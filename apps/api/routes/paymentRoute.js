import express from 'express'
import { confirmPayment, paymentAccept } from '../controller/paymentController.js'

import companyAuthMiddleware from '../middleware/companyAuthMiddleware.js'
import company from '../middleware/company.js'

const router = express.Router()

router.post('/make-payment' ,companyAuthMiddleware , company ,  paymentAccept )
router.post('/confirm-payment', companyAuthMiddleware, company, confirmPayment)
// router.post('/webhook' ,  stripeWebhookHandler)

export default router ;