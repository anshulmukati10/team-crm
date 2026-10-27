import express from 'express'
import { paymentAccept } from '../controller/paymentController.js'
import authMiddleware from '../middleware/authMiddleware.js'
import admin from '../middleware/adminMiddleware.js'

const router = express.Router()

router.post('/make-payment' , authMiddleware, admin , paymentAccept )

export default router ;