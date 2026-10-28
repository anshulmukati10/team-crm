import asyncHandler from "../middleware/asyncMiddleware.js"
import stripe from '../config/stripe.js'
import { prisma } from '../config/prismaClient.js'


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
        res.json({ client: paymentIntent.client_secret,amount : plan.price, currency : "usd", paymentId: payment.id })
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




export const stripeWebhookHandler = asyncHandler(async (req, res) => {
    let event;

    const signature = req.headers["stripe-signature"]
    console.log(signature)
    if (!signature) {
        console.log(signature)
        return res.status(400).send("Missing Stripe signature");
    }
    try {
        event = await stripe.webhooks.constructEvent(
            req.body, signature, process.env.STRIPE_WEBHOOK_SECRET
        )
    } catch (error) {
        console.log(error.message)
        return res.status(500).json({ message: `error at ${error}` })
    }
    try {
        const intent = event.data.object;
        if (event.type === 'payment_intent.succeeded') {
            const { paymentId, companyId, planId } = intent.metadata
            if (!paymentId) {
                return res.status(401).json({ message: "payment id is missing " })
            }

            const payment = await prisma.payment.findFirst({
                where:
                {
                    id: paymentId,
                    companyId,
                    planId,
                    stripeIntentsId: intent.id
                }

            })

            if (!payment) {
                return res.status(401).json({ message: " company payment not found " })
            }
            if (intent.amount !== payment.amount || intent.currency !== payment.currency) {
                return res.status(400).json({ message: " check curreny and amount " })
            }


            const result = await prisma.$transaction(async (tx) => {
                const currentPayment = await tx.payment.findFirst({
                    where: {
                        id: paymentId,
                    }
                })
                if (currentPayment.status === "SUCCESS") return res.json({ message: " payment already process ", alreadyProcessed: true })

                if (currentPayment.status !== "PENDING") return res.json({ message: " payment is not pending  solve issue or try again " })

                const plan = await tx.plan.findFirst({
                    where:
                    {
                        id: planId,
                        isActive: true,
                        type: "PRO",
                        price: { gt: 0 }
                    }
                })
                if (!plan) return res.json({ message: " plan not found " })

                const company = await tx.company.findUnique({
                    where:
                    {
                        id: companyId
                    }
                })
                if (!company ) return res.json({ message: " company not found " })

                const now = new Date() ;
                const end = new Date(now);
                end.setDate(end.getDate() + 30)

                await tx.payment.updateMany({
                    where :
                    {
                        id : paymentId
                    },
                    data :
                    {
                        status : "SUCCESS"
                    }
                })


                await tx.subscription.updateMany({ 
                    where :{
                       companyId,
                    },
                    data :
                    {
                        status : "CANCEL",
                        endAt : now ,
                        canceledAt : now , 
                    }
                })

                const subscription =   await tx.subscription.create({
                    data :
                    {
                        companyId : company.id,
                        planId : plan.id,
                        endAt : end ,
                        createdAt : now
                    }
                })

                await tx.company.update({
                    where: { id: companyId },
                    data: { planId: plan.id }
                })

                return {
                    alreadyProcessed : false ,
                    subscriptionId : subscription.id,
                    endAt :end 
                }

            })

            return res.json({ message : (result.alreadyProcessed) ? " payment already processed " : " new subscription created " , ...result })

        }

        if (event.type === 'payment_intent.payment_failed') {
            const {paymentId , companyId , planId } = intent.metadata?.paymentId;
            const failedPayment = await prisma.payment.updateMany({
                where:
                {
                    id: paymentId,
                    stripeIntentsId: intent.id,
                    companyId,
                    planId,
                    status: 'PENDING'
                },
                data:
                {
                    status: 'FAIL'
                }
            })
            return res.status(200).json({ message: `PAYMENT ${failedPayment.status}` , count : failedPayment.count })
        }
        return res.sendStatus(200);
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: `Error ${err.message}` })
    }
})