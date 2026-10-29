import { createLead, createProduct, removeMember ,  createRoom, creditAmount, deleteLead, deleteProduct, getAllUsers, getLeads, getRequestList, handleRequest, updateProduct, getBalance, deleteRooms, addUserToGroup } from "../../controller/adminController/adminController.js";
import express from "express"
import authMiddleware from "../../middleware/authMiddleware.js";
import adminMiddleware from "../../middleware/adminMiddleware.js";
import planLimiter from "../../jobs/planLimiter.js";

const router = express.Router();
  

router.post('/product/create-product' , authMiddleware , adminMiddleware , createProduct);
router.delete('/product/delete-product' , authMiddleware , adminMiddleware , deleteProduct);
router.put('/product/update-product/:id' , authMiddleware , adminMiddleware , updateProduct);
router.post('/lead/create-lead' , authMiddleware , adminMiddleware , createLead)
router.delete('/lead/delete-lead' , authMiddleware , adminMiddleware  , deleteLead )
router.get('/lead' , authMiddleware , adminMiddleware , getLeads) 
router.get('/get-request' , authMiddleware , adminMiddleware , getRequestList)
router.post('/credit-amount' , planLimiter("balance") , creditAmount) 
router.post ('/handle-request'  , authMiddleware , adminMiddleware , handleRequest)
router.post('/room' , authMiddleware , adminMiddleware , createRoom )
router.delete('/room' , authMiddleware , adminMiddleware , removeMember )
router.get('/get-all-user' , authMiddleware , adminMiddleware , getAllUsers)
router.get('/balance' , authMiddleware , adminMiddleware , getBalance )
router.delete('/delete-room' , authMiddleware , adminMiddleware , deleteRooms)
router.put('/room' , authMiddleware , adminMiddleware , addUserToGroup)
export default router ;