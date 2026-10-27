import asyncHandler from "../middleware/asyncMiddleware.js"
import stripe from '../config/stripe.js'
import { prisma } from '../config/prismaClient.js'


export const paymentAccept = asyncHandler(async (req, res) => {
    let payment;

    try {
        const { amount, currency } = req.body;


        const userId = Number.parseInt(req.user.id)

        payment = await prisma.payment.create({
            data:
            {
                userId: userId,
                amount: amount,
                currency: currency,
            }
        })



        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: currency,
            automatic_payment_methods: { enabled: true },
            metadata: {
                paymentId: payment.id,
                userId: userId,
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
        res.json({ client: paymentIntent.client_secret, amount, currency, paymentId: payment.id })
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
    if (!signature) 
    {   
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
            const paymentId = intent.metadata?.paymentId
            if (!paymentId) {
                return res.status(401).json({ message: "payment id is missing " })
            }
            const payment = await prisma.payment.findFirst({
                where:
                {
                    id: paymentId,
                    stripeIntentsId: intent.id
                }

            })
            if (!payment) {
                return res.status(401).json({ message: "payment not found " })
            }

            await prisma.payment.updateMany({
                where:
                {
                    id: paymentId,
                    stripeIntentsId: intent.id,
                    status: { not: 'SUCCESS' }
                },
                data: {
                    status: 'SUCCESS'
                }
            }
            )
            console.log(payment.status)
            return res.status(200).json({ message: `PAYMENT ${payment.status}` })
        }

        if (event.type === 'payment_intent.payment_failed') {
            const paymentId = intent.metadata?.paymentId;
            const payment = await prisma.payment.updateMany({
                where:
                {
                    id: paymentId,
                    stripeIntentsId: intent.id,
                    status: 'PENDING'
                },
                data:
                {
                    status: 'FAIL'
                }
            })
            console.log(payment.status)
            return res.status(200).json({ message: `PAYMENT ${payment.status}` })
        }
        return res.sendStatus(200);
    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: `Error ${err.message}` })

    }
})