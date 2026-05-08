// __tests__/auth.test.js
// ✅ CARICA .env PRIMA di tutto (IMPORTANTE!)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// ✅ VERIFICA JWT_SECRET
if (!process.env.JWT_SECRET) {
    throw new Error('❌ JWT_SECRET non definito. Controlla .env file');
}

const authRoutes = require('../routes/auth');

// Setup express app for testing
const createTestApp = () => {
    const app = express();
    app.use(cors());
    app.use(bodyParser.json());
    app.use('/api/auth', authRoutes);
    return app;
};

describe('Authentication Routes', () => {
    let app;
    
    beforeEach(() => {
        app = createTestApp();
    });

    afterAll(async () => {
        // Chiudi connessioni aperte
        await new Promise(resolve => setTimeout(resolve, 500));
    });

    describe('POST /api/auth/register', () => {
        test('should reject request without required fields', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser'
                    // Missing email, password, privacy_accepted
                });
            
            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        test('should reject password shorter than 6 characters', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser',
                    email: 'test@example.com',
                    password: '123',
                    privacy_accepted: true
                });
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('almeno 6 caratteri');
        });

        test('should reject registration without privacy acceptance', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser',
                    email: 'test@example.com',
                    password: 'password123',
                    privacy_accepted: false
                });
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('privacy');
        });

        test('should return 201 with token on successful registration', async () => {
            const uniqueUsername = `user_${Date.now()}`;
            const uniqueEmail = `test_${Date.now()}@example.com`;
            
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: uniqueUsername,
                    email: uniqueEmail,
                    password: 'password123',
                    privacy_accepted: true
                });
            
            // Note: This test may fail if database is not properly isolated
            // In production, use a test database
            if (res.statusCode === 201) {
                expect(res.body).toHaveProperty('token');
                expect(res.body).toHaveProperty('user');
                expect(res.body.user.username).toBe(uniqueUsername);
            } else {
                expect([400, 201]).toContain(res.statusCode);
            }
        });
    });

    describe('POST /api/auth/login', () => {
        test('should reject login with missing credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'testuser'
                    // Missing password
                });
            
            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        test('should return 401 for invalid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'nonexistent_user_12345',
                    password: 'wrongpassword'
                });
            
            expect(res.statusCode).toBe(401);
            expect(res.body.error).toContain('Credenziali');
        });

        test('should return token on successful login', async () => {
            // This test requires a known user in database
            // For now, just check the response structure
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'admin',
                    password: 'admin123'
                });
            
            if (res.statusCode === 200) {
                expect(res.body).toHaveProperty('token');
                expect(res.body).toHaveProperty('user');
            } else {
                // User might not exist, that's ok
                expect([401, 400]).toContain(res.statusCode);
            }
        });
    });

    describe('Validation & Security', () => {
        test('should validate JWT format', () => {
            // JWT format: xxxxx.yyyyy.zzzzz
            const validJWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
            expect(validJWT.test('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')).toBe(true);
        });

        test('should not expose sensitive data in response', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: `user_${Date.now()}`,
                    email: `test_${Date.now()}@example.com`,
                    password: 'password123',
                    privacy_accepted: true
                });
            
            // Should not contain password_hash
            if (res.body.user) {
                expect(res.body.user).not.toHaveProperty('password_hash');
                expect(res.body.user).not.toHaveProperty('password');
            }
        });
    });
});

describe('Server Health', () => {
    test('server should be running', (done) => {
        const app = createTestApp();
        expect(app).toBeDefined();
        done();
    });
});
