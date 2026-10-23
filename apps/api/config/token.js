import jwt from 'jsonwebtoken'
const genToken = (user) => {
    if (!process.env.JWT_SECRET) {
        console.error("Missing Jwt Token");
    }

    const token = jwt.sign({ id : String(user.id) , role : user.role }, process.env.JWT_SECRET , {
        expiresIn: '30d'
    })

    return token ;

}

export default genToken;