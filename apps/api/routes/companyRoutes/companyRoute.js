import express from 'express'
import {
    addMember,
    createCompany,
    createMember,
    createSubscription,
    currentSubscription,
    loginCompany,
    logoutCompany
} from "../../controller/company/companyAuth.js";

import companyAuthMiddleware from '../../middleware/companyAuthMiddleware.js'
import company from '../../middleware/company.js'
import planLimiter from '../../jobs/planLimiter.js'

const router =  express.Router();

router.post("/register", createCompany);
router.post("/login", loginCompany);
router.post("/logout", logoutCompany);
router.post('/create-member' , companyAuthMiddleware , company , planLimiter("member") ,  createMember)
router.post('/add-member' , companyAuthMiddleware , company , planLimiter("member") , addMember)
router.get('/subscription' , companyAuthMiddleware , company , currentSubscription )
router.post('/subscription' , companyAuthMiddleware , company , createSubscription )


export default router ;