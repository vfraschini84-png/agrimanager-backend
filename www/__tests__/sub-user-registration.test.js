// __tests__/sub-user-registration.test.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('../routes/auth');

const createApp = () => {
    const app = express();
    app.use(bodyParser.json());
    app.use('/api/auth', authRoutes);
    return app;
};

describe('Privacy ereditata sui sotto-utenti', () => {
    let app, parentToken, parentUsername;

    beforeAll(async () => {
        app = createApp();
        // Crea utente "genitore" che accetta privacy
        parentUsername = `parent_${Date.now()}`;
        const reg = await request(app)
            .post('/api/auth/register')
            .send({
                username: parentUsername,
                email: `${parentUsername}@test.it`,
                password: 'password123',
                privacy_accepted: true,
                role: 'admin'
            });
        expect(reg.statusCode).toBe(201);
        parentToken = reg.body.token;
    });

    test('senza token → privacy_accepted obbligatoria (registrazione pubblica)', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                username: `pubblico_${Date.now()}`,
                email: `pub_${Date.now()}@test.it`,
                password: 'password123'
                // niente privacy_accepted
            });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/privacy/i);
    });

    test('con Bearer token del genitore → privacy ereditata, registrazione OK', async () => {
        const sub = `sub_${Date.now()}`;
        const res = await request(app)
            .post('/api/auth/register')
            .set('Authorization', `Bearer ${parentToken}`)
            .send({
                username: sub,
                email: `${sub}@test.it`,
                password: 'password123',
                role: 'operatore'
                // NESSUN privacy_accepted nel body!
            });
        expect(res.statusCode).toBe(201);
        expect(res.body.inherited_privacy).toBe(true);
        expect(res.body.user.parent_id).toBeTruthy();
    });

    test('con token invalido → trattato come pubblico (privacy obbligatoria)', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .set('Authorization', 'Bearer fake.token.xyz')
            .send({
                username: `x_${Date.now()}`,
                email: `x_${Date.now()}@test.it`,
                password: 'password123'
            });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/privacy/i);
    });
});
