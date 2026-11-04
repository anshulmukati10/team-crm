
import stripe from "../config/stripe.js";
import { prisma } from "../config/prismaClient.js";

const FRONTEND_URL = process.env.FRONTEND_URL;
const V2_ACCOUNT_TYPE = "EXPRESS_V2";

if (!FRONTEND_URL) {
    throw new Error("FRONTEND_URL is not configured");
}

export async function retrieveConnectedAccountStatus(connectedAccount) {
    if (connectedAccount.accountType !== V2_ACCOUNT_TYPE) {
        const account = await stripe.accounts.retrieve(
            connectedAccount.stripeAccountId
        );
        return {
            country: account.country,
            currency: account.default_currency,
            chargesEnabled: account.charges_enabled,
            payoutEnabled: account.payouts_enabled,
            detailsSubmitted: account.details_submitted,
        };
    }

    const account = await stripe.v2.core.accounts.retrieve(
        connectedAccount.stripeAccountId,
        {
            include: ["configuration.merchant", "identity", "defaults", "requirements"],
        }
    );
    const merchant = account.configuration?.merchant;
    const chargesEnabled =
        merchant?.capabilities?.card_payments?.status === "active";
    const payoutEnabled =
        merchant?.capabilities?.stripe_balance?.payouts?.status === "active";
    const detailsSubmitted = !account.requirements?.entries?.some(
        (requirement) => requirement.awaiting_action_from === "user"
    );

    return {
        country: account.identity?.country,
        currency: account.defaults?.currency,
        chargesEnabled,
        payoutEnabled,
        detailsSubmitted,
    };
}

export const createConnectedAccount = async (company) => {
    if (!company?.id || !company?.email || !company?.name) {
        throw new Error("Valid company details are required");
    }

    let connectedAccount = await prisma.stripeConnectedAccount.findUnique({
        where: { companyId: company.id },
    });

    
    if (!connectedAccount) {
        const account = await stripe.v2.core.accounts.create(
            {
                contact_email: company.email,
                display_name: company.name,
                identity: {
                    country: "US",
                    entity_type: "company",
                    business_details: {
                        registered_name: company.name,
                    },
                },
                configuration: {
                    merchant: {
                        capabilities: {
                            card_payments: { requested: true },
                        },
                    },
                },
                defaults: {
                    currency: "usd",
                    // Express accounts require the platform to collect fees and cover account losses.
                    responsibilities: {
                        fees_collector: "application",
                        losses_collector: "application",
                    },
                },
                dashboard: "express",
                metadata: {
                    companyId: company.id,
                    platform: "team-crm",
                },
                include: [
                    "configuration.merchant",
                    "identity",
                    "defaults",
                    "requirements",
                ],
            },
            {
                idempotencyKey: `team-crm-connect-v2-${company.id}`,
            }
        );

        connectedAccount = await prisma.stripeConnectedAccount.create({
            data: {
                companyId: company.id,
                stripeAccountId: account.id,
                accountType: V2_ACCOUNT_TYPE,
                country: "US",
                currency: "usd",
                status: "PENDING",
            },
        });
    }

    const accountStatus = await retrieveConnectedAccountStatus(connectedAccount);

    connectedAccount = await prisma.stripeConnectedAccount.update({
        where: { companyId: company.id },
        data: {
            chargesEnabled: accountStatus.chargesEnabled,
            payoutEnabled: accountStatus.payoutEnabled,
            detailsSubmitted: accountStatus.detailsSubmitted,
            status:
                accountStatus.chargesEnabled &&
                accountStatus.payoutEnabled
                    ? "ACTIVE"
                    : "PENDING",
        },
    });

    const accountLink =
        connectedAccount.accountType === V2_ACCOUNT_TYPE
            ? await stripe.v2.core.accountLinks.create({
                  account: connectedAccount.stripeAccountId,
                  use_case: {
                      type: "account_onboarding",
                      account_onboarding: {
                          refresh_url: `${FRONTEND_URL}/company/stripe/refresh`,
                          return_url: `${FRONTEND_URL}/company/stripe/return`,
                      },
                  },
              })
            : await stripe.accountLinks.create({
                  account: connectedAccount.stripeAccountId,
                  refresh_url: `${FRONTEND_URL}/company/stripe/refresh`,
                  return_url: `${FRONTEND_URL}/company/stripe/return`,
                  type: "account_onboarding",
              });

    return {
        connectedAccount,
        onboardingUrl: accountLink.url,
    };
};


export const createStripeAccount = createConnectedAccount;
