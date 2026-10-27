import express from 'express'
import { createUSer ,getProfile ,  deleteUser, loginUser, logoutUser, updateProfile , socketConnection, getRooms } from "../controller/userController.js";
import admninMiddleware from '../middleware/adminMiddleware.js'
import authMiddleware from '../middleware/authMiddleware.js';
import rateLimiter from '../middleware/redisMiddleware.js';
const router = express.Router();

router.post('/register' ,rateLimiter(3,60), createUSer)
router.post('/login'  , rateLimiter(3,60), loginUser)
router.post('/logout' , rateLimiter(3,60), logoutUser)
router.delete('/delete-user' , rateLimiter(3,60), authMiddleware , admninMiddleware , deleteUser )
router.get('/chat/:id/messages' , authMiddleware , socketConnection) 
router.get('/profile' , authMiddleware , getProfile)
router.put('/profile' , authMiddleware , updateProfile)
router.get('/get-rooms' , authMiddleware , getRooms)

export default router ; 
