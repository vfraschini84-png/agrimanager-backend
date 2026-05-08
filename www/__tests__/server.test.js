// __tests__/server.test.js - Smoke test server (health, 404, swagger, static safety)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../server');

describe('Server smoke tests', () => {
    test('GET /api/health → 200', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    test('GET /api-docs.json → swagger spec valido', async () => {
        const res = await request(app).get('/api-docs.json');
        expect(res.statusCode).toBe(200);
        expect(res.body.openapi).toBe('3.0.0');
    });

    test('GET /agrimanager.db → 404 (file DB non esposto)', async () => {
        const res = await request(app).get('/agrimanager.db');
        expect(res.statusCode).toBe(404);
    });

    test('GET /server.js → 404 (sorgenti non esposti)', async () => {
        const res = await request(app).get('/server.js');
        expect(res.statusCode).toBe(404);
    });

    test('GET /database.js → 404 (sorgenti non esposti)', async () => {
        const res = await request(app).get('/database.js');
        expect(res.statusCode).toBe(404);
    });

    test('GET /.env → 404', async () => {
        const res = await request(app).get('/.env');
        expect(res.statusCode).toBe(404);
    });

    test('GET / → 200 (index.html)', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toBe(200);
    });

    test('GET /api/non-esistente → 404 JSON', async () => {
        const res = await request(app).get('/api/non-esistente');
        expect(res.statusCode).toBe(404);
        expect(res.body).toHaveProperty('error');
    });
});
