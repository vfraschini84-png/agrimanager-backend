// __tests__/reset-password.test.js
// Verifica reset password + atomicità transazionale
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET non definito');
}

const db = require('../database');
const authRoutes = require('../routes/auth');

const createApp = () => {
    const app = express();
    app.use(bodyParser.json());
    app.use('/api/auth', authRoutes);
    return app;
};

describe('Reset password — atomicità transazionale', () => {
    let app;
    let testUser;
    const oldPassword = 'oldPwd_' + Date.now();
    const newPassword = 'newPwd_' + Date.now();

    beforeAll(async () => {
        app = createApp();
        const ts = Date.now();
        const oldHash = await bcrypt.hash(oldPassword, 10);
        const result = await db.runAsync(
            `INSERT INTO users (username, email, password_hash, role, privacy_accepted)
             VALUES (?, ?, ?, 'operatore', 1)`,
            [`reset_test_${ts}`, `reset_${ts}@test.it`, oldHash]
        );
        testUser = { id: result.id, username: `reset_test_${ts}`, email: `reset_${ts}@test.it` };
    });

    afterAll(async () => {
        // Cleanup
        await db.runAsync('DELETE FROM password_reset_tokens WHERE user_id = ?', [testUser.id]);
        await db.runAsync('DELETE FROM users WHERE id = ?', [testUser.id]);
        await new Promise(resolve => setTimeout(resolve, 200));
    });

    test('Reset password aggiorna password E marca token come usato (atomico)', async () => {
        // Crea token valido manualmente (no SMTP needed)
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000).toISOString();
        await db.runAsync(
            `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
            [testUser.id, token, expiresAt]
        );

        // Chiama reset-password
        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ token, newPassword });
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        // Verifica password effettivamente cambiata
        const user = await db.getAsync('SELECT password_hash FROM users WHERE id = ?', [testUser.id]);
        const matches = await bcrypt.compare(newPassword, user.password_hash);
        expect(matches).toBe(true);

        // Verifica token marcato usato
        const tk = await db.getAsync('SELECT used FROM password_reset_tokens WHERE token = ?', [token]);
        expect(tk.used).toBe(1);
    });

    test('Token già usato → 400', async () => {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000).toISOString();
        await db.runAsync(
            `INSERT INTO password_reset_tokens (user_id, token, expires_at, used) VALUES (?, ?, ?, 1)`,
            [testUser.id, token, expiresAt]
        );

        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ token, newPassword: 'qualcosa123' });
        expect(res.statusCode).toBe(400);
    });

    test('Token scaduto → 400', async () => {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() - 3600000).toISOString(); // 1h fa
        await db.runAsync(
            `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
            [testUser.id, token, expiresAt]
        );

        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ token, newPassword: 'qualcosa123' });
        expect(res.statusCode).toBe(400);
    });

    test('Password troppo corta (<6 char) → 400', async () => {
        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ token: 'fake', newPassword: '123' });
        expect(res.statusCode).toBe(400);
    });
});
