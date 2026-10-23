import { prisma } from '../config/prismaClient.js'
import asyncHandler from '../middleware/asyncMiddleware.js'

// export const requestStockImport =  asyncHandler( async ( req , res ) => {
//     try {
//         const { id } = req.user
        
        
//     } catch (error) {
//         return res.status(500).json({message : " server error in req stock "})
//     }
// })


    /* #swagger.tags = ['Sales'] */

export const createOrder = asyncHandler ( async ( req , res ) =>
{
    try {
        const { id } =  req.user ;
        const numericID =  Number(id);

        if ( !id )
        {
            return res.status(401).json({message : "id is required"})
        }
        const salesUser =  await prisma.user.findUnique({where : { id : numericID }})
        if(salesUser.role !== 'SALES')
        {
            return res.status(403).json({message : " not authorized as sales "})
        }
        const { salesId , leadId , orderItems } = req.body
        if ( !orderItems || !Array.isArray(orderItems) || orderItems.length === 0)
        {
            return res.status(401).json({message : " invalid product list  "})
        }

        let totalPrice =  0 ;
        const lineItems = [] ;
        let i = 0 ; 
        for ( let item of orderItems) 
        {
             const product = await prisma.product.findUnique( { where : { id : item.productId }})
             if (!product) {
                return res.status(400).json( {message : ` product not found for id ${item.productId}` } )

             }

             totalPrice +=  product.price * item.quantity 

             lineItems.push ({
                id : `ORDER_ITEM${String(++i)}`,
                quantity : item.quantity ,
                price : product.price ,
                productId : product.id
             })
        }
        
        await prisma.order.create( { 
            data : {
                id : `ORD_${Date.now()}`,
                total : totalPrice,
                leadId : leadId ,
                salesId : salesId ,
                orderItems : {
                    create : lineItems ,
                }
            },
            include : { orderItems : true }
        })

        res.status(201).json({ message : " order created "})
    } catch (error) {
        console.log(error)
        return res.status(500).json({message : " error at creating orderr "})
    }
})