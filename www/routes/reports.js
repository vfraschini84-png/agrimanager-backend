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
const fmtPct = (n) => `${(Number(n) || 0).toFixed(1)}%`;

/**
 * Estrae beni durevoli attivi dato un set di registrazioni economiche e l'anno.
 * Replica server-side della funzione caricaBeniDurevoliAttivi del frontend.
 * Dedupe per chiave: `${descrizione}_${anno_inizio}_${costo_totale}`.
 */
function estraiBeniAttivi(registrazioni, anno) {
    if (!Array.isArray(registrazioni)) return [];
    const annoNum = parseInt(anno);
    const beniAttivi = [];
    const visti = new Set();
    
    const ordinate = [...registrazioni].sort((a, b) =>
        (parseInt(a.stagione_agricola) || 0) - (parseInt(b.stagione_agricola) || 0)
    );
    
    for (const reg of ordinate) {
        if (!reg.beni_durevoli) continue;
        let beni;
        try {
            beni = typeof reg.beni_durevoli === 'string'
                ? JSON.parse(reg.beni_durevoli)
                : reg.beni_durevoli;
        } catch (_) { continue; }
        if (!Array.isArray(beni)) continue;
        
        for (const bene of beni) {
            const descrizione = bene.descrizione || 'Bene durevole';
            const annoInizio = parseInt(bene.anno_inizio) || parseInt(reg.stagione_agricola) || annoNum;
            const anniAmm = parseInt(bene.anni_ammortamento) || 1;
            const annoFine = annoInizio + anniAmm - 1;
            const costo = Number(bene.costo_totale) || 0;
            const quota = Number(bene.quota_annuale) || (anniAmm > 0 ? costo / anniAmm : 0);
            
            if (annoNum >= annoInizio && annoNum <= annoFine) {
                const chiave = `${descrizione}_${annoInizio}_${costo}`;
                if (!visti.has(chiave)) {
                    visti.add(chiave);
                    beniAttivi.push({
                        descrizione, costo_totale: costo, anni_ammortamento: anniAmm,
                        quota_annuale: quota, anno_inizio: annoInizio, anno_fine: annoFine
                    });
                }
            }
        }
    }
    return beniAttivi;
}

/**
 * Aggrega beni durevoli su un set di registrazioni considerando per ogni anno
 * solo i beni attivi. Restituisce array { descrizione, quota_totale } sommata
 * su tutti gli anni in cui il bene è attivo (ammortamento cumulato lifetime).
 * Se `anniFiltro` è null aggrega sull'unione di tutti gli anni delle registrazioni.
 */
function aggregaAmmortamentiPerBene(registrazioni, anniFiltro = null) {
    const anniSet = anniFiltro && anniFiltro.length > 0
        ? new Set(anniFiltro.map(a => parseInt(a)))
        : new Set(registrazioni.map(r => parseInt(r.stagione_agricola)).filter(Boolean));
    
    const perBene = new Map(); // chiave -> { descrizione, quota_annuale, anni_attivi: Set }
    for (const anno of anniSet) {
        const attivi = estraiBeniAttivi(registrazioni, anno);
        for (const b of attivi) {
            const k = `${b.descrizione}_${b.anno_inizio}_${b.costo_totale}`;
            if (!perBene.has(k)) {
                perBene.set(k, {
                    descrizione: b.descrizione,
                    quota_annuale: b.quota_annuale,
                    costo_totale: b.costo_totale,
                    anni_ammortamento: b.anni_ammortamento,
                    anni_conteggio: 0
                });
            }
            perBene.get(k).anni_conteggio += 1;
        }
    }
    return Array.from(perBene.values()).map(b => ({
        descrizione: b.descrizione,
        quota_totale: b.quota_annuale * b.anni_conteggio,
        quota_annuale: b.quota_annuale,
        anni_conteggio: b.anni_conteggio,
        costo_totale: b.costo_totale,
        anni_ammortamento: b.anni_ammortamento
    }));
}

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

        // ✅ Aggregazioni: ricavi/kg dai record economici (snapshot), MA costi reali dalle tabelle dedicate
        // (allinea il PDF alla dashboard "Bilancio & Report" che usa le stesse fonti)
        const tot = records.reduce((acc, r) => {
            acc.ricavi += Number(r.ricavi_totali || 0);
            acc.kg += Number(r.totale_kg || 0);
            return acc;
        }, { ricavi: 0, kg: 0, mezzi: 0, personale: 0, ammortamento: 0 });
        
        // Costi personale e mezzi: SUM dalle tabelle reali (filtro stagione se richiesto)
        const persFiltro = stagione ? 'AND stagione_agricola = ?' : '';
        const persParams = stagione ? [lot.id, stagione] : [lot.id];
        const persSum = await db.getAsync(
            `SELECT COALESCE(SUM(costo_totale), 0) AS tot FROM costi_personale WHERE lot_id = ? ${persFiltro}`,
            persParams
        ).catch(() => null);
        tot.personale = Number(persSum?.tot || 0);
        const mezziSum = await db.getAsync(
            `SELECT COALESCE(SUM(importo), 0) AS tot FROM costi_mezzi_tecnici WHERE lot_id = ? ${persFiltro}`,
            persParams
        ).catch(() => null);
        tot.mezzi = Number(mezziSum?.tot || 0);
        
        // Ammortamenti: stessa logica della dashboard (beni attivi per ciascun anno)
        // Carica TUTTI i record economici del lotto per calcolare il timeline dei beni
        const recordsCompleti = await db.allAsync(
            `SELECT * FROM economic_records WHERE lot_id = ? ORDER BY stagione_agricola`,
            [lot.id]
        );
        const anniDaConsiderare = stagione
            ? [parseInt(stagione)]
            : Array.from(new Set(records.map(r => parseInt(r.stagione_agricola)).filter(Boolean)));
        let ammTot = 0;
        for (const anno of anniDaConsiderare) {
            const attivi = estraiBeniAttivi(recordsCompleti, anno);
            ammTot += attivi.reduce((s, b) => s + Number(b.quota_annuale || 0), 0);
        }
        tot.ammortamento = ammTot;
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

        // ==== Dati confronto ultime 5 stagioni (saranno renderizzate come card in PDFKit) ====
        // ✅ Riutilizza recordsCompleti già caricato
        const allRecordsLotto = recordsCompleti;
        const stagioniSet = new Set(allRecordsLotto.map(r => r.stagione_agricola).filter(Boolean));
        stagioniSet.add(String(new Date().getFullYear()));
        // ✅ Ordine cronologico DESCENDING (più recente in alto)
        const stagioniMulti = Array.from(stagioniSet).sort((a, b) => parseInt(b) - parseInt(a)).slice(0, 5);
        
        // ✅ Bulk query (no N+1): personale e mezzi raggruppati per stagione_agricola
        const personalePerStag = new Map();
        const mezziPerStag = new Map();
        try {
            const rowsP = await db.allAsync(
                `SELECT stagione_agricola AS s, COALESCE(SUM(costo_totale), 0) AS tot
                 FROM costi_personale WHERE lot_id = ? GROUP BY stagione_agricola`,
                [lot.id]
            );
            rowsP.forEach(r => personalePerStag.set(String(r.s), Number(r.tot || 0)));
        } catch (_) {}
        try {
            const rowsM = await db.allAsync(
                `SELECT stagione_agricola AS s, COALESCE(SUM(importo), 0) AS tot
                 FROM costi_mezzi_tecnici WHERE lot_id = ? GROUP BY stagione_agricola`,
                [lot.id]
            );
            rowsM.forEach(r => mezziPerStag.set(String(r.s), Number(r.tot || 0)));
        } catch (_) {}
        
        const datiStagioni = stagioniMulti.map(s => {
            const recsS = allRecordsLotto.filter(r => String(r.stagione_agricola) === String(s));
            const ricavi = recsS.reduce((sum, r) => sum + Number(r.ricavi_totali || 0), 0);
            const personale = personalePerStag.get(String(s)) || 0;
            const mezzi = mezziPerStag.get(String(s)) || 0;
            // ✅ Ammortamenti: usa la stessa logica della dashboard (beni attivi per anno)
            const beniAttivi = estraiBeniAttivi(allRecordsLotto, parseInt(s));
            const amm = beniAttivi.reduce((sum, b) => sum + Number(b.quota_annuale || 0), 0);
            const costi = personale + mezzi + amm;
            return { stagione: s, ricavi, personale, mezzi, amm, costi, bilancio: ricavi - costi };
        });

        // ==== Dettaglio Personale per Attività (raggruppato) ====
        const personalePerAttivita = await db.allAsync(
            `SELECT COALESCE(NULLIF(TRIM(attivita), ''), 'Non specificata') AS attivita,
                    COALESCE(NULLIF(qualifica, ''), 'standard') AS qualifica,
                    COALESCE(SUM(costo_totale), 0) AS totale,
                    COALESCE(SUM(ore_lavorate * numero_operatori), 0) AS ore_uomo,
                    COUNT(*) AS interventi
             FROM costi_personale
             WHERE lot_id = ? ${persFiltro}
             GROUP BY attivita, qualifica
             ORDER BY totale DESC`,
            persParams
        ).catch(() => []);
        const totalePersonaleDett = personalePerAttivita.reduce((s, r) => s + Number(r.totale || 0), 0);

        // ==== Dettaglio Mezzi Tecnici per Categoria ====
        const mezziPerCategoria = await db.allAsync(
            `SELECT COALESCE(NULLIF(categoria, ''), 'altro') AS categoria,
                    COALESCE(SUM(importo), 0) AS totale,
                    COUNT(*) AS interventi
             FROM costi_mezzi_tecnici
             WHERE lot_id = ? ${persFiltro}
             GROUP BY categoria
             ORDER BY totale DESC`,
            persParams
        ).catch(() => []);
        const totaleMezziDett = mezziPerCategoria.reduce((s, r) => s + Number(r.totale || 0), 0);
        
        // Dettaglio mezzi tecnici per Descrizione (top 10 per leggibilità del grafico)
        const mezziPerDescrizione = await db.allAsync(
            `SELECT COALESCE(NULLIF(TRIM(descrizione), ''), '(senza descrizione)') AS descrizione,
                    COALESCE(SUM(importo), 0) AS totale,
                    COUNT(*) AS interventi
             FROM costi_mezzi_tecnici
             WHERE lot_id = ? ${persFiltro}
             GROUP BY descrizione
             ORDER BY totale DESC
             LIMIT 10`,
            persParams
        ).catch(() => []);

        // ==== Dettaglio Ammortamenti per Bene Durevole ====
        const ammortamentiPerBene = aggregaAmmortamentiPerBene(recordsCompleti, anniDaConsiderare);
        ammortamentiPerBene.sort((a, b) => b.quota_totale - a.quota_totale);
        const totaleAmmDett = ammortamentiPerBene.reduce((s, r) => s + Number(r.quota_totale || 0), 0);

        // ==== Grafici dettagliati (PNG) — generati solo se ci sono dati ====
        const palette = ['#FF5722', '#FF9800', '#FFC107', '#4CAF50', '#00BCD4', '#2196F3', '#3F51B5', '#9C27B0', '#E91E63', '#795548'];
        const truncateLabel = (s, n = 18) => {
            const str = String(s || '');
            return str.length > n ? str.substring(0, n - 1) + '…' : str;
        };
        const buildHbarChart = async (labels, data, title, colors) => {
            if (labels.length === 0) return null;
            return chartCanvas.renderToBuffer({
                type: 'bar',
                data: {
                    labels: labels.map(l => truncateLabel(l, 22)),
                    datasets: [{ label: '€', data, backgroundColor: colors, borderWidth: 0 }]
                },
                options: {
                    indexAxis: 'y',
                    plugins: {
                        legend: { display: false },
                        title: { display: true, text: title, font: { size: 14, weight: 'bold' } }
                    },
                    scales: {
                        x: { beginAtZero: true, ticks: { callback: v => '€' + v } },
                        y: { ticks: { font: { size: 10 } } }
                    }
                }
            });
        };
        const chartPersonale = await buildHbarChart(
            personalePerAttivita.map(r => `${r.attivita} (${r.qualifica})`),
            personalePerAttivita.map(r => Number(r.totale)),
            'Costi Personale per Attività',
            personalePerAttivita.map((_, i) => palette[i % palette.length])
        );
        const chartMezzi = await buildHbarChart(
            mezziPerCategoria.map(r => r.categoria),
            mezziPerCategoria.map(r => Number(r.totale)),
            'Mezzi Tecnici per Categoria',
            mezziPerCategoria.map((_, i) => palette[i % palette.length])
        );
        const chartAmm = await buildHbarChart(
            ammortamentiPerBene.map(b => b.descrizione),
            ammortamentiPerBene.map(b => Number(b.quota_totale)),
            'Ammortamenti per Bene Durevole',
            ammortamentiPerBene.map((_, i) => palette[i % palette.length])
        );

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

        // ✅ Confronto Ultime 5 Stagioni — card list (stesso stile web mobile-friendly)
        ensureSpace(40);
        doc.fillColor('#222').fontSize(13).font('Helvetica-Bold').text('Confronto Ultime 5 Stagioni', 50, doc.y);
        doc.moveDown(0.4);
        
        const CARD_H = 60;
        const CARD_W = 495;
        const maxValoreSt = Math.max(...datiStagioni.flatMap(d => [d.ricavi, d.costi]), 1);
        
        datiStagioni.forEach((d, idx) => {
            ensureSpace(CARD_H + 8);
            const cardY = doc.y;
            // Card background
            doc.roundedRect(50, cardY, CARD_W, CARD_H, 6).fillAndStroke('#FFFFFF', '#e0e0e0');
            
            // Stagione (titolo)
            doc.fillColor('#2E7D32').fontSize(11).font('Helvetica-Bold')
               .text(`Stagione ${d.stagione}`, 60, cardY + 8, { width: 120, lineBreak: false });
            
            // Bilancio badge (top-right)
            const bilancioPositivo = d.bilancio >= 0;
            const badgeColor = bilancioPositivo ? '#E8F5E9' : '#FFEBEE';
            const badgeText = bilancioPositivo ? '#2E7D32' : '#c62828';
            const badgeLabel = (bilancioPositivo ? '▲ ' : '▼ ') + fmtEur(d.bilancio);
            const badgeWidth = 110;
            doc.roundedRect(50 + CARD_W - badgeWidth - 8, cardY + 6, badgeWidth, 18, 9).fillAndStroke(badgeColor, badgeColor);
            doc.fillColor(badgeText).fontSize(9).font('Helvetica-Bold')
               .text(badgeLabel, 50 + CARD_W - badgeWidth - 8, cardY + 11, { width: badgeWidth, align: 'center', lineBreak: false });
            
            // Riga Ricavi: label + barra + valore
            const labelW = 55;
            const valueW = 80;
            const barX = 60 + labelW + 6;
            const barW = CARD_W - labelW - valueW - 30;
            const ricaviRowY = cardY + 30;
            doc.fillColor('#555').fontSize(8).font('Helvetica').text('Ricavi', 60, ricaviRowY + 2, { width: labelW, lineBreak: false });
            // sfondo barra
            doc.rect(barX, ricaviRowY, barW, 8).fill('#f5f5f5');
            // riempimento barra ricavi (verde)
            const wR = barW * (d.ricavi / maxValoreSt);
            if (wR > 0.5) doc.rect(barX, ricaviRowY, wR, 8).fill('#4CAF50');
            doc.fillColor('#222').fontSize(8).font('Helvetica-Bold')
               .text(fmtEur(d.ricavi), 50 + CARD_W - valueW - 8, ricaviRowY + 2, { width: valueW, align: 'right', lineBreak: false });
            
            // Riga Costi: label + barra segmentata + valore
            const costiRowY = cardY + 44;
            doc.fillColor('#555').fontSize(8).font('Helvetica').text('Costi', 60, costiRowY + 2, { width: labelW, lineBreak: false });
            doc.rect(barX, costiRowY, barW, 8).fill('#f5f5f5');
            const wC = barW * (d.costi / maxValoreSt);
            if (wC > 0.5 && d.costi > 0) {
                // Segmenti proporzionali
                const wP = wC * (d.personale / d.costi);
                const wM = wC * (d.mezzi / d.costi);
                const wA = wC * (d.amm / d.costi);
                let segX = barX;
                if (wP > 0) { doc.rect(segX, costiRowY, wP, 8).fill('#FF5722'); segX += wP; }
                if (wM > 0) { doc.rect(segX, costiRowY, wM, 8).fill('#2196F3'); segX += wM; }
                if (wA > 0) { doc.rect(segX, costiRowY, wA, 8).fill('#9C27B0'); }
            }
            doc.fillColor('#222').fontSize(8).font('Helvetica-Bold')
               .text(fmtEur(d.costi), 50 + CARD_W - valueW - 8, costiRowY + 2, { width: valueW, align: 'right', lineBreak: false });
            
            doc.y = cardY + CARD_H + 6;
            doc.x = 50;
        });
        
        // Legenda colori
        ensureSpace(20);
        const legendY = doc.y + 4;
        const legendItems = [
            { color: '#FF5722', label: 'Personale' },
            { color: '#2196F3', label: 'Mezzi tecnici' },
            { color: '#9C27B0', label: 'Ammortamenti' }
        ];
        let legX = 60;
        legendItems.forEach(it => {
            doc.rect(legX, legendY + 2, 8, 8).fill(it.color);
            doc.fillColor('#555').fontSize(8).font('Helvetica').text(it.label, legX + 12, legendY + 2, { lineBreak: false });
            legX += 110;
        });
        doc.y = legendY + 16;
        doc.x = 50;

        // ============ DETTAGLI ANALITICI (Personale / Mezzi / Ammortamenti) ============
        // Helper: renderizza una sezione "Dettaglio voce di costo" con grafico + tabella incidenza
        const renderDettaglioCosto = (titolo, colorTema, righe, chartBuf, totale, labelCols) => {
            // Pagina nuova per ogni sezione di dettaglio (header chiaro e niente overlap)
            doc.addPage();
            doc.x = 50;
            doc.y = doc.page.margins.top;
            
            // Banner titolo
            const bannerY = doc.y;
            doc.rect(50, bannerY, 495, 28).fill(colorTema);
            doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold')
               .text(titolo, 58, bannerY + 8, { width: 487, lineBreak: false });
            doc.y = bannerY + 36;
            doc.x = 50;
            
            // Sottotitolo con totale + nota stagione
            doc.fillColor('#555').fontSize(10).font('Helvetica')
               .text(`Totale voce: ${fmtEur(totale)}  ·  Periodo: ${stagione || 'tutte le stagioni'}  ·  ${righe.length} ${righe.length === 1 ? 'voce' : 'voci'}`,
                     50, doc.y, { width: 495 });
            doc.moveDown(0.6);
            
            if (righe.length === 0) {
                doc.fillColor('#888').fontSize(11).font('Helvetica-Oblique')
                   .text('Nessun dato disponibile per questa voce nel periodo selezionato.', { align: 'center' });
                return;
            }
            
            // Grafico (se presente)
            if (chartBuf) {
                const chartH = Math.max(140, Math.min(320, 40 + righe.length * 24));
                ensureSpace(chartH + 10);
                doc.image(chartBuf, 50, doc.y, { width: 495, height: chartH });
                doc.y += chartH + 10;
                doc.x = 50;
            }
            
            // Tabella
            const colWs = labelCols.map(c => c.w);
            const tableW = colWs.reduce((s, w) => s + w, 0);
            const drawDettHeader = () => {
                const headerY = doc.y;
                doc.rect(50, headerY, tableW, 18).fill(colorTema);
                let cx = 50;
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
                labelCols.forEach(c => {
                    doc.fillColor('#FFFFFF').text(c.label, cx + 4, headerY + 5,
                        { width: c.w - 8, align: c.align || 'left', lineBreak: false });
                    cx += c.w;
                });
                doc.y = headerY + 18;
                doc.x = 50;
                doc.font('Helvetica').fontSize(9).fillColor('#222');
            };
            drawDettHeader();
            
            const ROW_H = 18;
            righe.forEach((r, idx) => {
                if (doc.y + ROW_H > PAGE_BOTTOM) {
                    doc.addPage(); doc.y = doc.page.margins.top; doc.x = 50; drawDettHeader();
                }
                const rowY = doc.y;
                if (idx % 2 === 0) doc.rect(50, rowY, tableW, ROW_H).fill('#f5f5f5');
                let cx = 50;
                labelCols.forEach((c) => {
                    const v = r[c.field] != null ? r[c.field] : '';
                    doc.fillColor('#222').text(String(v), cx + 4, rowY + 5,
                        { width: c.w - 8, align: c.align || 'left', lineBreak: false });
                    cx += c.w;
                });
                doc.y = rowY + ROW_H;
                doc.x = 50;
            });
            
            // Riga totale
            const totRowY = doc.y;
            doc.rect(50, totRowY, tableW, ROW_H).fill('#E8F5E9');
            let cx = 50;
            doc.fillColor('#1B5E20').font('Helvetica-Bold').fontSize(9);
            labelCols.forEach((c, i) => {
                let v = '';
                if (i === 0) v = 'TOTALE';
                else if (c.field === 'totale_str') v = fmtEur(totale);
                else if (c.field === 'incidenza_str') v = '100%';
                doc.fillColor('#1B5E20').text(v, cx + 4, totRowY + 5,
                    { width: c.w - 8, align: c.align || 'left', lineBreak: false });
                cx += c.w;
            });
            doc.y = totRowY + ROW_H;
            doc.x = 50;
        };
        
        // --- PERSONALE per Attività ---
        const righePersonale = personalePerAttivita.map(r => ({
            attivita: String(r.attivita || ''),
            qualifica: String(r.qualifica || ''),
            interventi: String(r.interventi || 0),
            ore: Number(r.ore_uomo || 0).toFixed(1),
            totale_str: fmtEur(r.totale),
            incidenza_str: totalePersonaleDett > 0
                ? fmtPct((Number(r.totale) / totalePersonaleDett) * 100) : '0%'
        }));
        renderDettaglioCosto(
            'Dettaglio Costo Personale per Attività', '#FF5722',
            righePersonale, chartPersonale, totalePersonaleDett,
            [
                { label: 'Attività',   field: 'attivita',      w: 170, align: 'left'  },
                { label: 'Qualifica',  field: 'qualifica',     w: 75,  align: 'left'  },
                { label: 'Interventi', field: 'interventi',    w: 70,  align: 'right' },
                { label: 'Ore-uomo',   field: 'ore',           w: 65,  align: 'right' },
                { label: 'Totale',     field: 'totale_str',    w: 75,  align: 'right' },
                { label: 'Incidenza',  field: 'incidenza_str', w: 60,  align: 'right' }
            ]
        );
        
        // --- MEZZI TECNICI per Categoria (+ top descrizioni) ---
        const righeMezzi = mezziPerCategoria.map(r => ({
            categoria: String(r.categoria || ''),
            interventi: String(r.interventi || 0),
            totale_str: fmtEur(r.totale),
            incidenza_str: totaleMezziDett > 0
                ? fmtPct((Number(r.totale) / totaleMezziDett) * 100) : '0%'
        }));
        renderDettaglioCosto(
            'Dettaglio Costo Mezzi Tecnici per Categoria', '#2196F3',
            righeMezzi, chartMezzi, totaleMezziDett,
            [
                { label: 'Categoria',   field: 'categoria',     w: 230, align: 'left'  },
                { label: 'Interventi',  field: 'interventi',    w: 100, align: 'right' },
                { label: 'Totale',      field: 'totale_str',    w: 100, align: 'right' },
                { label: 'Incidenza',   field: 'incidenza_str', w: 65,  align: 'right' }
            ]
        );
        
        // Aggiungi tabella secondaria "top 10 descrizioni" se >1 descrizione
        if (mezziPerDescrizione.length > 1 && totaleMezziDett > 0) {
            ensureSpace(40);
            doc.moveDown(0.8);
            doc.fillColor('#222').fontSize(11).font('Helvetica-Bold')
               .text('Top 10 mezzi tecnici per descrizione', 50, doc.y, { lineBreak: false });
            doc.moveDown(0.3);
            const subColsW = [305, 90, 100];
            const subHeaderY = doc.y;
            doc.rect(50, subHeaderY, 495, 16).fill('#1565C0');
            doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
               .text('Descrizione', 54, subHeaderY + 4, { width: subColsW[0] - 8, lineBreak: false })
               .text('Interventi', 50 + subColsW[0] + 4, subHeaderY + 4, { width: subColsW[1] - 8, align: 'right', lineBreak: false })
               .text('Totale', 50 + subColsW[0] + subColsW[1] + 4, subHeaderY + 4, { width: subColsW[2] - 8, align: 'right', lineBreak: false });
            doc.y = subHeaderY + 16;
            doc.x = 50;
            doc.font('Helvetica').fontSize(9).fillColor('#222');
            mezziPerDescrizione.forEach((r, idx) => {
                if (doc.y + 16 > PAGE_BOTTOM) { doc.addPage(); doc.y = doc.page.margins.top; doc.x = 50; }
                const rowY = doc.y;
                if (idx % 2 === 0) doc.rect(50, rowY, 495, 16).fill('#f5f5f5');
                doc.fillColor('#222')
                   .text(String(r.descrizione || ''), 54, rowY + 4, { width: subColsW[0] - 8, lineBreak: false })
                   .text(String(r.interventi || 0), 50 + subColsW[0] + 4, rowY + 4, { width: subColsW[1] - 8, align: 'right', lineBreak: false })
                   .text(fmtEur(r.totale), 50 + subColsW[0] + subColsW[1] + 4, rowY + 4, { width: subColsW[2] - 8, align: 'right', lineBreak: false });
                doc.y = rowY + 16;
                doc.x = 50;
            });
        }
        
        // --- AMMORTAMENTI per Bene ---
        const righeAmm = ammortamentiPerBene.map(b => ({
            descrizione: String(b.descrizione || ''),
            costo_str: fmtEur(b.costo_totale),
            anni: `${b.anni_ammortamento}`,
            quota_str: fmtEur(b.quota_annuale),
            anni_conteggio: String(b.anni_conteggio),
            totale_str: fmtEur(b.quota_totale),
            incidenza_str: totaleAmmDett > 0
                ? fmtPct((Number(b.quota_totale) / totaleAmmDett) * 100) : '0%'
        }));
        renderDettaglioCosto(
            'Dettaglio Ammortamenti per Bene Durevole', '#9C27B0',
            righeAmm, chartAmm, totaleAmmDett,
            [
                { label: 'Bene',             field: 'descrizione',     w: 165, align: 'left'  },
                { label: 'Costo',            field: 'costo_str',       w: 65,  align: 'right' },
                { label: 'Anni',             field: 'anni',            w: 35,  align: 'right' },
                { label: 'Quota/anno',       field: 'quota_str',       w: 70,  align: 'right' },
                { label: 'Anni nel periodo', field: 'anni_conteggio',  w: 75,  align: 'right' },
                { label: 'Totale',           field: 'totale_str',      w: 70,  align: 'right' },
                { label: 'Incidenza',        field: 'incidenza_str',   w: 60,  align: 'right' }
            ]
        );

        // ============ Tabella record economici (SEMPRE su pagina nuova, no overlap) ============
        doc.addPage();
        doc.x = 50;
        doc.y = doc.page.margins.top;
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

// ==================== PDF BILANCIO AZIENDA (aggregato + confronto lotti) ====================
async function assertCompanyAccess(req, companyId) {
    const company = await db.getAsync('SELECT * FROM companies WHERE id = ?', [companyId]);
    if (!company) return { error: 404, message: 'Azienda non trovata' };
    if (req.user.username === 'admin' || req.user.role === 'admin') return { company };
    const u = await db.getAsync('SELECT parent_id FROM users WHERE id = ?', [req.user.id]);
    const tenantOwnerId = u?.parent_id || req.user.id;
    if (company.owner_id !== tenantOwnerId) return { error: 403, message: 'Accesso negato' };
    return { company };
}

router.get('/bilancio-azienda/:id', authenticateToken, requirePermission('lots:read'), async (req, res) => {
    try {
        const access = await assertCompanyAccess(req, req.params.id);
        if (access.error) return res.status(access.error).json({ error: access.message });
        const company = access.company;
        const stagione = req.query.stagione ? String(req.query.stagione).trim() : null;
        const lots = await db.allAsync('SELECT * FROM lots WHERE company_id = ? ORDER BY id', [company.id]);
        if (lots.length === 0) {
            return res.status(400).json({ error: 'L\'azienda non ha lotti registrati' });
        }
        const fmtEur = (v) => `€ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
        
        // ✅ Bulk queries: una SELECT GROUP BY lot_id invece di N+1 (N=numero lotti)
        const lotIds = lots.map(l => l.id);
        const ph = lotIds.map(() => '?').join(',');
        
        // Economic records (filtrabili per stagione)
        const econFiltro = stagione ? `AND stagione_agricola = ?` : '';
        const econParams = stagione ? [...lotIds, stagione] : [...lotIds];
        const ricaviRows = await db.allAsync(
            `SELECT lot_id, COALESCE(SUM(ricavi_totali), 0) AS ricavi, COALESCE(SUM(totale_kg), 0) AS kg
             FROM economic_records WHERE lot_id IN (${ph}) ${econFiltro}
             GROUP BY lot_id`,
            econParams
        );
        const ricaviMap = new Map(ricaviRows.map(r => [r.lot_id, { ricavi: Number(r.ricavi || 0), kg: Number(r.kg || 0) }]));
        
        // Per gli ammortamenti, serve l'intero set di record economici (per il calcolo finestra)
        const allEconRows = await db.allAsync(
            `SELECT * FROM economic_records WHERE lot_id IN (${ph}) ORDER BY lot_id, stagione_agricola`,
            lotIds
        );
        const recordsPerLot = new Map();
        for (const r of allEconRows) {
            if (!recordsPerLot.has(r.lot_id)) recordsPerLot.set(r.lot_id, []);
            recordsPerLot.get(r.lot_id).push(r);
        }
        
        // Costi personale (bulk con filtro stagione opzionale)
        const persRows = await db.allAsync(
            `SELECT lot_id, COALESCE(SUM(costo_totale), 0) AS tot
             FROM costi_personale WHERE lot_id IN (${ph}) ${stagione ? 'AND stagione_agricola = ?' : ''}
             GROUP BY lot_id`,
            stagione ? [...lotIds, stagione] : [...lotIds]
        );
        const persMap = new Map(persRows.map(r => [r.lot_id, Number(r.tot || 0)]));
        
        // Costi mezzi tecnici (bulk con filtro stagione opzionale)
        const mezziRows = await db.allAsync(
            `SELECT lot_id, COALESCE(SUM(importo), 0) AS tot
             FROM costi_mezzi_tecnici WHERE lot_id IN (${ph}) ${stagione ? 'AND stagione_agricola = ?' : ''}
             GROUP BY lot_id`,
            stagione ? [...lotIds, stagione] : [...lotIds]
        );
        const mezziMap = new Map(mezziRows.map(r => [r.lot_id, Number(r.tot || 0)]));
        
        // Aggrega per ogni lotto in memoria (zero query in più nel loop)
        const lotsData = [];
        let totalRicavi = 0, totalPersonale = 0, totalMezzi = 0, totalAmm = 0, totalKg = 0;
        for (const lot of lots) {
            const r = ricaviMap.get(lot.id) || { ricavi: 0, kg: 0 };
            const ricavi = r.ricavi;
            const kg = r.kg;
            const personale = persMap.get(lot.id) || 0;
            const mezzi = mezziMap.get(lot.id) || 0;
            // Ammortamenti: stessa logica della dashboard (beni attivi per ciascun anno)
            const lotRecords = recordsPerLot.get(lot.id) || [];
            const anniDaConsiderare = stagione
                ? [parseInt(stagione)]
                : Array.from(new Set(lotRecords.map(rr => parseInt(rr.stagione_agricola)).filter(Boolean)));
            let amm = 0;
            for (const anno of anniDaConsiderare) {
                const attivi = estraiBeniAttivi(lotRecords, anno);
                amm += attivi.reduce((s, b) => s + Number(b.quota_annuale || 0), 0);
            }
            const costi = personale + mezzi + amm;
            const bilancio = ricavi - costi;
            lotsData.push({ lot, ricavi, kg, personale, mezzi, amm, costi, bilancio });
            totalRicavi += ricavi; totalPersonale += personale; totalMezzi += mezzi; totalAmm += amm; totalKg += kg;
        }
        const totalCosti = totalPersonale + totalMezzi + totalAmm;
        const totalBilancio = totalRicavi - totalCosti;
        
        const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true, info: {
            Title: `Bilancio Azienda ${company.name}${stagione ? ' - Stagione ' + stagione : ''}`,
            Author: 'Cropbook'
        }});
        res.setHeader('Content-Type', 'application/pdf');
        const sName = company.name.replace(/[^a-z0-9]/gi, '_');
        const stSuffix = stagione ? `_${stagione}` : '';
        res.setHeader('Content-Disposition', `attachment; filename="bilancio-azienda-${sName}${stSuffix}.pdf"`);
        doc.pipe(res);
        
        // HEADER
        doc.fillColor('#2E7D32').fontSize(20).font('Helvetica-Bold').text('Bilancio Azienda', { align: 'center' });
        doc.moveDown(0.2);
        doc.fillColor('#333').fontSize(14).font('Helvetica').text(company.name, { align: 'center' });
        if (company.sectors) {
            doc.fontSize(10).fillColor('#666').text(`Settori: ${company.sectors}`, { align: 'center' });
        }
        if (company.address) {
            doc.fontSize(10).fillColor('#666').text(`Sede: ${company.address}`, { align: 'center' });
        }
        // ✅ Stagione di riferimento (NEW) — niente emoji (PDFKit/Helvetica non li supporta)
        const stagioneLabel = stagione ? `Stagione di riferimento: ${stagione}` : 'Periodo: Tutte le stagioni';
        doc.fontSize(11).fillColor('#00838F').font('Helvetica-Bold').text(stagioneLabel, { align: 'center' });
        doc.font('Helvetica');
        doc.fontSize(9).fillColor('#888').text(`Generato il ${new Date().toLocaleDateString('it-IT')} · ${lots.length} ${lots.length === 1 ? 'lotto' : 'lotti'}`, { align: 'center' });
        doc.moveDown(1);
        
        // KPI TOTALI
        doc.fillColor('#222').fontSize(13).font('Helvetica-Bold').text('Riepilogo aggregato');
        doc.moveDown(0.3);
        const kpiY = doc.y;
        const kpiW = 150, kpiH = 50;
        const kpis = [
            { label: 'Ricavi', value: fmtEur(totalRicavi), color: '#4CAF50' },
            { label: 'Costi', value: fmtEur(totalCosti), color: '#f44336' },
            { label: 'Bilancio', value: fmtEur(totalBilancio), color: totalBilancio >= 0 ? '#4CAF50' : '#f44336' }
        ];
        kpis.forEach((k, i) => {
            const x = 50 + i * (kpiW + 8);
            doc.roundedRect(x, kpiY, kpiW, kpiH, 6).fillAndStroke('#FAFAFA', '#e0e0e0');
            doc.fillColor('#666').fontSize(9).font('Helvetica').text(k.label, x, kpiY + 8, { width: kpiW, align: 'center', lineBreak: false });
            doc.fillColor(k.color).fontSize(14).font('Helvetica-Bold').text(k.value, x, kpiY + 25, { width: kpiW, align: 'center', lineBreak: false });
        });
        doc.y = kpiY + kpiH + 16;
        doc.x = 50;
        
        // TABELLA CONFRONTO LOTTI
        doc.fillColor('#222').fontSize(13).font('Helvetica-Bold').text('Confronto Lotti');
        doc.moveDown(0.3);
        
        const cols = [
            { label: 'Lotto', w: 120 },
            { label: 'Prodotto', w: 80 },
            { label: 'Ricavi', w: 70 },
            { label: 'Personale', w: 65 },
            { label: 'Mezzi', w: 60 },
            { label: 'Amm.', w: 50 },
            { label: 'Bilancio', w: 55 }
        ];
        const drawHeader = () => {
            const headerY = doc.y;
            doc.rect(50, headerY, 500, 18).fill('#2E7D32');
            let cx = 50;
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
            cols.forEach(c => {
                doc.fillColor('#FFFFFF').text(c.label, cx + 3, headerY + 5, {
                    width: c.w - 6, align: c.label === 'Lotto' || c.label === 'Prodotto' ? 'left' : 'right', lineBreak: false
                });
                cx += c.w;
            });
            doc.y = headerY + 18;
            doc.x = 50;
            doc.font('Helvetica').fontSize(8).fillColor('#222');
        };
        const PAGE_BOTTOM = doc.page.height - 60;
        const ROW_H = 18;
        drawHeader();
        lotsData.forEach((d, idx) => {
            if (doc.y + ROW_H > PAGE_BOTTOM) {
                doc.addPage(); doc.y = doc.page.margins.top; doc.x = 50; drawHeader();
            }
            const rowY = doc.y;
            if (idx % 2 === 0) doc.rect(50, rowY, 500, ROW_H).fill('#f5f5f5');
            let cx = 50;
            const cells = [
                { v: `#${d.lot.id} ${d.lot.location || ''}`, a: 'left' },
                { v: `${d.lot.product_type || ''}${d.lot.variety ? ' / ' + d.lot.variety : ''}`, a: 'left' },
                { v: fmtEur(d.ricavi), a: 'right' },
                { v: fmtEur(d.personale), a: 'right' },
                { v: fmtEur(d.mezzi), a: 'right' },
                { v: fmtEur(d.amm), a: 'right' },
                { v: fmtEur(d.bilancio), a: 'right' }
            ];
            cells.forEach((c, i) => {
                const color = (i === 6 && d.bilancio < 0) ? '#c62828' : '#222';
                doc.fillColor(color).text(c.v, cx + 3, rowY + 5, { width: cols[i].w - 6, align: c.a, lineBreak: false });
                cx += cols[i].w;
            });
            doc.y = rowY + ROW_H;
            doc.x = 50;
        });
        // Riga TOTALE
        const totalRowY = doc.y;
        doc.rect(50, totalRowY, 500, ROW_H).fill('#E8F5E9');
        let cx = 50;
        const totals = [
            { v: 'TOTALE', a: 'left' },
            { v: '', a: 'left' },
            { v: fmtEur(totalRicavi), a: 'right' },
            { v: fmtEur(totalPersonale), a: 'right' },
            { v: fmtEur(totalMezzi), a: 'right' },
            { v: fmtEur(totalAmm), a: 'right' },
            { v: fmtEur(totalBilancio), a: 'right' }
        ];
        totals.forEach((c, i) => {
            doc.fillColor('#1B5E20').font('Helvetica-Bold').fontSize(8).text(c.v, cx + 3, totalRowY + 5, { width: cols[i].w - 6, align: c.a, lineBreak: false });
            cx += cols[i].w;
        });
        doc.y = totalRowY + ROW_H;
        
        // Footer
        doc.font('Helvetica').fontSize(8).fillColor('#888');
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            doc.switchToPage(range.start + i);
            doc.text(`Cropbook · ${company.name} · pag. ${i + 1}/${range.count}`, 50, doc.page.height - 35,
                     { width: 495, align: 'center', lineBreak: false, height: 20 });
        }
        doc.flushPages();
        doc.end();
    } catch (error) {
        logger.error('Errore PDF bilancio-azienda', { error: error.message, stack: error.stack });
        if (!res.headersSent) {
            res.status(500).json({ error: 'Errore generazione PDF: ' + error.message });
        }
    }
});

module.exports = router;
