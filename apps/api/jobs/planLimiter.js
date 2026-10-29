
import { prisma } from "../config/prismaClient.js";
import asyncHandler from "../middleware/asyncMiddleware.js";

function planLimiter(resource) {
  return asyncHandler(async (req, res, next) => {
    try {
      // Prefer the authenticated company, not a client-supplied ID.
      const companyId = req.company?.id || req.query.id;

      if (!companyId) {
        return res.status(401).json({
          message: "Company authentication required",
        });
      }

      const now = new Date();

      const subscription = await prisma.subscription.findFirst({
        where: {
          companyId,
          status: "ACTIVE",
          OR: [
            { endAt: null },
            { endAt: { gte: now } },
          ],
        },
        orderBy: {
          startedAt: "desc",
        },
        include: {
          plan: {
            include: {
              details: true,
            },
          },
        },
      });

      if (!subscription?.plan?.details) {
        return res.status(403).json({
          message: "No active subscription or plan limits configured",
        });
      }

      const { maxMember, maxOrder, balance: maxBalance } =
        subscription.plan.details;

      let current = 0;
      let limit = 0;

      switch (resource) {
        case "member": {
          current = await prisma.user.count({
            where: { memberOf: companyId },
          });

          limit = maxMember;

          if (current >= limit) {
            return res.status(403).json({
              message: `Member limit reached for ${subscription.plan.name}`,
              limit,
              current,
            });
          }

          break;
        }

        case "order": {
          current = await prisma.order.count({
            where: {
              orderOf: companyId,
              createdAt: {
                gte: subscription.startedAt,
              },
            },
          });

          limit = maxOrder;

          if (current >= limit) {
            return res.status(403).json({
              message: `Order limit reached for ${subscription.plan.name}`,
              limit,
              current,
            });
          }

          break;
        }

        case "balance": {
          const requestedAmount = Number(req.body?.balance);

          if (
            !Number.isSafeInteger(requestedAmount) ||
            requestedAmount <= 0
          ) {
            return res.status(400).json({
              message: "A positive integer balance amount is required",
            });
          }

          const wallet = await prisma.wallet.findUnique({
            where: { balanceOf: companyId },
            select: { balance: true },
          });

          current = wallet?.balance ?? 0;
          limit = maxBalance;

          if (current + requestedAmount > limit) {
            return res.status(403).json({
              message: `Wallet balance limit reached for ${subscription.plan.name}`,
              limit,
              current,
              requested: requestedAmount,
              remaining: Math.max(0, limit - current),
            });
          }

          break;
        }

        default:
          return res.status(400).json({
            message: `Unknown plan limit resource: ${resource}`,
          });
      }

      req.subscription = subscription;
      return next();
    } catch (error) {
      console.error("Plan limiter error:", error);

      return res.status(500).json({
        message: "Failed to check plan limits",
      });
    }
  });
}

export default planLimiter;
