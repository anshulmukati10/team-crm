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




export const createMember = asyncHandler(async (req, res) => {
    try {
        const id = req.company.id
        const { name, email, role } = req.body
        if (!id) return res.json({ message: `id is ${id}` })
        const password = "techbuilds"
        const hashedPassword = await bcrypt.hash(password, 10)
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: String(hashedPassword),
                role,
                memberOf: id,
            },
            select:
            {
                id: true,
                name: true,
                email: true,
                role: true,
                memberOf: true,
            }
        })

        await prisma.company.update({
            where:
            {
                id: id
            },
            data:
            {
                member: {
                    connect: [
                        { id: user.id }
                    ]
                }
            }
        })
        return res.json(user)
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: "Internal server error in creating member " })
    }
});




export const addMember = asyncHandler(async (req, res) => {
    const userId = Number(req.query.id);
    const companyId = req.company?.id;

    if (!companyId) {
        return res.status(401).json({
            message: "Company authentication required",
        });
    }

    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({
            message: "Valid user ID is required",
        });
    }

    try {

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }


        if (user.memberOf === companyId) {
            return res.status(409).json({
                message: "User is already a member of this company",
            });
        }


        await prisma.company.update({
            where: { id: companyId },
            data: {
                member: {
                    connect: { id: userId },
                },
            },
        });

        return res.status(200).json({
            message: "Member added successfully",
            userId,
            companyId,
        });
    } catch (error) {
        console.error("Add member error:", error);

        return res.status(500).json({
            message: "Cannot add member",
        });
    }
});



export const currentSubscription = asyncHandler(async (req, res) => {
    try {
        const subscriptions = await prisma.subscription.findMany({
            where: {
                companyId: req.company.id,
            },
        });

        console.log("Company subscriptions:", subscriptions);
        return res.json(subscriptions)
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: " error in getting subscription" })
    }
})



export const createSubscription = asyncHandler(async (req, res) => {
    const companyId = req.company?.id;
    const { planId } = req.body
    console.log(companyId, planId)

    if (!companyId || !planId) {
        return res.status(400).json({
            message: "companyId and planId are required",
        });
    }

    // Check if company exists
    const company = await prisma.company.findUnique({
        where: { id: companyId },
    });

    if (!company) {
        return res.status(404).json({
            message: "Company not found",
        });
    }

    // Check if plan exists and has limits configured
    const plan = await prisma.plan.findUnique({
        where: { id: planId },
        include: { details: true },
    });

    if (!plan) {
        return res.status(404).json({
            message: "Plan not found",
        });
    }

    if (!plan.details) {
        return res.status(400).json({
            message: "Plan details are not configured",
        });
    }

    // Create active subscription
    const subscription = await prisma.subscription.create({
        data: {
            companyId,
            planId,
            status: "ACTIVE",
            startedAt: new Date(),
            endAt: null,
        },
        include: {
            plan: {
                include: {
                    details: true,
                },
            },
            company: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    return res.status(201).json({
        message: "Subscription created successfully",
        subscription,
    });
});