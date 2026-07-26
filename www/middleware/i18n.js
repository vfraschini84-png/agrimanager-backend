// middleware/i18n.js
// Traduzione lightweight per messaggi di errore/successo dell'API.
// Legge la lingua da:
//   1. header custom X-Language
//   2. header standard Accept-Language (primo tag riconosciuto)
//   3. profilo utente (se autenticato) via req.user
//   4. default 'it'

const SUPPORTED_LANGS = ['it', 'en', 'es'];
const DEFAULT_LANG = 'it';

// Dizionario chiavi per PDF report (stampe multilingua)
const pdfTranslations = {
    'pdf.report_title_lot':     { it: 'Bilancio Economico Lotto',  en: 'Lot Economic Balance',  es: 'Balance Económico Parcela' },
    'pdf.report_title_company': { it: 'Bilancio Azienda',           en: 'Company Balance',        es: 'Balance de Empresa' },
    'pdf.season_ref':           { it: 'Stagione di riferimento',    en: 'Reference season',       es: 'Temporada de referencia' },
    'pdf.season_all':           { it: 'Periodo: Tutte le stagioni', en: 'Period: All seasons',    es: 'Periodo: Todas las temporadas' },
    'pdf.generated_on':         { it: 'Generato il',                en: 'Generated on',           es: 'Generado el' },
    'pdf.lot':                  { it: 'lotto',                      en: 'lot',                    es: 'parcela' },
    'pdf.lots':                 { it: 'lotti',                      en: 'lots',                   es: 'parcelas' },
    // KPI
    'pdf.kpi_revenue':          { it: 'Ricavi Totali',              en: 'Total Revenue',          es: 'Ingresos Totales' },
    'pdf.kpi_costs':            { it: 'Costi Totali',               en: 'Total Costs',            es: 'Costos Totales' },
    'pdf.kpi_balance':          { it: 'Bilancio',                   en: 'Balance',                es: 'Balance' },
    'pdf.kpi_amort':            { it: 'Ammortamenti',               en: 'Amortizations',          es: 'Amortizaciones' },
    'pdf.kpi_avg_price':        { it: 'Prezzo Medio',               en: 'Average Price',          es: 'Precio Medio' },
    'pdf.kpi_yield':            { it: 'Resa Totale',                en: 'Total Yield',            es: 'Rendimiento Total' },
    // Sezioni
    'pdf.section_summary':      { it: 'Bilancio Sintetico',         en: 'Summary Balance',        es: 'Balance Resumen' },
    'pdf.section_multi_season': { it: 'Confronto Ultime 5 Stagioni', en: 'Last 5 Seasons Comparison', es: 'Comparación Últimas 5 Temporadas' },
    'pdf.section_personnel':    { it: 'Dettaglio Costo Personale per Attività', en: 'Personnel Cost Detail by Activity', es: 'Detalle Costo Personal por Actividad' },
    'pdf.section_means':        { it: 'Dettaglio Costo Mezzi Tecnici per Categoria', en: 'Technical Means Cost Detail by Category', es: 'Detalle Costo Medios Técnicos por Categoría' },
    'pdf.section_amort':        { it: 'Dettaglio Ammortamenti per Bene Durevole', en: 'Amortizations Detail by Durable Asset', es: 'Detalle Amortizaciones por Bien Duradero' },
    'pdf.section_records':      { it: 'Registrazioni Economiche',   en: 'Economic Records',       es: 'Registros Económicos' },
    'pdf.section_lots_table':   { it: 'Bilancio per Lotto',         en: 'Balance per Lot',        es: 'Balance por Parcela' },
    // Chart titles
    'pdf.chart_rev_vs_cost':    { it: 'Ricavi vs Costi',            en: 'Revenue vs Costs',       es: 'Ingresos vs Costos' },
    'pdf.chart_cost_detail':    { it: 'Dettaglio Costi (incidenza % sui costi totali)', en: 'Cost Detail (% incidence on total costs)', es: 'Detalle Costos (incidencia % sobre costos totales)' },
    'pdf.chart_personnel':      { it: 'Costi Personale per Attività', en: 'Personnel Costs by Activity', es: 'Costos Personal por Actividad' },
    'pdf.chart_means':          { it: 'Mezzi Tecnici per Categoria', en: 'Technical Means by Category', es: 'Medios Técnicos por Categoría' },
    'pdf.chart_amort':          { it: 'Ammortamenti per Bene Durevole', en: 'Amortizations by Durable Asset', es: 'Amortizaciones por Bien Duradero' },
    // Colonne tabelle
    'pdf.col_revenue':          { it: 'Ricavi',                     en: 'Revenue',                es: 'Ingresos' },
    'pdf.col_personnel':        { it: 'Personale',                  en: 'Personnel',              es: 'Personal' },
    'pdf.col_means':            { it: 'Mezzi tecnici',              en: 'Technical means',        es: 'Medios técnicos' },
    'pdf.col_means_short':      { it: 'Mezzi',                      en: 'Means',                  es: 'Medios' },
    'pdf.col_amort_short':      { it: 'Amm.',                       en: 'Amort.',                 es: 'Amort.' },
    'pdf.col_balance':          { it: 'Bilancio',                   en: 'Balance',                es: 'Balance' },
    'pdf.col_costs':            { it: 'Costi',                      en: 'Costs',                  es: 'Costos' },
    'pdf.col_season':           { it: 'Stagione',                   en: 'Season',                 es: 'Temporada' },
    'pdf.col_activity':         { it: 'Attività',                   en: 'Activity',               es: 'Actividad' },
    'pdf.col_qualification':    { it: 'Qualifica',                  en: 'Qualification',          es: 'Calificación' },
    'pdf.col_interventions':    { it: 'Interventi',                 en: 'Interventions',          es: 'Intervenciones' },
    'pdf.col_manhours':         { it: 'Ore-uomo',                   en: 'Man-hours',              es: 'Horas-hombre' },
    'pdf.col_total':            { it: 'Totale',                     en: 'Total',                  es: 'Total' },
    'pdf.col_incidence':        { it: 'Incidenza',                  en: 'Incidence',              es: 'Incidencia' },
    'pdf.col_category':         { it: 'Categoria',                  en: 'Category',               es: 'Categoría' },
    'pdf.col_asset':            { it: 'Bene',                       en: 'Asset',                  es: 'Bien' },
    'pdf.col_cost':             { it: 'Costo',                      en: 'Cost',                   es: 'Costo' },
    'pdf.col_years':            { it: 'Anni',                       en: 'Years',                  es: 'Años' },
    'pdf.col_annual_quota':     { it: 'Quota/anno',                 en: 'Quota/year',             es: 'Cuota/año' },
    'pdf.col_years_in_period':  { it: 'Anni nel periodo',           en: 'Years in period',        es: 'Años en el periodo' },
    'pdf.col_lot':              { it: 'Lotto',                      en: 'Lot',                    es: 'Parcela' },
    'pdf.col_product':          { it: 'Prodotto',                   en: 'Product',                es: 'Producto' },
    'pdf.col_date':             { it: 'Data',                       en: 'Date',                   es: 'Fecha' },
    'pdf.col_kg':               { it: 'Kg',                         en: 'Kg',                     es: 'Kg' },
    // Footer / legend
    'pdf.total_row':            { it: 'TOTALE',                     en: 'TOTAL',                  es: 'TOTAL' },
    'pdf.no_data':              { it: 'Nessun dato disponibile per questa voce nel periodo selezionato.',
                                   en: 'No data available for this item in the selected period.',
                                   es: 'No hay datos disponibles para este ítem en el periodo seleccionado.' },
    'pdf.detail_total':         { it: 'Totale voce',                en: 'Item total',             es: 'Total ítem' },
    'pdf.detail_period':        { it: 'Periodo',                    en: 'Period',                 es: 'Periodo' },
    'pdf.all_seasons_short':    { it: 'tutte le stagioni',          en: 'all seasons',            es: 'todas las temporadas' },
    'pdf.entries_one':          { it: 'voce',                       en: 'item',                   es: 'ítem' },
    'pdf.entries_many':         { it: 'voci',                       en: 'items',                  es: 'ítems' },
    'pdf.legend_personnel':     { it: 'Personale',                  en: 'Personnel',              es: 'Personal' },
    'pdf.legend_means':         { it: 'Mezzi tecnici',              en: 'Technical means',        es: 'Medios técnicos' },
    'pdf.legend_amort':         { it: 'Ammortamenti',               en: 'Amortizations',          es: 'Amortizaciones' },
    'pdf.top10_means':          { it: 'Top 10 mezzi tecnici per descrizione',
                                   en: 'Top 10 technical means by description',
                                   es: 'Top 10 medios técnicos por descripción' },
    'pdf.top10_col_desc':       { it: 'Descrizione',                en: 'Description',            es: 'Descripción' }
};

// Dizionario chiavi comuni per errori API
const backendTranslations = {
    // Auth
    'errors.token_missing':      { it: 'Token non fornito',           en: 'Token not provided',              es: 'Token no proporcionado' },
    'errors.token_invalid':      { it: 'Token non valido',            en: 'Invalid token',                   es: 'Token no válido' },
    'errors.credentials_invalid':{ it: 'Credenziali non valide',      en: 'Invalid credentials',             es: 'Credenciales no válidas' },
    'errors.unauthorized':       { it: 'Non autorizzato',             en: 'Unauthorized',                    es: 'No autorizado' },
    'errors.session_expired':    { it: 'Sessione scaduta',            en: 'Session expired',                 es: 'Sesión expirada' },
    'errors.password_reset_invalid': { it: 'Link di reset non valido o scaduto', en: 'Reset link invalid or expired', es: 'Enlace de restablecimiento no válido o caducado' },
    // Tenant guard
    'errors.access_denied':      { it: 'Accesso negato: risorsa di un altro tenant', en: 'Access denied: resource belongs to another tenant', es: 'Acceso denegado: recurso de otro inquilino' },
    'errors.not_found':          { it: 'Risorsa non trovata',         en: 'Resource not found',              es: 'Recurso no encontrado' },
    'errors.lot_not_found':      { it: 'Lotto non trovato',           en: 'Lot not found',                   es: 'Parcela no encontrada' },
    'errors.company_not_found':  { it: 'Azienda non trovata',         en: 'Company not found',               es: 'Empresa no encontrada' },
    'errors.record_not_found':   { it: 'Record non trovato',          en: 'Record not found',                es: 'Registro no encontrado' },
    // Permission
    'errors.permission_denied':  { it: 'Permessi insufficienti',      en: 'Insufficient permissions',        es: 'Permisos insuficientes' },
    // Validation
    'errors.required_field':     { it: 'Campo obbligatorio mancante', en: 'Missing required field',          es: 'Falta campo obligatorio' },
    'errors.invalid_format':     { it: 'Formato non valido',          en: 'Invalid format',                  es: 'Formato no válido' },
    'errors.language_unsupported': { it: 'Lingua non supportata', en: 'Language not supported', es: 'Idioma no soportado' },
    // Generic
    'errors.internal':           { it: 'Errore interno del server',   en: 'Internal server error',           es: 'Error interno del servidor' },
    'errors.no_lots_in_company': { it: "L'azienda non ha lotti registrati", en: 'The company has no lots registered', es: 'La empresa no tiene parcelas registradas' },
    // Success
    'ok.saved':                  { it: 'Salvato',                     en: 'Saved',                           es: 'Guardado' },
    'ok.updated':                { it: 'Aggiornato',                  en: 'Updated',                         es: 'Actualizado' },
    'ok.deleted':                { it: 'Eliminato',                   en: 'Deleted',                         es: 'Eliminado' }
};

/**
 * Estrae la lingua dalla richiesta.
 * @param {import('express').Request} req
 */
function detectLang(req) {
    // 1. Header custom (impostato dal frontend)
    const xLang = req.headers['x-language'];
    if (xLang && SUPPORTED_LANGS.includes(String(xLang).toLowerCase())) {
        return String(xLang).toLowerCase();
    }
    // 2. Accept-Language standard (parse veloce: prende il primo tag lingua di 2 lettere)
    const accept = req.headers['accept-language'];
    if (accept) {
        const first = String(accept).split(',')[0].trim().substring(0, 2).toLowerCase();
        if (SUPPORTED_LANGS.includes(first)) return first;
    }
    // 3. Preferenza salvata sul profilo utente (req.user popolato da authenticateToken)
    if (req.user && req.user.language && SUPPORTED_LANGS.includes(req.user.language)) {
        return req.user.language;
    }
    // 4. Default
    return DEFAULT_LANG;
}

/**
 * Traduce una chiave nel contesto della request.
 * Cerca prima nei backendTranslations, poi nei pdfTranslations.
 */
function tReq(req, key, fallback) {
    const lang = detectLang(req);
    const entry = backendTranslations[key] || pdfTranslations[key];
    if (!entry) return fallback || key;
    return entry[lang] || entry[DEFAULT_LANG] || fallback || key;
}

/**
 * Factory di traduzione PDF: prende una lingua esplicita (es. da ?lang=xx)
 * e restituisce una funzione p(key) che traduce.
 */
function makePdfTranslator(lang) {
    const useLang = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
    return function p(key, fallback) {
        const entry = pdfTranslations[key] || backendTranslations[key];
        if (!entry) return fallback || key;
        return entry[useLang] || entry[DEFAULT_LANG] || fallback || key;
    };
}

/**
 * Middleware Express: allega req.t(key,fallback) e req.lang.
 * Da montare globalmente prima delle rotte.
 */
function attachI18n(req, res, next) {
    req.lang = detectLang(req);
    req.t = (key, fallback) => tReq(req, key, fallback);
    next();
}

module.exports = { attachI18n, tReq, detectLang, makePdfTranslator, SUPPORTED_LANGS };
