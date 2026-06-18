// routes/reports.js — Generazione PDF "Bilancio Stagione"
const express = require('express');
const PDFDocument = require('pdfkit');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const jwt = require('jsonwebtoken');
const db = require('../database');
const logger = require('../logger');
const { requirePermission } = require('../middleware/rbac');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
    const token = (req.headers['authorization'] || '').split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token non fornito' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) {
        return res.status(403).json({ error: 'Token non valido' });
    }
}

async function assertLotAccess(req, lotId) {
    const lot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [lotId]);
    if (!lot) return { error: 404, message: 'Lotto non trovato' };
    if (req.user.username === 'admin' || req.user.role === 'admin') return { lot };
    const u = await db.getAsync('SELECT parent_id FROM users WHERE id = ?', [req.user.id]);
    const tenantOwnerId = u?.parent_id || req.user.id;
    if (lot.owner_id !== tenantOwnerId) return { error: 403, message: 'Accesso negato' };
    return { lot };
}

const chartCanvas = new ChartJSNodeCanvas({
    width: 500, height: 300, backgroundColour: 'white'
});

const fmtEur = (n) => `€ ${(Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtKg = (n) => `${(Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg`;

/**
 * GET /api/reports/bilancio/:lotId?stagione=YYYY
 * Genera un PDF "Bilancio Stagione" per il lotto specificato.
 */
router.get('/bilancio/:lotId', authenticateToken, requirePermission('economic:read'), async (req, res) => {
    try {
        const access = await assertLotAccess(req, req.params.lotId);
        if (access.error) return res.status(access.error).json({ error: access.message });

        const lot = access.lot;
        const stagione = req.query.stagione || null;

        // Carica record economici (filtro stagione opzionale)
        let records;
        if (stagione) {
            records = await db.allAsync(
                `SELECT * FROM economic_records WHERE lot_id = ? AND stagione_agricola = ? ORDER BY data_acquisto_vendita`,
                [lot.id, stagione]
            );
        } else {
            records = await db.allAsync(
                `SELECT * FROM economic_records WHERE lot_id = ? ORDER BY data_acquisto_vendita`,
                [lot.id]
            );
        }

        // Aggregazioni
        const tot = records.reduce((acc, r) => {
            acc.ricavi += Number(r.ricavi_totali || 0);
            acc.kg += Number(r.totale_kg || 0);
            acc.mezzi += Number(r.costo_mezzi_tecnici || 0);
            acc.personale += Number(r.costo_personale || 0);
            acc.ammortamento += Number(r.quota_ammortamento || 0);
            return acc;
        }, { ricavi: 0, kg: 0, mezzi: 0, personale: 0, ammortamento: 0 });
        tot.costiTotali = tot.mezzi + tot.personale + tot.ammortamento;
        tot.bilancio = tot.ricavi - tot.costiTotali;
        tot.prezzoMedio = tot.kg > 0 ? tot.ricavi / tot.kg : 0;

        // Attività di raccolta (per dettaglio)
        const activities = await db.allAsync(
            `SELECT date, kg, notes FROM activities WHERE lot_id = ? ORDER BY date DESC LIMIT 30`,
            [lot.id]
        );
        const totKgRaccolto = activities.reduce((s, a) => s + Number(a.kg || 0), 0);

        // ==== Genera grafici come buffer PNG ====
        const chartRicaviCosti = await chartCanvas.renderToBuffer({
            type: 'doughnut',
            data: {
                labels: ['Ricavi', 'Costi'],
                datasets: [{
                    data: [tot.ricavi, tot.costiTotali],
                    backgroundColor: ['#4CAF50', '#f44336'],
                    borderWidth: 2
                }]
            },
            options: {
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 14 } } },
                    title: { display: true, text: 'Ricavi vs Costi', font: { size: 16 } }
                }
            }
        });

        const chartCostiBreakdown = await chartCanvas.renderToBuffer({
            type: 'bar',
            data: {
                labels: ['Mezzi tecnici', 'Personale', 'Ammortamenti'],
                datasets: [{
                    label: 'Costi (€)',
                    data: [tot.mezzi, tot.personale, tot.ammortamento],
                    backgroundColor: ['#FF9800', '#2196F3', '#9C27B0']
                }]
            },
            options: {
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Dettaglio Costi', font: { size: 16 } }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { callback: v => '€' + v } }
                }
            }
        });

        // ==== Grafico confronto ultime 5 stagioni (recupera dati di TUTTE le stagioni) ====
        const allRecordsLotto = await db.allAsync(
            `SELECT * FROM economic_records WHERE lot_id = ? ORDER BY stagione_agricola`,
            [lot.id]
        );
        const stagioniSet = new Set(allRecordsLotto.map(r => r.stagione_agricola).filter(Boolean));
        stagioniSet.add(String(new Date().getFullYear()));
        const stagioniMulti = Array.from(stagioniSet).sort((a, b) => parseInt(b) - parseInt(a)).slice(0, 5).reverse();
        
        const multiRicavi = [];
        const multiPersonale = [];
        const multiMezzi = [];
        const multiAmm = [];
        for (const s of stagioniMulti) {
            const recsS = allRecordsLotto.filter(r => String(r.stagione_agricola) === String(s));
            multiRicavi.push(recsS.reduce((sum, r) => sum + Number(r.ricavi_totali || 0), 0));
            const persRow = await db.getAsync(
                `SELECT COALESCE(SUM(costo_totale), 0) AS tot FROM costi_personale WHERE lot_id = ? AND stagione = ?`,
                [lot.id, s]
            ).catch(() => null);
            multiPersonale.push(Number(persRow?.tot || 0));
            const mezziRow = await db.getAsync(
                `SELECT COALESCE(SUM(importo), 0) AS tot FROM costi_mezzi_tecnici WHERE lot_id = ? AND stagione = ?`,
                [lot.id, s]
            ).catch(() => null);
            multiMezzi.push(Number(mezziRow?.tot || 0));
            // Ammortamenti dalla quota_ammortamento dei record della stagione
            multiAmm.push(recsS.reduce((sum, r) => sum + Number(r.quota_ammortamento || 0), 0));
        }
        
        const chartMultiStagione = await chartCanvas.renderToBuffer({
            type: 'bar',
            data: {
                labels: stagioniMulti,
                datasets: [
                    { label: 'Ricavi', data: multiRicavi, backgroundColor: '#4CAF50', stack: 'ricavi' },
                    { label: 'Personale', data: multiPersonale, backgroundColor: '#FF5722', stack: 'costi' },
                    { label: 'Mezzi tecnici', data: multiMezzi, backgroundColor: '#2196F3', stack: 'costi' },
                    { label: 'Ammortamenti', data: multiAmm, backgroundColor: '#9C27B0', stack: 'costi' }
                ]
            },
            options: {
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 12 } } },
                    title: { display: true, text: 'Confronto Ultime 5 Stagioni', font: { size: 16 } }
                },
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true, ticks: { callback: v => '€' + v } }
                }
            }
        });

        // ==== PDF ====
        const filename = `bilancio_${lot.company_name.replace(/[^a-z0-9]/gi, '_')}_${stagione || 'tutte'}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true, info: {
            Title: `Bilancio ${lot.company_name}`,
            Author: 'Cropbook',
            Subject: 'Report Bilancio Stagione'
        }});
        doc.pipe(res);

        // Header
        doc.fillColor('#2E7D32').fontSize(24).font('Helvetica-Bold').text('Cropbook', { continued: false });
        doc.fillColor('#555').fontSize(11).font('Helvetica').text('Report Bilancio Stagione');
        doc.moveDown(0.5);
        doc.strokeColor('#4CAF50').lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1);

        // Info Lotto
        doc.fillColor('#222').fontSize(16).font('Helvetica-Bold').text(lot.company_name);
        doc.fontSize(10).font('Helvetica').fillColor('#555');
        doc.text(`Lotto #${lot.id}  ·  ${lot.product_type || 'N/D'}${lot.variety ? ' (' + lot.variety + ')' : ''}  ·  ${lot.location}`);
        if (lot.field_size) doc.text(`Superficie: ${lot.field_size} ha`);
        doc.text(`Stagione: ${stagione || 'Tutte'}  ·  Generato il ${new Date().toLocaleString('it-IT')}`);
        doc.moveDown(1);

        // KPI cards
        const drawKpi = (x, y, w, h, label, value, color) => {
            doc.roundedRect(x, y, w, h, 8).fillAndStroke(color, color);
            doc.fillColor('white').fontSize(9).font('Helvetica').text(label, x + 10, y + 10, { width: w - 20 });
            doc.fillColor('white').fontSize(15).font('Helvetica-Bold').text(value, x + 10, y + 28, { width: w - 20 });
        };
        const kpiY = doc.y;
        const kpiW = 155, kpiH = 60;
        drawKpi(50, kpiY, kpiW, kpiH, 'Ricavi totali', fmtEur(tot.ricavi), '#4CAF50');
        drawKpi(50 + kpiW + 15, kpiY, kpiW, kpiH, 'Costi totali', fmtEur(tot.costiTotali), '#f44336');
        drawKpi(50 + (kpiW + 15) * 2, kpiY, kpiW, kpiH, 'Bilancio', fmtEur(tot.bilancio), tot.bilancio >= 0 ? '#1976D2' : '#d32f2f');
        doc.y = kpiY + kpiH + 15;
        doc.x = 50;

        // Riga sotto-KPI
        doc.fillColor('#333').fontSize(10).font('Helvetica');
        doc.text(`Quantità totale venduta: ${fmtKg(tot.kg)}    ·    Prezzo medio: ${fmtEur(tot.prezzoMedio)}/kg    ·    Kg raccolti: ${fmtKg(totKgRaccolto)}`);
        doc.moveDown(0.5);

        // Grafici (riga 1: due grafici a torta affiancati)
        // Riserva 195pt verticali per la riga grafici
        const PAGE_BOTTOM = doc.page.height - 60; // margine sicurezza per footer
        const ensureSpace = (h) => {
            if (doc.y + h > PAGE_BOTTOM) {
                doc.addPage();
                doc.y = doc.page.margins.top;
                doc.x = 50;
            }
        };
        
        ensureSpace(200);
        doc.image(chartRicaviCosti, 50, doc.y, { width: 240 });
        doc.image(chartCostiBreakdown, 305, doc.y, { width: 240 });
        doc.y += 195;
        doc.x = 50;

        // ✅ Grafico confronto ultime 5 stagioni — su pagina nuova se non c'è spazio
        ensureSpace(260);
        doc.image(chartMultiStagione, 50, doc.y, { width: 495 });
        doc.y += 250;
        doc.x = 50;

        // ============ Tabella record economici con paginazione manuale ============
        ensureSpace(40);  // titolo + header tabella
        doc.fillColor('#222').fontSize(13).font('Helvetica-Bold').text('Registrazioni economiche', 50, doc.y);
        doc.moveDown(0.3);

        const cols = [
            { label: 'Stagione', w: 70 },
            { label: 'Data', w: 60 },
            { label: 'Kg', w: 60 },
            { label: '€/kg', w: 50 },
            { label: 'Ricavi', w: 70 },
            { label: 'Costi', w: 70 },
            { label: 'Bilancio', w: 70 }
        ];
        
        const drawTableHeader = () => {
            const headerY = doc.y;
            doc.rect(50, headerY, 450, 18).fill('#2E7D32');
            let cx = 50;
            doc.fontSize(9).font('Helvetica-Bold');
            cols.forEach(c => {
                doc.fillColor('#FFFFFF').text(
                    c.label,
                    cx + 4,
                    headerY + 5,
                    {
                        width: c.w - 8,
                        align: (c.label === 'Stagione' || c.label === 'Data') ? 'left' : 'right',
                        lineBreak: false
                    }
                );
                cx += c.w;
            });
            doc.y = headerY + 18;
            doc.x = 50;
            doc.font('Helvetica').fontSize(9).fillColor('#222');
        };
        
        drawTableHeader();

        if (records.length === 0) {
            doc.moveDown(0.5);
            doc.fillColor('#888').text('Nessuna registrazione economica per il periodo selezionato.', { align: 'center' });
        } else {
            // Filtra registrazioni "fantasma" (solo beni durevoli, ricavi=0 e kg=0)
            const visibili = records.filter(r =>
                !((Number(r.ricavi_totali || 0) === 0) && (Number(r.totale_kg || 0) === 0) && (Number(r.prezzo_kg || 0) === 0))
            );
            const sorgente = visibili.length > 0 ? visibili : records;
            const ROW_H = 16;
            
            sorgente.forEach((r, idx) => {
                // ✅ Page break manuale PRIMA di disegnare la riga (evita celle spaccate su pagine diverse)
                if (doc.y + ROW_H > PAGE_BOTTOM) {
                    doc.addPage();
                    doc.y = doc.page.margins.top;
                    doc.x = 50;
                    drawTableHeader();
                }
                
                const rowY = doc.y;
                if (idx % 2 === 0) doc.rect(50, rowY, 450, ROW_H).fill('#f5f5f5');
                let cx = 50;
                const costiRiga = Number(r.costo_personale || 0) + Number(r.costo_mezzi_tecnici || 0) + Number(r.quota_ammortamento || 0);
                const bilancioRiga = Number(r.ricavi_totali || 0) - costiRiga;
                const cells = [
                    { v: r.stagione_agricola || '-', align: 'left' },
                    { v: r.data_acquisto_vendita ? r.data_acquisto_vendita.substring(0, 10) : '-', align: 'left' },
                    { v: fmtKg(r.totale_kg).replace(' kg', ''), align: 'right' },
                    { v: fmtEur(r.prezzo_kg).replace('€ ', ''), align: 'right' },
                    { v: fmtEur(r.ricavi_totali), align: 'right' },
                    { v: fmtEur(costiRiga), align: 'right' },
                    { v: fmtEur(bilancioRiga), align: 'right' }
                ];
                cells.forEach((c, i) => {
                    doc.fillColor('#222').text(c.v, cx + 4, rowY + 4, { width: cols[i].w - 8, align: c.align, lineBreak: false });
                    cx += cols[i].w;
                });
                // ✅ Forza la y dopo la riga (NON usare moveDown perché PDFKit potrebbe aver alterato doc.y dentro text())
                doc.y = rowY + ROW_H;
                doc.x = 50;
            });
        }

        // Footer su ogni pagina (no addPage spurio: forzo posizione assoluta + lineBreak false)
        doc.fontSize(8).fillColor('#888').font('Helvetica');
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            doc.switchToPage(range.start + i);
            const yFooter = doc.page.height - 35;
            doc.text(
                `Cropbook · ${lot.company_name} · pag. ${i + 1}/${range.count}`,
                50, yFooter,
                { width: 495, align: 'center', lineBreak: false, height: 20 }
            );
        }
        // ✅ Flush solo le pagine create finora (evita pagine vuote da addPage spurio in fase finale)
        doc.flushPages();

        doc.end();
    } catch (error) {
        logger.error('Errore generazione PDF bilancio', { error: error.message, stack: error.stack });
        if (!res.headersSent) {
            res.status(500).json({ error: 'Errore generazione report PDF: ' + error.message });
        }
    }
});

module.exports = router;
