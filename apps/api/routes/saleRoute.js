import express from 'express'
import { createOrder, getSalesLeads, getSalesOrders, updateLeadStatus } from '../controller/saleController.js'
import authMiddleware from "../middleware/authMiddleware.js"
import planLimiter from '../jobs/planLimiter.js';

const router = express.Router();

router.post('/create-order' , authMiddleware , planLimiter("order") ,createOrder )
router.get('/leads', authMiddleware, getSalesLeads)
router.get('/orders', authMiddleware, getSalesOrders)
router.put('/lead' , authMiddleware , updateLeadStatus)

export default router ;