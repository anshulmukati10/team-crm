import jwt from "jsonwebtoken";

const genCompanyToken = (company) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("Missing JWT_SECRET");
    }

    return jwt.sign(
        {
            id: String(company.id),
            type: "COMPANY"
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "30d"
        }
    );
};

export default genCompanyToken;