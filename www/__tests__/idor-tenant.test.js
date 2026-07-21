// __tests__/idor-tenant.test.js
// Verifica che il tenant guard blocchi tentativi IDOR (Insecure Direct Object Reference):
// un utente di TenantA non deve poter modificare/cancellare risorse di TenantB.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('../routes/auth');
const lotsRoutes = require('../routes/lots');
const activitiesRoutes = require('../routes/activities');
const analysesRoutes = require('../routes/analyses');
const costiRoutes = require('../routes/costi');
const db = require('../database');

const createApp = () => {
    const app = express();
    app.use(bodyParser.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/lots', lotsRoutes);
    app.use('/api/activities', activitiesRoutes);
    app.use('/api/analyses', analysesRoutes);
    app.use('/api/costi', costiRoutes);
    return app;
};

describe('IDOR tenant guard (cross-tenant access)', () => {
    let app;
    let tenantAToken, tenantAUser, tenantALotId;
    let tenantBToken, tenantBUser, tenantBLotId;
    // Id delle risorse del tenant B su cui l'utente A tenterà l'IDOR
    let bActivityId, bAnalysisId, bCostoPersId, bCostoMezziId;

    const now = Date.now();

    beforeAll(async () => {
        app = createApp();

        // ---- Crea due tenant separati (owner_id != owner_id) ----
        tenantAUser = `tenant_a_${now}`;
        const regA = await request(app).post('/api/auth/register').send({
            username: tenantAUser,
            email: `${tenantAUser}@test.it`,
            password: 'password123',
            privacy_accepted: true,
            role: 'admin'
        });
        expect(regA.statusCode).toBe(201);
        tenantAToken = regA.body.token;

        tenantBUser = `tenant_b_${now}`;
        const regB = await request(app).post('/api/auth/register').send({
            username: tenantBUser,
            email: `${tenantBUser}@test.it`,
            password: 'password123',
            privacy_accepted: true,
            role: 'admin'
        });
        expect(regB.statusCode).toBe(201);
        tenantBToken = regB.body.token;

        // ---- Ogni tenant crea 1 lotto (con company_name inline) ----
        const lotA = await request(app).post('/api/lots')
            .set('Authorization', `Bearer ${tenantAToken}`)
            .send({ location: `LottoA_${now}`, area: 1, product_type: 'olivo', company_name: `AziendaA_${now}` });
        expect(lotA.statusCode).toBeLessThan(300);
        tenantALotId = lotA.body.data?.id || lotA.body.id;

        const lotB = await request(app).post('/api/lots')
            .set('Authorization', `Bearer ${tenantBToken}`)
            .send({ location: `LottoB_${now}`, area: 2, product_type: 'vite', company_name: `AziendaB_${now}` });
        expect(lotB.statusCode).toBeLessThan(300);
        tenantBLotId = lotB.body.data?.id || lotB.body.id;

        // ---- Tenant B popola le sue risorse (activities, analyses, costi_personale, costi_mezzi) ----
        const actB = await request(app).post('/api/activities')
            .set('Authorization', `Bearer ${tenantBToken}`)
            .send({ lot_id: tenantBLotId, date: '2026-06-01', kg: 500, notes: 'raccolta B' });
        expect(actB.statusCode).toBe(201);
        bActivityId = actB.body.id;

        const anaB = await request(app).post('/api/analyses')
            .set('Authorization', `Bearer ${tenantBToken}`)
            .send({
                lot_id: tenantBLotId, year: 2026, filename: 'test.pdf',
                originalName: 'test.pdf', fileUrl: '/uploads/test.pdf',
                notes: 'analisi B', fileSize: 1024
            });
        expect(anaB.statusCode).toBe(201);
        bAnalysisId = anaB.body.id;

        const persB = await request(app).post('/api/costi/personale')
            .set('Authorization', `Bearer ${tenantBToken}`)
            .send({
                lot_id: tenantBLotId, stagione_agricola: '2026',
                data_attivita: '2026-06-01', numero_operatori: 2,
                qualifica: 'standard', ore_lavorate: 8, attivita: 'raccolta'
            });
        expect(persB.statusCode).toBe(201);
        bCostoPersId = persB.body.id;

        const mezziB = await request(app).post('/api/costi/mezzi')
            .set('Authorization', `Bearer ${tenantBToken}`)
            .send({
                lot_id: tenantBLotId, stagione_agricola: '2026',
                data_registrazione: '2026-06-01', descrizione: 'rame',
                importo: 150, categoria: 'fitofarmaci'
            });
        expect(mezziB.statusCode).toBe(201);
        bCostoMezziId = mezziB.body.id;
    });

    afterAll(async () => {
        // Cleanup: rimuovi utenti e cascade
        try {
            await db.runAsync(`DELETE FROM users WHERE username IN (?, ?)`, [tenantAUser, tenantBUser]);
        } catch (_) {}
    });

    // =============== ACTIVITIES ===============
    describe('IDOR /api/activities', () => {
        test('Tenant A NON può cancellare activity di Tenant B → 403', async () => {
            const res = await request(app)
                .delete(`/api/activities/${bActivityId}`)
                .set('Authorization', `Bearer ${tenantAToken}`);
            expect(res.statusCode).toBe(403);
            // Verifica che l'activity di B esista ancora
            const stillThere = await db.getAsync('SELECT id FROM activities WHERE id = ?', [bActivityId]);
            expect(stillThere).toBeTruthy();
        });

        test('Tenant A NON può creare activity con lot_id di Tenant B → 403', async () => {
            const res = await request(app)
                .post('/api/activities')
                .set('Authorization', `Bearer ${tenantAToken}`)
                .send({ lot_id: tenantBLotId, date: '2026-06-01', kg: 999, notes: 'IDOR!' });
            expect(res.statusCode).toBe(403);
        });

        test('Tenant B PUÒ cancellare la propria activity → 200 (regression)', async () => {
            // Ricrea per non consumare quella di setup
            const created = await request(app).post('/api/activities')
                .set('Authorization', `Bearer ${tenantBToken}`)
                .send({ lot_id: tenantBLotId, date: '2026-06-02', kg: 100, notes: 'usa e getta' });
            expect(created.statusCode).toBe(201);
            const res = await request(app)
                .delete(`/api/activities/${created.body.id}`)
                .set('Authorization', `Bearer ${tenantBToken}`);
            expect(res.statusCode).toBe(200);
        });
    });

    // =============== ANALYSES ===============
    describe('IDOR /api/analyses', () => {
        test('Tenant A NON può cancellare analisi di Tenant B → 403', async () => {
            const res = await request(app)
                .delete(`/api/analyses/${bAnalysisId}`)
                .set('Authorization', `Bearer ${tenantAToken}`);
            expect(res.statusCode).toBe(403);
            const stillThere = await db.getAsync('SELECT id FROM analyses WHERE id = ?', [bAnalysisId]);
            expect(stillThere).toBeTruthy();
        });

        test('Tenant A NON può creare analisi con lot_id di Tenant B → 403', async () => {
            const res = await request(app)
                .post('/api/analyses')
                .set('Authorization', `Bearer ${tenantAToken}`)
                .send({
                    lot_id: tenantBLotId, year: 2026, filename: 'x.pdf',
                    originalName: 'x.pdf', fileUrl: '/uploads/x.pdf', fileSize: 100
                });
            expect(res.statusCode).toBe(403);
        });
    });

    // =============== COSTI PERSONALE ===============
    describe('IDOR /api/costi/personale', () => {
        test('Tenant A NON può cancellare costo personale di Tenant B → 403', async () => {
            const res = await request(app)
                .delete(`/api/costi/personale/${bCostoPersId}`)
                .set('Authorization', `Bearer ${tenantAToken}`);
            expect(res.statusCode).toBe(403);
            const stillThere = await db.getAsync('SELECT id FROM costi_personale WHERE id = ?', [bCostoPersId]);
            expect(stillThere).toBeTruthy();
        });

        test('Tenant A NON può modificare (PUT) costo personale di Tenant B → 403', async () => {
            const res = await request(app)
                .put(`/api/costi/personale/${bCostoPersId}`)
                .set('Authorization', `Bearer ${tenantAToken}`)
                .send({ numero_operatori: 999, ore_lavorate: 999 });
            expect(res.statusCode).toBe(403);
        });

        test('Tenant A NON può creare costo personale con lot_id di Tenant B → 403', async () => {
            const res = await request(app)
                .post('/api/costi/personale')
                .set('Authorization', `Bearer ${tenantAToken}`)
                .send({
                    lot_id: tenantBLotId, stagione_agricola: '2026',
                    data_attivita: '2026-06-01', numero_operatori: 1,
                    qualifica: 'standard', ore_lavorate: 1, attivita: 'IDOR!'
                });
            expect(res.statusCode).toBe(403);
        });

        test('Tenant B PUÒ modificare il proprio costo personale (regression)', async () => {
            const res = await request(app)
                .put(`/api/costi/personale/${bCostoPersId}`)
                .set('Authorization', `Bearer ${tenantBToken}`)
                .send({ note: 'aggiornato dal legittimo owner' });
            expect(res.statusCode).toBe(200);
        });
    });

    // =============== COSTI MEZZI TECNICI ===============
    describe('IDOR /api/costi/mezzi', () => {
        test('Tenant A NON può cancellare costo mezzi di Tenant B → 403', async () => {
            const res = await request(app)
                .delete(`/api/costi/mezzi/${bCostoMezziId}`)
                .set('Authorization', `Bearer ${tenantAToken}`);
            expect(res.statusCode).toBe(403);
            const stillThere = await db.getAsync('SELECT id FROM costi_mezzi_tecnici WHERE id = ?', [bCostoMezziId]);
            expect(stillThere).toBeTruthy();
        });

        test('Tenant A NON può creare costo mezzi con lot_id di Tenant B → 403', async () => {
            const res = await request(app)
                .post('/api/costi/mezzi')
                .set('Authorization', `Bearer ${tenantAToken}`)
                .send({
                    lot_id: tenantBLotId, stagione_agricola: '2026',
                    data_registrazione: '2026-06-01', descrizione: 'IDOR',
                    importo: 100, categoria: 'fitofarmaci'
                });
            expect(res.statusCode).toBe(403);
        });
    });

    // =============== GET IDOR (regression per le route lettura) ===============
    describe('GET tenant isolation (regression)', () => {
        test('Tenant A NON legge costi_personale di Tenant B → 403', async () => {
            const res = await request(app)
                .get(`/api/costi/personale/${tenantBLotId}/2026`)
                .set('Authorization', `Bearer ${tenantAToken}`);
            expect(res.statusCode).toBe(403);
        });

        test('Tenant A NON legge costi_mezzi di Tenant B → 403', async () => {
            const res = await request(app)
                .get(`/api/costi/mezzi/${tenantBLotId}/2026`)
                .set('Authorization', `Bearer ${tenantAToken}`);
            expect(res.statusCode).toBe(403);
        });
    });

    // =============== PERMESSI RBAC (viewer non può cancellare) ===============
    describe('RBAC: viewer non può fare mutations', () => {
        let viewerToken, viewerUsername;
        
        beforeAll(async () => {
            viewerUsername = `viewer_${now}`;
            // Crea viewer come sub-user di Tenant B
            const reg = await request(app).post('/api/auth/register')
                .set('Authorization', `Bearer ${tenantBToken}`)
                .send({
                    username: viewerUsername,
                    email: `${viewerUsername}@test.it`,
                    password: 'password123',
                    role: 'viewer'
                });
            expect(reg.statusCode).toBe(201);
            // Login del viewer
            const login = await request(app).post('/api/auth/login').send({
                username: viewerUsername, password: 'password123'
            });
            expect(login.statusCode).toBe(200);
            viewerToken = login.body.token;
        });

        test('viewer NON può DELETE /api/costi/personale/:id → 403 permesso', async () => {
            const res = await request(app)
                .delete(`/api/costi/personale/${bCostoPersId}`)
                .set('Authorization', `Bearer ${viewerToken}`);
            expect(res.statusCode).toBe(403);
        });

        test('viewer NON può DELETE /api/activities/:id → 403 permesso', async () => {
            const res = await request(app)
                .delete(`/api/activities/${bActivityId}`)
                .set('Authorization', `Bearer ${viewerToken}`);
            expect(res.statusCode).toBe(403);
        });

        test('viewer NON può POST /api/costi/mezzi → 403 permesso', async () => {
            const res = await request(app)
                .post('/api/costi/mezzi')
                .set('Authorization', `Bearer ${viewerToken}`)
                .send({
                    lot_id: tenantBLotId, stagione_agricola: '2026',
                    data_registrazione: '2026-06-01', descrizione: 'x',
                    importo: 100, categoria: 'fitofarmaci'
                });
            expect(res.statusCode).toBe(403);
        });
    });
});
