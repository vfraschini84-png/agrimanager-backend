// __tests__/lots.test.js - Verifica protezione endpoint dopo fix
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const lotsRoutes = require('../routes/lots');

const createApp = () => {
    const app = express();
    app.use(bodyParser.json());
    app.use('/api/lots', lotsRoutes);
    return app;
};

describe('Lots routes - protezione auth', () => {
    let app;
    beforeEach(() => { app = createApp(); });

    test('GET /api/lots senza token → 401', async () => {
        const res = await request(app).get('/api/lots');
        expect(res.statusCode).toBe(401);
    });

    test('GET /api/lots/1 senza token → 401 (era pubblico prima!)', async () => {
        const res = await request(app).get('/api/lots/1');
        expect(res.statusCode).toBe(401);
    });

    test('GET /api/lots/1/details senza token → 401 (era pubblico!)', async () => {
        const res = await request(app).get('/api/lots/1/details');
        expect(res.statusCode).toBe(401);
    });

    test('GET /api/lots/1/details/all senza token → 401 (era pubblico!)', async () => {
        const res = await request(app).get('/api/lots/1/details/all');
        expect(res.statusCode).toBe(401);
    });

    test('POST /api/lots/1/details senza token → 401 (era pubblico!)', async () => {
        const res = await request(app).post('/api/lots/1/details').send({});
        expect(res.statusCode).toBe(401);
    });

    test('PUT /api/lots/1/details/1 senza token → 401 (era pubblico!)', async () => {
        const res = await request(app).put('/api/lots/1/details/1').send({});
        expect(res.statusCode).toBe(401);
    });

    test('DELETE /api/lots/1/details/1 senza token → 401 (era pubblico!)', async () => {
        const res = await request(app).delete('/api/lots/1/details/1');
        expect(res.statusCode).toBe(401);
    });

    test('Token invalido → 403 (non più passa silenzioso)', async () => {
        const res = await request(app).get('/api/lots').set('Authorization', 'Bearer fake.token.here');
        expect(res.statusCode).toBe(403);
    });
});
