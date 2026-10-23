import { Router } from "express";
import company from "../middleware/company.js";
import companyAuthMiddleware from "../middleware/companyAuthMiddleware.js";
import {
  createPlan,
  getPlans

} from "../controller/planController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import admin from "../middleware/adminMiddleware.js";

const router = Router();


router.post("/", createPlan);
router.get("/",companyAuthMiddleware ,  company ,   getPlans);




export default router;