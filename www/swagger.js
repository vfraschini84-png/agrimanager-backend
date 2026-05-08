// swagger.js - Swagger/OpenAPI Documentation Setup
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'AgriManager API',
            version: '1.0.0',
            description: 'API per la gestione di lotti agricoli con multitenant support',
            contact: {
                name: 'AgriManager Team',
                url: 'https://agrimanager.example.com',
            },
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server',
            },
            {
                url: 'http://192.168.0.69:3000',
                description: 'Local network',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT token for authentication',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                        message: { type: 'string' },
                    },
                },
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        username: { type: 'string' },
                        email: { type: 'string' },
                        role: { type: 'string', enum: ['admin', 'manager', 'operator', 'viewer'] },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
                Lot: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        company_name: { type: 'string' },
                        location: { type: 'string' },
                        product_type: { type: 'string' },
                        field_size: { type: 'number' },
                        owner_id: { type: 'integer' },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
                Activity: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        lot_id: { type: 'integer' },
                        type: { type: 'string' },
                        date: { type: 'string', format: 'date' },
                        kg: { type: 'number' },
                        notes: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: [
        './routes/auth.js',
        './routes/lots.js',
        './routes/activities.js',
        './routes/analyses.js',
        './routes/economic.js',
        './routes/costi.js',
    ],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
