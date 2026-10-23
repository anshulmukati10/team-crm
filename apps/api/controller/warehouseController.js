import { prisma } from "../config/prismaClient.js";
import asyncHandler from "../middleware/asyncMiddleware.js";
import { emitWorkspaceUpdate } from "../config/socket.js";


    /* #swagger.tags = ['Warehouse'] */

export const getStockData = asyncHandler(async (req, res) => {
    const { id } = req.user
    const numericID = await Number(id);
    try {
        const userRole = await prisma.user.findUnique({
            where: {
                id: numericID
            }
        })
        const isAllowed = (userRole.role != 'ADMIN' || userRole.role != 'WAREHOUSE');
        if (!isAllowed) {
            return res.status(500).json({ message: " not authorized to get stock data " })
        }
        const Products = await prisma.product.findMany({
            select: {
                id: true,
                name: true,
                price: true,
                stock: true
            }
        })
        res.json(Products)
    } catch (error) {
        console.log("getStockData Erorr " + error)
        return res.status(500).json({ message: " Error in getting stock data " })
    }
})

export const getOrderList = asyncHandler(async (req, res) => {
    try {
        const { id } = req.user
        const numericId = await parseInt(id);
        const user = await prisma.user.findUnique({ where: { id: numericId } })
        console.log(user.role)
        if (user.role != 'WAREHOUSE' && user.role != 'ADMIN') {
            return res.status(403).json({ message: " not authorized to access order list " })
        }
        const orders = await prisma.order.findMany({
            select: {
                id: true,
                total: true,
                status: true
            }
        })
        res.json(orders)
    }
    catch (error) {
        console.error(error)
        return res.status(500).json({ message: " Error in getting order list " })
    }

})



export const exportOrder = asyncHandler(async (req, res) => {
    try {
        const { id } = req.user
        const numericId = await parseInt(id);
        const user = await prisma.user.findUnique({ where: { id: numericId } })
        console.log(user.role)
        if (user.role != 'WAREHOUSE') {
            return res.status(403).json({ message: " not authorized to access order list " })
        }
        const orderId = req.params.id
        const order = await prisma.order.findUnique({ where: { id: orderId }, include: { orderItems: true } })
        const orderItems = order.orderItems;
        for (let item of orderItems) {
            const product = await prisma.product.findUnique({ where: { id: item.productId } })
            if (item.quantity > product.stock) {
                return res.status(429).json({ message: `product is not sufficient to shiping ${product.id}` })
            }
        }
        for (let item of orderItems) {
            const product = await prisma.product.findUnique({ where: { id: item.productId } })
            await prisma.product.update({
                where: { id: item.productId }, data: {
                    stock: { decrement: item.quantity }
                }
            })
        }
        await prisma.order.update({ where: { id: orderId }, data: { status: 'PROCESS' } })
        const expense = await prisma.expenses.create({
            data: {
                id: `EXP_${Date.now()}`,
                amount: parseInt(order.total),
                note: ` created when ordered done by user ${order.leadId}`,
                userId: order.salesId
            }
        })
        await prisma.wallet.upsert({
            where: { userId: order.salesId },
            update: { balance: { increment: order.total } },
            create: { userId: order.salesId, balance: order.total }
        })
        emitWorkspaceUpdate()
        
        return res.status(200).json({ message: ` order status ${order.status}` })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: " Error in exporting order" })
    }
})

export const importReqList = asyncHandler(async (req, res) => {
    try {
        const { id } = req.user
        const numericId = await parseInt(id);
        const user = await prisma.user.findUnique({ where: { id: numericId } })
        console.log(user.role)
        if (user.role != 'WAREHOUSE') {
            return res.status(403).json({ message: " not authorized to import order req list " })
        }
        const requests = await prisma.request.findMany({
            select: {

                id: true,
                amount: true,
                note: true,
                status: true
            }
        })
        return res.json(requests)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: " Error in getting req list  " })
    }
})

export const createImportOrderRequest = asyncHandler(async (req, res) => {
    try {
        const { id } = req.user
        const { amount, note, products } = req.body

        const numericId = await parseInt(id);
        const user = await prisma.user.findUnique({ where: { id: numericId } })

        if (user.role != 'WAREHOUSE') {
            return res.status(403).json({ message: " not authorized to import order req  " })
        }
        await prisma.request.create({
            data:
            {
                amount: amount,
                note: note,
                userId: numericId,
                products: {
                    connect: products.map( (p) => ({ id : p.id }))
                }
            }
        })
        emitWorkspaceUpdate()
        res.status(201).json({ message: "Request created for importing stock " })
    }
    catch (error) {
        console.error(error?.message)
        return res.status(500).json({ message: " Error in importing order" })
    }
})