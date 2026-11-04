import { prisma } from "../../config/prismaClient.js";
import stripe from "../../config/stripe.js";
import { emitWorkspaceUpdate } from "../../config/socket.js";
import asyncHandler from "../../middleware/asyncMiddleware.js";

function getCompanyId(req, res) {
  const companyId = req.company?.id;
  if (!companyId) {
    res.status(401).json({ message: "Company authentication required" });
    return null;
  }
  return companyId;
}

export const getCompanyMembers = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req, res);
  if (!companyId) return;

  const members = await prisma.user.findMany({
    where: { memberOf: companyId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });

  return res.status(200).json({
    members,
    total: members.length,
  });
});

export const getCompanyWallet = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req, res);
  if (!companyId) return;

  const [wallet, subscription] = await Promise.all([
    prisma.wallet.findUnique({
      where: { balanceOf: companyId },
      select: { balance: true },
    }),
    prisma.subscription.findFirst({
      where: {
        companyId,
        status: "ACTIVE",
        OR: [{ endAt: null }, { endAt: { gte: new Date() } }],
      },
      orderBy: { startedAt: "desc" },
      select: {
        plan: {
          select: {
            name: true,
            details: { select: { balance: true } },
          },
        },
      },
    }),
  ]);

  return res.status(200).json({
    balance: wallet?.balance ?? 0,
    limit: subscription?.plan?.details?.balance ?? null,
    planName: subscription?.plan?.name ?? null,
  });
});

export const getCompanyStripeBalance = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req, res);
  if (!companyId) return;

  const connectedAccount = await prisma.stripeConnectedAccount.findUnique({
    where: { companyId },
    select: { stripeAccountId: true },
  });

  if (!connectedAccount) {
    return res.status(200).json({
      connected: false,
      available: [],
      pending: [],
    });
  }

  try {
    const balance = await stripe.balance.retrieve(
      {},
      { stripeAccount: connectedAccount.stripeAccountId },
    );

    return res.status(200).json({
      connected: true,
      available: balance.available.map(({ amount, currency }) => ({
        amount,
        currency,
      })),
      pending: balance.pending.map(({ amount, currency }) => ({
        amount,
        currency,
      })),
    });
  } catch (error) {
    console.error("Unable to retrieve connected Stripe balance:", error);
    return res.status(502).json({
      message: "Unable to retrieve the company's Stripe balance",
    });
  }
});

export const creditCompanyWallet = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req, res);
  if (!companyId) return;

  const balance = Number(req.body?.balance);
  if (!Number.isSafeInteger(balance) || balance <= 0) {
    return res.status(400).json({
      message: "Balance must be a positive integer",
    });
  }

  const wallet = await prisma.wallet.upsert({
    where: { balanceOf: companyId },
    update: { balance: { increment: balance } },
    create: { balanceOf: companyId, balance },
    select: { balance: true },
  });

  emitWorkspaceUpdate();

  return res.status(200).json({
    message: "Wallet balance added successfully",
    wallet,
  });
});

export const getCompanyOrders = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req, res);
  if (!companyId) return;

  const orders = await prisma.order.findMany({
    where: { orderOf: companyId },
    select: {
      id: true,
      total: true,
      status: true,
      createdAt: true,
      lead: { select: { name: true } },
      sales: { select: { name: true } },
      payment: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.status(200).json(orders);
});


export const getRecordings = asyncHandler(async (req, res) => {
  try {
    const id = req.company.id
    const recordings = await prisma.recordings.findMany({
      where: {
        companyId: id
      },
      orderBy: { date: "desc" },
      select:
      {
        id: true,
        url: true,
        date: true
      }
    })
   return res.json(recordings)
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: "server error in getting recording" })
  }
})