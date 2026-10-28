import genCompanyToken from '../../config/genCompanyToken.js';
import asyncHandler from '../../middleware/asyncMiddleware.js'
import { prisma } from '../../config/prismaClient.js';
import bcrypt from 'bcrypt'



export const createCompany = asyncHandler(async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ message: " all fields required ", data: { name, email, password } })
        }
        const companyExist = await prisma.company.findUnique({ where: { email: email } });
        if (companyExist) {
            return res.status(409).json({ message: "user already exist" })
        }
        const freePlan = await prisma.plan.findFirst({
            where: {
                type: "FREE",
                isActive: true
            },
            select: {
                id: true
            }
        });

        if (!freePlan) {
            return res.status(500).json({
                message: "Free plan not found. Please seed the plans first."
            });
        }
        const hashedPass = await bcrypt.hash(password, 10)
        const company = await prisma.$transaction(async (tx) => {
            const createdCompany = await tx.company.create({
                data: {
                    email,
                    password: hashedPass,
                    name,
                    planId: freePlan.id,
                },
            });

            await tx.subscription.create({
                data: {
                    companyId: createdCompany.id,
                    planId: freePlan.id,
                    status: "ACTIVE",
                },
            });

            return createdCompany;
        });
        return res.status(201).json({ message: ` company registered  ${company.id}` })
    }
    catch (err) {
        console.log(err)
        return res.status(500).json({ error: err.message })
    }
})


export const loginCompany = asyncHandler(async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        const company = await prisma.company.findUnique({
            where: { email }
        });

        if (!company) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const isPass = await bcrypt.compare(
            password,
            company.password
        );

        if (!isPass) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = genCompanyToken(company);

        res.cookie("companyToken", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 30 * 24 * 60 * 60 * 1000,
            path: "/"
        });

        return res.status(200).json({
            message: "Company login successful",
            user: {
                id: company.id,
                name: company.name,
                email: company.email,
                role: company.role
            }
        });

    } catch (error) {
        console.error("Company login error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});



export const logoutCompany = asyncHandler(async (req, res) => {
    try {
        res.cookie('token', '', {
            httpOnly: true,
            maxAge: new Date(0)
        })
        return res.status(200).json({ message: " logged out " })
    }

    catch (error) {
        console.error("Company logout error:", error);

        return res.status(500).json({
            message: "Problem logging out company"
        });
    }
});