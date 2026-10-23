import redis from "../config/redis.js";
import asyncHandler from "./asyncMiddleware.js";
 
const rateLimiter = (maxRequest , windowPerSecond) =>  { return asyncHandler (async (req , res , next ) => 
{
    const ip =  req.socket.remoteAddress ;
    const key = `rate_limit:${ip}:${req.baseUrl}${req.path}`;


    try {
        const currentRequest = await redis.incr(key)
        if ( currentRequest === 1 )
        {
            await redis.expire(key , windowPerSecond);
        }
        
        const ttl = await redis.ttl(key)

        res.set({
            "maxRequest" : maxRequest,
            "remainingRequst" : Math.max( 0 , maxRequest - currentRequest ),
            "remainingTime" : ttl
        })


        if ( currentRequest > maxRequest) 
        {
            return res.status(429).json({
                "status" : "fail",
                "message" : "Try Again After Some Time",
                "remainingTime"  : ttl ,

            })
        }
        next();
    } catch (error) 
    {
        console.log( "error " + error )
        return res.status(500).json({message  : "Error in redis connection "})
        next();

    }
});

}

export default rateLimiter ; 