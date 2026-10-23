import asyncHandler from "../middleware/asyncMiddleware.js";
import { prisma } from "../config/prismaClient.js"



export const getBalance = asyncHandler(async(req , res ) =>
{
    try 
    {
        const userId = Number(req.user?.id)
        if (!Number.isInteger(userId)) {
            return res.status(401).json({message : "user not found "})
        }
        const user = await prisma.user.findUnique({where : { id: userId }, select: { id: true, role: true }})
        if (!user)
        {
            return res.status(401).json({message : "user not found "})
        }
        if (user.role !== 'ACCOUNTS' && user.role !== 'ADMIN')
        {
            return res.status(403).json({message : "user not authorized "})
        }
        const wallet = await prisma.wallet.findUnique({where : { userId: user.id }, select: { balance: true }})
        return res.status(200).json({ balance: wallet?.balance ?? 0 })
    } catch (error) 
    {
        console.error(error)
        return res.status(500).json({message :" Error in getting balance "})
    }
})



export const salesList = asyncHandler(async(req , res ) =>
{
    try {
        const userId = Number(req.user?.id)
        if (!Number.isInteger(userId)) {
            return res.status(401).json({message : "user not found "})
        }
        const user = await prisma.user.findUnique({
            where : { id: userId },
            select: { role: true },
        })
         if (!user)
        {
            return res.status(401).json({message : "user not found "})
        }
    
        if (user.role !== 'ACCOUNTS' && user.role !== 'ADMIN')
        {
            return res.status(403).json({message : "user not authorized "})
        }
        const users = await prisma.user.findMany({
            where : {
            
                role : 'SALES'
                
            },
            select :
            {
                id : true ,
                name : true ,
                expenses : {
                    select: {
                        id: true,
                        amount: true,
                        note: true,
                    },
                },
                leads : {
                    select :
                    {
                        id: true,
                        name : true ,
                        phone: true,
                        status: true,
                        orders : {
                            select: {
                                id: true,
                                status: true,
                                total: true,
                                createdAt: true,
                            },
                        },
                    }
                }

            }
        })
        return res.status(200).json(users)
    } catch (error) {
        console.error(error)
        return res.status(500).json({message : "Internal server error at rendering sales list"})
    }
})