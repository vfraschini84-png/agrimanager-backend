// __tests__/admin-dev.test.js - Verifica sicurezza endpoint admin/dev
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const adminRoutes = require('../routes/admin');
const authRoutes = require('../routes/auth');

// Genera hash per password di test e setta env PRIMA di importare routes
process.env.DEV_PASSWORD_HASH = bcrypt.hashSync('TestDevPwd123!', 10);
process.env.ENABLE_DEV_PANEL = 'true';

const createApp = () => {
    const app = express();
    app.use(bodyParser.json());
    app.set('trust proxy', 1);
    app.use('/api/auth', authRoutes);
    app.use('/api/admin', adminRoutes);
    return app;
};

describe('Admin/Dev endpoint security', () => {
    let app, adminToken, normalUserToken;

    beforeAll(async () => {
        app = createApp();

        // Login super-admin (admin esiste già da seed)
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin', password: '96a0761f3943' });
        if (loginRes.statusCode === 200) {
            adminToken = loginRes.body.token;
        }

        // Crea utente normale per test 403
        const ts = Date.now();
        const reg = await request(app)
            .post('/api/auth/register')
            .send({
                username: `normal_${ts}`,
                email: `normal_${ts}@test.it`,
                password: 'password123',
                privacy_accepted: true
            });
        if (reg.statusCode === 201) normalUserToken = reg.body.token;
    });

    test('GET /api/admin/dev/users senza token → 401', async () => {
        const res = await request(app).get('/api/admin/dev/users');
        expect(res.statusCode).toBe(401);
    });

    test('GET /api/admin/dev/users con token normale → 403', async () => {
        if (!normalUserToken) return;
        const res = await request(app)
            .get('/api/admin/dev/users')
            .set('Authorization', `Bearer ${normalUserToken}`);
        expect(res.statusCode).toBe(403);
    });

    test('GET /api/admin/dev/users con admin ma senza dev session → 401', async () => {
        if (!adminToken) return;
        const res = await request(app)
            .get('/api/admin/dev/users')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/dev session/i);
    });

    test('POST /api/admin/dev/auth con password sbagliata → 403', async () => {
        if (!adminToken) return;
        const res = await request(app)
            .post('/api/admin/dev/auth')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ password: 'wrong-password' });
        expect(res.statusCode).toBe(403);
    });

    test('POST /api/admin/dev/auth con password corretta → 200 + devToken', async () => {
        if (!adminToken) return;
        const res = await request(app)
            .post('/api/admin/dev/auth')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ password: 'TestDevPwd123!' });
        expect(res.statusCode).toBe(200);
        expect(res.body.devToken).toBeDefined();
        expect(res.body.expiresInSec).toBe(1800);
    });

    test('Dev session token funziona per /dev/users', async () => {
        if (!adminToken) return;
        const auth = await request(app)
            .post('/api/admin/dev/auth')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ password: 'TestDevPwd123!' });
        const devToken = auth.body.devToken;

        const res = await request(app)
            .get('/api/admin/dev/users')
            .set('Authorization', `Bearer ${adminToken}`)
            .set('X-Dev-Token', devToken);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('Dev token NON utilizzabile da un utente normale (sub mismatch)', async () => {
        if (!adminToken || !normalUserToken) return;
        const auth = await request(app)
            .post('/api/admin/dev/auth')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ password: 'TestDevPwd123!' });
        const devToken = auth.body.devToken;

        // Utente normale prova ad usare il dev token di admin → deve passare auth principale ma fallire requireSuperAdmin
        const res = await request(app)
            .get('/api/admin/dev/users')
            .set('Authorization', `Bearer ${normalUserToken}`)
            .set('X-Dev-Token', devToken);
        expect(res.statusCode).toBe(403);
    });

    test('Dev panel disabilitato → 404 (non rivela esistenza)', async () => {
        process.env.ENABLE_DEV_PANEL = 'false';
        // Reload module - serve un nuovo router per applicare la variabile
        delete require.cache[require.resolve('../routes/admin')];
        const adminRoutesReloaded = require('../routes/admin');
        const app2 = express();
        app2.use(bodyParser.json());
        app2.set('trust proxy', 1);
        app2.use('/api/auth', authRoutes);
        app2.use('/api/admin', adminRoutesReloaded);

        const res = await request(app2).get('/api/admin/dev/users');
        expect(res.statusCode).toBe(404);

        // Ripristina per altri test
        process.env.ENABLE_DEV_PANEL = 'true';
        delete require.cache[require.resolve('../routes/admin')];
    });
});
