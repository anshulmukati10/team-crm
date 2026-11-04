import swaggerAutogenInit from 'swagger-autogen'
import { fileURLToPath } from 'url'
import path from 'path'
import { readFile, writeFile } from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const swaggerAutogen = swaggerAutogenInit({ openapi: '3.0.0' })

const outputFile = path.join(__dirname, './swagger-output.json')

const endpointFiles = [
    path.join(__dirname, '../src/index.js'),
    path.join(__dirname, '../routes/userRoutes.js'),
    path.join(__dirname, '../routes/adminRoutes/adminRoutes.js'),
    path.join(__dirname, '../routes/warehouseRoute.js'),
    path.join(__dirname, '../routes/saleRoute.js'),
    path.join(__dirname, '../routes/planRoute.js'),
    path.join(__dirname, '../routes/paymentRoute.js'),
    path.join(__dirname, '../routes/companyRoutes/companyRoute.js')

];

const tagDescriptions = [
    { name: 'Authentication', description: 'User authentication endpoints' },
    { name: 'Profile', description: 'User profile and upload endpoints' },
    { name: 'Chat', description: 'Chat and room endpoints' },
    { name: 'Admin - Product', description: 'Admin product management endpoints' },
    { name: 'Admin - Lead', description: 'Admin lead management endpoints' },
    { name: 'Admin - Requests', description: 'Admin request handling endpoints' },
    { name: 'Admin - Users', description: 'Admin user management endpoints' },
    { name: 'Admin - Accounts', description: 'Admin account and balance endpoints' },
    { name: 'Admin - Chat', description: 'Admin chat and room management endpoints' },
    { name: 'Warehouse', description: 'Warehouse and stock endpoints' },
    { name: 'Sales', description: 'Sales leads and orders endpoints' },
    { name: 'Plans', description: 'Plan management endpoints' },
    { name: 'Payments', description: 'Payment endpoints' },
    { name: 'Company', description: 'Company and subscription endpoints' }
]

const operationTags = {
    '/payment/webhook': 'Payments',
    '/register': 'Authentication',
    '/login': 'Authentication',
    '/logout': 'Authentication',
    '/delete-user': 'Authentication',
    '/chat/{id}/messages': 'Chat',
    '/profile': 'Profile',
    '/get-rooms': 'Chat',
    '/upload': 'Profile',
    '/product/create-product': 'Admin - Product',
    '/product/delete-product': 'Admin - Product',
    '/product/update-product/{id}': 'Admin - Product',
    '/lead/create-lead': 'Admin - Lead',
    '/lead/delete-lead': 'Admin - Lead',
    '/lead': 'Admin - Lead',
    '/get-request': 'Admin - Requests',
    '/handle-request': 'Admin - Requests',
    '/credit-amount': 'Admin - Accounts',
    '/room': 'Admin - Chat',
    '/get-all-user': 'Admin - Users',
    '/balance': 'Admin - Accounts',
    '/delete-room': 'Admin - Chat',
    '/get-stock-data': 'Warehouse',
    '/get-order-list': 'Warehouse',
    '/export-order/{id}': 'Warehouse',
    '/deliver-order/{id}': 'Warehouse',
    '/get-req-list': 'Warehouse',
    '/import-stock': 'Warehouse',
    '/create-order': 'Sales',
    '/leads': 'Sales',
    '/lead': 'Sales',
    '/orders': 'Sales',
    '/orders/{id}/payment': 'Payments',
    '/orders/{id}/confirm-payment': 'Payments',
    '/': 'Plans',
    '/make-payment': 'Payments',
    '/confirm-payment': 'Payments',
    '/create-member': 'Company',
    '/add-member': 'Company',
    '/members': 'Company',
    '/wallet': 'Company',
    '/wallet/credit': 'Company',
    '/subscription': 'Company',
    '/get-recordings': 'Company',
    '/stripe/balance': 'Company',
    '/stripe/onboarding': 'Company',
    '/stripe/status': 'Company',
    '/stripe/payout-history': 'Payments',
    '/stripe/payout': 'Payments'
}

const doc = {
    info: {
        title: 'Enterprise API & Schema Docs',
        version: '1.0.0',
        description: 'Swagger documentation for the enterprise API'
    },
    tags: tagDescriptions,
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

    const specification = JSON.parse(await readFile(outputFile, 'utf8'))
    for (const [endpoint, methods] of Object.entries(specification.paths)) {
        const tag = operationTags[endpoint]
        if (!tag) {
            throw new Error(`No Swagger category is configured for endpoint: ${endpoint}`)
        }
        for (const operation of Object.values(methods)) {
            operation.tags = [tag]
        }
    }
    await writeFile(outputFile, `${JSON.stringify(specification, null, 2)}\n`)

    console.log(`Swagger specification generated at ${outputFile}`)
}
catch (err) {
    console.error('Swagger specification generation failed:', err)
    process.exitCode = 1
}
