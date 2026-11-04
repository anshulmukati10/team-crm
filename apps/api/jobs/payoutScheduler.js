
import cron from "node-cron";

import{ prisma} from "../config/prismaClient.js";

import {
  runScheduledCompanyPayout,
} from "../controller/payoutController.js";



const PAYOUT_CONFIG = {
  enabled: true,

  frequency: "EVERY_7_DAYS",

  time: "10:00",

  timezone: "Asia/Kolkata",

  weeklyDay: 1, 

  monthlyDay: 1,
};



function getCronExpression() {
  const [hour, minute] = PAYOUT_CONFIG.time.split(":");

  switch (PAYOUT_CONFIG.frequency) {

    case "DAILY":
      return `${minute} ${hour} * * *`;

    case "EVERY_7_DAYS":
      return `${minute} ${hour} * * ${PAYOUT_CONFIG.weeklyDay}`;

    case "MONTHLY":
      return `${minute} ${hour} ${PAYOUT_CONFIG.monthlyDay} * *`;

    default:
      throw new Error("Invalid payout frequency");
  }
}



async function getCompaniesForPayout() {

  const connectedAccounts =
    await prisma.stripeConnectedAccount.findMany({
      where: {
        payoutEnabled: true,
      },
      include: {
        company: true,
      },
    });

  return connectedAccounts;
}

async function executeScheduledPayouts() {

  console.log("Starting scheduled payouts...");

  try {

    const accounts = await getCompaniesForPayout();

    for (const account of accounts) {

      try {

        if (!account.company || !account.stripeAccountId) {
          continue;
        }

        const result = await runScheduledCompanyPayout({
          companyId: account.company.id,
          stripeAccountId: account.stripeAccountId,
          paymentMethod: "STRIPE",
        });

        console.log(
          `Payout result for ${account.company.id}:`,
          result
        );

      } catch (error) {

        console.error(
          `Payout failed for account ${account.id}:`,
          error.message
        );

      }
    }

    console.log("Scheduled payouts completed");

  } catch (error) {

    console.error("Payout scheduler error:", error);

  }
}



export function startPayoutScheduler() {

  if (!PAYOUT_CONFIG.enabled) {
    console.log("Payout scheduler disabled");
    return;
  }

  const expression = getCronExpression();

  cron.schedule(
    expression,
    async () => {
      await executeScheduledPayouts();
    },
    {
      timezone: PAYOUT_CONFIG.timezone,
    }
  );

}
