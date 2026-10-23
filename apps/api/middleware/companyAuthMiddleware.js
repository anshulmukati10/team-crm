
import jwt from "jsonwebtoken";

const companyAuthMiddleware = (req, res, next) => {
    try {
        const token = req.cookies?.companyToken;

        if (!token) {
            return res.status(401).json({
                message: "Company authentication required"
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (decoded.type !== "COMPANY" || !decoded.id) {
            return res.status(403).json({
                message: "Invalid company token"
            });
        }

        // Attach the verified company identity to the request
        req.company = {
            id: decoded.id
        };

        next();
    } catch (error) {
        console.error("Company authentication error:", error.message);

        return res.status(401).json({
            message: "Invalid or expired company token"
        });
    }
};

export default companyAuthMiddleware ;
