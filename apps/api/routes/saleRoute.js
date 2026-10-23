import express from 'express'
import { createOrder, getSalesLeads, getSalesOrders } from '../controller/saleController.js'
import authMiddleware from "../middleware/authMiddleware.js"

const router = express.Router();

router.post('/create-order' , authMiddleware , createOrder )
router.get('/leads', authMiddleware, getSalesLeads)
router.get('/orders', authMiddleware, getSalesOrders)

export default router ;