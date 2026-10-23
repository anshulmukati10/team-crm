
import { prisma } from "../config/prismaClient.js";

const company = async (req, res, next) => {
    try {
        const id = req.company?.id;

        if (!id) {
            return res.status(401).json({
                message: "Company authentication required"
            });
        }

        const companyExist = await prisma.company.findUnique({
            where: { id }
        });

        if (!companyExist) {
            return res.status(403).json({
                message: "Company not found or not authorized"
            });
        }

        req.companyRecord = companyExist;
        return next();

    } catch (error) {
        console.error("Company middleware error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

export default company;
