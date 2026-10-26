import asyncHandler from "../../middleware/asyncMiddleware.js";
import { prisma } from "../../config/prismaClient.js";
import { emitWorkspaceUpdate } from "../../config/socket.js";



/* #swagger.tags = ['Admin - Product'] */
export const createProduct = asyncHandler(async (req, res) => {
    try {
        const { name, price, stock } = req.body;
        console.log(name);
        const productExist = await prisma.product.findFirst({ where: { name: name } })
        if (productExist) {
            return res.status(400).json({ message: "product already exist " })
        }
        const count = await prisma.product.count()
        const id = 'PROD' + String(count + 1);
        await prisma.product.create({
            data: {
                id: id,
                name: name,
                price: price,
                stock: stock
            }
        })
        emitWorkspaceUpdate()
        return res.status(201).json({ message: " product created " })
    }
    catch (error) {
        console.error("Prisma Error Details:", error);
        return res.status(500).json({ message: " error at creating product " })
    }
})
/* #swagger.tags = ['Admin - Product'] */

export const deleteProduct = asyncHandler(async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) {
            return res.status(401).json({ message: "id required" })
        }
        const productExist = await prisma.product.findUnique({
            where: {
                id: id
            }
        })
        if (!productExist) {
            return res.status(409).json({ message: " product does not exist " })
        }
        await prisma.product.delete({ where: { id: id } })
        emitWorkspaceUpdate()
        return res.status(200).json({ message: "product deleted " })
    }
    catch (error) {
        console.log(error)
        return res.status(500).json({ message: `Error in deleting product ` })
    }
})

/* #swagger.tags = ['Admin - Product'] */

export const updateProduct = asyncHandler(async (req, res) => {
    try {
        const id = req.params;
        const { name, price, stock } = req.body;
        if (!id) {
            return res.status(401).json({ message: " product id is missing " })
        }
        const productExist = await prisma.product.findUnique({ where: { id: id } })
        if (!productExist) {
            return res.status(409).json({ message: " No product found" })
        }
        const nameConflict = await prisma.product.findFirst({ where: { name: name } })
        if (nameConflict) {
            return res.status(429).json({ message: " product with same name exist " })
        }
        await prisma.product.update({
            data:
            {
                name: name !== undefined ? name : productExist.name,
                price: price !== undefined ? price : productExist.price,
                stock: stock !== undefined ? stock : productExist.stock
            }
        })
        emitWorkspaceUpdate()
        return res.status(200).json({ message: " update successfull " })

    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: `Error in updating product ` })
    }
})


/* #swagger.tags = ['Admin - Lead'] */

export const deleteLead = asyncHandler(async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) {
            return res.status(401).json({ message: " id required " })
        }

        const isLead = await prisma.lead.findUnique({ where: { id: id } })
        if (!isLead) {
            return res.status(404).json({ message: "lead not exist " })
        }


        await prisma.lead.delete({ where: { id: id } })
        emitWorkspaceUpdate()
        return res.status(200).json({ message: "lead deleted" })
    }
    catch (error) {
        return res.status(500).json({ message: "server errored at deleting lead" })
    }
})

/* #swagger.tags = ['Admin - Lead'] */

export const createLead = asyncHandler(async (req, res) => {
    try {
        const { name, phone, salesId } = req.body;
        if (!name || !phone || !salesId) {
            return res.status(400).json({ message: " all fields required " })
        }
        const leadExist = await prisma.lead.findUnique({ where: { phone: phone } });
        if (leadExist) {
            return res.status(409).json({ message: "lead already exist" })
        }

        const leadId = 'LEAD_' + String(Date.now())
        await prisma.lead.create(
            {
                data:
                {
                    id: leadId,
                    name: name,
                    phone: phone,
                    salesId: salesId

                }
            })
        emitWorkspaceUpdate()
        return res.status(201).json({ message: " lead created " })
    }
    catch (err) {
        console.log(err)
        return res.status(500).json({ error: err })
    }
})

/* #swagger.tags = ['Admin - Lead'] */

export const getLeads = asyncHandler(async (req, res) => {
    try {
        const leads = await prisma.lead.findMany({
            select: {
                id: true,
                name: true,
                phone: true,
                status: true,
            }
        })
        res.status(200).json(leads)

    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: err })
    }
})

/* #swagger.tags = ['Admin - WareHouse'] */

export const getRequestList = asyncHandler(async (req, res) => {
    try {
        const requests = await prisma.request.findMany({
            select: {
                id: true,
                amount: true,
                status: true,
                note: true,
                products: {
                    select: {
                        name: true,
                        price: true,
                        stock: true
                    }
                }
            }
        })
        res.status(200).json(requests)

    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: error })
    }
})


export const handleRequest = asyncHandler(async (req, res) => {
    try {

        const { reqId } = req.query;
        const { id } = req.user
        const numericId = Number.parseInt(id)
        if (Number.isNaN(numericId)) {
            return res.status(401).json({ message: "Invalid or missing User ID in token structure" });
        }
        const user = await prisma.user.findUnique({ where: { id: numericId } })
        if (!user) return res.status(403).json({ message: "user not found " })

        const request = await prisma.request.findUnique({
            where: {
                id: Number.parseInt(reqId)
            }
        })
        if (!request) return res.status(403).json({ message: "req not found " })

        if (request.status == "REJECTED") {
            return res.status(400).json({ message: ` Request ${id} is already rejected ` })
        }
        if (request.status == "APPROVED") {
            return res.status(400).json({ message: ` Request ${id} is already approved ` })
        }
        const wallet = await prisma.wallet.findUnique({
            where: {
                userId: user.id
            },
            select:
            {
                balance: true,
            }
        })
        if (!wallet) return res.status(403).json({ message: "wallet not found " })

        const balance = wallet.balance
        if (balance >= request.amount) {
            await prisma.request.update({
                where: {
                    id: request.id
                },
                data: {
                    status: "APPROVED"
                }
            });
            await prisma.wallet.update({
                where: { userId: user.id }, data: {
                    balance: {
                        decrement: request.amount
                    }
                }
            })
            emitWorkspaceUpdate()
            return res.status(201).json({ message: `APPROVED` })
        }
        if (balance < request.amount) {
            await prisma.request.update({
                where: {
                    id: request.id
                },
                data: {
                    status: "REJECTED"
                }
            });
            emitWorkspaceUpdate()
            return res.status(201).json({ message: `REJECTED` })
        }
    }
    catch (error) {
        console.error("Error : " + error)
        return res.status(500).json({ message: "Internal Server Error At Handling Request " })
    }
})

/* #swagger.tags = ['Admin - Accounts'] */

export const creditAmount = asyncHandler(async (req, res) => {
    try {
        const { id } = req.user
        const numericId = Number.parseInt(id)
        const { amount } = req.body
        const user = await prisma.user.findUnique({ where: { id: numericId } })

        await prisma.expenses.create({
            data: {
                id: `EXP_${crypto.randomUUID()}`,
                amount: amount,
                userId: numericId
            }
        })
        await prisma.wallet.upsert({
            where: { userId: numericId },
            update: { balance: { increment: amount } },
            create: { userId: numericId, balance: amount }
        })
        emitWorkspaceUpdate()
        return res.status(201).json({ message: ` transaction done by ${user.name} of $ ${amount}` })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: " Server Down Try Again Later" })
    }
})

export const createRoom = asyncHandler(async (req, res) => {
    try {
        const { groupName, memberIds = [] } = req.body
        const createrId = Number(req.user.id)

        if (!groupName?.trim()) {
            return res.status(400).json({ message: "Group name is required" })
        }
        if (!Number.isInteger(createrId)) {
            return res.status(400).json({ message: "Invalid creator" })
        }
        if (!Array.isArray(memberIds)) {
            return res.status(400).json({ message: "memberIds must be an array" })
        }

        const room = await prisma.room.create({
            data:
            {
                name: groupName,

            },
        })

        const membersToAdd = [{ roomId: room.id, userId: createrId, isAdmin: true },
        ...(memberIds || []).map((memberId) => ({
            roomId: room.id,
            userId: Number(memberId)
        }))
        ]

        await prisma.groupMember.createMany({ data: membersToAdd, skipDuplicates: true })
        emitWorkspaceUpdate()
        res.status(201).json({
            ...room,
            memberIds: membersToAdd.map(({ userId }) => userId)
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: " Internal Server Error in Creating Room " })
    }
})

export const removeMember = asyncHandler(async (req, res) => {
    try {
        const { roomId, memberId } = req.query
        if (!roomId || !memberId) {
            return res.status(400).json({ message: "roomId and memberId are required" })
        }

        const room = await prisma.room.findUnique({ where: { id: roomId } })
        if (!room) {
            return res.status(404).json({ message: "Room not found" })
        }

        const membership = await prisma.groupMember.findUnique({
            where: {
                roomId_userId: {
                    userId: Number(memberId),
                    roomId: roomId
                }
            }
        })
        if (!membership) {
            return res.status(404).json({ message: "Member not found in room" })
        }
        
        const user  = await prisma.user.findUnique({ where: { id: Number(memberId),} })
        if (!user) {
            return res.status(404).json({ message: "user not found" })
        }
        if(user.role === 'ADMIN') return res.status(404).json({ message: " admin cant be removed " })

        await prisma.groupMember.delete({
            where: {
                roomId_userId: {
                    userId: Number(memberId),
                    roomId: roomId
                }
            }
        })
        emitWorkspaceUpdate()
        return res.status(200).json({ message: "member removed from group" })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: " Internal Server Error in Removing Member " })
    }
})




export const getAllUsers = asyncHandler(async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true
            },
            where:
            {
                role:
                {
                    not: 'ADMIN'
                }
            }
        })
        return res.status(200).json(users)
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: "Internal server error in getting user " })
    }
})


export const getBalance = asyncHandler(async (req, res) => {
    try {
        const id = Number.parseInt(req.user.id)
        if (!id) return res.status(401).json({ message: " required id " })
        const amount = await prisma.wallet.findUnique({
            select:
            {
                balance: true,
            },
            where: {
                userId: id
            }
        })
        return res.json(amount)
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: "Internal Server error i fetching balance " })
    }

})


export const deleteRooms = asyncHandler(
    async (req, res) => {
        try {
            const { rooms } = req.body
            if (!rooms && Array.isArray(rooms) && rooms.length === 0) {
                return res.status(401).json({ message: " rooms is missing " })

            }
            await prisma.room.deleteMany({
                where:
                {
                    id:
                    {
                        in: rooms
                    }
                }
            })
            return res.status(200).json({ message: "successful " })
        } catch (error) {
            console.log(error)
            return res.status(500).json({ message: " internal server error at deleting room " })
        }
    }
)



export const addUserToGroup = asyncHandler(async (req, res) => {
    try {
        const { userId } = req.body;
        const numericUserId = Number.parseInt(userId)
        const { roomId } = req.body;

        if (!roomId && !userId) return res.json({ message: " empty fields " })
        const room = await prisma.room.findUnique({
            where:
            {
                id: roomId,
            }
        })
        if (!room) return res.json({ message: " room is missing  " })
            const user = await prisma.user.findUnique({
            where:
            {
                id: numericUserId,
            }
        })
        if (!user) return res.json({ message: " room is missing  " })
        
        await prisma.groupMember.upsert({ where :
            {
                roomId_userId :
                {
                    roomId , 
                    userId : numericUserId
                }
            },
            update : {},
            create :
            {
                roomId ,
                userId : numericUserId ,
            }   
        })
        emitWorkspaceUpdate()
        return res.status(200).json({ message: "member added to group" })
        
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: " Server error in adding member inside group " })
    }

})