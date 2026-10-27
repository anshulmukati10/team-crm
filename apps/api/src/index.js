import "dotenv/config"
import express from "express"
import cookieParser from "cookie-parser"
import userRoutes from "../routes/userRoutes.js";
import adminRoutes from "../routes/adminRoutes/adminRoutes.js"
import { start } from "../config/db.js";
import wareHouseRoutes from "../routes/warehouseRoute.js";
import accountRoutes from "../routes/accountRoute.js"
import salesRoutes from '../routes/saleRoute.js'
import swaggerUi from 'swagger-ui-express'
import paymentRoutes from '../routes/paymentRoute.js'
import fs from 'fs'
import { fileURLToPath } from "url";
import path from 'path'
import { createServer } from "http";
import { socketInit } from "../config/socket.js";
import cors from 'cors'

import "../config/worker.js"




const app = express();

start();
const corsOptions = {
    origin: process.env.FRONTEND_URL,
    credentials: true,
};
const PORT = 8000;
app.use(express.json())
app.use(cookieParser())
app.use(cors(corsOptions));

const httpServer = createServer(app)
socketInit(httpServer);

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)


let swaggerSpecPath = path.join(__dirname, '../config/swagger-output.json');
if (fs.existsSync(swaggerSpecPath)) {
    const swaggerDocument = JSON.parse(fs.readFileSync(swaggerSpecPath, 'utf8'))

    const uiOptions = {
        explorer: true,
        swaggerOptions: {
            documentExpansion: "list",
            defaultModelExpansionDepth: 1
        }
    }
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, uiOptions))
    console.log(` swagger is live on  localhost:${PORT}/api-docs`)
}
app.use('/auth', userRoutes)
app.use('/admin', adminRoutes)
app.use('/warehouse', wareHouseRoutes)
app.use('/sales', salesRoutes)
app.use('/accounts', accountRoutes)
app.use('/payment' , paymentRoutes)



httpServer.listen(PORT, () => {
    console.log(`server is running on port ${PORT}`)
})