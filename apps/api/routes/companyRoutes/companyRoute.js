import express from 'express'
import {
    createCompany,
    loginCompany,
    logoutCompany
} from "../../controller/company/companyAuth.js";

const router =  express.Router();

router.post("/register", createCompany);
router.post("/login", loginCompany);
router.post("/logout", logoutCompany);

export default router ;