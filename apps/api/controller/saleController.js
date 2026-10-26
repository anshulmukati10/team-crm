import { prisma } from '../config/prismaClient.js'
import asyncHandler from '../middleware/asyncMiddleware.js'
import { emitWorkspaceUpdate } from '../config/socket.js'

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
            select: { id: true, total: true, status: true, createdAt: true },
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
        const { leadId, orderItems } = req.body
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

        let totalPrice = 0;
        const lineItems = [];
        let i = 0;
        for (let item of orderItems) {
            const product = await prisma.product.findUnique({ where: { id: item.productId } })
            if (!product) {
                return res.status(400).json({ message: ` product not found for id ${item.productId}` })

            }

            totalPrice += product.price * item.quantity

            lineItems.push({
                id: `ORDER_ITEM${String(++i)}`,
                quantity: item.quantity,
                price: product.price,
                productId: product.id
            })
        }

        await prisma.order.create({
            data: {
                id: `ORD_${Date.now()}`,
                total: totalPrice,
                leadId: leadId,
                salesId: numericID,
                orderItems: {
                    create: lineItems,
                }
            },
            include: { orderItems: true }
        })

        emitWorkspaceUpdate()
        res.status(201).json({ message: " order created " })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: " error at creating orderr " })
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