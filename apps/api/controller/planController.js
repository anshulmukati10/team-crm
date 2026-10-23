
import{ prisma }from "../config/prismaClient.js";


export const createPlan = async (req, res) => {
  try {
    const {
      name,
      type,
      price,
      isActive = true,
      maxMember,
      maxOrder,
      maxWallet,
    } = req.body;

   
    if (
      typeof name !== "string" ||
      !name.trim() ||
      !["FREE", "PRO"].includes(type) ||
      !Number.isSafeInteger(price) ||
      price < 0 ||
      !Number.isSafeInteger(maxMember) ||
      maxMember < 1 ||
      !Number.isSafeInteger(maxOrder) ||
      maxOrder < 1 ||
      !Number.isSafeInteger(maxWallet) ||
      maxWallet < 1 ||
      typeof isActive !== "boolean"
    ) {
      return res.status(400).json({
        message: "Invalid plan data",
        required: {
          name: "Non-empty string",
          type: "FREE or PRO",
          price: "Non-negative integer",
          isActive: "Boolean",
          maxMember: "Positive integer",
          maxOrder: "Positive integer",
          maxWallet: "Positive integer",
        },
      });
    }

    const normalizedName = name.trim();

  
    const existingPlan = await prisma.plan.findFirst({
      where: { name: normalizedName },
    });

    if (existingPlan) {
      return res.status(409).json({
        message: "A plan with this name already exists",
      });
    }

 
    const plan = await prisma.plan.create({
      data: {
        name: normalizedName,
        type,
        price,
        isActive,
        details: {
          create: {
            maxMember,
            maxOrder,
            maxWallet,
          },
        },
      },
      include: {
        details: true,
      },
    });

    return res.status(201).json({
      message: "Plan created successfully",
      plan,
    });
  } catch (error) {
    
    if (error.code === "P2002") {
      return res.status(409).json({
        message: "A plan with this name already exists",
      });
    }

    console.error("Create plan error:", error);

    return res.status(500).json({
      message: "Failed to create plan",
    });
  }
};

export const getPlans = async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      include: {
        details: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      message: "Plans fetched successfully",
      plans,
    });
  } catch (error) {
    console.error("Get plans error:", error);

    return res.status(500).json({
      message: "Failed to fetch plans",
    });
  }
};

