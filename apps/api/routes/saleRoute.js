import express from 'express'
import { createOrder } from '../controller/saleController.js'
import authMiddleware from "../middleware/authMiddleware.js"

const router = express.Router();

router.post('/create-order' , authMiddleware , createOrder )

export default router ;