import express from 'express'
import { exportOrder, getOrderList, getStockData, createImportOrderRequest , importReqList } from '../controller/warehouseController.js'
import authMiddleware from '../middleware/authMiddleware.js'


const router = express.Router()

router.get('/get-stock-data' , authMiddleware ,  getStockData )
router.get('/get-order-list' , authMiddleware ,getOrderList) 
router.post('/export-order/:id' , authMiddleware , exportOrder )
router.get('/get-req-list' , authMiddleware , importReqList )
router.post('/import-stock' , authMiddleware , createImportOrderRequest )
export default router;