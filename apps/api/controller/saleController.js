import { prisma } from '../config/prismaClient.js'
import asyncHandler from '../middleware/asyncMiddleware.js'
import { emitWorkspaceUpdate } from '../config/socket.js'
import stripe from '../config/stripe.js'
import { randomUUID } from 'node:crypto'
import { retrieveConnectedAccountStatus } from '../services/stripeConnectService.js'

function paymentError(message, status = 400) {
    const error = new Error(message)
    error.status = status
    return error
}

async function getChargeReadyAccount(companyId) {
    const connectedAccount = await prisma.stripeConnectedAccount.findUnique({
        where: { companyId }
    })
    if (!connectedAccount) {
        throw paymentError("This company has not connected a Stripe account", 409)
    }

    let accountStatus
    try {
        accountStatus = await retrieveConnectedAccountStatus(connectedAccount)
    } catch (error) {
        console.error("Unable to retrieve connected Stripe account:", error)
        throw paymentError("Unable to verify the company's Stripe account", 502)
    }

    await prisma.stripeConnectedAccount.update({
        where: { companyId },
        data: {
            chargesEnabled: accountStatus.chargesEnabled,
            payoutEnabled: accountStatus.payoutEnabled,
            detailsSubmitted: accountStatus.detailsSubmitted,
            status: accountStatus.chargesEnabled ? "ACTIVE" : "PENDING"
        }
    })

    if (!accountStatus.chargesEnabled) {
        throw paymentError("The company must finish Stripe onboarding before accepting payments", 409)
    }

    return connectedAccount.stripeAccountId
}

async function createOrRetrieveOrderPaymentIntent(payment) {
    let intent
    if (payment.stripePaymentIntentId) {
        intent = await stripe.paymentIntents.retrieve(
            payment.stripePaymentIntentId,
            {},
            { stripeAccount: payment.stripeAccountId }
        )
    } else {
        intent = await stripe.paymentIntents.create(
            {
                amount: payment.amount,
                currency: payment.currency,
                metadata: {
                    purpose: "order_payment",
                    orderPaymentId: payment.id,
                    orderId: payment.orderId,
                    companyId: payment.companyId
                }
            },
            {
                stripeAccount: payment.stripeAccountId,
                idempotencyKey: `team-crm-order-payment-v2-${payment.id}`
            }
        )

        await prisma.orderPayment.update({
            where: { id: payment.id },
            data: { stripePaymentIntentId: intent.id }
        })
    }

    return intent
}

export async function settleOrderPaymentIntent(intent, stripeAccountId) {
    const { orderPaymentId, orderId, companyId, purpose } = intent.metadata ?? {}
    if (
        purpose !== "order_payment" ||
        !orderPaymentId ||
        !orderId ||
        !companyId ||
        !stripeAccountId
    ) {
        throw paymentError("Order payment metadata is incomplete", 400)
    }

    const payment = await prisma.orderPayment.findUnique({
        where: { id: orderPaymentId }
    })
    if (
        !payment ||
        payment.orderId !== orderId ||
        payment.companyId !== companyId ||
        payment.stripeAccountId !== stripeAccountId ||
        payment.stripePaymentIntentId !== intent.id
    ) {
        throw paymentError("Order payment does not match this connected account", 404)
    }
    if (intent.amount !== payment.amount || intent.currency !== payment.currency) {
        throw paymentError("Order payment amount or currency does not match", 400)
    }

    const isSucceeded = intent.status === "succeeded"
    const result = await prisma.orderPayment.updateMany({
        where: {
            id: payment.id,
            stripeAccountId,
            stripePaymentIntentId: intent.id,
            status: isSucceeded ? { in: ["PENDING", "FAIL"] } : "PENDING"
        },
        data: { status: isSucceeded ? "SUCCESS" : "FAIL" }
    })

    if (result.count === 0) {
        const currentPayment = await prisma.orderPayment.findUnique({
            where: { id: payment.id },
            select: { status: true }
        })
        if (isSucceeded && currentPayment?.status !== "SUCCESS") {
            throw paymentError("Order payment is not eligible for confirmation", 409)
        }
    } else {
        emitWorkspaceUpdate()
    }

    return { alreadyProcessed: result.count === 0 }
}

export const getSalesLeads = asyncHandler(async (req, res) => {
    try {
        const userId = Number(req.user?.id)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true }
        })
        if (!user) return res.status(401).json({ message: "User not found" })
        if (user.role !== 'SALES') return res.status(403).json({ message: "Not authorized to view sales leads" })

        const leads = await prisma.lead.findMany({
            where: { salesId: user.id },
            select: { id: true, name: true, phone: true, status: true },
            orderBy: { id: 'desc' }
        })
        return res.status(200).json(leads)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: "Unable to load assigned leads" })
    }
})

export const getSalesOrders = asyncHandler(async (req, res) => {
    try {
        const userId = Number(req.user?.id)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true }
        })
        if (!user) return res.status(401).json({ message: "User not found" })
        if (user.role !== 'SALES') return res.status(403).json({ message: "Not authorized to view sales orders" })

        const orders = await prisma.order.findMany({
            where: { salesId: user.id },
            select: {
                id: true,
                total: true,
                status: true,
                createdAt: true,
                payment: { select: { status: true } }
            },
            orderBy: { createdAt: 'desc' }
        })
        return res.status(200).json(orders)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: "Unable to load sales orders" })
    }
})

// export const requestStockImport =  asyncHandler( async ( req , res ) => {
//     try {
//         const { id } = req.user


//     } catch (error) {
//         return res.status(500).json({message : " server error in req stock "})
//     }
// })


/* #swagger.tags = ['Sales'] */

export const createOrder = asyncHandler(async (req, res) => {
    try {
        const { id } = req.user;
        const numericID = Number(id);

        if (!id) {
            return res.status(401).json({ message: "id is required" })
        }
        const salesUser = await prisma.user.findUnique({ where: { id: numericID } })
        if (!salesUser) {
            return res.status(401).json({ message: " user not found " })
        }
        if (salesUser.role !== 'SALES') {
            return res.status(403).json({ message: " not authorized as sales " })
        }
        if (!salesUser.memberOf) {
            return res.status(403).json({ message: "Sales user is not assigned to a company" })
        }
        const { leadId, orderItems } = req.body
        const idempotencyKey = req.get("Idempotency-Key") || req.body.idempotencyKey || randomUUID()
        if (typeof idempotencyKey !== "string" || idempotencyKey.length > 255) {
            return res.status(400).json({ message: "Invalid order idempotency key" })
        }
        if (typeof leadId !== 'string' || !leadId.trim()) {
            return res.status(400).json({ message: " lead id is required " })
        }
        if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
            return res.status(401).json({ message: " invalid product list  " })
        }
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, salesId: numericID },
            select: { id: true }
        })
        if (!lead) {
            return res.status(404).json({ message: "Lead not found in your assignments" })
        }

        const existingPayment = await prisma.orderPayment.findUnique({
            where: { idempotencyKey },
            include: { order: true }
        })
        if (existingPayment) {
            if (
                existingPayment.order.salesId !== numericID ||
                existingPayment.companyId !== salesUser.memberOf
            ) {
                return res.status(409).json({ message: "Idempotency key was already used" })
            }
            if (existingPayment.status === "SUCCESS") {
                return res.status(200).json({
                    orderId: existingPayment.orderId,
                    amount: existingPayment.order.total,
                    currency: existingPayment.currency,
                    paymentStatus: existingPayment.status,
                    alreadyPaid: true
                })
            }
            const intent = await createOrRetrieveOrderPaymentIntent(existingPayment)
            return res.status(200).json({
                orderId: existingPayment.orderId,
                clientSecret: intent.client_secret,
                stripeAccountId: existingPayment.stripeAccountId,
                amount: existingPayment.order.total,
                currency: existingPayment.currency,
                paymentStatus: existingPayment.status
            })
        }

        const stripeAccountId = await getChargeReadyAccount(salesUser.memberOf)
        let totalPrice = 0;
        const lineItems = [];
        for (const item of orderItems) {
            if (
                !item ||
                typeof item.productId !== "string" ||
                !Number.isSafeInteger(item.quantity) ||
                item.quantity < 1
            ) {
                return res.status(400).json({ message: "Each item needs a product ID and positive whole-number quantity" })
            }
            const product = await prisma.product.findUnique({ where: { id: item.productId } })
            if (!product) {
                return res.status(400).json({ message: ` product not found for id ${item.productId}` })
            }
            if (item.quantity > product.stock) {
                return res.status(409).json({ message: `Insufficient stock for product ${product.id}` })
            }
            if (product.price < 0) {
                return res.status(400).json({ message: "Product price cannot be negative" })
            }
            totalPrice += product.price * item.quantity
            if (!Number.isSafeInteger(totalPrice) || totalPrice * 100 > 99999999) {
                return res.status(400).json({ message: "Order total is outside Stripe's supported amount range" })
            }
            lineItems.push({
                quantity: item.quantity,
                price: product.price,
                productId: product.id
            })
        }
        if (totalPrice <= 0 || totalPrice * 100 < 50) {
            return res.status(400).json({ message: "Order total must be at least $0.50 to use Stripe card payments" })
        }

        let orderPayment
        try {
            orderPayment = await prisma.$transaction(async (tx) => {
                const order = await tx.order.create({
                    data: {
                        total: totalPrice,
                        leadId,
                        salesId: numericID,
                        orderOf: salesUser.memberOf,
                        orderItems: { create: lineItems },
                        payment: {
                            create: {
                                companyId: salesUser.memberOf,
                                stripeAccountId,
                                amount: totalPrice * 100,
                                currency: "usd",
                                idempotencyKey
                            }
                        }
                    },
                    include: { payment: true }
                })
                return order.payment
            })
        } catch (error) {
            if (error.code === "P2002") {
                const existing = await prisma.orderPayment.findUnique({
                    where: { idempotencyKey },
                    include: { order: true }
                })
                if (existing?.order.salesId === numericID) {
                    const intent = await createOrRetrieveOrderPaymentIntent(existing)
                    return res.status(200).json({
                        orderId: existing.orderId,
                        clientSecret: intent.client_secret,
                        stripeAccountId: existing.stripeAccountId,
                        amount: existing.order.total,
                        currency: existing.currency,
                        paymentStatus: existing.status
                    })
                }
                if (existing) {
                    return res.status(409).json({ message: "Idempotency key was already used" })
                }
            }
            throw error
        }

        const intent = await createOrRetrieveOrderPaymentIntent(orderPayment)
        emitWorkspaceUpdate()
        return res.status(201).json({
            message: "Order created; complete the card payment",
            orderId: orderPayment.orderId,
            clientSecret: intent.client_secret,
            stripeAccountId,
            amount: totalPrice,
            currency: "usd",
            paymentStatus: orderPayment.status
        })
    } catch (error) {
        console.error("Unable to create order payment:", error)
        return res.status(error.status || 500).json({
            message: error.status ? error.message : "Unable to create order and payment"
        })
    }
})

export const getOrderPaymentIntent = asyncHandler(async (req, res) => {
    try {
        const userId = Number(req.user?.id)
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user || user.role !== "SALES") {
            return res.status(403).json({ message: "Sales authorization required" })
        }
        if (!user.memberOf) {
            return res.status(403).json({ message: "Sales user is not assigned to a company" })
        }

        const payment = await prisma.orderPayment.findFirst({
            where: {
                orderId: req.params.id,
                companyId: user.memberOf,
                order: { salesId: userId }
            },
            include: { order: true }
        })
        if (!payment) {
            return res.status(404).json({ message: "Order payment not found" })
        }
        if (payment.status === "SUCCESS") {
            return res.status(200).json({
                orderId: payment.orderId,
                paymentStatus: payment.status,
                alreadyPaid: true
            })
        }

        const intent = await createOrRetrieveOrderPaymentIntent(payment)
        return res.status(200).json({
            orderId: payment.orderId,
            clientSecret: intent.client_secret,
            stripeAccountId: payment.stripeAccountId,
            amount: payment.order.total,
            currency: payment.currency,
            paymentStatus: payment.status
        })
    } catch (error) {
        console.error("Unable to load order payment:", error)
        return res.status(500).json({ message: "Unable to load order payment" })
    }
})

export const confirmOrderPayment = asyncHandler(async (req, res) => {
    try {
        const userId = Number(req.user?.id)
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user || user.role !== "SALES") {
            return res.status(403).json({ message: "Sales authorization required" })
        }
        if (!user.memberOf) {
            return res.status(403).json({ message: "Sales user is not assigned to a company" })
        }

        const payment = await prisma.orderPayment.findFirst({
            where: {
                orderId: req.params.id,
                companyId: user.memberOf,
                order: { salesId: userId }
            }
        })
        if (!payment?.stripePaymentIntentId) {
            return res.status(404).json({ message: "Order payment not found" })
        }

        const intent = await stripe.paymentIntents.retrieve(
            payment.stripePaymentIntentId,
            {},
            { stripeAccount: payment.stripeAccountId }
        )
        if (intent.status !== "succeeded") {
            return res.status(409).json({ message: "Order payment has not succeeded" })
        }

        const result = await settleOrderPaymentIntent(intent, payment.stripeAccountId)
        return res.status(200).json({
            message: result.alreadyProcessed ? "Order was already paid" : "Order payment confirmed",
            orderId: payment.orderId,
            paymentStatus: "SUCCESS"
        })
    } catch (error) {
        console.error("Unable to confirm order payment:", error)
        return res.status(error.status || 500).json({
            message: error.status ? error.message : "Unable to confirm order payment"
        })
    }
})


export const updateLeadStatus = asyncHandler(async (req, res) => {
    try {
        const { id } = req.user;
        const numericID = Number(id);
        const { status } = req.body

        if (!id) {
            return res.status(401).json({ message: "id is required" })
        }
        const salesUser = await prisma.user.findUnique({ where: { id: numericID } })
        if (!salesUser) {
            return res.status(401).json({ message: " user not found " })
        }
        if (salesUser.role !== 'SALES') {
            return res.status(403).json({ message: " not authorized as sales " })
        }
        const leadId = req.query.id
        const lead = await prisma.lead.findUnique({
            where:
            {
                id: leadId
            }
        })
        if (!lead) return res.json({ message: "lead data invalid " })
        const leadStatus = await prisma.lead.update({
            where: {
                id: leadId
            },
            data :
            {
                status : status
            }
        })
        res.status(200).json({message : ` lead status update ${status}`})
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: " can not update lead status " })

    }

})