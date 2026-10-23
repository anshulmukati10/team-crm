import express from 'express'
import { getBalance, salesList } from '../controller/accountsController.js'
import authMiddleware from '../middleware/authMiddleware.js'


const router = express.Router()

router.get('/get-balance' , authMiddleware , getBalance)
router.get('/sales-list' , authMiddleware ,  salesList)

export default router ;