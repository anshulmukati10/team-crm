import express from 'express'
import {
    addMember,
    createCompany,
    createMember,
    createSubscription,
    currentSubscription,
    loginCompany,
    logoutCompany,
    retryStripeOnboarding,
    getStripeAccountStatus
} from "../../controller/company/companyAuth.js";
import {
    creditCompanyWallet,
    getCompanyMembers,
    getCompanyOrders,
    getCompanyStripeBalance,
    getCompanyWallet,
    getRecordings
} from "../../controller/company/companyAdminController.js";

import {
    getCompanyPayoutHistory,
    requestCompanyPayout,
} from "../../controller/payoutController.js";



import companyAuthMiddleware from '../../middleware/companyAuthMiddleware.js'
import company from '../../middleware/company.js'
import planLimiter from '../../jobs/planLimiter.js'

const router =  express.Router();

router.post("/register", createCompany);
router.post("/login", loginCompany);
router.post("/logout", logoutCompany);
router.post('/create-member' , companyAuthMiddleware , company , planLimiter("member") ,  createMember)
router.post('/add-member' , companyAuthMiddleware , company , planLimiter("member") , addMember)
router.get('/members', companyAuthMiddleware, company, getCompanyMembers)
router.get('/wallet', companyAuthMiddleware, company, getCompanyWallet)
router.get('/stripe/balance', companyAuthMiddleware, company, getCompanyStripeBalance)
router.post('/wallet/credit', companyAuthMiddleware, company, planLimiter("balance"), creditCompanyWallet)
router.get('/orders', companyAuthMiddleware, company, getCompanyOrders)
router.get('/subscription' , companyAuthMiddleware , company , currentSubscription )
router.post('/subscription' , companyAuthMiddleware , company , createSubscription )
router.get('/get-recordings' ,  companyAuthMiddleware , company , getRecordings)
router.post("/stripe/onboarding",companyAuthMiddleware,company, retryStripeOnboarding);
router.get("/stripe/status",companyAuthMiddleware,company,getStripeAccountStatus);
router.get("/stripe/payout-history", companyAuthMiddleware, company, getCompanyPayoutHistory);
router.post("/stripe/payout", companyAuthMiddleware, company, requestCompanyPayout);

export default router ;