import { prisma } from "../config/prismaClient.js";
import asyncHandler from "../middleware/asyncMiddleware.js";

export async function planLimiter(resource) {
   return  asyncHandler(async (req, res , next ) => {
        const now = new Date()

        try {
            const id = req.company?.id

            const companyId = id

            if (!companyId) {
                return res.status(401).json({
                    message: "Company authentication required"
                });
            }

            const subscription = await prisma.subscription.findFirst({
                where:
                {
                    companyId,
                    status: "ACTIVE",
                    OR: [
                        { endAt: null },
                        { endAt: { gte: now } }
                    ]
                },
                orderBy:
                {
                    startedAt: "desc",
                },
                include:
                {
                    plan:
                    {
                        include: {
                            details: true,
                        }
                    }
                }
            })

            if (!subscription?.plan?.details) {
                return res.status(401).json({ message: "plan details not found " })
            }


            const { maxOrder, maxMember, maxWallet } = subscription.plan.details

            let count;
            let max;

            switch (resource) {
                case "member":
                    count = await prisma.user.count({
                        where: {
                            memberOf: companyId
                        }
                    })

                    max = maxMember
                    break;

                case "order":
                    count = await prisma.order.count({
                        where: {
                            orderOf: companyId,
                            createdAt:
                            {
                                gte: subscription.startedAt
                            }
                        },

                    })

                    max = maxOrder
                    break;

                case "wallet":
                    count = await prisma.wallet.count({
                        where: {
                            balanceOf: companyId
                        }
                    })

                    max = maxWallet
                    break;

                default:
                    return res.status(500).json({
                        message: "Unknown plan limit"
                    });
            }
            if (count >= max) {
                return res.status(403).json({
                    message: `${resource} limit reached for your ${subscription.plan.name} plan`,
                    limit: max,
                    current: count
                });
            }

            req.subscription = subscription;
            next()
        } catch (error) {
            console.log(error.message)
            return res.status(500).json({ message: "plan limit error" })
        }

    })
}