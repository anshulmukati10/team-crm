import swaggerAutogenInit from 'swagger-autogen'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const swaggerAutogen = swaggerAutogenInit({ openapi: '3.0.0' })

const outputFile = path.join(__dirname, './swagger-output.json')

const endpointFiles = [
    path.join(__dirname, '../src/index.js'),
    path.join(__dirname, '../routes/userRoutes.js'),
    path.join(__dirname, '../routes/adminRoutes/adminRoutes.js'),
    path.join(__dirname, '../routes/warehouseRoute.js'),
    path.join(__dirname, '../routes/saleRoute.js')
];

const doc = {
    info: {
        title: 'Enterprise API & Schema Docs',
        version: '1.0.0',
        description: 'Swagger documentation for the enterprise API'
    },
    host: 'localhost:8000',
    schemes: ['http'],
    components: {
        schemas: {}
    }
}

try {
    const result = await swaggerAutogen(outputFile, endpointFiles, doc)
    if (!result.success) {
        throw new Error('swagger-autogen did not generate the specification')
    }
    console.log(`Swagger specification generated at ${outputFile}`)
}
catch (err) 
{
    console.error('Swagger specification generation failed:', err)
    process.exitCode = 1
}


