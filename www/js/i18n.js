/* ================================================================
   Cropbook i18n — sistema vanilla puro (nessuna dipendenza)
   
   Uso:
    - HTML:  <span data-i18n="menu.registrazione">Registrazione</span>
             <input data-i18n-placeholder="login.username_placeholder">
             <button data-i18n-title="tooltips.save">💾</button>
    - JS:    showNotification(t('notifications.saved'), 'success');
             const s = t('common.confirm_delete', { name: 'Lotto 12' });
   
   Regole:
    - Fallback catena: chiave→lingua_selezionata → chiave→it → chiave_letterale
    - Persistenza: localStorage 'cropbook_lang' + DB users.language (via API)
    - Default: 'it' (comportamento attuale se lingua non impostata)
================================================================ */

const SUPPORTED_LANGS = ['it', 'en', 'es'];
const DEFAULT_LANG = 'it';
const LANG_STORAGE_KEY = 'cropbook_lang';

/* ---------- Dizionario traduzioni ---------- */
const translations = {
    /* ============ COMMON / RIUTILIZZABILI ============ */
    'common.save':         { it: 'Salva',         en: 'Save',         es: 'Guardar' },
    'common.cancel':       { it: 'Annulla',       en: 'Cancel',       es: 'Cancelar' },
    'common.delete':       { it: 'Elimina',       en: 'Delete',       es: 'Eliminar' },
    'common.edit':         { it: 'Modifica',      en: 'Edit',         es: 'Editar' },
    'common.close':        { it: 'Chiudi',        en: 'Close',        es: 'Cerrar' },
    'common.back':         { it: 'Indietro',      en: 'Back',         es: 'Atrás' },
    'common.confirm':      { it: 'Conferma',      en: 'Confirm',      es: 'Confirmar' },
    'common.loading':      { it: 'Caricamento…',  en: 'Loading…',     es: 'Cargando…' },
    'common.search':       { it: 'Cerca',         en: 'Search',       es: 'Buscar' },
    'common.select':       { it: 'Seleziona',     en: 'Select',       es: 'Seleccionar' },
    'common.all':          { it: 'Tutti',         en: 'All',          es: 'Todos' },
    'common.download':     { it: 'Scarica',       en: 'Download',     es: 'Descargar' },
    'common.upload':       { it: 'Carica',        en: 'Upload',       es: 'Subir' },
    'common.yes':          { it: 'Sì',            en: 'Yes',          es: 'Sí' },
    'common.no':           { it: 'No',            en: 'No',           es: 'No' },
    'common.total':        { it: 'Totale',        en: 'Total',        es: 'Total' },
    'common.season':       { it: 'Stagione',      en: 'Season',       es: 'Temporada' },
    'common.lot':          { it: 'Lotto',         en: 'Lot',          es: 'Parcela' },
    'common.company':      { it: 'Azienda',       en: 'Company',      es: 'Empresa' },
    'common.date':         { it: 'Data',          en: 'Date',         es: 'Fecha' },
    'common.notes':        { it: 'Note',          en: 'Notes',        es: 'Notas' },
    'common.actions':      { it: 'Azioni',        en: 'Actions',      es: 'Acciones' },
    'common.year':         { it: 'Anno',          en: 'Year',         es: 'Año' },
    'common.no_data':      { it: 'Nessun dato disponibile', en: 'No data available', es: 'Sin datos disponibles' },
    'common.required':     { it: 'Campo obbligatorio', en: 'Required field', es: 'Campo obligatorio' },
    'common.file_pdf':     { it: 'PDF',           en: 'PDF',          es: 'PDF' },
    'common.file_excel':   { it: 'Excel',         en: 'Excel',        es: 'Excel' },

    /* ============ HEADER ============ */
    'header.tagline':      { it: 'Gestione Agricola Multi-Tenant',
                             en: 'Multi-Tenant Agricultural Management',
                             es: 'Gestión Agrícola Multi-Tenant' },
    'header.login':        { it: 'Accedi',        en: 'Sign in',      es: 'Iniciar sesión' },
    'header.logout':       { it: 'Esci',          en: 'Logout',       es: 'Cerrar sesión' },
    'header.user_management': { it: 'Utenti',     en: 'Users',        es: 'Usuarios' },
    'header.change_language': { it: 'Cambia lingua', en: 'Change language', es: 'Cambiar idioma' },

    /* ============ LOGIN / REGISTER ============ */
    'auth.language_hint':  { it: 'Scegli la lingua:', en: 'Choose your language:', es: 'Elige tu idioma:' },
    'auth.login_title':    { it: 'Accedi al tuo account', en: 'Sign in to your account', es: 'Inicia sesión en tu cuenta' },
    'auth.register_title': { it: 'Crea un nuovo account', en: 'Create a new account', es: 'Crea una nueva cuenta' },
    'auth.username':       { it: 'Nome utente',   en: 'Username',     es: 'Nombre de usuario' },
    'auth.email':          { it: 'Email',         en: 'Email',        es: 'Email' },
    'auth.password':       { it: 'Password',      en: 'Password',     es: 'Contraseña' },
    'auth.password_confirm':{ it: 'Conferma password', en: 'Confirm password', es: 'Confirmar contraseña' },
    'auth.full_name':      { it: 'Nome e Cognome', en: 'Full name',   es: 'Nombre completo' },
    'auth.remember_me':    { it: 'Ricordami',     en: 'Remember me',  es: 'Recuérdame' },
    'auth.forgot_password':{ it: 'Password dimenticata?', en: 'Forgot password?', es: '¿Olvidaste tu contraseña?' },
    'auth.no_account':     { it: 'Non hai un account?', en: 'No account yet?', es: '¿No tienes cuenta?' },
    'auth.have_account':   { it: 'Hai già un account?', en: 'Already have an account?', es: '¿Ya tienes una cuenta?' },
    'auth.signup_now':     { it: 'Registrati ora', en: 'Sign up now', es: 'Regístrate ahora' },
    'auth.signin_here':    { it: 'Accedi qui',    en: 'Sign in here', es: 'Inicia sesión aquí' },
    'auth.privacy_accept': { it: 'Accetto la Privacy Policy e i Termini di Servizio',
                             en: 'I accept the Privacy Policy and Terms of Service',
                             es: 'Acepto la Política de Privacidad y los Términos de Servicio' },
    'auth.signup_btn':     { it: 'Crea Account',  en: 'Create Account', es: 'Crear Cuenta' },
    'auth.signin_btn':     { it: 'Accedi',        en: 'Sign in',      es: 'Iniciar sesión' },
    'auth.reset_link_btn': { it: 'Invia link di recupero', en: 'Send recovery link', es: 'Enviar enlace de recuperación' },
    'auth.reset_intro':    { it: 'Inserisci la tua email: ti invieremo un link per reimpostare la password.',
                             en: 'Enter your email: we will send you a link to reset your password.',
                             es: 'Ingresa tu email: te enviaremos un enlace para restablecer tu contraseña.' },

    /* ============ MENU PRINCIPALE (dashboard cards) ============ */
    'menu.title':          { it: 'Menu Principale', en: 'Main Menu',  es: 'Menú Principal' },
    'menu.registrazione':  { it: 'Registrazione Lotti', en: 'Lot Registration', es: 'Registro de Parcelas' },
    'menu.registrazione_desc': { it: 'Registra nuovi lotti agricoli',
                                  en: 'Register new agricultural lots',
                                  es: 'Registra nuevas parcelas agrícolas' },
    'menu.lista':          { it: 'Aziende & Lotti', en: 'Companies & Lots', es: 'Empresas y Parcelas' },
    'menu.lista_desc':     { it: 'Gestisci aziende e lotti registrati',
                             en: 'Manage registered companies and lots',
                             es: 'Gestiona empresas y parcelas registradas' },
    'menu.dettagli':       { it: 'Dettagli Lotto', en: 'Lot Details', es: 'Detalles Parcela' },
    'menu.dettagli_desc':  { it: 'Attività, analisi e mappa',
                             en: 'Activities, analyses and map',
                             es: 'Actividades, análisis y mapa' },
    'menu.economica':      { it: 'Gestione Economica', en: 'Economic Management', es: 'Gestión Económica' },
    'menu.economica_desc': { it: 'Ricavi e vendite per stagione',
                             en: 'Revenue and sales per season',
                             es: 'Ingresos y ventas por temporada' },
    'menu.costi':          { it: 'Gestione Costi', en: 'Cost Management', es: 'Gestión de Costos' },
    'menu.costi_desc':     { it: 'Personale, mezzi tecnici, beni durevoli',
                             en: 'Personnel, technical means, durable assets',
                             es: 'Personal, medios técnicos, bienes duraderos' },
    'menu.bilancio':       { it: 'Bilancio & Report', en: 'Balance & Reports', es: 'Balance e Informes' },
    'menu.bilancio_desc':  { it: 'Consuntivi, PDF, Excel',
                             en: 'Summaries, PDF, Excel',
                             es: 'Resúmenes, PDF, Excel' },

    /* ============ SECTION HEADERS (titoli sezioni interne) ============ */
    'section.registrazione_title': { it: '📝 Registrazione Nuovo Lotto', en: '📝 New Lot Registration', es: '📝 Registro de Nueva Parcela' },
    'section.lista_title':         { it: '📊 Aziende e Lotti',            en: '📊 Companies and Lots',   es: '📊 Empresas y Parcelas' },
    'section.dettagli_title':      { it: '📍 Dettagli Lotto',             en: '📍 Lot Details',          es: '📍 Detalles de Parcela' },
    'section.economica_title':     { it: '💰 Gestione Economica',         en: '💰 Economic Management',  es: '💰 Gestión Económica' },
    'section.costi_title':         { it: '📉 Gestione Costi',             en: '📉 Cost Management',      es: '📉 Gestión de Costos' },
    'section.bilancio_title':      { it: '📈 Bilancio & Report',          en: '📈 Balance & Reports',    es: '📈 Balance e Informes' },

    /* ============ LISTA / AZIENDE ============ */
    'lista.view_aziende':  { it: 'Vista Aziende',  en: 'Companies View', es: 'Vista Empresas' },
    'lista.view_lotti':    { it: 'Vista Lotti',    en: 'Lots View',      es: 'Vista Parcelas' },
    'lista.new_company':   { it: 'Nuova Azienda',  en: 'New Company',    es: 'Nueva Empresa' },
    'lista.new_lot':       { it: 'Nuovo Lotto',    en: 'New Lot',        es: 'Nueva Parcela' },
    'lista.empty':         { it: 'Nessuna azienda registrata.', en: 'No companies registered.', es: 'Ninguna empresa registrada.' },
    'lista.empty_lots':    { it: 'Nessun lotto registrato.', en: 'No lots registered.', es: 'Ninguna parcela registrada.' },

    /* ============ REGISTRAZIONE FORM ============ */
    'reg.company_section': { it: 'Azienda',        en: 'Company',        es: 'Empresa' },
    'reg.select_company':  { it: 'Seleziona un\'azienda esistente o creane una nuova',
                             en: 'Select an existing company or create a new one',
                             es: 'Selecciona una empresa existente o crea una nueva' },
    'reg.company_name':    { it: 'Nome Azienda',   en: 'Company Name',   es: 'Nombre Empresa' },
    'reg.company_address': { it: 'Sede / Indirizzo', en: 'Address',      es: 'Dirección' },
    'reg.company_sectors': { it: 'Settori (separati da virgola)', en: 'Sectors (comma-separated)', es: 'Sectores (separados por comas)' },
    'reg.lot_section':     { it: 'Lotto',          en: 'Lot',            es: 'Parcela' },
    'reg.lot_location':    { it: 'Località / Nome Lotto', en: 'Location / Lot Name', es: 'Ubicación / Nombre Parcela' },
    'reg.lot_area':        { it: 'Superficie (ha)', en: 'Area (ha)',     es: 'Superficie (ha)' },
    'reg.product_type':    { it: 'Tipo Prodotto',  en: 'Product Type',   es: 'Tipo de Producto' },
    'reg.variety':         { it: 'Varietà',        en: 'Variety',        es: 'Variedad' },
    'reg.save_btn':        { it: '💾 Salva Lotto', en: '💾 Save Lot',    es: '💾 Guardar Parcela' },

    /* ============ BILANCIO & REPORT ============ */
    'bilancio.mode_azienda': { it: 'Vista Aziende',  en: 'Company View',  es: 'Vista Empresas' },
    'bilancio.mode_lotto':   { it: 'Vista Singolo Lotto', en: 'Single Lot View', es: 'Vista Parcela Individual' },
    'bilancio.hint_azienda': { it: "Scegli un'azienda per vedere il bilancio consolidato di tutti i suoi lotti",
                               en: 'Choose a company to see the consolidated balance of all its lots',
                               es: 'Elige una empresa para ver el balance consolidado de todas sus parcelas' },
    'bilancio.hint_lotto':   { it: 'Analizza il bilancio di un singolo lotto con confronto multi-stagione',
                               en: 'Analyze a single lot balance with multi-season comparison',
                               es: 'Analiza el balance de una parcela con comparación multi-temporada' },
    'bilancio.back_to_companies': { it: 'Torna alle Aziende', en: 'Back to Companies', es: 'Volver a Empresas' },
    'bilancio.pdf_company':  { it: 'PDF Bilancio Azienda', en: 'Company Balance PDF', es: 'PDF Balance Empresa' },
    'bilancio.season_ref':   { it: 'Stagione di riferimento:', en: 'Reference season:', es: 'Temporada de referencia:' },
    'bilancio.all_seasons':  { it: '— Tutte le stagioni —', en: '— All seasons —', es: '— Todas las temporadas —' },
    'bilancio.filter_hint':  { it: 'Il filtro si applica a KPI, tabella e PDF.',
                               en: 'The filter applies to KPIs, table and PDF.',
                               es: 'El filtro se aplica a KPIs, tabla y PDF.' },
    'bilancio.kpi_revenue':  { it: '💰 Ricavi Totali', en: '💰 Total Revenue', es: '💰 Ingresos Totales' },
    'bilancio.kpi_costs':    { it: '💸 Costi Totali',  en: '💸 Total Costs',   es: '💸 Costos Totales' },
    'bilancio.kpi_balance':  { it: '⚖️ Bilancio',     en: '⚖️ Balance',       es: '⚖️ Balance' },
    'bilancio.kpi_lots':     { it: '🌱 N° Lotti',     en: '🌱 # Lots',        es: '🌱 N° Parcelas' },
    'bilancio.balance_per_lot': { it: 'Bilancio per Lotto', en: 'Balance per Lot', es: 'Balance por Parcela' },
    'bilancio.col_product':  { it: 'Prodotto',        en: 'Product',        es: 'Producto' },
    'bilancio.col_revenue':  { it: 'Ricavi',          en: 'Revenue',        es: 'Ingresos' },
    'bilancio.col_personnel':{ it: 'Personale',       en: 'Personnel',      es: 'Personal' },
    'bilancio.col_means':    { it: 'Mezzi',           en: 'Means',          es: 'Medios' },
    'bilancio.col_amort':    { it: 'Amm.',            en: 'Amort.',         es: 'Amort.' },
    'bilancio.col_balance':  { it: 'Bilancio',        en: 'Balance',        es: 'Balance' },
    'bilancio.no_data_company':{ it: 'Nessuna azienda con lotti registrati.', en: 'No company with registered lots.', es: 'Ninguna empresa con parcelas registradas.' },
    'bilancio.see_report':   { it: 'Vedi Bilancio Consolidato', en: 'View Consolidated Balance', es: 'Ver Balance Consolidado' },

    /* ============ CASCADE SELECTORS ============ */
    'cascade.company':       { it: 'Azienda:', en: 'Company:', es: 'Empresa:' },
    'cascade.all':           { it: '— Tutte —', en: '— All —', es: '— Todas —' },
    'cascade.select_lot':    { it: 'Seleziona Lotto', en: 'Select Lot', es: 'Seleccionar Parcela' },
    'cascade.no_lots':       { it: 'Nessun lotto per questa azienda', en: 'No lots for this company', es: 'Ninguna parcela para esta empresa' },

    /* ============ NOTIFICATIONS / TOASTS ============ */
    'notify.saved':          { it: 'Salvato con successo',    en: 'Saved successfully',    es: 'Guardado exitosamente' },
    'notify.deleted':        { it: 'Eliminato con successo',  en: 'Deleted successfully',  es: 'Eliminado exitosamente' },
    'notify.updated':        { it: 'Aggiornato con successo', en: 'Updated successfully',  es: 'Actualizado exitosamente' },
    'notify.error_generic':  { it: 'Si è verificato un errore', en: 'An error occurred',   es: 'Ocurrió un error' },
    'notify.confirm_delete': { it: 'Sei sicuro di voler eliminare?', en: 'Are you sure you want to delete?', es: '¿Estás seguro de eliminar?' },
    'notify.session_expired':{ it: 'Sessione scaduta, effettua di nuovo l\'accesso', en: 'Session expired, please sign in again', es: 'Sesión expirada, por favor inicia sesión de nuevo' },
    'notify.login_failed':   { it: 'Credenziali non valide',  en: 'Invalid credentials',   es: 'Credenciales no válidas' },
    'notify.login_success':  { it: 'Accesso effettuato',      en: 'Signed in',             es: 'Sesión iniciada' },
    'notify.select_company_first': { it: 'Seleziona prima un\'azienda', en: 'Select a company first', es: 'Selecciona primero una empresa' },
    'notify.pdf_generating': { it: 'Generazione PDF in corso...', en: 'Generating PDF...', es: 'Generando PDF...' },
    'notify.pdf_downloaded': { it: 'PDF scaricato',           en: 'PDF downloaded',        es: 'PDF descargado' },
    'notify.language_changed': { it: 'Lingua cambiata', en: 'Language changed', es: 'Idioma cambiado' }
};

/* ---------- API pubblica ---------- */

function getCurrentLang() {
    const stored = (typeof localStorage !== 'undefined')
        ? localStorage.getItem(LANG_STORAGE_KEY) : null;
    if (stored && SUPPORTED_LANGS.includes(stored)) return stored;
    return DEFAULT_LANG;
}

function setCurrentLang(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) lang = DEFAULT_LANG;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LANG_STORAGE_KEY, lang);
    }
    document.documentElement.lang = lang;
    applyTranslations();
    updateLangButtonsUI(lang);
    // Persist sul server se l'utente è loggato
    if (typeof persistLangToServer === 'function') persistLangToServer(lang);
    // Notifica per componenti custom
    document.dispatchEvent(new CustomEvent('cropbook:lang-changed', { detail: { lang } }));
}

/**
 * Traduce una chiave. Supporta interpolazione: t('menu.hi_user', { name: 'Mario' })
 * assumendo che il dizionario contenga stringhe con {name} come placeholder.
 */
function t(key, vars) {
    const lang = getCurrentLang();
    const entry = translations[key];
    let str = entry ? (entry[lang] || entry[DEFAULT_LANG] || key) : key;
    if (vars && typeof str === 'string') {
        Object.keys(vars).forEach(k => {
            str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
        });
    }
    return str;
}

/**
 * Applica le traduzioni a TUTTI gli elementi con attributi data-i18n*.
 * - data-i18n           → sostituisce textContent
 * - data-i18n-html      → sostituisce innerHTML
 * - data-i18n-placeholder → sostituisce placeholder
 * - data-i18n-title     → sostituisce title (tooltip)
 * - data-i18n-value     → sostituisce value (utile su <input type="submit">)
 * - data-i18n-aria-label → sostituisce aria-label
 */
function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    document.querySelectorAll('[data-i18n-value]').forEach(el => {
        el.setAttribute('value', t(el.getAttribute('data-i18n-value')));
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
        el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });
}

/**
 * Aggiorna lo stato visivo dei pulsanti lingua nell'header + login.
 */
function updateLangButtonsUI(lang) {
    document.querySelectorAll('[data-lang-btn]').forEach(btn => {
        const isActive = btn.getAttribute('data-lang-btn') === lang;
        btn.classList.toggle('lang-btn-active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

/**
 * Persiste la scelta lingua sul server per utenti loggati.
 * Non blocca in caso di errore (best-effort).
 */
async function persistLangToServer(lang) {
    if (typeof localStorage === 'undefined') return;
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    const API_URL = (typeof API_BASE_URL !== 'undefined')
        ? API_BASE_URL
        : (window.API_BASE_URL || '/api');
    try {
        await fetch(`${API_URL}/users/language`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ language: lang })
        });
    } catch (_) { /* best-effort */ }
}

/* ---------- Auto-init ---------- */
document.addEventListener('DOMContentLoaded', () => {
    const lang = getCurrentLang();
    document.documentElement.lang = lang;
    applyTranslations();
    updateLangButtonsUI(lang);
});

/* Esporta per accesso globale */
window.i18n = { t, getCurrentLang, setCurrentLang, applyTranslations, SUPPORTED_LANGS };
window.t = t;                         // shortcut usato in cropbook.js
window.setCurrentLang = setCurrentLang;
