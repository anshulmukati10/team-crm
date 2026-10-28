import { prisma } from "../config/prismaClient.js";
import cron from 'node-cron'

export async function expireSubscriptionHandler() {
    const now = new Date()
    const expired = await prisma.subscription.findMany({
        where:
        {
            status: "ACTIVE",
            endAt: { lte: now }
        },
        select:
        {
            id: true,
            companyId: true
        }
    })

    for (const subscription of expired) {
        await prisma.$transaction(async (tx) => {
            const claimed = await tx.subscription.updateMany({
                where:
                {
                    id: subscription.id,
                    status: "ACTIVE",
                    endAt: { lte: now }
                },
                data:
                {
                    status: "EXPIRE",
                }
            })

            if (claimed.count === 0) return

            const active = await tx.subscription.findFirst({
                where:
                {
                    companyId: subscription.companyId,
                    status: "ACTIVE",
                    endAt: { gt: now }
                },
                orderBy:
                {
                    startedAt: "desc"
                }
            })
            if (active) {
                await tx.company.findMany({
                    where: {
                        id: subscription.companyId,
                    },
                    data:
                    {
                        planId: active.planId
                    }
                })
            }

            const freePlan = await tx.plan.findFirst({
                where:
                {
                    name: "Free",
                    price: 0,
                    type: "FREE",
                    isActive: true,
                },
                orderBy:
                {
                    createdAt: "asc"
                }
            })

            if (!freePlan) {
                throw new Error("Active Free plan not found");
            }
            
            await tx.company.updateMany({
                where:
                {
                    id: subscription.companyId
                },
                data:
                {
                    planId: freePlan.id
                }
            })
        })
    }

}


cron.schedule('*/5 * * * *', () => {
    expireSubscriptionHandler().catch((err) => {
        console.log(err)
    })
})