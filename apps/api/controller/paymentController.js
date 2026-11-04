import asyncHandler from "../middleware/asyncMiddleware.js"
import stripe from '../config/stripe.js'
import { prisma } from '../config/prismaClient.js'
import { settleOrderPaymentIntent } from './saleController.js'

async function activatePaidSubscription(intent, expectedCompanyId) {
    const { paymentId, companyId, planId } = intent.metadata ?? {};
    if (!paymentId || !companyId || !planId) {
        const error = new Error("Payment metadata is incomplete");
        error.status = 400;
        throw error;
    }

    if (expectedCompanyId && companyId !== expectedCompanyId) {
        const error = new Error("Payment does not belong to this company");
        error.status = 403;
        throw error;
    }

    const payment = await prisma.payment.findFirst({
        where: {
            id: paymentId,
            companyId,
            planId,
            stripeIntentsId: intent.id
        }
    });

    if (!payment) {
        const error = new Error("Payment record not found");
        error.status = 404;
        throw error;
    }
    if (intent.amount !== payment.amount || intent.currency !== payment.currency) {
        const error = new Error("Payment amount or currency does not match");
        error.status = 400;
        throw error;
    }

    return prisma.$transaction(async (tx) => {
        const claimedPayment = await tx.payment.updateMany({
            where: {
                id: paymentId,
                companyId,
                planId,
                stripeIntentsId: intent.id,
                status: { in: ["PENDING", "FAIL"] }
            },
            data: { status: "SUCCESS" }
        });

        if (claimedPayment.count === 0) {
            const currentPayment = await tx.payment.findUnique({
                where: { id: paymentId },
                select: { status: true }
            });

            return {
                alreadyProcessed: currentPayment?.status === "SUCCESS",
                notEligible: currentPayment?.status !== "SUCCESS"
            };
        }

        const plan = await tx.plan.findFirst({
            where: {
                id: planId,
                isActive: true,
                type: "PRO",
                price: { gt: 0 }
            }
        });
        if (!plan) {
            throw new Error("The paid plan is no longer active");
        }

        const company = await tx.company.findUnique({
            where: { id: companyId }
        });
        if (!company) {
            throw new Error("The company for this payment was not found");
        }

        const now = new Date();
        const end = new Date(now);
        end.setDate(end.getDate() + 30);

        await tx.subscription.updateMany({
            where: { companyId },
            data: {
                status: "CANCEL",
                endAt: now,
                canceledAt: now,
            }
        });

        const subscription = await tx.subscription.create({
            data: {
                companyId: company.id,
                planId: plan.id,
                endAt: end,
                createdAt: now
            }
        });

        await tx.company.update({
            where: { id: companyId },
            data: { planId: plan.id }
        });

        return {
            alreadyProcessed: false,
            notEligible: false,
            subscriptionId: subscription.id,
            endAt: end
        };
    });
}

export const paymentAccept = asyncHandler(async (req, res) => {
    let payment;

    try {
        const companyId = req.company?.id
        const { planId } = req.body;

        if (!planId) return res.status(401).json({ message: " plan id required" });

        if (!companyId) return res.status(401).json({ message: " company  id required" });

        const plan = await prisma.plan.findFirst(
            {
                where:
                {
                    id: String(planId),
                    isActive: true,
                }
            }
        )

        if (!plan) return res.status(401).json({ message: " plan not found " });

        if (plan.type !== "PRO" || plan.price <= 0) {
            return res.status(401).json({ message: "choose a paid plan  " });
        }



        payment = await prisma.payment.create({
            data:
            {

                amount: plan.price,
                currency: "usd",
                companyId,
                planId: String(planId)
            }
        })



        const paymentIntent = await stripe.paymentIntents.create({
            amount: plan.price,
            currency: "usd",
            automatic_payment_methods: { enabled: true },
            metadata: {
                paymentId: payment.id,
                companyId,
                planId: String(planId),
                purpose: 'team-crm'
            },
        }, {
            idempotencyKey: `team-crm${payment.id}`
        }
        )

        await prisma.payment.updateMany({
            where:
            {
                id: payment.id
            },
            data:
            {
                stripeIntentsId: paymentIntent.id
            }
        })
        res.json({ client: paymentIntent.client_secret, amount: plan.price, currency: "usd", paymentId: payment.id })
    } catch (error) {
        console.error("Unable to create demo payment:", error.message);

        if (payment?.id) {
            try {
                await prisma.payment.delete({
                    where: { id: payment.id },
                });
            } catch (cleanupError) {
                console.error("Payment cleanup failed:", cleanupError.message);
            }
        }

        return res.status(error.status || 500).json({
            message:
                error.status === 401
                    ? "Authentication required"
                    : "Unable to initialize payment",
        });
    }
})

export const confirmPayment = asyncHandler(async (req, res) => {
    const companyId = req.company?.id;
    const { paymentId } = req.body;

    if (!companyId || !paymentId) {
        return res.status(400).json({ message: "paymentId is required" });
    }

    try {
        const payment = await prisma.payment.findFirst({
            where: { id: paymentId, companyId }
        });
        if (!payment?.stripeIntentsId) {
            return res.status(404).json({ message: "Payment record not found" });
        }

        const intent = await stripe.paymentIntents.retrieve(payment.stripeIntentsId);
        if (intent.status !== "succeeded") {
            return res.status(409).json({ message: "Payment has not succeeded" });
        }

        const result = await activatePaidSubscription(intent, companyId);
        if (result.notEligible) {
            return res.status(409).json({ message: "Payment is not eligible for processing" });
        }

        return res.status(200).json({
            message: result.alreadyProcessed
                ? "Payment was already processed"
                : "Subscription activated",
            subscriptionId: result.subscriptionId
        });
    } catch (error) {
        console.error("Unable to confirm payment:", error);
        return res.status(error.status || 500).json({
            message: error.status ? error.message : "Unable to activate subscription"
        });
    }
});



export const stripeWebhookHandler = asyncHandler(async (req, res) => {
    let event;
    

 // log 
    // console.log("Signature exists:", !!signature);
    // console.log("Body is Buffer:", Buffer.isBuffer(req.body));
    // console.log(signature)

        const signature = req.headers["stripe-signature"];



    if (!signature) {
        return res.status(400).send("Missing Stripe signature");
    }
    try {
        event = await stripe.webhooks.constructEvent(
            req.body, signature, process.env.STRIPE_WEBHOOK_SECRET
        )


        //  log

        //   console.log("Verified event:", event.type);
        // console.log("Event ID:", event.id);

        
    } catch (error) {
        console.log(error.message)
        return res.status(500).json({ message: `error at ${error}` })
    }
    try {
        const intent = event.data.object;
        if (event.account) {
            if (event.type.startsWith("payout.")) {
                const payoutStatus = {
                    pending: "PENDING",
                    in_transit: "PROCESS",
                    paid: "ARRIVED",
                    failed: "FAIL",
                    canceled: "FAIL",
                }[intent.status];

                if (!payoutStatus) {
                    return res.sendStatus(200);
                }

                const payoutWhere = {
                    stripeAccountId: event.account,
                    OR: [{ stripePayoutId: intent.id }],
                };
                if (intent.metadata?.internalPayoutId) {
                    payoutWhere.OR.push({ id: intent.metadata.internalPayoutId });
                }

                const updated = await prisma.payout.updateMany({
                    where: payoutWhere,
                    data: {
                        stripePayoutId: intent.id,
                        status: payoutStatus,
                        destination:
                            typeof intent.destination === "string"
                                ? intent.destination
                                : intent.destination?.id || null,
                        arrival_date: intent.arrival_date
                            ? new Date(intent.arrival_date * 1000)
                            : null,
                    },
                });

                if (!updated.count) {
                    console.warn(
                        `No internal payout matched Stripe payout ${intent.id}`
                    );
                }
                return res.sendStatus(200);
            }

            if (
                intent.metadata?.purpose === "order_payment" &&
                ["payment_intent.succeeded", "payment_intent.payment_failed"].includes(event.type)
            ) {
                const result = await settleOrderPaymentIntent(intent, event.account)
                return res.status(200).json({
                    message: result.alreadyProcessed
                        ? "Order payment was already processed"
                        : "Order payment updated"
                })
            }
            return res.sendStatus(200)
        }

        if (event.type === 'payment_intent.succeeded') {
            const result = await activatePaidSubscription(intent);

            if (result.alreadyProcessed) {
                return res.status(200).json({
                    message: "Payment was already processed",
                    alreadyProcessed: true
                });
            }
            if (result.notEligible) {
                return res.status(200).json({
                    message: "Payment is not eligible for processing"
                });
            }

            return res.status(200).json({
                message: "Subscription created",
                subscriptionId: result.subscriptionId,
                endAt: result.endAt
            });

        }

        if (event.type === 'payment_intent.payment_failed') {
            const { paymentId, companyId, planId } = intent.metadata ?? {};
            if (!paymentId || !companyId || !planId) {
                return res.status(400).json({ message: "Payment metadata is incomplete" });
            }

            const failedPayment = await prisma.payment.updateMany({
                where: {
                    id: paymentId,
                    stripeIntentsId: intent.id,
                    companyId,
                    planId,
                    status: 'PENDING'
                },
                data: { status: 'FAIL' }
            });

            return res.status(200).json({
                message: failedPayment.count
                    ? "Payment attempt marked as failed; it may still be retried"
                    : "No pending payment matched",
                count: failedPayment.count
            });
        }
        return res.sendStatus(200);
    } catch (err) {
        console.error("Stripe webhook processing failed:", err);
        return res.status(500).json({ message: `Error ${err.message}` })
    }
})