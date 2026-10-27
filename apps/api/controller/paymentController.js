import asyncHandler from "../middleware/asyncMiddleware.js"
import stripe from '../config/stripe.js'
import { prisma }from '../config/prismaClient.js'


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