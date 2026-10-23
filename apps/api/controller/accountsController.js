import asyncHandler from "../middleware/asyncMiddleware.js";
import { prisma } from "../config/prismaClient.js"



export const getBalance = asyncHandler(async(req , res ) =>
{
    try 
    {
        const { id } = req.user
        const user = await prisma.user.findUnique({where :
            {
                id : id
            }
        })
        if ( !user && !user.role)
        {
            return res.status(401).json({message : "user not found "})
        }
        if ( user.role != 'ACCOUNTS' || user.role != 'ADMIN')
        {
            return res.status(403).json({message : "user not authorized "})
        }
        const amount = await prisma.wallet.findUnique({where : {
            id : user.id
        }})
        return res.status(200).json(amount)
    } catch (error) 
    {
        console.error(error)
        return res.status(500).json({message :" Error in getting balance "})
    }
})



export const salesList = asyncHandler(async(req , res ) =>
{
    try {
        const { id } = req.user
        const user = await prisma.user.findUnique({
            where :
            {
                id : Number.parseInt(id),
            }
        })
         if ( !user && !user.role)
        {
            return res.status(401).json({message : "user not found "})
        }
    
        if ( user.role != 'ACCOUNTS' && user.role != 'ADMIN' )
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
                expenses : true,
                leads : {
                    select :
                    {
                        name : true ,
                        orders : true 
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