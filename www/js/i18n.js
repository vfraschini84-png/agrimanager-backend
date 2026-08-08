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
    'cards.sectors_empty':   { it: 'Settori non specificati', en: 'Sectors not specified', es: 'Sectores no especificados' },
    'cards.lot_one':         { it: 'lotto',                   en: 'lot',                    es: 'parcela' },
    'cards.lot_many':        { it: 'lotti',                   en: 'lots',                   es: 'parcelas' },

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
    'notify.language_changed': { it: 'Lingua cambiata', en: 'Language changed', es: 'Idioma cambiado' },
    'notify.select_first':    { it: 'Seleziona prima un elemento', en: 'Please select an item first', es: 'Selecciona primero un elemento' },
    'notify.no_selection':    { it: 'Nessuna selezione', en: 'No selection', es: 'Sin selección' },
    'notify.network_error':   { it: 'Errore di rete. Riprova.', en: 'Network error. Try again.', es: 'Error de red. Inténtalo de nuevo.' },
    'notify.unauthorized':    { it: 'Non autorizzato',   en: 'Unauthorized',      es: 'No autorizado' },
    'notify.forbidden':       { it: 'Accesso negato',    en: 'Access denied',     es: 'Acceso denegado' },
    'notify.not_found':       { it: 'Non trovato',       en: 'Not found',         es: 'No encontrado' },
    'notify.validation_error':{ it: 'Dati non validi',   en: 'Invalid data',      es: 'Datos no válidos' },
    'notify.copied':          { it: 'Copiato negli appunti', en: 'Copied to clipboard', es: 'Copiado al portapapeles' },
    'notify.fill_required':   { it: 'Compila tutti i campi obbligatori', en: 'Please fill all required fields', es: 'Completa todos los campos obligatorios' },
    'notify.invalid_email':   { it: 'Email non valida',  en: 'Invalid email',     es: 'Email no válido' },
    'notify.password_short':  { it: 'La password deve avere almeno 6 caratteri', en: 'Password must be at least 6 characters', es: 'La contraseña debe tener al menos 6 caracteres' },
    'notify.password_mismatch':{ it: 'Le password non coincidono', en: 'Passwords do not match', es: 'Las contraseñas no coinciden' },
    'notify.select_company':  { it: 'Seleziona un\'azienda', en: 'Select a company', es: 'Selecciona una empresa' },
    'notify.select_lot':      { it: 'Seleziona un lotto', en: 'Select a lot',     es: 'Selecciona una parcela' },
    'notify.data_saved':      { it: 'Dati salvati',      en: 'Data saved',        es: 'Datos guardados' },
    'notify.operation_failed':{ it: 'Operazione fallita', en: 'Operation failed',  es: 'Operación fallida' },
    'notify.loading':         { it: 'Caricamento in corso...', en: 'Loading...', es: 'Cargando...' },
    'notify.processing':      { it: 'Elaborazione in corso...', en: 'Processing...', es: 'Procesando...' },
    'notify.please_wait':     { it: 'Attendere prego',   en: 'Please wait',       es: 'Por favor espera' },

    /* ============ AUTH REGISTER — form fields ============ */
    'reg.help.username':      { it: 'Inserisci almeno 3 caratteri', en: 'Enter at least 3 characters', es: 'Ingresa al menos 3 caracteres' },
    'reg.help.email':         { it: 'Inserisci un indirizzo email valido', en: 'Enter a valid email address', es: 'Ingresa un correo electrónico válido' },
    'reg.help.password':      { it: 'Minimo 6 caratteri', en: 'Minimum 6 characters', es: 'Mínimo 6 caracteres' },
    'reg.placeholder.username': { it: 'Scegli un username', en: 'Choose a username', es: 'Elige un nombre de usuario' },
    'reg.placeholder.email':  { it: 'esempio@email.com',  en: 'example@email.com',  es: 'ejemplo@email.com' },
    'reg.placeholder.password': { it: 'Scegli una password', en: 'Choose a password', es: 'Elige una contraseña' },
    'reg.placeholder.login_username': { it: 'Inserisci il tuo username', en: 'Enter your username', es: 'Ingresa tu nombre de usuario' },
    'reg.placeholder.login_password': { it: 'Inserisci la tua password', en: 'Enter your password', es: 'Ingresa tu contraseña' },
    'reg.user_type':          { it: 'Tipologia Utente', en: 'User Type',            es: 'Tipo de Usuario' },
    'reg.user_type_hint':     { it: 'Seleziona la tua tipologia professionale', en: 'Select your professional type', es: 'Selecciona tu tipo profesional' },
    'reg.freelancer':         { it: '📋 Libero Professionista', en: '📋 Freelancer', es: '📋 Autónomo' },
    'reg.owner':              { it: '👔 Titolare',       en: '👔 Owner',           es: '👔 Titular' },
    'reg.company_type':       { it: '🏢 Azienda',        en: '🏢 Company',         es: '🏢 Empresa' },
    'reg.legal_name':         { it: 'Ragione Sociale',   en: 'Legal Name',         es: 'Razón Social' },
    'reg.legal_name_hint':    { it: 'Nome legale dell\'azienda', en: 'Legal name of the company', es: 'Nombre legal de la empresa' },
    'reg.legal_name_ph':      { it: 'Inserisci la ragione sociale', en: 'Enter the legal name', es: 'Ingresa la razón social' },
    'reg.vat':                { it: 'Partita IVA (Opzionale)', en: 'VAT Number (Optional)', es: 'RUC/NIF (Opcional)' },
    'reg.vat_hint':           { it: 'Formato: IT + 11 cifre', en: 'Format: IT + 11 digits', es: 'Formato: IT + 11 dígitos' },
    'reg.address':            { it: 'Indirizzo (Opzionale)', en: 'Address (Optional)', es: 'Dirección (Opcional)' },
    'reg.address_ph':         { it: 'Via/Piazza, Città, CAP', en: 'Street, City, ZIP', es: 'Calle, Ciudad, CP' },
    'reg.phone':              { it: 'Telefono (Opzionale)', en: 'Phone (Optional)', es: 'Teléfono (Opcional)' },
    'reg.sector':             { it: 'Settore (Opzionale)', en: 'Sector (Optional)', es: 'Sector (Opcional)' },
    'reg.select_sector':      { it: 'Seleziona settore', en: 'Select sector',      es: 'Selecciona sector' },
    'reg.sector.agri':        { it: 'Agricoltura',       en: 'Agriculture',        es: 'Agricultura' },
    'reg.sector.viti':        { it: 'Viticoltura',       en: 'Viticulture',        es: 'Viticultura' },
    'reg.sector.oli':         { it: 'Olivicoltura',      en: 'Olive Growing',      es: 'Olivicultura' },
    'reg.sector.zoo':         { it: 'Zootecnia',         en: 'Livestock',          es: 'Ganadería' },
    'reg.sector.agriturismo': { it: 'Agriturismo',       en: 'Farm Stay',          es: 'Agroturismo' },
    'reg.sector.other':       { it: 'Altro',             en: 'Other',              es: 'Otro' },
    'reg.sector.specify':     { it: 'Specifica Settore', en: 'Specify Sector',     es: 'Especificar Sector' },
    'reg.sector.specify_ph':  { it: 'Inserisci il settore', en: 'Enter the sector', es: 'Ingresa el sector' },
    'reg.company_notes':      { it: 'Note Aziendali (Opzionale)', en: 'Company Notes (Optional)', es: 'Notas de Empresa (Opcional)' },
    'reg.company_notes_ph':   { it: 'Informazioni aggiuntive sull\'azienda...', en: 'Additional information about the company...', es: 'Información adicional sobre la empresa...' },
    'reg.first_access_info':  { it: '<strong>Primo accesso?</strong> Verrai registrato come <b>Amministratore</b> con accesso completo. Potrai poi creare i tuoi sotto-utenti (operatori, visitatori) dalla sezione "Gestione Utenti".',
                                en: '<strong>First time?</strong> You will be registered as <b>Administrator</b> with full access. You can then create your sub-users (operators, viewers) from the "User Management" section.',
                                es: '<strong>¿Primer acceso?</strong> Serás registrado como <b>Administrador</b> con acceso completo. Luego podrás crear tus sub-usuarios (operadores, visitantes) desde la sección "Gestión de Usuarios".' },
    'reg.privacy_declare':    { it: 'Dichiaro di aver letto e accettato l\'<a href="#" onclick="showPrivacyPolicy(); return false;" style="color:#4CAF50;text-decoration:underline;">Informativa sulla Privacy</a> e presto il mio consenso al trattamento dei miei dati personali per le finalità indicate. <span style="color:#f44336;">*</span>',
                                en: 'I have read and accept the <a href="#" onclick="showPrivacyPolicy(); return false;" style="color:#4CAF50;text-decoration:underline;">Privacy Policy</a> and I consent to the processing of my personal data for the stated purposes. <span style="color:#f44336;">*</span>',
                                es: 'He leído y acepto la <a href="#" onclick="showPrivacyPolicy(); return false;" style="color:#4CAF50;text-decoration:underline;">Política de Privacidad</a> y doy mi consentimiento para el tratamiento de mis datos personales para los fines indicados. <span style="color:#f44336;">*</span>' },
    'reg.register_user_btn':  { it: 'Registra Utente',   en: 'Register User',      es: 'Registrar Usuario' },
    'auth.back_to_login':     { it: '← Torna al Login',  en: '← Back to Login',    es: '← Volver al Inicio' },
    'auth.recover_password_title': { it: 'Recupera Password', en: 'Recover Password', es: 'Recuperar Contraseña' },
    'auth.forgot_email_ph':   { it: 'es. mario.rossi@email.com', en: 'e.g. john.doe@email.com', es: 'ej. juan.perez@email.com' },

    /* ============ REGISTRAZIONE LOTTO ============ */
    'reg_lot.company_required': { it: 'Azienda', en: 'Company', es: 'Empresa' },
    'reg_lot.select_company_ph': { it: 'Seleziona o crea un\'azienda', en: 'Select or create a company', es: 'Selecciona o crea una empresa' },
    'reg_lot.new_company_btn': { it: '+ Nuova Azienda', en: '+ New Company', es: '+ Nueva Empresa' },
    'reg_lot.sectors_label':  { it: 'Settori di attività', en: 'Business sectors', es: 'Sectores de actividad' },
    'reg_lot.select_type':    { it: 'Seleziona tipologia', en: 'Select type',      es: 'Selecciona tipo' },
    'reg_lot.type.fruits':    { it: 'Frutta',            en: 'Fruits',             es: 'Frutas' },
    'reg_lot.type.veg':       { it: 'Verdura',           en: 'Vegetables',         es: 'Verduras' },
    'reg_lot.type.grains':    { it: 'Cereali',           en: 'Grains',             es: 'Cereales' },
    'reg_lot.select_type_first':{ it: 'Seleziona prima la tipologia', en: 'Select type first', es: 'Selecciona el tipo primero' },
    'reg_lot.custom_prod_hint':{ it: 'Inserisci il nome del prodotto personalizzato', en: 'Enter the custom product name', es: 'Ingresa el nombre del producto personalizado' },
    'reg_lot.lot_id_hint':    { it: 'Identificativo del lotto campo', en: 'Field lot identifier', es: 'Identificador de parcela del campo' },
    'reg_lot.area_hint':      { it: 'Superficie totale del lotto in ettari', en: 'Total lot area in hectares', es: 'Superficie total de la parcela en hectáreas' },

    /* ============ HEADER / DEFAULT USER ============ */
    'header.user_default':    { it: 'Utente',            en: 'User',               es: 'Usuario' },
    'header.role_default':    { it: 'Ruolo',             en: 'Role',               es: 'Rol' },
    'header.user_management_full': { it: 'Gestione Utenti', en: 'User Management', es: 'Gestión de Usuarios' },
    'header.user_management_tooltip': { it: 'Gestione Utenti e Permessi', en: 'User & Permissions Management', es: 'Gestión de Usuarios y Permisos' },

    /* ============ SPINNER / LOADING ============ */
    'spinner.loading':        { it: 'Caricamento in corso...', en: 'Loading...',   es: 'Cargando...' },
    'spinner.wait':           { it: 'Attendere prego',   en: 'Please wait',        es: 'Por favor espera' },

    /* ============ PAGINATION ============ */
    'pager.page':             { it: 'Pagina',            en: 'Page',               es: 'Página' },
    'pager.of':               { it: 'di',                en: 'of',                 es: 'de' },
    'pager.prev':             { it: '← Precedente',      en: '← Previous',         es: '← Anterior' },
    'pager.next':             { it: 'Successivo →',      en: 'Next →',             es: 'Siguiente →' },

    /* ============ DETTAGLI LOTTO — TABS ============ */
    'det.tab.activities':     { it: 'Attività',          en: 'Activities',         es: 'Actividades' },
    'det.tab.analyses':       { it: 'Analisi',           en: 'Analyses',           es: 'Análisis' },
    'det.tab.map':            { it: 'Mappa',             en: 'Map',                es: 'Mapa' },
    'det.tab.info':           { it: 'Info Lotto',        en: 'Lot Info',           es: 'Info Parcela' },
    'det.activities.subtitle':{ it: 'Registra e visualizza le attività di raccolta del lotto', en: 'Record and view the lot harvest activities', es: 'Registra y visualiza las actividades de cosecha de la parcela' },
    'det.analyses.subtitle':  { it: 'Carica e gestisci le analisi di laboratorio', en: 'Upload and manage laboratory analyses', es: 'Sube y gestiona los análisis de laboratorio' },
    'det.info.subtitle':      { it: 'Informazioni aggiuntive sul lotto', en: 'Additional information about the lot', es: 'Información adicional sobre la parcela' },
    'det.select_year':        { it: 'Seleziona anno',    en: 'Select year',        es: 'Selecciona año' },
    'det.add_activity':       { it: 'Aggiungi Attività', en: 'Add Activity',       es: 'Agregar Actividad' },
    'det.add_analysis':       { it: 'Aggiungi Analisi',  en: 'Add Analysis',       es: 'Agregar Análisis' },
    'det.no_activities':      { it: 'Nessuna attività registrata', en: 'No activities recorded', es: 'Sin actividades registradas' },
    'det.no_analyses':        { it: 'Nessuna analisi registrata', en: 'No analyses recorded', es: 'Sin análisis registrados' },
    'det.harvest_title':      { it: 'Attività di Raccolta', en: 'Harvest Activities', es: 'Actividades de Cosecha' },
    'det.harvest_date':       { it: 'Data Raccolta',       en: 'Harvest Date',        es: 'Fecha de Cosecha' },
    'det.harvest_kg':         { it: 'Kg Raccolti',         en: 'Kg Harvested',        es: 'Kg Cosechados' },
    'det.harvest_notes':      { it: 'Note Raccolta',       en: 'Harvest Notes',       es: 'Notas de Cosecha' },
    'det.harvest_notes_ph':   { it: 'Note sulla raccolta...', en: 'Notes about the harvest...', es: 'Notas sobre la cosecha...' },
    'det.add_harvest':        { it: 'Aggiungi Raccolta',   en: 'Add Harvest',         es: 'Agregar Cosecha' },
    'det.harvest_history':    { it: 'Storico Attività di Raccolta', en: 'Harvest Activity History', es: 'Historial de Actividades de Cosecha' },
    'det.analyses_title':     { it: 'Analisi Multiresiduali', en: 'Multi-residue Analyses', es: 'Análisis Multirresiduo' },
    'det.analysis_year':      { it: 'Anno Riferimento',    en: 'Reference Year',      es: 'Año de Referencia' },
    'det.analysis_file':      { it: 'Carica File Analisi', en: 'Upload Analysis File', es: 'Subir Archivo de Análisis' },
    'det.analysis_notes':     { it: 'Note Analisi',        en: 'Analysis Notes',      es: 'Notas de Análisis' },
    'det.analysis_notes_ph':  { it: 'Note sull\'analisi...', en: 'Notes about the analysis...', es: 'Notas sobre el análisis...' },
    'det.upload_analysis':    { it: 'Carica Analisi',      en: 'Upload Analysis',     es: 'Subir Análisis' },
    'det.analyses_history':   { it: 'Storico Analisi Caricate', en: 'Uploaded Analyses History', es: 'Historial de Análisis Subidos' },
    'det.general_notes_title':{ it: 'Note Generali Lotto', en: 'Lot General Notes',   es: 'Notas Generales de Parcela' },
    'det.general_notes_ph':   { it: 'Inserisci note generali sul lotto...', en: 'Enter general notes about the lot...', es: 'Ingresa notas generales sobre la parcela...' },
    'det.save_details':       { it: 'Salva Dettagli',      en: 'Save Details',        es: 'Guardar Detalles' },
    'det.back_to_list':       { it: 'Torna alla Lista',    en: 'Back to List',        es: 'Volver a la Lista' },

    /* ============ ECONOMICA ============ */
    'eco.subtitle':           { it: 'Inserisci i dati economici per la stagione agricola', en: 'Enter economic data for the agricultural season', es: 'Ingresa los datos económicos para la temporada agrícola' },
    'eco.history_subtitle':   { it: 'Cronologia e bilancio economico', en: 'History and economic balance', es: 'Historial y balance económico' },
    'eco.price_mode_hint':    { it: 'Scegli come vuoi inserire il prezzo', en: 'Choose how to enter the price', es: 'Elige cómo quieres ingresar el precio' },
    'eco.price_per_kg_hint':  { it: 'Prezzo per chilogrammo', en: 'Price per kilogram', es: 'Precio por kilogramo' },
    'eco.price_total_hint':   { it: 'Prezzo totale complessivo', en: 'Overall total price', es: 'Precio total general' },
    'eco.qty_hint':           { it: 'Quantità totale raccolta', en: 'Total quantity harvested', es: 'Cantidad total cosechada' },
    'eco.year':               { it: 'Anno',              en: 'Year',               es: 'Año' },
    'eco.select_year':        { it: 'Seleziona anno',    en: 'Select year',        es: 'Selecciona año' },
    'eco.per_kg':             { it: 'Prezzo €/kg',       en: 'Price €/kg',         es: 'Precio €/kg' },
    'eco.total_price':        { it: 'Prezzo Totale',     en: 'Total Price',        es: 'Precio Total' },
    'eco.quantity':           { it: 'Quantità (kg)',     en: 'Quantity (kg)',      es: 'Cantidad (kg)' },
    'eco.revenue':            { it: 'Ricavo',            en: 'Revenue',            es: 'Ingreso' },
    'eco.save':               { it: 'Salva Dati Economici', en: 'Save Economic Data', es: 'Guardar Datos Económicos' },

    /* ============ COSTI ============ */
    'costi.subtitle':         { it: 'Registra attività e calcola costi manodopera', en: 'Record activities and calculate labor costs', es: 'Registra actividades y calcula costos de mano de obra' },
    'costi.tab.personnel':    { it: 'Personale',         en: 'Personnel',          es: 'Personal' },
    'costi.tab.means':        { it: 'Mezzi Tecnici',     en: 'Technical Means',    es: 'Medios Técnicos' },
    'costi.tab.durables':     { it: 'Beni Durevoli',     en: 'Durable Assets',     es: 'Bienes Duraderos' },
    'costi.qualification':    { it: 'Qualifica',         en: 'Qualification',      es: 'Cualificación' },
    'costi.qualification.standard': { it: 'Standard', en: 'Standard', es: 'Estándar' },
    'costi.qualification.spec':{ it: 'Specializzato',    en: 'Specialized',        es: 'Especializado' },
    'costi.category':         { it: 'Categoria',         en: 'Category',           es: 'Categoría' },
    'costi.category.pesticides':{ it: 'Fitofarmaci',     en: 'Pesticides',         es: 'Fitofármacos' },
    'costi.category.fertilizers':{ it: 'Fertilizzanti',  en: 'Fertilizers',        es: 'Fertilizantes' },
    'costi.category.seeds':   { it: 'Sementi',           en: 'Seeds',              es: 'Semillas' },
    'costi.category.fuels':   { it: 'Carburanti',        en: 'Fuels',              es: 'Combustibles' },
    'costi.description':      { it: 'Descrizione',       en: 'Description',        es: 'Descripción' },
    'costi.durable_desc':     { it: 'Descrizione bene',  en: 'Asset description',  es: 'Descripción del bien' },
    'costi.amort_years':      { it: 'Anni ammortamento', en: 'Amortization years', es: 'Años de amortización' },
    'costi.start_year':       { it: 'Anno inizio',       en: 'Start year',         es: 'Año de inicio' },
    'costi.hours':            { it: 'Ore',               en: 'Hours',              es: 'Horas' },
    'costi.rate':             { it: 'Tariffa €/h',       en: 'Rate €/h',           es: 'Tarifa €/h' },
    'costi.quantity':         { it: 'Quantità',          en: 'Quantity',           es: 'Cantidad' },
    'costi.unit_price':       { it: 'Prezzo unitario',   en: 'Unit price',         es: 'Precio unitario' },
    'costi.total':            { it: 'Totale',            en: 'Total',              es: 'Total' },
    'costi.save':             { it: 'Salva Costo',       en: 'Save Cost',          es: 'Guardar Costo' },

    /* ============ USER MANAGEMENT ============ */
    'users.title':            { it: 'Gestione Utenti',   en: 'User Management',    es: 'Gestión de Usuarios' },
    'users.new_user':         { it: 'Nuovo Utente',      en: 'New User',           es: 'Nuevo Usuario' },
    'users.username':         { it: 'Username',          en: 'Username',           es: 'Nombre de usuario' },
    'users.email':            { it: 'Email',             en: 'Email',              es: 'Email' },
    'users.email_optional':   { it: 'Email',             en: 'Email',              es: 'Email' },
    'users.email_optional_hint': { it: '(opzionale, per invio credenziali)', en: '(optional, for sending credentials)', es: '(opcional, para envío de credenciales)' },
    'users.password':         { it: 'Password',          en: 'Password',           es: 'Contraseña' },
    'users.role':             { it: 'Ruolo',             en: 'Role',               es: 'Rol' },
    'users.role.admin':       { it: 'Amministratore',    en: 'Administrator',      es: 'Administrador' },
    'users.role.operator':    { it: 'Operatore',         en: 'Operator',           es: 'Operador' },
    'users.role.viewer':      { it: 'Visitatore',        en: 'Viewer',             es: 'Visitante' },
    'users.send_email':       { it: 'Invia credenziali via email', en: 'Send credentials via email', es: 'Enviar credenciales por email' },
    'users.create_btn':       { it: 'Crea Utente',       en: 'Create User',        es: 'Crear Usuario' },
    'users.list_title':       { it: 'Utenti registrati', en: 'Registered users',   es: 'Usuarios registrados' },
    'users.status.active':    { it: 'Attivo',            en: 'Active',             es: 'Activo' },
    'users.status.inactive':  { it: 'Inattivo',          en: 'Inactive',           es: 'Inactivo' },
    'users.actions.deactivate': { it: 'Disattiva',       en: 'Deactivate',         es: 'Desactivar' },
    'users.actions.activate': { it: 'Attiva',            en: 'Activate',           es: 'Activar' },
    'users.actions.reset_pw': { it: 'Reset Password',    en: 'Reset Password',     es: 'Restablecer Contraseña' },
    'users.actions.delete':   { it: 'Elimina',           en: 'Delete',             es: 'Eliminar' },

    /* ============ BUTTONS / GENERAL UI ============ */
    'btn.save':               { it: 'Salva',             en: 'Save',               es: 'Guardar' },
    'btn.cancel':             { it: 'Annulla',           en: 'Cancel',             es: 'Cancelar' },
    'btn.delete':             { it: 'Elimina',           en: 'Delete',             es: 'Eliminar' },
    'btn.edit':               { it: 'Modifica',          en: 'Edit',               es: 'Editar' },
    'btn.view':               { it: 'Visualizza',        en: 'View',               es: 'Ver' },
    'btn.lots':               { it: 'Lotti',             en: 'Lots',               es: 'Parcelas' },
    'btn.details':            { it: 'Dettagli',          en: 'Details',            es: 'Detalles' },
    'btn.add':                { it: 'Aggiungi',          en: 'Add',                es: 'Agregar' },
    'btn.close':              { it: 'Chiudi',            en: 'Close',              es: 'Cerrar' },
    'btn.confirm':            { it: 'Conferma',          en: 'Confirm',            es: 'Confirmar' },
    'btn.export_pdf':         { it: 'Esporta PDF',       en: 'Export PDF',         es: 'Exportar PDF' },
    'btn.export_excel':       { it: 'Esporta Excel',     en: 'Export Excel',       es: 'Exportar Excel' },
    'btn.download':           { it: 'Scarica',           en: 'Download',           es: 'Descargar' },
    'btn.upload':             { it: 'Carica',            en: 'Upload',             es: 'Subir' },
    'btn.print':              { it: 'Stampa',            en: 'Print',              es: 'Imprimir' },
    'btn.refresh':            { it: 'Aggiorna',          en: 'Refresh',            es: 'Actualizar' },
    'btn.search':             { it: 'Cerca',             en: 'Search',             es: 'Buscar' },
    'btn.reset':              { it: 'Reset',             en: 'Reset',              es: 'Restablecer' },
    'btn.all_seasons':        { it: 'Tutte le stagioni', en: 'All seasons',        es: 'Todas las temporadas' },
    'btn.all_lots':           { it: 'Tutti i lotti',     en: 'All lots',           es: 'Todas las parcelas' },
    'btn.per_company':        { it: 'Per Azienda',       en: 'By Company',         es: 'Por Empresa' },

    /* ============ ERROR / VALIDATION ============ */
    'error.generic':          { it: 'Si è verificato un errore. Riprova.', en: 'An error occurred. Try again.', es: 'Ocurrió un error. Inténtalo de nuevo.' },
    'error.required_fields':  { it: 'Compila tutti i campi obbligatori', en: 'Please fill all required fields', es: 'Completa todos los campos obligatorios' },
    'error.server':           { it: 'Errore del server', en: 'Server error',       es: 'Error del servidor' },
    'error.timeout':          { it: 'Timeout, riprova',  en: 'Timeout, try again', es: 'Tiempo de espera agotado, inténtalo de nuevo' },
    'error.load_data':        { it: 'Errore nel caricamento dei dati', en: 'Error loading data', es: 'Error al cargar los datos' },
    'error.save_data':        { it: 'Errore nel salvataggio', en: 'Error saving', es: 'Error al guardar' },
    'error.delete_data':      { it: 'Errore nell\'eliminazione', en: 'Error deleting', es: 'Error al eliminar' },

    /* ============ CONFIRM DIALOGS ============ */
    'confirm.delete_generic': { it: 'Sei sicuro di voler eliminare?', en: 'Are you sure you want to delete?', es: '¿Estás seguro de eliminar?' },
    'confirm.delete_lot':     { it: 'Eliminare questo lotto?', en: 'Delete this lot?', es: '¿Eliminar esta parcela?' },
    'confirm.delete_company': { it: 'Eliminare questa azienda? Verranno eliminati anche tutti i lotti associati.', en: 'Delete this company? All associated lots will also be deleted.', es: '¿Eliminar esta empresa? También se eliminarán todas las parcelas asociadas.' },
    'confirm.delete_activity':{ it: 'Eliminare questa attività?', en: 'Delete this activity?', es: '¿Eliminar esta actividad?' },
    'confirm.delete_user':    { it: 'Eliminare questo utente?', en: 'Delete this user?', es: '¿Eliminar este usuario?' },
    'confirm.logout':         { it: 'Sei sicuro di voler uscire?', en: 'Are you sure you want to log out?', es: '¿Seguro que quieres cerrar sesión?' },

    /* ============ BILANCIO EXTRA ============ */
    'bilancio.lots_view':     { it: 'Vista Lotti',       en: 'Lots View',          es: 'Vista Parcelas' },
    'bilancio.company_view':  { it: 'Vista Aziende',     en: 'Companies View',     es: 'Vista Empresas' },
    'bilancio.select_lot':    { it: 'Seleziona un lotto per vedere il bilancio', en: 'Select a lot to see the balance', es: 'Selecciona una parcela para ver el balance' },
    'bilancio.select_company':{ it: 'Seleziona un\'azienda per vedere il bilancio', en: 'Select a company to see the balance', es: 'Selecciona una empresa para ver el balance' },
    'bilancio.all_seasons_opt':{ it: 'Tutte le stagioni', en: 'All seasons',       es: 'Todas las temporadas' },

    /* ============ FIELD LABELS COMMON ============ */
    'field.description':      { it: 'Descrizione',       en: 'Description',        es: 'Descripción' },
    'field.name':             { it: 'Nome',              en: 'Name',               es: 'Nombre' },
    'field.address':          { it: 'Indirizzo',         en: 'Address',            es: 'Dirección' },
    'field.city':             { it: 'Città',             en: 'City',               es: 'Ciudad' },
    'field.phone':            { it: 'Telefono',          en: 'Phone',              es: 'Teléfono' },
    'field.email':            { it: 'Email',             en: 'Email',              es: 'Email' },
    'field.date':             { it: 'Data',              en: 'Date',               es: 'Fecha' },
    'field.type':             { it: 'Tipo',              en: 'Type',               es: 'Tipo' },
    'field.status':           { it: 'Stato',             en: 'Status',             es: 'Estado' },
    'field.amount':           { it: 'Importo',           en: 'Amount',             es: 'Importe' },
    'field.quantity':         { it: 'Quantità',          en: 'Quantity',           es: 'Cantidad' },
    'field.price':            { it: 'Prezzo',            en: 'Price',              es: 'Precio' },
    'field.notes':            { it: 'Note',              en: 'Notes',              es: 'Notas' },
    'field.optional':         { it: '(Opzionale)',       en: '(Optional)',         es: '(Opcional)' },
    'field.required_star':    { it: '*',                 en: '*',                  es: '*' },

    /* ============ REGISTRAZIONE LOTTO — form completo ============ */
    'reg_lot.company':                { it: 'Azienda',              en: 'Company',              es: 'Empresa' },
    'reg_lot.select_existing':        { it: '-- Seleziona azienda esistente --', en: '-- Select existing company --', es: '-- Selecciona empresa existente --' },
    'reg_lot.new_company_opt':        { it: '➕ Nuova Azienda',    en: '➕ New Company',      es: '➕ Nueva Empresa' },
    'reg_lot.company_help':           { it: 'Seleziona un\'azienda esistente o crea una nuova. I lotti di una stessa azienda condividono ragione sociale e settori.', en: 'Select an existing company or create a new one. Lots from the same company share legal name and sectors.', es: 'Selecciona una empresa existente o crea una nueva. Las parcelas de una misma empresa comparten razón social y sectores.' },
    'reg_lot.new_company_title':      { it: 'Nuova Azienda',       en: 'New Company',          es: 'Nueva Empresa' },
    'reg_lot.legal_name':             { it: 'Ragione Sociale *',   en: 'Legal Name *',         es: 'Razón Social *' },
    'reg_lot.legal_name_ph':          { it: 'es. Azienda Alpha S.r.l.', en: 'e.g. Alpha Farm Ltd.', es: 'ej. Empresa Alpha S.L.' },
    'reg_lot.legal_address':          { it: 'Sede legale (opzionale)', en: 'Legal address (optional)', es: 'Domicilio legal (opcional)' },
    'reg_lot.legal_address_ph':       { it: 'es. Via Roma 12, Bari', en: 'e.g. 12 Main St., New York', es: 'ej. Calle Mayor 12, Madrid' },
    'reg_lot.sectors':                { it: 'Settori di attività', en: 'Business sectors',     es: 'Sectores de actividad' },
    'reg_lot.location':               { it: 'Luogo',               en: 'Location',             es: 'Ubicación' },
    'reg_lot.location_ph':            { it: 'Inserisci il luogo di produzione', en: 'Enter the production location', es: 'Ingresa la ubicación de producción' },
    'reg_lot.location_hint':          { it: 'Inserisci almeno 2 caratteri', en: 'Enter at least 2 characters', es: 'Ingresa al menos 2 caracteres' },
    'reg_lot.gps':                    { it: 'Coordinate GPS (Link Google Maps) - Opzionale', en: 'GPS Coordinates (Google Maps Link) - Optional', es: 'Coordenadas GPS (Enlace Google Maps) - Opcional' },
    'reg_lot.save_position':          { it: 'Salva Posizione',     en: 'Save Position',        es: 'Guardar Posición' },
    'reg_lot.use_current':            { it: 'Usa posizione attuale', en: 'Use current position', es: 'Usar posición actual' },
    'reg_lot.paste_clipboard':        { it: 'Incolla dagli appunti', en: 'Paste from clipboard', es: 'Pegar desde portapapeles' },
    'reg_lot.gen_coords':             { it: 'Genera da coordinate', en: 'Generate from coordinates', es: 'Generar desde coordenadas' },
    'reg_lot.add_later':              { it: 'Aggiungerò dopo',     en: 'Add later',            es: 'Añadir más tarde' },
    'reg_lot.gps_help':               { it: 'Puoi aggiungere le coordinate GPS anche in un secondo momento', en: 'You can add GPS coordinates later', es: 'Puedes añadir las coordenadas GPS más tarde' },
    'reg_lot.gps_tooltip':            { it: 'Clicca "Aggiungerò dopo" se vuoi inserire le coordinate in un secondo momento', en: 'Click "Add later" if you want to enter coordinates later', es: 'Haz clic en "Añadir más tarde" si quieres introducir las coordenadas más tarde' },
    'reg_lot.product_type':           { it: 'Tipologia di Prodotto', en: 'Product Type',       es: 'Tipo de Producto' },
    'reg_lot.type.wine':              { it: 'Vino',                en: 'Wine',                 es: 'Vino' },
    'reg_lot.type.oil':               { it: 'Olio',                en: 'Oil',                  es: 'Aceite' },
    'reg_lot.type.milk':              { it: 'Latte',               en: 'Milk',                 es: 'Leche' },
    'reg_lot.type.meat':              { it: 'Carne',               en: 'Meat',                 es: 'Carne' },
    'reg_lot.product_optional':       { it: 'Prodotto (Opzionale)', en: 'Product (Optional)',  es: 'Producto (Opcional)' },
    'reg_lot.product_help':           { it: 'Seleziona "altri" per inserire un prodotto personalizzato', en: 'Select "others" to enter a custom product', es: 'Selecciona "otros" para ingresar un producto personalizado' },
    'reg_lot.specify_product':        { it: 'Specifica Prodotto',  en: 'Specify Product',      es: 'Especificar Producto' },
    'reg_lot.specify_product_ph':     { it: 'Inserisci il nome del prodotto', en: 'Enter the product name', es: 'Ingresa el nombre del producto' },
    'reg_lot.variety':                { it: 'Varietà (Opzionale)', en: 'Variety (Optional)',   es: 'Variedad (Opcional)' },
    'reg_lot.variety_ph':             { it: 'Inserisci la varietà', en: 'Enter the variety',    es: 'Ingresa la variedad' },
    'reg_lot.variety_hint':           { it: 'Inserisci almeno 2 caratteri (opzionale)', en: 'Enter at least 2 characters (optional)', es: 'Ingresa al menos 2 caracteres (opcional)' },
    'reg_lot.field_lot':              { it: 'Lotto Campo (Opzionale)', en: 'Field Lot (Optional)', es: 'Parcela de Campo (Opcional)' },
    'reg_lot.field_lot_ph':           { it: 'Es: Campo A, Lotto 12B', en: 'e.g. Field A, Lot 12B', es: 'ej. Campo A, Parcela 12B' },
    'reg_lot.field_size':             { it: 'Superficie (ettari) (Opzionale)', en: 'Area (hectares) (Optional)', es: 'Superficie (hectáreas) (Opcional)' },
    'reg_lot.save_lot':               { it: 'Salva Lotto',         en: 'Save Lot',             es: 'Guardar Parcela' },
    'reg_lot.edit_company_btn':       { it: 'Modifica',            en: 'Edit',                 es: 'Editar' },

    /* ============ LISTA / TOGGLE ============ */
    'lista.per_azienda':              { it: 'Per Azienda',          en: 'By Company',          es: 'Por Empresa' },
    'lista.all_lots':                 { it: 'Tutti i lotti',        en: 'All lots',            es: 'Todas las parcelas' },
    'lista.new_azienda':              { it: 'Nuova Azienda',        en: 'New Company',         es: 'Nueva Empresa' },
    'lista.registered_lots':          { it: 'Lista Lotti Registrati', en: 'Registered Lots List', es: 'Lista de Parcelas Registradas' },
    'lista.no_companies':             { it: 'Nessuna azienda registrata', en: 'No companies registered', es: 'Sin empresas registradas' },
    'lista.no_lots':                  { it: 'Nessun lotto registrato', en: 'No lots registered', es: 'Sin parcelas registradas' },
    'lista.view_lots':                { it: 'Lotti',                en: 'Lots',                es: 'Parcelas' },
    'lista.edit':                     { it: 'Modifica',             en: 'Edit',                es: 'Editar' },
    'lista.delete':                   { it: 'Elimina',              en: 'Delete',              es: 'Eliminar' },
    'lista.search_ph':                { it: 'Cerca per nome, luogo, varietà, lotto campo, ID...', en: 'Search by name, location, variety, field lot, ID...', es: 'Buscar por nombre, ubicación, variedad, parcela de campo, ID...' },
    'lista.search_help':              { it: 'Digita per filtrare i lotti in tempo reale.', en: 'Type to filter lots in real time.', es: 'Escribe para filtrar parcelas en tiempo real.' },
    'pager.per_page_10':              { it: '10 per pagina',        en: '10 per page',         es: '10 por página' },
    'pager.per_page_20':              { it: '20 per pagina',        en: '20 per page',         es: '20 por página' },
    'pager.per_page_50':              { it: '50 per pagina',        en: '50 per page',         es: '50 por página' },
    'pager.per_page_100':             { it: '100 per pagina',       en: '100 per page',        es: '100 por página' },

    /* ============ ECONOMICA — Form registrazione ============ */
    'eco.new_registration':   { it: 'Nuova Registrazione Economica', en: 'New Economic Entry', es: 'Nuevo Registro Económico' },
    'eco.season':             { it: 'Stagione Agricola',   en: 'Agricultural Season', es: 'Temporada Agrícola' },
    'eco.transaction_date':   { it: 'Data Acquisto/Vendita', en: 'Purchase/Sale Date', es: 'Fecha de Compra/Venta' },
    'eco.calc_method':        { it: 'Metodo di Calcolo Prezzo', en: 'Price Calculation Method', es: 'Método de Cálculo del Precio' },
    'eco.method_kg':          { it: 'Prezzo al kg (€/kg)', en: 'Price per kg (€/kg)', es: 'Precio por kg (€/kg)' },
    'eco.method_total':       { it: 'Prezzo totale (€)',   en: 'Total price (€)',      es: 'Precio total (€)' },
    'eco.total_kg':           { it: 'Totale Kg Raccolti',  en: 'Total Kg Harvested',  es: 'Total Kg Cosechados' },
    'eco.calc_auto':          { it: 'Calcola Auto',        en: 'Auto Calc',           es: 'Cálc. Auto' },
    'eco.total_costs':        { it: 'Totale Costi Stagione (€)', en: 'Total Season Costs (€)', es: 'Costos Totales Temporada (€)' },
    'eco.no_cost_added':      { it: 'Nessun costo aggiunto', en: 'No cost added',      es: 'Sin costos añadidos' },
    'eco.import_costs_tooltip':{ it: 'Importa il totale costi (personale + mezzi tecnici + ammortamenti) dalla sezione Gestione Costi', en: 'Import total costs (personnel + technical means + amortizations) from Cost Management section', es: 'Importa los costos totales (personal + medios técnicos + amortizaciones) desde la sección Gestión de Costos' },
    'eco.update_from_costs':  { it: 'Aggiorna da Costi',   en: 'Update from Costs',   es: 'Actualizar desde Costos' },
    'eco.total_costs_help':   { it: 'Somma di personale, mezzi tecnici e quote di ammortamento dalla sezione Gestione Costi (sola lettura)', en: 'Sum of personnel, technical means and amortization shares from Cost Management (read-only)', es: 'Suma de personal, medios técnicos y cuotas de amortización desde Gestión de Costos (solo lectura)' },
    'eco.save_registration':  { it: 'Salva Registrazione', en: 'Save Entry',          es: 'Guardar Registro' },
    'eco.history_title':      { it: 'Storico Registrazioni Economiche', en: 'Economic Entry History', es: 'Historial de Registros Económicos' },

    /* ============ COSTI — Form completo ============ */
    'costi.personnel_title':  { it: '👥 Costo Personale',  en: '👥 Personnel Cost',   es: '👥 Costo Personal' },
    'costi.hourly_rates':     { it: '💶 Tariffe Orarie Stagione', en: '💶 Hourly Rates Season', es: '💶 Tarifas Horarias Temporada' },
    'costi.rate_standard':    { it: 'Standard (€/ora)',    en: 'Standard (€/hour)',   es: 'Estándar (€/hora)' },
    'costi.rate_spec':        { it: 'Specializzato (€/ora)', en: 'Specialized (€/hour)', es: 'Especializado (€/hora)' },
    'costi.update_rates':     { it: 'Aggiorna Tariffe',    en: 'Update Rates',        es: 'Actualizar Tarifas' },
    'costi.record_activity':  { it: '📝 Registra Attività Personale', en: '📝 Record Personnel Activity', es: '📝 Registrar Actividad de Personal' },
    'costi.activity_date':    { it: 'Data Attività',       en: 'Activity Date',       es: 'Fecha de Actividad' },
    'costi.n_operators':      { it: 'N. Operatori',        en: '# Operators',         es: 'N.° Operadores' },
    'costi.hours_worked':     { it: 'Ore Lavorate',        en: 'Hours Worked',        es: 'Horas Trabajadas' },
    'costi.activity_performed':{ it: 'Attività Svolta',    en: 'Activity Performed',  es: 'Actividad Realizada' },
    'costi.select_predefined':{ it: 'Seleziona attività predefinita...', en: 'Select predefined activity...', es: 'Selecciona actividad predefinida...' },
    'costi.free_activity_ph': { it: 'Oppure scrivi attività libera...', en: 'Or type a custom activity...', es: 'O escribe una actividad libre...' },
    'costi.notes_ph':         { it: 'Note aggiuntive...',  en: 'Additional notes...', es: 'Notas adicionales...' },
    'costi.record_activity_btn':{ it: 'Registra Attività', en: 'Record Activity',     es: 'Registrar Actividad' },
    'costi.personnel_register':{ it: '📊 Registro Attività Personale', en: '📊 Personnel Activity Log', es: '📊 Registro de Actividades del Personal' },
    'costi.view.day':         { it: '📅 Giorno',           en: '📅 Day',              es: '📅 Día' },
    'costi.view.week':        { it: '📆 Settimana',        en: '📆 Week',             es: '📆 Semana' },
    'costi.view.month':       { it: '🗓️ Mese',            en: '🗓️ Month',           es: '🗓️ Mes' },
    'costi.view.year':        { it: '📆 Anno',             en: '📆 Year',             es: '📆 Año' },
    'costi.total_personnel_season': { it: 'Totale Costo Personale Stagione', en: 'Total Personnel Cost Season', es: 'Costo Total Personal Temporada' },
    'costi.means_title':      { it: '🧪 Costo Mezzi Tecnici', en: '🧪 Technical Means Cost', es: '🧪 Costo Medios Técnicos' },
    'costi.means_subtitle':   { it: 'Fitofarmaci, fertilizzanti e altri mezzi', en: 'Pesticides, fertilizers and other means', es: 'Fitofármacos, fertilizantes y otros medios' },
    'costi.desc_product_ph':  { it: 'Descrizione prodotto...', en: 'Product description...', es: 'Descripción del producto...' },
    'costi.amount':           { it: 'Importo (€)',         en: 'Amount (€)',          es: 'Importe (€)' },
    'costi.record_cost':      { it: 'Registra Costo',      en: 'Record Cost',         es: 'Registrar Costo' },
    'costi.means_register':   { it: '📊 Registro Mezzi Tecnici', en: '📊 Technical Means Log', es: '📊 Registro de Medios Técnicos' },
    'costi.total_means':      { it: 'Totale Mezzi Tecnici', en: 'Total Technical Means', es: 'Total Medios Técnicos' },
    'costi.durables_title':   { it: '🚜 Ammortamento Beni Durevoli', en: '🚜 Durable Assets Amortization', es: '🚜 Amortización de Bienes Duraderos' },
    'costi.durables_subtitle':{ it: 'Trattori, impianti e attrezzature', en: 'Tractors, plants and equipment', es: 'Tractores, plantas y equipos' },
    'costi.durable_assets_amort':{ it: 'Beni Durevoli in Ammortamento', en: 'Durable Assets in Amortization', es: 'Bienes Duraderos en Amortización' },
    'costi.add_durable':      { it: 'Aggiungi Bene Durevole', en: 'Add Durable Asset', es: 'Añadir Bien Duradero' },
    'costi.durables_history': { it: 'Storico Beni Registrati', en: 'Registered Assets History', es: 'Historial de Bienes Registrados' },
    'costi.save_durables':    { it: 'Salva Beni Durevoli', en: 'Save Durable Assets', es: 'Guardar Bienes Duraderos' },
    'costi.annual_amort_quota':{ it: 'Quota Ammortamento Annuale', en: 'Annual Amortization Quota', es: 'Cuota de Amortización Anual' },
    'costi.summary_title':    { it: 'Riepilogo Costi Stagione', en: 'Season Costs Summary', es: 'Resumen de Costos Temporada' },
    'costi.amortizations':    { it: 'Ammortamenti',        en: 'Amortizations',       es: 'Amortizaciones' },
    'costi.total_costs':      { it: 'TOTALE COSTI',        en: 'TOTAL COSTS',         es: 'COSTOS TOTALES' },

    /* ============ USERS — Section ============ */
    'users.register_new':     { it: 'Registra Nuovo Utente', en: 'Register New User', es: 'Registrar Nuevo Usuario' },
    'users.username_star':    { it: 'Username *',           en: 'Username *',         es: 'Usuario *' },
    'users.username_ph':      { it: 'es. mario_rossi',      en: 'e.g. john_doe',      es: 'ej. juan_perez' },
    'users.email_ph':         { it: 'es. mario@azienda.it', en: 'e.g. john@company.com', es: 'ej. juan@empresa.es' },
    'users.password_star':    { it: 'Password *',           en: 'Password *',         es: 'Contraseña *' },
    'users.password_ph':      { it: 'Minimo 6 caratteri',   en: 'Minimum 6 characters', es: 'Mínimo 6 caracteres' },
    'users.role_star':        { it: 'Ruolo *',              en: 'Role *',             es: 'Rol *' },
    'users.role.viewer_full': { it: 'Visitatore (solo lettura)', en: 'Viewer (read-only)', es: 'Visitante (solo lectura)' },
    'users.role.operator_full':{ it: 'Operatore (può aggiungere/modificare)', en: 'Operator (can add/edit)', es: 'Operador (puede añadir/editar)' },
    'users.role.admin_full':  { it: 'Amministratore (accesso completo)', en: 'Administrator (full access)', es: 'Administrador (acceso completo)' },
    'users.toggle_password':  { it: 'Mostra/Nascondi password', en: 'Show/Hide password', es: 'Mostrar/Ocultar contraseña' },
    'users.generate_password':{ it: 'Genera password casuale', en: 'Generate random password', es: 'Generar contraseña aleatoria' },
    'users.auto_send_credentials':{ it: 'Invia automaticamente le credenziali via email al sotto-utente (richiede campo Email)', en: 'Automatically send credentials via email to the sub-user (requires Email field)', es: 'Enviar automáticamente las credenciales por email al sub-usuario (requiere campo Email)' },
    'users.registered':       { it: 'Utenti Registrati',   en: 'Registered Users',   es: 'Usuarios Registrados' },
    'users.permissions':      { it: 'Gestione Permessi',   en: 'Permissions Management', es: 'Gestión de Permisos' },

    /* ============ EXPORT / FOOTER / MODAL ============ */
    'export.title':           { it: '📥 Esportazione Dati', en: '📥 Data Export',     es: '📥 Exportación de Datos' },
    'export.subtitle':        { it: 'Scarica il bilancio in Excel completo o PDF stampabile', en: 'Download balance as full Excel or printable PDF', es: 'Descarga el balance en Excel completo o PDF imprimible' },
    'export.excel_full':      { it: 'Excel Completo',       en: 'Full Excel',         es: 'Excel Completo' },
    'export.pdf_season':      { it: 'Report PDF Stagione',  en: 'Season PDF Report',  es: 'Informe PDF Temporada' },
    'export.help':            { it: '<strong>Excel:</strong> dati grezzi (raccolta, costi, mezzi tecnici, beni durevoli) — <strong>PDF:</strong> bilancio sintetico con grafici e tabella riepilogativa',
                                en: '<strong>Excel:</strong> raw data (harvest, costs, technical means, durable assets) — <strong>PDF:</strong> synthetic balance with charts and summary table',
                                es: '<strong>Excel:</strong> datos brutos (cosecha, costos, medios técnicos, bienes duraderos) — <strong>PDF:</strong> balance sintético con gráficos y tabla resumen' },
    'footer.copyright':       { it: '© 2025 Cropbook - Tutti i diritti riservati', en: '© 2025 Cropbook - All rights reserved', es: '© 2025 Cropbook - Todos los derechos reservados' },
    'modal.sectors_help':     { it: 'Seleziona uno o più settori', en: 'Select one or more sectors', es: 'Selecciona uno o más sectores' },

    /* ============ BILANCIO — Charts ============ */
    'bilancio.chart_revenue_costs':{ it: '🍩 Ricavi vs Costi', en: '🍩 Revenue vs Costs', es: '🍩 Ingresos vs Costos' },
    'bilancio.chart_costs_detail':{ it: '📊 Dettaglio Costi', en: '📊 Costs Detail',   es: '📊 Detalle de Costos' },
    'lista.empty_first_hint':         { it: 'Nessuna azienda registrata. Crea la tua prima azienda per iniziare!', en: 'No companies registered. Create your first company to get started!', es: 'Sin empresas registradas. ¡Crea tu primera empresa para comenzar!' },
    'lista.create_company':           { it: 'Crea Azienda', en: 'Create Company', es: 'Crear Empresa' }
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
