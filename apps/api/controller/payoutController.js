import stripe from "../config/stripe.js";
import { prisma } from "../config/prismaClient.js";
import asyncHandler from "../middleware/asyncMiddleware.js";
import { randomUUID } from "node:crypto";

async function createCompanyPayout({
    companyId,
    stripeAccountId,
    paymentMethod,
    source = "AUTOMATIC_SCHEDULER",
}) {
    let record;

    try {
        if (!companyId || !stripeAccountId) {
            throw new Error("Company and Stripe account are required");
        }

        const balance = await stripe.balance.retrieve(
            {},
            { stripeAccount: stripeAccountId }
        );

        const available =
            balance.available.find(
                (item) => item.currency === "usd" && item.amount > 0
            ) || balance.available.find((item) => item.amount > 0);

        if (!available || available.amount <= 0) {
            return {
                success: false,
                message: "Insufficient available balance",
            };
        }

        const amountInCents = available.amount;
        const currencyExponent = new Intl.NumberFormat("en", {
            style: "currency",
            currency: available.currency.toUpperCase(),
        }).resolvedOptions().maximumFractionDigits;
        const amount = (amountInCents / 10 ** currencyExponent).toFixed(
            currencyExponent
        );


        const idempotencyKey =
            source === "AUTOMATIC_SCHEDULER"
                ? `scheduled-payout-${companyId}-${new Date()
                    .toISOString()
                    .slice(0, 10)}`
                : `company-payout-${companyId}-${randomUUID()}`;


        record = await prisma.payout.create({
            data: {
                paidBy: companyId,
                stripeAccountId,
                amount,
                currency: available.currency,
                status: "PENDING",
                paymentMethod: paymentMethod || "STRIPE",
                description:
                    source === "AUTOMATIC_SCHEDULER"
                        ? "Scheduled company payout"
                        : "Company payout",
                metadata: {
                    source,
                    idempotencyKey,
                },
            },
        });


        const stripePayout = await stripe.payouts.create(
            {
                amount: amountInCents,
                currency: available.currency,
                method: "standard",
                metadata: {
                    companyId,
                    internalPayoutId: record.id,
                },
            },
            {
                stripeAccount: stripeAccountId,
                idempotencyKey,
            }
        );


        const savedPayout = await prisma.payout.update({
            where: { id: record.id },
            data: {
                stripePayoutId: stripePayout.id,
                status: "PENDING",
                destination:
                    stripePayout.destination || null,
                arrival_date: stripePayout.arrival_date
                    ? new Date(stripePayout.arrival_date * 1000)
                    : null,
            },
        });

        return {
            success: true,
            message: "Payout created successfully",
            payout: savedPayout,
        };

    } catch (error) {

        if (record) {
            await prisma.payout.update({
                where: { id: record.id },
                data: {
                    status: "FAIL",
                    metadata: {
                        error: error.message,
                        source,
                    },
                },
            }).catch(console.error);
        }

        console.error("Payout creation failed:", error);

        throw error;
    }
}

export const runScheduledCompanyPayout = createCompanyPayout;

export const requestCompanyPayout = asyncHandler(async (req, res) => {
    const companyId = req.company?.id;

    if (!companyId) {
        return res.status(401).json({ message: "Company authentication required" });
    }

    const connectedAccount = await prisma.stripeConnectedAccount.findUnique({
        where: { companyId },
        select: { stripeAccountId: true, payoutEnabled: true },
    });

    if (!connectedAccount?.stripeAccountId) {
        return res.status(400).json({
            message: "A Stripe account must be connected before requesting a payout",
        });
    }

    if (!connectedAccount.payoutEnabled) {
        return res.status(409).json({
            message: "Payouts are not enabled for this Stripe account",
        });
    }

    try {
        const result = await createCompanyPayout({
            companyId,
            stripeAccountId: connectedAccount.stripeAccountId,
            paymentMethod: "STRIPE",
            source: "MANUAL",
        });

        return res.status(result.success ? 201 : 409).json(result);
    } catch (error) {
        const isStripeError =
            typeof error.type === "string" && error.type.startsWith("Stripe");
        return res.status(isStripeError ? 502 : 500).json({
            message: isStripeError
                ? "Stripe could not create the payout"
                : "Failed to create payout",
        });
    }
});

export const getCompanyPayoutHistory = asyncHandler(async (req, res) => {
    const companyId = req.company?.id;

    if (!companyId) {
        return res.status(401).json({ message: "Company authentication required" });
    }

    const requestedPage = Number(req.query.page ?? 1);
    const requestedPageSize = Number(req.query.pageSize ?? 20);

    if (
        !Number.isInteger(requestedPage) ||
        requestedPage < 1 ||
        !Number.isInteger(requestedPageSize) ||
        requestedPageSize < 1 ||
        requestedPageSize > 100
    ) {
        return res.status(400).json({
            message: "Page must be positive and pageSize must be between 1 and 100",
        });
    }

    const where = { paidBy: companyId };
    const [payouts, total] = await Promise.all([
        prisma.payout.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (requestedPage - 1) * requestedPageSize,
            take: requestedPageSize,
        }),
        prisma.payout.count({ where }),
    ]);

    return res.status(200).json({
        payouts,
        page: requestedPage,
        pageSize: requestedPageSize,
        total,
        totalPages: Math.ceil(total / requestedPageSize),
    });
});
