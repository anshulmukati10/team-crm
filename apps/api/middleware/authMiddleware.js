import jwt from 'jsonwebtoken'

const authMiddleware = (req, res, next) => {
    try 
    {
        let token;
        if ( req.cookies && req.cookies.token )
        {
            token = req.cookies.token;
        }
        else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        
        console.log("toke rec" + token ) 
        if (!token) {
            return res.status(401).json({ message: " not authorized" })
        }


        let decode = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decode;
        next();
    }
    catch (error) {
        return res.status(500).json({ message: " No token , no authorization " })
    }
}


export default authMiddleware;