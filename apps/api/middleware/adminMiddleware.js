const admninMiddleware =  (req , res , next ) =>
{
    try {
        const role  = req.body?.role || req.user?.role;
        console.log("role"+ role)
        if ( !role || role !== "ADMIN")
        {
           return res.status(403).json({message : " not auth as admin"})
        }

        next();
       
    } catch (error) 
    {
       return res.status(500).json({message :" error in gettin role "})   
    }
}
export default admninMiddleware ;