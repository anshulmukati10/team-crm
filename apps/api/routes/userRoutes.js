import express from 'express'
import { createUSer ,getProfile ,  deleteUser, loginUser, logoutUser, updateProfile , socketConnection, getRooms } from "../controller/userController.js";
import admninMiddleware from '../middleware/adminMiddleware.js'
import authMiddleware from '../middleware/authMiddleware.js';
const router = express.Router();

router.post('/register' , createUSer)
router.post('/login'  , loginUser)
router.post('/logout' , logoutUser)
router.delete('/delete-user' , authMiddleware , admninMiddleware , deleteUser )
router.get('/chat/:id/messages' , authMiddleware , socketConnection) 
router.get('/profile' , authMiddleware , getProfile)
router.put('/profile' , authMiddleware , updateProfile)
router.get('/get-rooms' , authMiddleware , getRooms)

export default router ; 
