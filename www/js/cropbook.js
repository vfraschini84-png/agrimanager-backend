/* ============================================================================
   CROPBOOK — Logica applicativa client-side
   Estratti automaticamente da index.html (fase refactoring A)
   ============================================================================ */

// ==================== SISTEMA DI AUTENTICAZIONE ====================
let currentUser = null;
let allUsers = [];
let userPermissions = {};
// Variabili globali per paginazione lotti
let currentLotsPage = 1;
let totalLotsPages = 1;
let itemsPerPage = 20;
let lotsPagination = null;

// ==================== NAVIGAZIONE INTER-SEZIONI (CROPBOOK) ====================
/**
 * Ritorna l'ID del lotto attualmente "in contesto", se selezionato in una qualsiasi sezione.
 * Cerca in: dettagli > economica > costi > bilancio.
 */
function getActiveLotId() {
    if (typeof currentLotId !== 'undefined' && currentLotId) return Number(currentLotId);
    if (typeof currentEconomicLotId !== 'undefined' && currentEconomicLotId) return Number(currentEconomicLotId);
    if (typeof currentCostiLotId !== 'undefined' && currentCostiLotId) return Number(currentCostiLotId);
    if (typeof currentBilancioLotId !== 'undefined' && currentBilancioLotId) return Number(currentBilancioLotId);
    return null;
}

/**
 * Sincronizza tutte le variabili globali "currentXxxLotId" su un unico valore
 * → garantisce che il lotto resti selezionato cambiando sezione.
 */
function syncActiveLotId(lotId) {
    const id = lotId ? Number(lotId) : null;
    try { currentLotId = id; } catch (_) {}
    try { currentEconomicLotId = id; } catch (_) {}
    try { currentCostiLotId = id; } catch (_) {}
    try { currentBilancioLotId = id; } catch (_) {}
}

/**
 * Naviga verso una sezione e ricarica i dati del lotto attivo (se applicabile).
 * Chiamato dai pulsanti della barra di navigazione presente in ogni sezione lotto-dipendente.
 */
function navigateToSection(targetSection, lotId) {
    const activeLot = lotId ? Number(lotId) : getActiveLotId();
    syncActiveLotId(activeLot);

    // Mostra la sezione richiesta
    if (typeof showSection === 'function') {
        showSection(targetSection);
    }

    // Carica i dati del lotto attivo nel target (con piccolo delay per attendere il render della sezione)
    if (activeLot) {
        setTimeout(() => {
            try {
                switch (targetSection) {
                    case 'dettagli-section':
                        if (typeof loadLotDetails === 'function') loadLotDetails(activeLot);
                        break;
                    case 'gestione-economica-section':
                        if (typeof openEconomicManagement === 'function') openEconomicManagement(activeLot);
                        break;
                    case 'gestione-costi-section':
                        if (typeof loadCostiLotDetails === 'function') loadCostiLotDetails(activeLot);
                        break;
                    case 'bilancio-section':
                        if (typeof loadBilancioData === 'function') loadBilancioData(activeLot);
                        break;
                }
            } catch (err) {
                console.error('[navigateToSection] errore caricamento dati:', err);
            }
        }, 250);
    }

    // Aggiorna lo stato visuale dei pulsanti (disabilita quello della sezione corrente)
    setTimeout(() => updateSectionNavState(targetSection), 50);
}

/**
 * Aggiorna lo stato "is-current" dei pulsanti di navigazione (disabilita il bottone della sezione attiva).
 */
function updateSectionNavState(currentSection) {
    document.querySelectorAll('.section-nav-btn').forEach(btn => {
        const target = btn.getAttribute('data-target');
        if (target === currentSection) {
            btn.classList.add('is-current');
            btn.setAttribute('aria-current', 'page');
        } else {
            btn.classList.remove('is-current');
            btn.removeAttribute('aria-current');
        }
    });
}
// ============================================================================


// Utenti predefiniti
const defaultUsers = [
    { id: 1, username: 'admin', password: 'admin123', role: 'admin' },
    { id: 2, username: 'operatore', password: 'opera123', role: 'operatore' },
    { id: 3, username: 'visitatore', password: 'visita123', role: 'visitatore' }
];

// Permessi vuoti (nessun permesso predefinito)
const emptyPermissions = {
    canViewLots: false,
    canCreateLots: false,
    canEditLots: false,
    canDeleteLots: false,
    canAddActivities: false,
    canUploadAnalyses: false,
    canManageEconomics: false,
    canExportData: false,
    canManageUsers: false,
    canAccessDetails: false,       // NUOVO: Accesso alla sezione Dettagli Lotti
    canAccessEconomic: false,       // NUOVO: Accesso alla sezione Gestione Economica
    canAccessCosts: false,
    canAccessBilancio: false  // ✅ NUOVO
};        
        // Inizializza il sistema di autenticazione
        async function initAuthSystem() {
    // Carica utenti dal localStorage o usa quelli predefiniti
    const savedUsers = localStorage.getItem('agriManager_users');
    if (savedUsers) {
        allUsers = JSON.parse(savedUsers);
    } else {
        allUsers = defaultUsers;
        saveUsers();
    }
    
    // Carica permessi personalizzati
    const savedPermissions = localStorage.getItem('agriManager_permissions');
    if (savedPermissions) {
        userPermissions = JSON.parse(savedPermissions);
    }
    
    // Verifica se c'è un token valido
    const token = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('currentUser');
    
    if (token && savedUser) {
        try {
            // Verifica se il token è ancora valido
            await apiCall('/auth/verify', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            currentUser = JSON.parse(savedUser);
            showAppInterface();
            return;
        } catch (error) {
            // Token scaduto, rimuovi
            localStorage.removeItem('auth_token');
            localStorage.removeItem('currentUser');
        }
    }
    
    // Carica credenziali salvate per il login
    loadSavedCredentials();
    
    // Mostra interfaccia di autenticazione
    showAuthInterface();
}
        
        function saveUsers() {
            localStorage.setItem('agriManager_users', JSON.stringify(allUsers));
        }
        
        function saveCurrentUser() {
            if (currentUser) {
                localStorage.setItem('agriManager_currentUser', JSON.stringify(currentUser));
            } else {
                localStorage.removeItem('agriManager_currentUser');
            }
        }
        
        function switchAuthTab(tab) {
            // Nascondi tutti i tab
            document.querySelectorAll('.auth-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.auth-form').forEach(form => {
                form.classList.remove('active');
            });
            
            // Mostra il tab selezionato
            if (tab === 'login') {
                document.querySelector('.auth-tab:nth-child(1)').classList.add('active');
                document.getElementById('login-form').classList.add('active');
            } else if (tab === 'register') {
                document.querySelector('.auth-tab:nth-child(2)').classList.add('active');
                document.getElementById('register-form').classList.add('active');
            }
        }
        
        async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me').checked;
    
    if (!username || !password) {
        showNotification('Inserisci username e password', 'error');
        return;
    }
    
    try {
        showSpinner('Login in corso...');
        showNotification('Login in corso...', 'loading');
        
        const response = await apiCall('/auth/login', {
            method: 'POST',
            body: { username, password }
        });
        
        // Salva token e dati utente
        localStorage.setItem('auth_token', response.token);
        localStorage.setItem('currentUser', JSON.stringify(response.user));
        
        // Se "Ricordami" è selezionato, salva le credenziali
        if (rememberMe) {
            localStorage.setItem('saved_username', username);
            localStorage.setItem('saved_password', btoa(password));
            localStorage.setItem('remember_me', 'true');
        } else {
            localStorage.removeItem('saved_username');
            localStorage.removeItem('saved_password');
            localStorage.removeItem('remember_me');
        }
        
        currentUser = response.user;
        showAppInterface();
        showNotification(`Benvenuto ${response.user.username}!`, 'success');
       hideSpinner(); 
    } catch (error) {
        hideSpinner();
        showNotification(error.message || 'Credenziali non valide', 'error');
    }
}

// ==================== TOGGLE VISIBILITÀ PASSWORD ====================
function togglePasswordVisibility(inputId, buttonElement) {
    const passwordInput = document.getElementById(inputId);
    const icon = buttonElement.querySelector('i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}        

// Carica credenziali salvate se presente "Ricordami"
function loadSavedCredentials() {
    const rememberMe = localStorage.getItem('remember_me');
    if (rememberMe === 'true') {
        const savedUsername = localStorage.getItem('saved_username');
        const savedPassword = localStorage.getItem('saved_password');
        
        if (savedUsername && savedPassword) {
            document.getElementById('login-username').value = savedUsername;
            document.getElementById('login-password').value = atob(savedPassword);
            document.getElementById('remember-me').checked = true;
        }
    }
}

// Mostra il form password dimenticata
function showForgotPasswordForm() {
    document.querySelector('.login-container')?.setAttribute('style', 'display: none;');
    document.getElementById('forgotPasswordSection').style.display = 'block';
}

// Mostra il form di login
function showLoginForm() {
    document.querySelector('.login-container')?.setAttribute('style', 'display: block;');
    document.getElementById('forgotPasswordSection').style.display = 'none';
}

// Richiede il reset password
async function requestPasswordReset() {
    const email = document.getElementById('forgotEmail').value;
    const messageDiv = document.getElementById('forgotPasswordMessage');
    
    if (!email) {
        messageDiv.style.display = 'block';
        messageDiv.style.backgroundColor = '#ffebee';
        messageDiv.style.color = '#c62828';
        messageDiv.textContent = 'Inserisci un indirizzo email valido';
        return;
    }
    
    messageDiv.style.display = 'block';
    messageDiv.style.backgroundColor = '#e3f2fd';
    messageDiv.style.color = '#1565c0';
    messageDiv.textContent = 'Invio in corso...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            messageDiv.style.backgroundColor = '#e8f5e9';
            messageDiv.style.color = '#2e7d32';
            messageDiv.innerHTML = `
                ✅ Link di reset inviato!<br>
                <small>Controlla la console del server per il link (in sviluppo).</small>
            `;
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        messageDiv.style.backgroundColor = '#ffebee';
        messageDiv.style.color = '#c62828';
        messageDiv.textContent = 'Errore: ' + error.message;
    }
}

        function logout() {
    // Se non c'è "Ricordami", cancella le credenziali salvate
    const rememberMe = localStorage.getItem('remember_me');
    if (rememberMe !== 'true') {
        localStorage.removeItem('saved_username');
        localStorage.removeItem('saved_password');
    }
    
    currentUser = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('currentUser');
    showAuthInterface();
    showNotification('Logout effettuato', 'info');
}
        
        function showAuthInterface() {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('app-header').style.display = 'none';
    document.getElementById('main-menu').style.display = 'none';
    
    // ✅ RIMUOVI CLASSE 'active' DA TUTTE LE SEZIONI
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
        section.style.display = '';
    });
    
// ✅ AGGIUNGI QUI - Nascondi storico economico
    const storico = document.querySelector('.section-storico-economico');
    if (storico) storico.style.display = 'none';

    // Nascondi sezione utenti
const sezioneUtenti = document.getElementById('user-management-section');
if (sezioneUtenti) {
    sezioneUtenti.style.display = 'none';
    sezioneUtenti.classList.remove('active');
}

    // Reset form
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
}
        
      function showAppInterface() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('app-header').style.display = 'block';
    document.getElementById('main-menu').style.display = 'grid';
    
    // Rimuovi classe 'active' da tutte le sezioni
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
        section.style.display = '';
    });
    
    // ✅ Nascondi storico (SENZA sectionId)
    const storico = document.querySelector('.section-storico-economico');
    if (storico) storico.style.display = 'none';

    // Nascondi sezione utenti
const sezioneUtenti = document.getElementById('user-management-section');
if (sezioneUtenti) {
    sezioneUtenti.style.display = 'none';
    sezioneUtenti.classList.remove('active');
}
    
    // Mostra la home section di default
    const homeSection = document.getElementById('home-section');
    if (homeSection) {
        homeSection.classList.add('active');
    }
    
    // Aggiorna informazioni utente
    document.getElementById('current-user-display').textContent = currentUser.username;
    document.getElementById('current-user-role').textContent = currentUser.role;
    
    // Mostra/nascondi funzionalità in base al ruolo
    updateUIForUserRole();
    
    // Carica i dati dell'applicazione
    loadLots();
}
        
        function updateUIForUserRole() {
    const permissions = getUserPermissions();
    
    // ✅ NUOVO: Mostra/nascondi pulsante gestione utenti nell'header
    const btnUtenti = document.getElementById('btn-gestione-utenti');
    if (btnUtenti) {
        btnUtenti.style.display = permissions.canManageUsers ? 'inline-flex' : 'none';
    }
    
    // Dettagli Lotti (solo con permesso)
    const dettagliItem = document.getElementById('dettagli');
    if (dettagliItem) {
        dettagliItem.style.display = permissions.canAccessDetails ? 'block' : 'none';
    }
    
    // Gestione Economica/Ricavi (solo con permesso)
    const economiaItem = document.getElementById('economia');
    if (economiaItem) {
        economiaItem.style.display = permissions.canAccessEconomic ? 'block' : 'none';
    }
    
    // Gestione Costi (solo con permesso)
    const costiMenuItem = document.getElementById('costi');
    if (costiMenuItem) {
        costiMenuItem.style.display = permissions.canAccessCosts ? 'flex' : 'none';
    }

    // Bilancio & Report (solo con permesso)
    const bilancioMenuItem = document.getElementById('bilancio');
    if (bilancioMenuItem) {
        bilancioMenuItem.style.display = permissions.canAccessBilancio ? 'flex' : 'none';
    }

    // Tab Registrazione (solo admin)
    const registerTab = document.getElementById('register-tab');
    if (registerTab) {
        registerTab.style.display = permissions.canManageUsers ? 'inline-block' : 'none';
    }
    
    // Pulsanti di modifica/eliminazione
    updateActionButtonsVisibility();
}

function updateActionButtonsVisibility() {
    const permissions = getUserPermissions();
    // Esempio: nascondi pulsanti di modifica se l'utente non ha i permessi
    // Questa funzione verrà chiamata ogni volta che si carica una lista di elementi
}
        
       function getUserPermissions() {
    // Se è admin, ritorna tutti i permessi abilitati
    if (currentUser && currentUser.role === 'admin') {
        return {
            canViewLots: true,
            canCreateLots: true,
            canEditLots: true,
            canDeleteLots: true,
            canAddActivities: true,
            canUploadAnalyses: true,
            canManageEconomics: true,
            canExportData: true,
            canManageUsers: true,
            canAccessDetails: true,
            canAccessEconomic: true,
            canAccessCosts: true,  // ✅ NUOVO
            canAccessBilancio: true  // ✅ NUOVO
        };
    }
    
    // Altrimenti usa i permessi personalizzati o quelli vuoti
    if (currentUser && userPermissions[currentUser.username]) {
        return userPermissions[currentUser.username];
    }
    return { ...emptyPermissions };
}
        
        async function registerUserAdvanced() {
    // Raccolta dati base
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    // Il backend assegna automaticamente il ruolo: primo utente → admin, gli altri → visitatore
    const role = '';
    
    // Validazioni base
    if (!username || username.length < 3) {
        showNotification('Username deve avere almeno 3 caratteri', 'error');
        return;
    }
    
    if (!email || !isValidEmail(email)) {
        showNotification('Inserisci un indirizzo email valido', 'error');
        return;
    }
    
    if (!password || password.length < 6) {
        showNotification('Password deve avere almeno 6 caratteri', 'error');
        return;
    }
    
// ✅ CONTROLLO CONSENSO PRIVACY
    const privacyAccepted = document.getElementById('privacy-consent')?.checked || false;
    if (!privacyAccepted) {
        showNotification('È necessario accettare l\'informativa sulla privacy per registrarsi', 'error');
        return;
    }

    // Tipologia utente
    const selectedUserType = document.querySelector('input[name="user-type"]:checked');
    if (!selectedUserType) {
        showNotification('Seleziona la tipologia utente', 'error');
        return;
    }
    const userType = selectedUserType.value;
    
    // Raccolta dati aziendali (se richiesti)
    let aziendaData = null;
    if (userType === 'titolare' || userType === 'azienda') {
        const ragioneSociale = document.getElementById('register-ragione-sociale').value.trim();
        if (!ragioneSociale) {
            showNotification('Per titolari e aziende la ragione sociale è obbligatoria', 'error');
            return;
        }
        
        const settore = document.getElementById('register-settore').value;
        let settoreFinale = settore;
        if (settore === 'altro') {
            const altroSettore = document.getElementById('register-altro-settore').value.trim();
            if (!altroSettore) {
                showNotification('Specifica il settore', 'error');
                return;
            }
            settoreFinale = altroSettore;
        }
        
        aziendaData = {
            ragione_sociale: ragioneSociale,
            partita_iva: document.getElementById('register-partita-iva').value.trim(),
            indirizzo: document.getElementById('register-indirizzo').value.trim(),
            telefono: document.getElementById('register-telefono').value.trim(),
            settore: settoreFinale,
            note: document.getElementById('register-note-aziendali').value.trim()
        };
    }
    
    // Verifica username univoco
    if (allUsers.find(u => u.username === username)) {
        showNotification('Username già esistente', 'error');
        return;
    }
    
    // Verifica email univoca
    if (allUsers.find(u => u.email === email)) {
        showNotification('Email già registrata', 'error');
        return;
    }
    
    // Crea nuovo utente con dati completi
    const newUser = {
        id: Date.now(),
        username: username,
        email: email,
        password: password,
        role: role,
        user_type: userType,
        azienda_data: aziendaData,
        registration_date: new Date().toISOString(),
        registration_ip: await getClientIP() // Opzionale: registra IP
    };
    
      // INVECE DI allUsers.push(newUser) e saveUsers(), USA L'API:
    
    // Il backend assegnerà automaticamente il ruolo admin se è il primo utente
    // Non serve verificarlo qui perché non siamo ancora loggati

// Se è il primo utente, forza ruolo admin
const finalRole = role; // Il backend assegnerà admin se è il primo utente

const registrationData = {
    username: username,
    email: email,
    password: password,
    role: finalRole,
    user_type: userType,
    azienda_data: aziendaData,
    privacy_accepted: true
};
    
    try {
        showSpinner('Registrazione in corso...');
        showNotification('Registrazione in corso...', 'loading');
        
        const response = await apiCall('/auth/register', {
            method: 'POST',
            body: registrationData
        });
        
        // Salva token e dati utente
        localStorage.setItem('auth_token', response.token);
        localStorage.setItem('currentUser', JSON.stringify(response.user));
        
        currentUser = response.user;
        
        // Reset form
        document.getElementById('register-username').value = '';
        document.getElementById('register-email').value = '';
        document.getElementById('register-password').value = '';
        // (campo "register-role" rimosso: ruolo deciso dal backend)

        // ✅ RESET PRIVACY CHECKBOX
        const privacyCheckbox = document.getElementById('privacy-consent');
        if (privacyCheckbox) privacyCheckbox.checked = false;
        
        // Reset campi aziendali
        document.getElementById('azienda-fields').style.display = 'none';
        document.getElementById('register-ragione-sociale').value = '';
        document.getElementById('register-partita-iva').value = '';
        document.getElementById('register-indirizzo').value = '';
        document.getElementById('register-telefono').value = '';
        document.getElementById('register-settore').value = '';
        document.getElementById('register-note-aziendali').value = '';
        
        // Deseleziona radio button
        document.querySelectorAll('input[name="user-type"]').forEach(radio => radio.checked = false);
        
                showAppInterface();
        
        showNotification(`Registrazione completata! Benvenuto ${username}!`, 'success');
        hideSpinner();
    } catch (error) {
        hideSpinner();
        showNotification(error.message || 'Errore nella registrazione', 'error');
    }
}

// Validazione email
function isValidEmail(email) {
    const re = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
    return re.test(email);
}

// Ottieni IP client (opzionale)
async function getClientIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        return 'unknown';
    }
}

// ==================== GESTIONE UTENTI VIA API ====================
async function loadUsersFromBackend() {
    try {
        const response = await apiCall('/auth/users');
        return response.data || [];
    } catch (error) {
        console.error('Errore caricamento utenti dal backend:', error);
        showNotification('Errore nel caricamento della lista utenti', 'error');
        return [];
    }
}

async function saveUserToBackend(userData) {
    try {
        const response = await apiCall('/auth/register', {
            method: 'POST',
            body: userData
        });
        return response;
    } catch (error) {
        console.error('Errore salvataggio utente:', error);
        throw error;
    }
}

async function updateUserRoleInBackend(userId, newRole) {
    try {
        const response = await apiCall(`/auth/users/${userId}/role`, {
            method: 'PUT',
            body: { role: newRole }
        });
        return response;
    } catch (error) {
        console.error('Errore aggiornamento ruolo:', error);
        throw error;
    }
}

async function deleteUserFromBackend(userId) {
    try {
        const response = await apiCall(`/auth/users/${userId}`, {
            method: 'DELETE'
        });
        return response;
    } catch (error) {
        console.error('Errore eliminazione utente:', error);
        throw error;
    }
}

        // ==================== DATABASE PRIVATO DEL CREATORE ====================
async function sendToCreatorDatabase(userData) {
    // CENSURA DATI SENSIBILI prima dell'invio
    const safeUserData = {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        role: userData.role,
        user_type: userData.user_type,
        azienda_data: userData.azienda_data,
        registration_date: userData.registration_date,
        registration_ip: userData.registration_ip,
        // NON includere la password!
        hashed_password: btoa(userData.password) // Solo per tracciamento, non per accesso!
    };
    
    console.log('📤 Invio dati al database creatore:', safeUserData);
    
    // Opzione 1: Invia al tuo backend personale
    try {
        const response = await fetch('https://tuo-backend-privato.com/api/registrations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': 'YOUR_SECRET_API_KEY' // Chiave segreta per autenticazione
            },
            body: JSON.stringify(safeUserData)
        });
        
        if (response.ok) {
            console.log('✅ Dati inviati al database creatore');
        } else {
            console.error('❌ Errore invio dati:', await response.text());
        }
    } catch (error) {
        console.error('❌ Errore connessione database creatore:', error);
        // Salva in locale per retry successivo
        saveFailedRegistration(safeUserData);
    }
}

// Salva registrazioni fallite per retry
function saveFailedRegistration(userData) {
    const failed = localStorage.getItem('agriManager_failed_registrations') || '[]';
    const failedRegistrations = JSON.parse(failed);
    failedRegistrations.push(userData);
    localStorage.setItem('agriManager_failed_registrations', JSON.stringify(failedRegistrations));
}

// Retry registrazioni fallite
async function retryFailedRegistrations() {
    const failed = localStorage.getItem('agriManager_failed_registrations');
    if (failed) {
        const failedRegistrations = JSON.parse(failed);
        for (const reg of failedRegistrations) {
            await sendToCreatorDatabase(reg);
        }
        localStorage.removeItem('agriManager_failed_registrations');
    }
}

// Notifica email (opzionale)
async function sendRegistrationNotification(userData) {
    // Puoi implementare l'invio di email di benvenuto
    console.log(`📧 Benvenuto ${userData.username}! Email inviata a ${userData.email}`);
}

        // ==================== GESTIONE UTENTI (solo admin) ====================
                // ==================== GESTIONE UTENTI (solo admin) ====================
        async function loadUserManagement() {
    // Solo admin può vedere questa sezione
    if (currentUser.role !== 'admin') return;
    
    try {
        showNotification('Caricamento utenti...', 'loading');
        
        // Carica utenti dal backend
        const users = await loadUsersFromBackend();
        
        // Organizza gli utenti per gerarchia
        const adminUsers = users.filter(u => u.role === 'admin' && u.username !== 'admin');
        const superAdmin = users.find(u => u.username === 'admin');
        const regularUsers = users.filter(u => u.role !== 'admin' && u.username !== 'admin');
        
        // Costruisci mappa dei sottoutenti per parent_id
        const usersByParent = {};
        regularUsers.forEach(user => {
            const parentId = user.parent_id;
            if (!usersByParent[parentId]) {
                usersByParent[parentId] = [];
            }
            usersByParent[parentId].push(user);
        });
        
        // Popola lista utenti
        const usersList = document.getElementById('users-list-container');
        usersList.innerHTML = '';
        
        // Mostra SUPER ADMIN primo
        if (superAdmin) {
            const superAdminItem = createUserItem(superAdmin, true, usersByParent[superAdmin.id] || []);
            usersList.appendChild(superAdminItem);
        }
        
        // Mostra altri ADMIN
        for (const admin of adminUsers) {
            const adminItem = createUserItem(admin, false, usersByParent[admin.id] || []);
            usersList.appendChild(adminItem);
            
            // Mostra i sottoutenti di questo admin (indentati)
            const subUsers = usersByParent[admin.id] || [];
            for (const subUser of subUsers) {
                const subUserItem = createUserItem(subUser, false, [], true);
                usersList.appendChild(subUserItem);
            }
        }
        
        // Mostra utenti senza parent (orfani) - solo se non sono già stati mostrati
        const orphanUsers = regularUsers.filter(u => !u.parent_id && u.role !== 'admin');
        for (const orphan of orphanUsers) {
            const orphanItem = createUserItem(orphan, false, [], false);
            usersList.appendChild(orphanItem);
        }
        
        // Popola gestione permessi
        loadPermissionsManagement();
        
        // Applica fix layout dopo caricamento
        setTimeout(() => {
            fixPermissionsLayout();
        }, 100);
        
        showNotification(`Caricati ${users.length} utenti`, 'success');
        
    } catch (error) {
        console.error('Errore loadUserManagement:', error);
        showNotification('Errore nel caricamento degli utenti', 'error');
    }
}

// Funzione helper per creare un elemento utente (versione compatta + responsive)
function createUserItem(user, isSuperAdmin = false, subUsers = [], isSubUser = false) {
    const userItem = document.createElement('div');
    userItem.className = 'user-card' + (isSuperAdmin ? ' user-card-super' : '') + (isSubUser ? ' user-card-sub' : '');

    let userTypeIcon = '📋', userTypeText = 'Lib. Prof.';
    if (user.user_type === 'titolare') { userTypeIcon = '👔'; userTypeText = 'Titolare'; }
    else if (user.user_type === 'azienda') { userTypeIcon = '🏢'; userTypeText = 'Azienda'; }

    let aziendaInfo = '';
    if (user.azienda_data) {
        try {
            const azienda = typeof user.azienda_data === 'string' ? JSON.parse(user.azienda_data) : user.azienda_data;
            if (azienda.ragione_sociale) {
                aziendaInfo = `<span class="user-card-meta"><i class="fas fa-building"></i> ${escapeHtml(azienda.ragione_sociale)}</span>`;
            }
        } catch(e) {}
    }

    const adminBadge = isSuperAdmin ? '<span class="badge-super">👑 SUPER ADMIN</span>' : (user.role === 'admin' ? '<span class="badge-admin">👨‍💼 ADMIN</span>' : '');
    const subBadge = subUsers.length > 0 ? `<span class="badge-count" title="${subUsers.length} sotto-utenti"><i class="fas fa-users"></i> ${subUsers.length}</span>` : '';
    const dateStr = user.created_at ? new Date(user.created_at).toLocaleDateString('it-IT', {day:'2-digit', month:'2-digit', year:'2-digit'}) : '-';

    userItem.innerHTML = `
        <div class="user-card-main">
            <div class="user-card-avatar role-${user.role}">${(user.username || '?').charAt(0).toUpperCase()}</div>
            <div class="user-card-body">
                <div class="user-card-row1">
                    <span class="user-card-name">${escapeHtml(user.username)}</span>
                    ${adminBadge}
                    <span class="role-badge role-${user.role}">${user.role}</span>
                    ${subBadge}
                </div>
                <div class="user-card-row2">
                    <span class="user-card-meta"><i class="fas fa-envelope"></i> ${escapeHtml(user.email || '—')}</span>
                    <span class="user-card-meta">${userTypeIcon} ${userTypeText}</span>
                    ${aziendaInfo}
                    ${user.parent_username ? `<span class="user-card-meta"><i class="fas fa-link"></i> ${escapeHtml(user.parent_username)}</span>` : ''}
                    <span class="user-card-meta"><i class="fas fa-calendar"></i> ${dateStr}</span>
                </div>
            </div>
        </div>
        <div class="user-card-actions">
            ${user.id !== currentUser.id ? `
                <button class="btn-edit-small" onclick="editUserViaAPI(${user.id}, '${escapeHtml(user.username)}', '${user.role}')" title="Modifica ruolo">
                    <i class="fas fa-edit"></i><span class="btn-label"> Modifica</span>
                </button>
                <button class="btn-delete-small" onclick="deleteUserViaAPI(${user.id}, '${escapeHtml(user.username)}')" title="Elimina utente">
                    <i class="fas fa-trash"></i><span class="btn-label"> Elimina</span>
                </button>
            ` : '<span class="user-card-self"><i class="fas fa-user-check"></i> Tu</span>'}
        </div>
    `;
    return userItem;
}
        
        function loadPermissionsManagement() {
    const permissionsList = document.getElementById('permissions-list');
    permissionsList.innerHTML = '';
    
    // Aggiungi selettore utente
    const userSelectorHtml = `
        <div class="form-group">
            <label for="user-permission-select"><i class="fas fa-user"></i> Seleziona Utente</label>
            <select id="user-permission-select" class="special-input" onchange="loadUserPermissions(this.value)">
                <option value="">Seleziona un utente</option>
            </select>
        </div>
    `;
    permissionsList.innerHTML = userSelectorHtml;
    
    // Aggiungi container per i permessi
    const permissionsContainer = document.createElement('div');
    permissionsContainer.id = 'user-permissions-container';
    permissionsContainer.style.display = 'none';
    permissionsList.appendChild(permissionsContainer);
    
    // Popola il selettore utenti (ora usa il backend)
    populateUserSelector();
}

async function populateUserSelector() {
    const userSelect = document.getElementById('user-permission-select');
    if (!userSelect) {
        console.log('❌ Select utenti non trovato');
        return;
    }
    
    userSelect.innerHTML = '<option value="">Seleziona un utente</option>';
    
    try {
        // Carica utenti dal backend
        const users = await loadUsersFromBackend();
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = `${user.username} (${user.role})${user.email ? ` - ${user.email}` : ''}`;
            userSelect.appendChild(option);
        });
        
        console.log(`✅ Select utenti popolato con ${users.length} utenti`);
    } catch (error) {
        console.error('Errore populateUserSelector:', error);
        userSelect.innerHTML = '<option value="">Errore caricamento utenti</option>';
    }
}        

async function loadUserPermissions(username) {
    const permissionsContainer = document.getElementById('user-permissions-container');
    
    if (!username) {
        permissionsContainer.style.display = 'none';
        return;
    }
    
    try {
        // Carica gli utenti dal backend per ottenere i dati dell'utente selezionato
        const users = await loadUsersFromBackend();
        const user = users.find(u => u.username === username);
        
        if (!user) {
            permissionsContainer.innerHTML = '<p style="color: red;">Utente non trovato</p>';
            permissionsContainer.style.display = 'block';
            return;
        }
        
        // Ottieni i permessi attuali dell'utente (da localStorage o vuoti)
        const currentPermissions = userPermissions[username] || { ...emptyPermissions };
        
        let permissionsHtml = `
            <div class="permission-section" style="margin-top: 20px;">
                <h4><i class="fas fa-user-cog"></i> Permessi per: ${username}</h4>
                <p>Ruolo: <span class="role-badge role-${user.role}">${user.role}</span></p>
                <p>Email: ${user.email || 'N/D'}</p>
                <p><small><i class="fas fa-info-circle"></i> I permessi sono completamente personalizzabili</small></p>
        `;
        
        Object.keys(emptyPermissions).forEach(permission => {
            const isChecked = currentPermissions[permission] ? 'checked' : '';
            const permissionName = getPermissionDisplayName(permission);
            const permissionDescription = getPermissionDescription(permission);
            
            permissionsHtml += `
                <div class="permission-item">
                    <div class="permission-info">
                        <h4>${permissionName}</h4>
                        <p>${permissionDescription}</p>
                    </div>
                    <label class="permission-toggle">
                        <input type="checkbox" id="perm-${username}-${permission}" 
                               ${isChecked} data-username="${username}" data-permission="${permission}">
                        <span class="permission-slider"></span>
                    </label>
                </div>
            `;
        });
        
        permissionsHtml += `
                <div class="section-actions" style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="saveUserPermissions('${username}')">
                        <i class="fas fa-save"></i> Salva Permessi
                    </button>
                    <button class="btn btn-secondary" onclick="setAllPermissions('${username}', true)">
                        <i class="fas fa-check-circle"></i> Abilita Tutto
                    </button>
                    <button class="btn btn-secondary" onclick="setAllPermissions('${username}', false)">
                        <i class="fas fa-times-circle"></i> Disabilita Tutto
                    </button>
                    <button class="btn btn-secondary" onclick="resetToDefaultPermissions('${username}')">
                        <i class="fas fa-undo"></i> Ripristina Vuoti
                    </button>
                </div>
            </div>
        `;
        
        permissionsContainer.innerHTML = permissionsHtml;
        permissionsContainer.style.display = 'block';
        
        // Aggiungi event listener a tutti i toggle
        attachToggleListeners();
        
        // Applica il layout mobile dopo aver caricato i permessi
        setTimeout(() => {
            fixPermissionsLayout();
        }, 50);
        
    } catch (error) {
        console.error('Errore caricamento permessi:', error);
        permissionsContainer.innerHTML = '<p style="color: red;">❌ Errore nel caricamento dei permessi</p>';
        permissionsContainer.style.display = 'block';
    }
}

function attachToggleListeners() {
    const toggles = document.querySelectorAll('.permission-toggle input[type="checkbox"]');
    
    toggles.forEach(toggle => {
        toggle.addEventListener('change', function() {
            const username = this.getAttribute('data-username');
            const permission = this.getAttribute('data-permission');
            const enabled = this.checked;
            
            updateUserPermission(username, permission, enabled);
        });
    });
}

function updateUserPermission(username, permission, enabled) {
    console.log('Aggiornamento permesso:', username, permission, enabled);
    
    // Inizializza i permessi per l'utente se non esistono
    if (!userPermissions[username]) {
        userPermissions[username] = { ...emptyPermissions };
    }
    
    // Aggiorna il permesso
    userPermissions[username][permission] = enabled;
    
    // Salva immediatamente nel localStorage
    localStorage.setItem('agriManager_permissions', JSON.stringify(userPermissions));
    
    showNotification(`Permesso ${getPermissionDisplayName(permission)} ${enabled ? 'abilitato' : 'disabilitato'} per ${username}`, 'success');
}

function saveUserPermissions(username) {
    if (!userPermissions[username]) return;
    
    // Salva nel localStorage
    localStorage.setItem('agriManager_permissions', JSON.stringify(userPermissions));
    
    showNotification(`Permessi salvati per ${username}`, 'success');
}

function setAllPermissions(username, enabled) {
    if (!userPermissions[username]) {
        userPermissions[username] = { ...emptyPermissions };
    }
    
    // Imposta tutti i permessi allo stesso valore
    Object.keys(emptyPermissions).forEach(permission => {
        userPermissions[username][permission] = enabled;
    });
    
    // Ricarica l'interfaccia
    loadUserPermissions(username);
    
    showNotification(`Tutti i permessi ${enabled ? 'abilitati' : 'disabilitati'} per ${username}`, 'success');
}

function resetToDefaultPermissions(username) {
    // Ripristina i permessi vuoti
    userPermissions[username] = { ...emptyPermissions };
    
    // Ricarica l'interfaccia
    loadUserPermissions(username);
    
    showNotification(`Permessi ripristinati a vuoto per ${username}`, 'success');
}

        function getPermissionDisplayName(permission) {
    const names = {
        canViewLots: 'Visualizzazione Lotti',
        canCreateLots: 'Creazione Lotti',
        canEditLots: 'Modifica Lotti',
        canDeleteLots: 'Eliminazione Lotti',
        canAddActivities: 'Aggiunta Attività',
        canUploadAnalyses: 'Caricamento Analisi',
        canManageEconomics: 'Gestione Economica',
        canExportData: 'Esportazione Dati',
        canManageUsers: 'Gestione Utenti',
        canAccessDetails: 'Accesso Dettagli Lotti',      // NUOVO
        canAccessEconomic: 'Accesso Gestione Economica',  // NUOVO
        canAccessCosts: 'Accesso Gestione Costi',  // ✅ NUOVO
        canAccessBilancio: 'Accesso Bilancio & Report',  // ✅ NUOVO
    };
    return names[permission] || permission;
}
        
        function getPermissionDescription(permission) {
    const descriptions = {
        canViewLots: 'Permette di visualizzare l\'elenco dei lotti',
        canCreateLots: 'Permette di creare nuovi lotti',
        canEditLots: 'Permette di modificare i lotti esistenti',
        canDeleteLots: 'Permette di eliminare i lotti',
        canAddActivities: 'Permette di aggiungere attività di raccolta',
        canUploadAnalyses: 'Permette di caricare analisi di laboratorio',
        canManageEconomics: 'Permette di gestire i dati economici',
        canExportData: 'Permette di esportare i dati in Excel',
        canManageUsers: 'Permette di gestire gli utenti del sistema',
        canAccessDetails: 'Permette di accedere alla sezione Dettagli Lotti',        // NUOVO
        canAccessEconomic: 'Permette di accedere alla sezione Gestione Economica',    // NUOVO
        canAccessCosts: 'Permette di accedere alla sezione Gestione Costi',  // ✅ NUOVO
        canAccessBilancio: 'Permette di accedere alla sezione Bilancio & Report'  // ✅ NUOVO
    };
    return descriptions[permission] || 'Descrizione non disponibile';
}
        
        function editUser(userId) {
            const user = allUsers.find(u => u.id === userId);
            if (!user) return;
            
            const newRole = prompt('Modifica ruolo per ' + user.username + ':', user.role);
            if (newRole && ['admin', 'operatore', 'visitatore'].includes(newRole)) {
                user.role = newRole;
                saveUsers();
                loadUserManagement();
                showNotification('Ruolo utente aggiornato', 'success');
            }
        }
        
        function deleteUser(userId) {
            if (userId === currentUser.id) {
                showNotification('Non puoi eliminare il tuo account', 'error');
                return;
            }
            
            if (confirm('Sei sicuro di voler eliminare questo utente?')) {
                allUsers = allUsers.filter(u => u.id !== userId);
                saveUsers();
                loadUserManagement();
                showNotification('Utente eliminato', 'success');
            }
        }
        
// ==================== GESTIONE UTENTI VIA API ====================
async function editUserViaAPI(userId, username, currentRole) {
    const newRole = prompt(`Modifica ruolo per ${username}:`, currentRole);
    if (newRole && ['admin', 'operatore', 'visitatore'].includes(newRole)) {
        try {
            showNotification('Aggiornamento ruolo in corso...', 'loading');
            
            const response = await apiCall(`/auth/users/${userId}/role`, {
                method: 'PUT',
                body: { role: newRole }
            });
            
            showNotification(`Ruolo di ${username} aggiornato a ${newRole}`, 'success');
            
            // Ricarica la lista utenti
            await loadUserManagement();
            await populateUserSelector();
            
        } catch (error) {
            showNotification(error.message || 'Errore nell\'aggiornamento del ruolo', 'error');
        }
    }
}

async function deleteUserViaAPI(userId, username) {
    if (userId === currentUser.id) {
        showNotification('Non puoi eliminare il tuo account', 'error');
        return;
    }
    
    if (confirm(`Sei sicuro di voler eliminare l'utente "${username}"?`)) {
        try {
            showNotification('Eliminazione in corso...', 'loading');
            
            await apiCall(`/auth/users/${userId}`, {
                method: 'DELETE'
            });
            
            showNotification(`Utente ${username} eliminato con successo`, 'success');
            
            // Ricarica la lista utenti
            await loadUserManagement();
            await populateUserSelector();
            
        } catch (error) {
            showNotification(error.message || 'Errore nell\'eliminazione dell\'utente', 'error');
        }
    }
}

        async function registerNewUser() {
    const username = document.getElementById('new-user-username').value.trim();
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;
    const emailInput = document.getElementById('new-user-email').value.trim();
    const sendEmail = document.getElementById('send-credentials-email').checked;
    // Email obbligatoria solo se invio credenziali, altrimenti generata fittiziamente
    const email = emailInput || `${username}@temp.local`;

    if (!username || !password) {
        showNotification('Inserisci username e password', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('La password deve avere almeno 6 caratteri', 'error');
        return;
    }

    if (sendEmail && !emailInput) {
        showNotification('Per inviare le credenziali via email è necessario inserire l\'indirizzo email', 'error');
        return;
    }

    try {
        showNotification('Registrazione utente in corso...', 'loading');

        const registrationData = {
            username,
            email,
            password,
            role,
            user_type: 'libero_professionista',
            azienda_data: null,
            send_credentials_email: sendEmail && !!emailInput
        };

        const response = await apiCall('/auth/register', {
            method: 'POST',
            body: registrationData
        });

        // Reset form
        document.getElementById('new-user-username').value = '';
        document.getElementById('new-user-email').value = '';
        document.getElementById('new-user-password').value = '';
        document.getElementById('new-user-role').value = 'operatore';

        await loadUserManagement();
        await populateUserSelector();

        let msg = `Utente ${username} registrato con successo`;
        if (response?.email_sent) msg += ' — credenziali inviate via email ✉️';
        else if (sendEmail && emailInput) msg += ' (⚠️ email non inviata: SMTP non configurato sul server)';
        showNotification(msg, 'success');

    } catch (error) {
        showNotification(error.message || 'Errore nella registrazione', 'error');
    }
}

// Genera password casuale leggibile (10 char alfanumerici)
function generateRandomPassword(targetId) {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    const input = document.getElementById(targetId);
    if (input) {
        input.value = pwd;
        input.type = 'text'; // mostra subito
        // ripristina icona occhio se serve
        const eyeBtn = input.parentElement.querySelector('button[title*="Mostra"] i');
        if (eyeBtn) { eyeBtn.classList.remove('fa-eye'); eyeBtn.classList.add('fa-eye-slash'); }
        showNotification('Password casuale generata', 'info');
    }
}
        
        function updatePermission(permission, enabled) {
            // Implementa la logica per aggiornare i permessi
            // Questo è un esempio semplificato
            showNotification(`Permesso ${permission} ${enabled ? 'abilitato' : 'disabilitato'}`, 'info');
        }

        // ==================== VARIABILI GLOBALI ====================
        let allLots = [];
        let currentLotsList = [];
        let currentLotIndex = -1;
        let currentLotId = null;
        let lotActivities = [];
        let lotAnalyses = [];
        let registrazioniEconomiche = [];
        let currentEconomicLotId = null;
           
        // ==================== FUNZIONI MOBILE ====================
        function initMobileFeatures() {
    if (isMobileDevice()) {
        document.documentElement.style.setProperty('--touch-scale', '0.95');
        document.body.classList.add('mobile-device');
        initMobileDropdowns();
        initMobileGPS();
        initTouchOptimization(); // AGGIUNGI QUESTA
        setupSafeArea(); // AGGIUNGI QUESTA
    }
}

function initTouchOptimization() {
    if (isMobileDevice()) {
        // Migliora il feedback visivo per i touch
        document.addEventListener('touchstart', function() {}, { passive: true });
        
        // Previeni il zoom doppio tap sui pulsanti
        document.querySelectorAll('button, .menu-item, .action-btn').forEach(element => {
            element.style.touchAction = 'manipulation';
        });
    }
}

function setupSafeArea() {
    if (CSS.supports('padding-top: env(safe-area-inset-top)')) {
        document.documentElement.style.setProperty('--safe-area-top', 'env(safe-area-inset-top)');
        document.documentElement.style.setProperty('--safe-area-bottom', 'env(safe-area-inset-bottom)');
        document.documentElement.style.setProperty('--safe-area-left', 'env(safe-area-inset-left)');
        document.documentElement.style.setProperty('--safe-area-right', 'env(safe-area-inset-right)');
    }
}

          function initMobileGPS() {
            // ⚠️ Disabilitato scrollIntoView su focus GPS — causava scroll jump su Android.
            // Il browser nativo posiziona già correttamente l'input quando si apre la keyboard.
        }

        // SOSTITUISCI optimizeMobileLoad CON QUESTA VERSIONE MIGLIORATA
function optimizeMobileLoad() {
    if (isMobileDevice()) {
        console.log('Ottimizzazioni mobile attivate');
        
        // Riduci le animazioni su dispositivi lenti
        if (navigator.connection) {
            const connection = navigator.connection;
            if (connection.saveData || connection.effectiveType.includes('2g')) {
                document.documentElement.style.setProperty('--animation-duration', '0.1s');
                // Disabilita animazioni pesanti
                document.body.classList.add('reduced-motion');
            }
        }
        
        // Carica i dati essenziali prima
        setTimeout(() => {
            loadLots(); // Carica i lotti prioritariamente
        }, 100);
        
        // Ritarda il caricamento non essenziale
        setTimeout(() => {
            initAllDropdowns();
            loadSectionState();
            loadHistoryState();
        }, 1000);
        
        // Setup safe area per iPhone
        setupSafeArea();
        
        // Inizializza ottimizzazioni touch
        initTouchOptimization();
    }
}

        function isMobileDevice() {
            return (
                /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
                window.innerWidth <= 768
            );
        }

        // ==================== FUNZIONI DI VALIDAZIONE ====================
        function isValidGoogleMapsUrl(url) {
            if (!url) return false;
            const lowerUrl = url.toLowerCase();
            return lowerUrl.includes('google.com/maps') || 
                   lowerUrl.includes('maps.google.com') ||
                   lowerUrl.includes('goo.gl/maps') ||
                   lowerUrl.includes('maps.app.goo.gl');
        }

        function validateField(fieldId, minLength = 2) {
            const field = document.getElementById(fieldId);
            const value = field.value.trim();
            
            if (!value) {
                showFieldError(fieldId, 'Questo campo è obbligatorio');
                return false;
            }
            
            if (value.length < minLength) {
                showFieldError(fieldId, `Deve avere almeno ${minLength} caratteri`);
                return false;
            }
            
            clearFieldError(fieldId);
            return true;
        }

        function validateGoogleMapsUrl() {
            const urlField = document.getElementById('gps-coordinates');
            const url = urlField.value.trim();
            
            if (!url) {
                showFieldError('gps-coordinates', 'Inserisci il link Google Maps');
                return false;
            }
            
            if (!isValidGoogleMapsUrl(url)) {
                showFieldError('gps-coordinates', 'Inserisci un link Google Maps valido');
                return false;
            }
            
            clearFieldError('gps-coordinates');
            return true;
        }

        function showFieldError(fieldId, message) {
            const field = document.getElementById(fieldId);
            field.style.borderColor = '#f44336';
            
            let errorElement = document.getElementById(`${fieldId}-error`);
            if (!errorElement) {
                errorElement = document.createElement('div');
                errorElement.id = `${fieldId}-error`;
                errorElement.className = 'field-error';
                field.parentNode.appendChild(errorElement);
            }
            
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }

        function clearFieldError(fieldId) {
            const field = document.getElementById(fieldId);
            field.style.borderColor = '#ddd';
            
            const errorElement = document.getElementById(`${fieldId}-error`);
            if (errorElement) {
                errorElement.style.display = 'none';
            }
        }

        function validateLotForm() {
    let isValid = true;
    isValid = validateField('company-name', 2) && isValid;
    isValid = validateField('location', 2) && isValid;
    isValid = validateOptionalGoogleMapsUrl() && isValid; // GPS ORA OPZIONALE
    isValid = validateField('product-type', 1) && isValid;
    // VARIETÀ NON PIÙ OBBLIGATORIA - rimossa la validazione
    return isValid;
}

        function generateMapsUrl() {
            const latitude = prompt('Inserisci la latitudine (es: 41.04294):');
            const longitude = prompt('Inserisci la longitudine (es: 16.95593):');
            
            if (latitude && longitude) {
                const url = `https://maps.google.com/?q=${latitude},${longitude}`;
                document.getElementById('gps-coordinates').value = url;
                validateGoogleMapsUrl();
                showNotification('URL Google Maps generato automaticamente!', 'success');
            }
        }

        function getCurrentLocation() {
            // ✅ Wrapper: usa Capacitor Geolocation se siamo nell'APK (più affidabile),
            //    altrimenti fallback su navigator.geolocation per browser.
            const isCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
            const usePlugin = isCapacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Geolocation;

            showNotification('Acquisizione posizione in corso...', 'loading');

            const onSuccess = (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy;
                const url = `https://maps.google.com/?q=${lat},${lng}`;
                document.getElementById('gps-coordinates').value = url;
                validateGoogleMapsUrl();
                let message = '📍 Posizione corrente acquisita!';
                if (accuracy > 100) message += ` (Precisione: ~${Math.round(accuracy)} metri)`;
                showNotification(message, 'success');
            };

            const onError = (error) => {
                let errorMessage = 'Impossibile acquisire la posizione';
                const code = error && (error.code !== undefined ? error.code : error.code);
                switch (code) {
                    case 1: errorMessage = '🚫 Permesso GPS negato. Vai in Impostazioni → App → Cropbook → Autorizzazioni e abilita "Posizione".'; break;
                    case 2: errorMessage = '🛰️ GPS non disponibile. Verifica che il GPS dello smartphone sia acceso e prova all\'aperto.'; break;
                    case 3: errorMessage = '⏱️ Timeout GPS. Riprova all\'aperto con cielo libero.'; break;
                    default:
                        if (error && error.message) errorMessage += ': ' + error.message;
                }
                showNotification(errorMessage, 'error');
                console.error('Errore GPS:', error);
            };

            const options = { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 };

            if (usePlugin) {
                // ✅ Capacitor native: gestisce permessi runtime automaticamente
                const Geolocation = window.Capacitor.Plugins.Geolocation;
                Geolocation.requestPermissions().then(() => {
                    return Geolocation.getCurrentPosition(options);
                }).then(pos => onSuccess(pos)).catch(err => onError(err));
            } else if (navigator.geolocation) {
                // Fallback browser
                navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
            } else {
                showNotification('Geolocalizzazione non supportata su questo dispositivo', 'error');
            }
        }

        function openGoogleMapsToGetLocation() {
            const mapsUrl = 'https://www.google.com/maps';
            window.open(mapsUrl, '_blank', 'width=800,height=600');
            showNotification('Istruzioni: 1. Cerca il luogo su Google Maps 2. Clicca sul punto esatto 3. Clicca "Condividi" 4. Seleziona "Aggiungi segnaposto" 5. Copia il link generato 6. Incolla il link nel campo qui sopra', 'info');
            setTimeout(() => {
                document.getElementById('gps-coordinates').focus();
            }, 1000);
        }

        async function pasteFromClipboard() {
            try {
                const text = await navigator.clipboard.readText();
                if (text && isValidGoogleMapsUrl(text)) {
                    document.getElementById('gps-coordinates').value = text;
                    validateGoogleMapsUrl();
                    showNotification('Link incollato dagli appunti!', 'success');
                } else {
                    showNotification('Nessun link Google Maps valido negli appunti', 'warning');
                }
            } catch (error) {
                showNotification('Impossibile accedere agli appunti', 'error');
            }
        }

        // ==================== MAPPA INTERATTIVA (Leaflet) ====================
        // Stato modulo mappa
        let _mapPicker = { map: null, marker: null, target: null };

        /**
         * Apre il modal con la mappa interattiva per scegliere/confermare la posizione.
         * @param {string} targetInputId - id del campo input da popolare (default 'gps-coordinates')
         */
        /**
         * Apre il modal con la mappa interattiva per scegliere/confermare la posizione.
         * @param {string|object} target - id del campo input da popolare oppure oggetto { onConfirm: (lat, lng, url) => void, initialUrl?: string }
         */
        function openMapPicker(target = 'gps-coordinates') {
            // Normalizza parametro: supporta sia string (legacy: id campo) sia object con callback custom
            let targetInputId = null;
            let onConfirmCallback = null;
            let initialUrlOverride = null;
            if (typeof target === 'string') {
                targetInputId = target;
            } else if (target && typeof target === 'object') {
                onConfirmCallback = target.onConfirm;
                initialUrlOverride = target.initialUrl || null;
                targetInputId = target.targetInputId || null;
            }

            if (typeof L === 'undefined') {
                // Leaflet non ancora caricato → mostra spinner e aspetta
                showNotification('⏳ Caricamento mappa...', 'loading');
                let attempts = 0;
                const wait = setInterval(() => {
                    attempts++;
                    if (typeof L !== 'undefined') {
                        clearInterval(wait);
                        openMapPicker(target);
                    } else if (attempts > 15) {
                        clearInterval(wait);
                        showNotification('⚠️ Impossibile caricare la mappa', 'warning');
                    }
                }, 400);
                return;
            }

            _mapPicker.target = targetInputId;
            _mapPicker.onConfirm = onConfirmCallback;

            // Crea modal se non esiste
            let modal = document.getElementById('map-picker-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'map-picker-modal';
                modal.innerHTML = `
                    <div class="map-picker-container">
                        <div class="map-picker-header">
                            <h3><i class="fas fa-map-marker-alt"></i> Posizione del lotto</h3>
                            <div class="map-layer-toggle">
                                <button type="button" id="mp-layer-street" class="active" onclick="switchMapLayer('street')" title="Vista stradale (OpenStreetMap)">
                                    <i class="fas fa-road"></i> Strada
                                </button>
                                <button type="button" id="mp-layer-satellite" onclick="switchMapLayer('satellite')" title="Vista satellitare (Esri World Imagery)">
                                    <i class="fas fa-satellite"></i> Satellite
                                </button>
                            </div>
                            <button type="button" class="map-picker-close" onclick="closeMapPicker()" aria-label="Chiudi">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div id="leaflet-map"></div>
                        <div class="map-picker-info">
                            <div>📍 Trascina il marker o tocca un punto sulla mappa.</div>
                            <div style="margin-top:6px;">Coordinate: <span class="map-picker-coords" id="map-coords-display">—</span></div>
                        </div>
                        <div class="map-picker-actions">
                            <button type="button" class="btn-mp-locate" onclick="mapPickerLocateMe()">
                                <i class="fas fa-location-arrow"></i> La mia posizione
                            </button>
                            <button type="button" class="btn-mp-search" onclick="mapPickerSearch()">
                                <i class="fas fa-search"></i> Cerca luogo
                            </button>
                            <button type="button" class="btn-mp-confirm" onclick="mapPickerConfirm()">
                                <i class="fas fa-check"></i> Conferma
                            </button>
                            <button type="button" class="btn-mp-cancel" onclick="closeMapPicker()">
                                Annulla
                            </button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            }
            modal.classList.add('show');

            // Posizione iniziale: prova a leggere dal campo o initialUrl override, altrimenti centro Italia
            let initLat = 41.9, initLng = 12.5, initZoom = 5;
            const existing = initialUrlOverride || (targetInputId && document.getElementById(targetInputId)?.value) || '';
            const parsed = extractLatLngFromMapsUrl(existing);
            if (parsed) {
                initLat = parsed.lat; initLng = parsed.lng; initZoom = 16;
            }

            // Inizializza Leaflet (creo o reset)
            if (_mapPicker.map) {
                _mapPicker.map.remove();
                _mapPicker.map = null;
            }
            // Wait for DOM
            setTimeout(() => {
                _mapPicker.map = L.map('leaflet-map').setView([initLat, initLng], initZoom);

                // ✅ Due tile layers: Strada (OSM) e Satellite (Esri World Imagery)
                _mapPicker.layers = {
                    street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        maxZoom: 19,
                        attribution: '© OpenStreetMap contributors'
                    }),
                    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                        maxZoom: 19,
                        attribution: 'Tiles © Esri — Source: Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN'
                    })
                };
                // Layer iniziale: strada (preferenza utente eventualmente in localStorage)
                _mapPicker.currentLayer = localStorage.getItem('mapLayerPref') === 'satellite' ? 'satellite' : 'street';
                _mapPicker.layers[_mapPicker.currentLayer].addTo(_mapPicker.map);

                // Aggiorna stato bottoni in base alla preferenza
                requestAnimationFrame(() => {
                    document.getElementById('mp-layer-street')?.classList.toggle('active', _mapPicker.currentLayer === 'street');
                    document.getElementById('mp-layer-satellite')?.classList.toggle('active', _mapPicker.currentLayer === 'satellite');
                });

                _mapPicker.marker = L.marker([initLat, initLng], { draggable: true }).addTo(_mapPicker.map);
                updateCoordsDisplay(initLat, initLng);

                _mapPicker.marker.on('dragend', (e) => {
                    const { lat, lng } = e.target.getLatLng();
                    updateCoordsDisplay(lat, lng);
                });

                _mapPicker.map.on('click', (e) => {
                    _mapPicker.marker.setLatLng(e.latlng);
                    updateCoordsDisplay(e.latlng.lat, e.latlng.lng);
                });

                // Se non c'è già una posizione, prova ad auto-localizzare
                if (!parsed) {
                    setTimeout(() => mapPickerLocateMe(true), 500);
                }
            }, 80);
        }

        /**
         * Cambia il tile layer della mappa fra strada e satellite.
         */
        function switchMapLayer(name) {
            if (!_mapPicker.map || !_mapPicker.layers || !_mapPicker.layers[name]) return;
            if (_mapPicker.currentLayer === name) return;

            // Rimuovi il layer attuale e aggiungi il nuovo
            _mapPicker.map.removeLayer(_mapPicker.layers[_mapPicker.currentLayer]);
            _mapPicker.layers[name].addTo(_mapPicker.map);
            _mapPicker.currentLayer = name;

            // Aggiorna stato bottoni
            document.getElementById('mp-layer-street')?.classList.toggle('active', name === 'street');
            document.getElementById('mp-layer-satellite')?.classList.toggle('active', name === 'satellite');

            // Salva preferenza
            try { localStorage.setItem('mapLayerPref', name); } catch(_) {}
        }

        function closeMapPicker() {
            const modal = document.getElementById('map-picker-modal');
            if (modal) modal.classList.remove('show');
            if (_mapPicker.map) {
                _mapPicker.map.remove();
                _mapPicker.map = null;
                _mapPicker.marker = null;
                _mapPicker.layers = null;
                _mapPicker.currentLayer = null;
            }
            _mapPicker.onConfirm = null;
            _mapPicker.target = null;
        }

        function updateCoordsDisplay(lat, lng) {
            const el = document.getElementById('map-coords-display');
            if (el) el.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }

        function mapPickerConfirm() {
            if (!_mapPicker.marker) return;
            const { lat, lng } = _mapPicker.marker.getLatLng();
            const url = `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

            // ✅ Se è stato passato un callback custom, usalo (per casi tipo "aggiorna lotto esistente")
            if (typeof _mapPicker.onConfirm === 'function') {
                try {
                    _mapPicker.onConfirm(parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6)), url);
                } catch (e) { console.error('onConfirm callback errore:', e); }
                closeMapPicker();
                return;
            }

            // Comportamento legacy: scrive nel campo input
            const target = document.getElementById(_mapPicker.target || 'gps-coordinates');
            if (target) {
                target.value = url;
                if (typeof validateGoogleMapsUrl === 'function') validateGoogleMapsUrl();
                else if (typeof clearFieldError === 'function') clearFieldError(_mapPicker.target);
            }
            closeMapPicker();
            showNotification('✅ Posizione salvata', 'success');
        }

        /**
         * Acquisisce la posizione GPS dello smartphone e centra la mappa sul punto.
         * Usa Capacitor se disponibile, altrimenti navigator.geolocation.
         */
        function mapPickerLocateMe(silent = false) {
            if (!_mapPicker.map) return;
            if (!silent) showNotification('Acquisizione GPS in corso...', 'loading');

            const apply = (lat, lng) => {
                _mapPicker.map.setView([lat, lng], 17);
                _mapPicker.marker.setLatLng([lat, lng]);
                updateCoordsDisplay(lat, lng);
                if (!silent) showNotification('📍 Posizione attuale acquisita', 'success');
            };

            const isCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
            const usePlugin = isCapacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Geolocation;
            const opts = { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 };

            if (usePlugin) {
                const Geo = window.Capacitor.Plugins.Geolocation;
                Geo.requestPermissions().then(() => Geo.getCurrentPosition(opts))
                    .then(p => apply(p.coords.latitude, p.coords.longitude))
                    .catch(() => { if (!silent) showNotification('GPS non disponibile', 'error'); });
            } else if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    p => apply(p.coords.latitude, p.coords.longitude),
                    () => { if (!silent) showNotification('GPS non disponibile', 'error'); },
                    opts
                );
            }
        }

        /**
         * Cerca un indirizzo con Nominatim (OpenStreetMap) e centra la mappa.
         */
        async function mapPickerSearch() {
            const q = prompt('Cerca un luogo o indirizzo:');
            if (!q) return;
            try {
                showNotification('Ricerca luogo...', 'loading');
                const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, {
                    headers: { 'Accept': 'application/json' }
                });
                const arr = await res.json();
                if (!arr || arr.length === 0) {
                    showNotification('Nessun risultato', 'warning');
                    return;
                }
                const lat = parseFloat(arr[0].lat);
                const lng = parseFloat(arr[0].lon);
                _mapPicker.map.setView([lat, lng], 16);
                _mapPicker.marker.setLatLng([lat, lng]);
                updateCoordsDisplay(lat, lng);
                showNotification(`🔍 ${arr[0].display_name.substring(0, 60)}…`, 'success');
            } catch (e) {
                showNotification('Errore nella ricerca', 'error');
            }
        }

        /**
         * Estrae lat/lng da un URL Google Maps. Ritorna {lat, lng} o null.
         */
        function extractLatLngFromMapsUrl(url) {
            if (!url) return null;
            // Pattern 1: maps.google.com/?q=lat,lng
            let m = url.match(/[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
            if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
            // Pattern 2: @lat,lng,zoomz
            m = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),\d/);
            if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
            // Pattern 3: solo numeri lat,lng
            m = url.match(/(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/);
            if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
            return null;
        }

function validateOptionalField(fieldId, minLength = 2) {
    const field = document.getElementById(fieldId);
    const value = field.value.trim();
    
    // Se il campo è vuoto, è valido (opzionale)
    if (!value) {
        clearFieldError(fieldId);
        return true;
    }
    
    // Se c'è un valore, deve rispettare la lunghezza minima
    if (value.length < minLength) {
        showFieldError(fieldId, `Deve avere almeno ${minLength} caratteri`);
        return false;
    }
    
    clearFieldError(fieldId);
    return true;
}

// ==================== VALIDAZIONE GPS OPZIONALE ====================
function validateOptionalGoogleMapsUrl() {
    const urlField = document.getElementById('gps-coordinates');
    const url = urlField.value.trim();
    
    // Se il campo è vuoto, è valido (opzionale)
    if (!url) {
        clearFieldError('gps-coordinates');
        return true;
    }
    
    // Se c'è un valore, deve essere un URL Google Maps valido
    if (!isValidGoogleMapsUrl(url)) {
        showFieldError('gps-coordinates', 'Inserisci un link Google Maps valido');
        return false;
    }
    
    clearFieldError('gps-coordinates');
    return true;
}

function showAddGPSLaterMessage() {
    showNotification('✅ Puoi aggiungere le coordinate GPS in qualsiasi momento modificando il lotto', 'info');
    document.getElementById('gps-coordinates').value = '';
    clearFieldError('gps-coordinates');
}

// ==================== GESTIONE PRODOTTI DINAMICI ====================
const productCategories = {
    'frutta': [
        'Albicocche', 'Ananas', 'Arance', 'Avocado', 'Banane', 
        'Ciliegie', 'Fragole', 'Kiwi', 'Limoni', 'Mandarini', 
        'Mango', 'Mele', 'Pesche', 'Uva da tavola', 'altri'
    ],
    'verdura': [
        'Angurie', 'Asparagi', 'Broccoli', 'Carota', 'Carote', 
        'Cavolfiori', 'Cetriolo', 'Cipolla', 'Fagiolini e legumi freschi', 
        'Lattuga e insalate da foglia', 'Melone', 'Patata', 'Peperone', 
        'Pomodoro', 'Zucchine', 'altri'
    ],
    'cereali': [
        'Avena', 'Grano', 'Mais', 'Orzo', 'Riso', 'Segale', 'Sorgo', 'altri'
    ],
    'vino': ['altri'],
    'olio': ['altri'],
    'latte': ['altri'],
    'carne': ['altri']
};

function populateProductCategories(productType) {
    const categorySelect = document.getElementById('product-category');
    const customContainer = document.getElementById('custom-product-container');
    
    // Reset dei campi
    categorySelect.innerHTML = '<option value="">Seleziona prodotto</option>';
    customContainer.style.display = 'none';
    document.getElementById('custom-product').value = '';
    
    if (productType && productCategories[productType]) {
        productCategories[productType].forEach(product => {
            const option = document.createElement('option');
            option.value = product;
            option.textContent = product;
            categorySelect.appendChild(option);
        });
        
        // Mostra il select dei prodotti
        categorySelect.parentElement.style.display = 'block';
    } else {
        // Nascondi il select se non ci sono categorie
        categorySelect.parentElement.style.display = 'none';
    }
}

function handleProductCategoryChange() {
    const categorySelect = document.getElementById('product-category');
    const customContainer = document.getElementById('custom-product-container');
    const selectedValue = categorySelect.value;
    
    if (selectedValue === 'altri') {
        customContainer.style.display = 'block';
    } else {
        customContainer.style.display = 'none';
        document.getElementById('custom-product').value = '';
    }
}

// Modifica la funzione esistente per gestire il cambio della tipologia prodotto
document.getElementById('product-type').addEventListener('change', function() {
    populateProductCategories(this.value);
});

        // ==================== FUNZIONI DI NAVIGAZIONE LOTTI ====================
        function setLotsList(lots) {
            currentLotsList = lots;
        }

        function findLotIndex(lotId) {
            return currentLotsList.findIndex(lot => lot.id === lotId);
        }

               // ==================== FUNZIONE HELPER API MIGLIORATA CON AUTENTICAZIONE ====================
// API base URL: stesso origin (preview Emergent / produzione) o porta locale 3000 (dev locale)
const API_BASE_URL = (() => {
    const host = window.location.hostname;
    // Dev locale (file://, localhost, IP LAN): mantieni :3000 esplicito
    if (host === '' || host === 'localhost' || host === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        return window.location.protocol + '//' + host + ':3000/api';
    }
    // Tutti gli altri ambienti (Emergent preview, ngrok, prod): usa stesso origin → /api
    return window.location.origin + '/api';
})();

async function apiCall(endpoint, options = {}) {
    // Ottieni il token dal localStorage
    const token = localStorage.getItem('auth_token');
    
    // Prepara gli headers
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    // Aggiungi il token se presente
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        // Costruisci l'URL completo
        const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
        
        const response = await fetch(url, {
            ...options,
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        
        // Gestione errori di autenticazione
        if (response.status === 401) {
            // Token scaduto o non valido
            localStorage.removeItem('auth_token');
            localStorage.removeItem('currentUser');
            showNotification('Sessione scaduta. Effettua di nuovo il login.', 'warning');
            showAuthInterface();
            throw new Error('Password o Username errati');
        }
        
        if (!response.ok) {
            let errorMessage;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || response.statusText;
            } catch {
                errorMessage = await response.text();
            }
            throw new Error(errorMessage);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

// ==================== AGGIUNGI QUI addGPSLater ====================
function addGPSLater(lotId) {
    showGPSOptionsModal(lotId);
}

function showGPSOptionsModal(lotId) {
    // Crea un modal con i pulsanti
    const modalHtml = `
        <div id="gps-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 10000;">
            <div style="background: white; padding: 25px; border-radius: 16px; width: 90%; max-width: 450px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; color: #333; font-size: 1.3rem;">
                        <i class="fas fa-map-marker-alt" style="color: #4CAF50; margin-right: 10px;"></i>
                        Aggiungi Coordinate GPS
                    </h3>
                    <button onclick="closeGPSModal()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #666;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button onclick="addGPSFromMapPicker(${lotId}); closeGPSModal();" class="btn btn-primary" style="text-align: left; padding: 15px; border-radius: 10px; font-size: 1rem; background: #2E7D32;">
                        <i class="fas fa-map-marked-alt" style="margin-right: 10px; width: 20px;"></i> Salva posizione (mappa interattiva)
                    </button>

                    <button onclick="addGPSCurrentLocation(${lotId}); closeGPSModal()" class="btn btn-secondary" style="text-align: left; padding: 15px; border-radius: 10px; font-size: 1rem;">
                        <i class="fas fa-location-arrow" style="margin-right: 10px; width: 20px;"></i> Usa posizione attuale
                    </button>

                    <button onclick="addGPSManual(${lotId}); closeGPSModal()" class="btn btn-secondary" style="text-align: left; padding: 15px; border-radius: 10px; font-size: 1rem;">
                        <i class="fas fa-keyboard" style="margin-right: 10px; width: 20px;"></i> Inserisci manualmente il link
                    </button>

                    <button onclick="addGPSFromClipboard(${lotId}); closeGPSModal()" class="btn btn-secondary" style="text-align: left; padding: 15px; border-radius: 10px; font-size: 1rem;">
                        <i class="fas fa-paste" style="margin-right: 10px; width: 20px;"></i> Incolla dagli appunti
                    </button>

                    <button onclick="addGPSFromCoordinates(${lotId}); closeGPSModal()" class="btn btn-secondary" style="text-align: left; padding: 15px; border-radius: 10px; font-size: 1rem;">
                        <i class="fas fa-coordinates" style="margin-right: 10px; width: 20px;"></i> Genera da coordinate

                    </button>

                    <button onclick="closeGPSModal()" class="btn" style="background: #f5f5f5; color: #666; padding: 15px; border-radius: 10px; margin-top: 10px; font-size: 1rem;">
                        <i class="fas fa-times" style="margin-right: 10px; width: 20px;"></i> Annulla
                    </button>
                </div>
                
                <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px; font-size: 0.85rem; color: #666;">
                    <i class="fas fa-info-circle" style="margin-right: 5px;"></i>
                    Puoi aggiungere le coordinate in qualsiasi momento
                </div>
            </div>
        </div>
    `;
    
    // Rimuovi eventuali modal precedenti
    closeGPSModal();
    
    // Aggiungi il nuovo modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Chiudi il modal cliccando sullo sfondo
    document.getElementById('gps-modal').addEventListener('click', function(e) {
        if (e.target.id === 'gps-modal') {
            closeGPSModal();
        }
    });
}

function closeGPSModal() {
    const modal = document.getElementById('gps-modal');
    if (modal) {
        modal.remove();
    }
}

function openGoogleMapsForLocation(lotId) {
    const mapsUrl = 'https://www.google.com/maps';
    window.open(mapsUrl, '_blank');
    showNotification('Apri Google Maps, trova la posizione e copia il link da condividere', 'info');
    closeGPSModal();
    
    // Dopo 3 secondi, apri il prompt per incollare il link
    setTimeout(() => {
        addGPSFromClipboard(lotId);
    }, 3000);
}

/**
 * Apre la mappa interattiva (Leaflet) per scegliere/regolare le coordinate di un lotto esistente,
 * poi aggiorna il lotto via API. Stesso flusso di "Salva Posizione" usato in fase di registrazione.
 */
function addGPSFromMapPicker(lotId) {
    // Trova lotto per leggere coordinate esistenti (se ci sono)
    const lot = (typeof allLots !== 'undefined' && Array.isArray(allLots))
        ? allLots.find(l => l.id === parseInt(lotId))
        : null;
    const initialUrl = lot && lot.gps_coordinates ? lot.gps_coordinates : '';

    openMapPicker({
        initialUrl,
        onConfirm: (lat, lng, url) => {
            updateLotGPS(lotId, url);
        }
    });
}


function addGPSManual(lotId) {
    const gpsUrl = prompt('Incolla il link Google Maps:');
    if (gpsUrl && gpsUrl.trim() !== '') {
        if (isValidGoogleMapsUrl(gpsUrl)) {
            updateLotGPS(lotId, gpsUrl);
        } else {
            showNotification('Link Google Maps non valido', 'error');
        }
    }
}

function addGPSCurrentLocation(lotId) {
    if (!navigator.geolocation) {
        showNotification('Geolocalizzazione non supportata su questo dispositivo', 'error');
        return;
    }
    
    showNotification('Acquisizione posizione in corso...', 'loading');
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            
            const url = `https://maps.google.com/?q=${lat},${lng}`;
            
            let message = 'Posizione acquisita!';
            if (accuracy > 100) {
                message += ` (Precisione: ~${Math.round(accuracy)} metri)`;
            }
            
            showNotification(message, 'success');
            updateLotGPS(lotId, url);
        },
        (error) => {
            let errorMessage = 'Impossibile acquisire la posizione';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Permesso di geolocalizzazione negato. Abilitalo nelle impostazioni del browser.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Informazioni di posizione non disponibili.';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Timeout nella richiesta di posizione.';
                    break;
            }
            showNotification(errorMessage, 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000
        }
    );
}

async function addGPSFromClipboard(lotId) {
    try {
        const text = await navigator.clipboard.readText();
        if (text && isValidGoogleMapsUrl(text)) {
            updateLotGPS(lotId, text);
        } else {
            showNotification('Nessun link Google Maps valido negli appunti', 'warning');
            // Se non c'è un link valido, propone l'inserimento manuale
            setTimeout(() => addGPSManual(lotId), 1000);
        }
    } catch (error) {
        showNotification('Impossibile accedere agli appunti. Usa Ctrl+V per incollare manualmente.', 'error');
        setTimeout(() => addGPSManual(lotId), 1000);
    }
}

function addGPSFromCoordinates(lotId) {
    const latitude = prompt('Inserisci la latitudine (es: 41.04294):');
    if (!latitude) return;
    
    const longitude = prompt('Inserisci la longitudine (es: 16.95593):');
    if (!longitude) return;
    
    const url = `https://maps.google.com/?q=${latitude},${longitude}`;
    updateLotGPS(lotId, url);
}

function updateLotGPS(lotId, gpsUrl) {
    showNotification('Aggiornamento coordinate in corso...', 'loading');
    
    apiCall(`/lots/${lotId}`, {
        method: 'PATCH',
        body: {
            gps_coordinates: gpsUrl
        }
    })
    .then(response => {
        showNotification('✅ Coordinate GPS aggiunte con successo!', 'success');
        loadLots(); // Ricarica la lista per mostrare le modifiche
    })
    .catch(error => {
        console.error('Errore aggiornamento GPS:', error);
        showNotification('❌ Errore nell\'aggiornamento delle coordinate', 'error');
    });
}
// ==================== FINE FUNZIONI GPS ====================
// ==================== FUNZIONI DI GESTIONE DETTAGLI ====================
       async function loadLotDetails(lotId) {
    try {
        showNotification('Caricamento dettagli...', 'loading');
        
        const lotIdNum = parseInt(lotId);
        currentLotId = lotIdNum;
        if (typeof syncActiveLotId === 'function') syncActiveLotId(lotIdNum);
        
        // ✅ 1. Carica i dati del lotto
        const lotResponse = await apiCall(`/lots/${lotIdNum}`);
        const lotData = lotResponse.data;
        
        if (!lotData) {
            throw new Error('Lotto non trovato');
        }
        
        // ✅ 2. Carica i dettagli del lotto (da lot_details)
        let detailsData = {};
        try {
            const detailsResponse = await apiCall(`/lots/${lotIdNum}/details`);
            detailsData = detailsResponse.data || {};
        } catch (e) {
            console.log('Nessun dettaglio trovato per questo lotto');
            detailsData = {};
        }
        
        // ✅ 3. Mostra la sezione e popola il form con ENTRAMBI
        showSection('dettagli-section');
        populateDetailsForm(lotData, detailsData);
        
        // ✅ 4. Carica attività e analisi
        loadLotActivities(lotIdNum);
        loadLotAnalyses(lotIdNum);
        populateAnalysisYears();
        
        showNotification('Dettagli caricati con successo', 'success');
        
    } catch (error) {
        console.error('Errore caricamento dettagli:', error);
        showNotification(`Errore nel caricamento: ${error.message}`, 'error');
    }
}

        function populateDetailsForm(lotData, detailsData) {
            const sectionTitle = document.querySelector('#dettagli-section .section-title');
            if (sectionTitle) {
                sectionTitle.innerHTML = `<i class="fas fa-info-circle"></i> Dettagli Lotto: ${lotData.company_name}`;
            }
            
            let lotIdField = document.getElementById('current-lot-id');
            if (!lotIdField) {
                lotIdField = document.createElement('input');
                lotIdField.type = 'hidden';
                lotIdField.id = 'current-lot-id';
                document.getElementById('dettagli-section').appendChild(lotIdField);
            }
            lotIdField.value = lotData.id;
            
            updateReadOnlyInfo(lotData, detailsData);
        }

        function updateReadOnlyInfo(lotData, detailsData) {
    let readOnlyInfo = document.getElementById('read-only-info');
    
    if (!readOnlyInfo) {
        readOnlyInfo = document.createElement('div');
        readOnlyInfo.id = 'read-only-info';
        readOnlyInfo.className = 'read-only-info';
        document.querySelector('#dettagli-section').insertBefore(readOnlyInfo, document.querySelector('#dettagli-section .form-group'));
    }
    
    // Costruisci le informazioni del prodotto
    let productInfo = '';
    if (lotData.product_category) {
        productInfo = ` - ${lotData.product_category}`;
    }
    if (lotData.variety) {
        productInfo += ` (${lotData.variety})`;
    }
    
    readOnlyInfo.innerHTML = `
        <div class="lot-summary">
            <h4><i class="fas fa-building"></i> ${lotData.company_name}</h4>
            <p><i class="fas fa-map-marker-alt"></i> ${lotData.location}</p>
            <p><i class="fas fa-wine-bottle"></i> ${lotData.product_type}${productInfo}</p>
            
            ${lotData.field_lot ? `<p><i class="fas fa-map"></i> Lotto Campo: ${lotData.field_lot}</p>` : ''}
            
            ${lotData.field_size ? `<p><i class="fas fa-ruler-combined"></i> Superficie: ${lotData.field_size} ettari</p>` : ''}
            
            ${lotData.gps_coordinates ? `<p><i class="fas fa-link"></i> <a href="${lotData.gps_coordinates}" target="_blank">Vedi su Mappa</a></p>` : '<p><i class="fas fa-map-marker-alt" style="color: #FF9800;"></i> <em>Coordinate non inserite</em></p>'}
            
            <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                <small><i class="fas fa-info-circle"></i> <strong>Informazioni di base del lotto</strong></small>
            </div>
        </div>
    `;
}
        
        // ==================== GESTIONE SEZIONI PRINCIPALI ====================
        function toggleSection(headerElement) {
            const section = headerElement.closest('.special-section');
            const content = section.querySelector('.section-content');
            const toggleBtn = section.querySelector('.section-toggle i');
            const icon = section.querySelector('.section-icon');
            
            const isExpanded = content.classList.contains('expanded');
            
            if (isExpanded) {
                content.classList.remove('expanded');
                content.classList.add('collapsed');
                toggleBtn.className = 'fas fa-chevron-right';
                section.classList.add('compact');
                icon.style.transform = 'scale(0.8)';
            } else {
                content.classList.remove('collapsed');
                content.classList.add('expanded');
                toggleBtn.className = 'fas fa-chevron-down';
                section.classList.remove('compact');
                icon.style.transform = 'scale(1)';
            }
            
            saveSectionState();
        }

        // ==================== GESTIONE STORICI INTERNI ====================
        function toggleHistory(historyType) {
            const historyContent = document.getElementById(`${historyType}-list`);
            const toggleBtn = document.querySelector(`#${historyType}-history-container .history-toggle i`);
            
            const isExpanded = historyContent.classList.contains('expanded');
            
            if (isExpanded) {
                historyContent.classList.remove('expanded');
                historyContent.classList.add('collapsed');
                toggleBtn.className = 'fas fa-chevron-right';
            } else {
                historyContent.classList.remove('collapsed');
                historyContent.classList.add('expanded');
                toggleBtn.className = 'fas fa-chevron-down';
            }
            
            saveHistoryState();
        }

        function toggleAllSections(expand = true) {
            const sections = document.querySelectorAll('.special-section');
            
            sections.forEach(section => {
                const content = section.querySelector('.section-content');
                const toggleBtn = section.querySelector('.section-toggle i');
                const icon = section.querySelector('.section-icon');
                
                if (expand) {
                    content.classList.remove('collapsed');
                    content.classList.add('expanded');
                    toggleBtn.className = 'fas fa-chevron-down';
                    section.classList.remove('compact');
                    icon.style.transform = 'scale(1)';
                } else {
                    content.classList.remove('expanded');
                    content.classList.add('collapsed');
                    toggleBtn.className = 'fas fa-chevron-right';
                    section.classList.add('compact');
                    icon.style.transform = 'scale(0.8)';
                }
            });
            
            saveSectionState();
        }

        function toggleAllHistories(expand = true) {
            const historyTypes = ['activities', 'analyses'];
            
            historyTypes.forEach(type => {
                const historyContent = document.getElementById(`${type}-list`);
                const toggleBtn = document.querySelector(`#${type}-history-container .history-toggle i`);
                const container = document.getElementById(`${type}-history-container`);
                
                if (container && container.style.display !== 'none' && historyContent && toggleBtn) {
                    if (expand) {
                        historyContent.classList.remove('collapsed');
                        historyContent.classList.add('expanded');
                        toggleBtn.className = 'fas fa-chevron-down';
                    } else {
                        historyContent.classList.remove('expanded');
                        historyContent.classList.add('collapsed');
                        toggleBtn.className = 'fas fa-chevron-right';
                    }
                }
            });
            
            saveHistoryState();
        }

       function addSectionControls() {
    // Funzione vuota - i controlli sono stati rimossi
    return;
}

        function saveSectionState() {
            const sectionsState = {};
            
            document.querySelectorAll('.special-section').forEach((section, index) => {
                const isMainSection = section.classList.contains('section-raccolta') || 
                                     section.classList.contains('section-analisi') || 
                                     section.classList.contains('section-note');
                
                if (isMainSection) {
                    const content = section.querySelector('.section-content');
                    const sectionType = Array.from(section.classList).find(cls => 
                        cls.includes('section-') && !cls.includes('special-section')
                    ) || `section_${index}`;
                    
                    sectionsState[sectionType] = content.classList.contains('expanded');
                }
            });
            
            localStorage.setItem('agriManager_sections', JSON.stringify(sectionsState));
        }

        function loadSectionState() {
            const savedState = localStorage.getItem('agriManager_sections');
            if (savedState) {
                const sectionsState = JSON.parse(savedState);
                
                document.querySelectorAll('.special-section').forEach((section, index) => {
                    const isMainSection = section.classList.contains('section-raccolta') || 
                                         section.classList.contains('section-analisi') || 
                                         section.classList.contains('section-note');
                    
                    if (isMainSection) {
                        const content = section.querySelector('.section-content');
                        const toggleBtn = section.querySelector('.section-toggle i');
                        const icon = section.querySelector('.section-icon');
                        
                        const sectionType = Array.from(section.classList).find(cls => 
                            cls.includes('section-') && !cls.includes('special-section')
                        ) || `section_${index}`;
                        
                        if (sectionsState[sectionType] === false) {
                            content.classList.remove('expanded');
                            content.classList.add('collapsed');
                            toggleBtn.className = 'fas fa-chevron-right';
                            section.classList.add('compact');
                            icon.style.transform = 'scale(0.8)';
                        }
                    }
                });
            }
        }

        function saveHistoryState() {
            const historyState = {
                activities: document.getElementById('activities-list')?.classList.contains('expanded') || false,
                analyses: document.getElementById('analyses-list')?.classList.contains('expanded') || false
            };
            localStorage.setItem('agriManager_histories', JSON.stringify(historyState));
        }

        function loadHistoryState() {
            const savedState = localStorage.getItem('agriManager_histories');
            if (savedState) {
                const historyState = JSON.parse(savedState);
                
                Object.keys(historyState).forEach(historyType => {
                    const historyContent = document.getElementById(`${historyType}-list`);
                    const toggleBtn = document.querySelector(`#${historyType}-history-container .history-toggle i`);
                    const container = document.getElementById(`${historyType}-history-container`);
                    
                    if (container && container.style.display !== 'none' && historyContent && toggleBtn) {
                        if (!historyState[historyType]) {
                            historyContent.classList.remove('expanded');
                            historyContent.classList.add('collapsed');
                            toggleBtn.className = 'fas fa-chevron-right';
                        }
                    }
                });
            }
        }

        function updateHistoryCounters() {
            const activitiesCount = document.getElementById('raccolta-count');
            const analysesCount = document.getElementById('analisi-count');
            
            if (activitiesCount) {
                const count = lotActivities.length;
                activitiesCount.textContent = count;
            }
            
            if (analysesCount) {
                const count = lotAnalyses.length;
                analysesCount.textContent = count;
            }
        }

        // ==================== GESTIONE ATTIVITÀ AVANZATE ====================
        function addHarvestActivity() {
            // Controlla i permessi
            const permissions = getUserPermissions();
            if (!permissions.canAddActivities) {
                showNotification('Non hai i permessi per aggiungere attività di raccolta', 'error');
                return;
            }
            
            const lotId = document.getElementById('current-lot-id')?.value;
            if (!lotId) {
                showNotification('Seleziona prima un lotto', 'error');
                return;
            }
            
            const date = document.getElementById('harvest-date').value;
            const kg = document.getElementById('harvest-kg').value;
            const notes = document.getElementById('harvest-notes').value;
            
            if (!date || !kg) {
                showNotification('Inserisci almeno data e kg raccolti', 'error');
                return;
            }
            
            // ✅ Verifica che la data appartenga alla stagione selezionata in Dettagli
            const stagioneSelezionata = parseInt(document.getElementById('dettagli-stagione-select')?.value) || null;
            if (stagioneSelezionata) {
                const annoData = new Date(date).getFullYear();
                if (annoData !== stagioneSelezionata) {
                    if (!confirm(`⚠️ La data ${date} appartiene all'anno ${annoData}, diverso dalla stagione selezionata ${stagioneSelezionata}.\n\nVuoi salvare comunque l'attività?`)) {
                        return;
                    }
                }
            }
            
            const activity = {
                id: Date.now(),
                type: 'raccolta',
                date: date,
                kg: parseFloat(kg),
                notes: notes,
                createdAt: new Date().toISOString(),
                createdBy: currentUser.username
            };
            
            lotActivities.push(activity);
            saveLotActivities();
            displayActivities();
            
            document.getElementById('harvest-date').value = '';
            document.getElementById('harvest-kg').value = '';
            document.getElementById('harvest-notes').value = '';
            
            showNotification('Attività di raccolta aggiunta!', 'success');
        }

        async function uploadAnalysis() {
            // Controlla i permessi
            const permissions = getUserPermissions();
            if (!permissions.canUploadAnalyses) {
                showNotification('Non hai i permessi per caricare analisi', 'error');
                return;
            }
            
            const lotId = document.getElementById('current-lot-id')?.value;
            if (!lotId) {
                showNotification('Seleziona prima un lotto', 'error');
                return;
            }
            
            const year = document.getElementById('analysis-year').value;
            const fileInput = document.getElementById('analysis-file');
            const notes = document.getElementById('analysis-notes').value;
            
            if (!year || !fileInput.files[0]) {
                showNotification('Seleziona anno e carica un file', 'error');
                return;
            }
            
            try {
                showNotification('Caricamento analisi in corso...', 'loading');
                
                const file = fileInput.files[0];
                const fileUrl = await simulateFileUpload(file);
                
                const analysis = {
                    id: Date.now(),
                    year: year,
                    filename: file.name,
                    originalName: file.name,
                    fileUrl: fileUrl,
                    notes: notes,
                    uploadDate: new Date().toISOString(),
                    fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
                    uploadedBy: currentUser.username
                };
                
                lotAnalyses.push(analysis);
                saveLotAnalyses();
                displayAnalyses();
                
                document.getElementById('analysis-year').value = '';
                document.getElementById('analysis-file').value = '';
                document.getElementById('analysis-notes').value = '';
                
                showNotification('Analisi caricata con successo!', 'success');
            } catch (error) {
                console.error('Errore upload analisi:', error);
                showNotification('Errore nel caricamento del file', 'error');
            }
        }

        function populateAnalysisYears() {
            const select = document.getElementById('analysis-year');
            if (!select) return;
            
            select.innerHTML = '<option value="">Seleziona anno</option>';
            const currentYear = new Date().getFullYear();
            for (let year = currentYear; year >= currentYear - 10; year--) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                select.appendChild(option);
            }
        }

        function simulateFileUpload(file) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    const fileUrl = URL.createObjectURL(file);
                    resolve(fileUrl);
                }, 1000);
            });
        }

        function saveLotActivities() {
            const lotId = document.getElementById('current-lot-id')?.value;
            if (lotId) {
                localStorage.setItem(`agriManager_activities_${lotId}`, JSON.stringify(lotActivities));
            }
        }

        function saveLotAnalyses() {
            const lotId = document.getElementById('current-lot-id')?.value;
            if (lotId) {
                localStorage.setItem(`agriManager_analyses_${lotId}`, JSON.stringify(lotAnalyses));
            }
        }

        function loadLotActivities(lotId) {
            const saved = localStorage.getItem(`agriManager_activities_${lotId}`);
            if (saved) {
                lotActivities = JSON.parse(saved);
            } else {
                lotActivities = [];
            }
            // ✅ Popola il selettore stagione di Dettagli e applica filtro iniziale
            populateDettagliStagioneSelect();
            displayActivities();
        }
        
        // ✅ Popola il <select> stagione in Dettagli Lotto con anno corrente + tutti gli anni
        //    presenti nei dati (attività/analisi). Mantiene la stagione corrente se ancora valida.
        function populateDettagliStagioneSelect() {
            const select = document.getElementById('dettagli-stagione-select');
            if (!select) return;
            const annoCorrente = new Date().getFullYear();
            const anni = new Set();
            anni.add(annoCorrente);
            (lotActivities || []).forEach(a => {
                if (a.date) anni.add(new Date(a.date).getFullYear());
            });
            (lotAnalyses || []).forEach(a => {
                if (a.year) anni.add(parseInt(a.year));
            });
            // Aggiungi 3 anni passati e 1 futuro come comodità
            for (let y = annoCorrente - 3; y <= annoCorrente + 1; y++) anni.add(y);
            
            const valoreCorrente = select.value;
            const opzioni = Array.from(anni).filter(y => !isNaN(y)).sort((a, b) => b - a);
            select.innerHTML = opzioni.map(y => `<option value="${y}">Stagione ${y}</option>`).join('');
            // Mantieni selezione se valida, altrimenti default = anno corrente
            if (opzioni.includes(parseInt(valoreCorrente))) {
                select.value = valoreCorrente;
            } else {
                select.value = String(annoCorrente);
            }
        }
        
        // ✅ Callback al cambio stagione → ri-renderizza attività e analisi filtrate
        function onCambioStagioneDettagli() {
            const stagione = document.getElementById('dettagli-stagione-select')?.value;
            displayActivities();
            displayAnalyses();
            // Suggerisci la data raccolta: 1° gennaio della stagione (se diversa da anno corrente)
            const harvestDateInput = document.getElementById('harvest-date');
            if (harvestDateInput && !harvestDateInput.value && stagione) {
                const annoCorrente = new Date().getFullYear();
                if (parseInt(stagione) !== annoCorrente) {
                    harvestDateInput.value = `${stagione}-01-01`;
                }
            }
            // Pre-imposta anno analisi
            const analysisYearInput = document.getElementById('analysis-year');
            if (analysisYearInput && stagione) {
                analysisYearInput.value = stagione;
            }
        }

        function loadLotAnalyses(lotId) {
            const saved = localStorage.getItem(`agriManager_analyses_${lotId}`);
            if (saved) {
                lotAnalyses = JSON.parse(saved);
            } else {
                lotAnalyses = [];
            }
            populateDettagliStagioneSelect();
            displayAnalyses();
        }
        
        function displayActivities() {
            const container = document.getElementById('activities-list');
            const historyContainer = document.getElementById('activities-history-container');
            const countBadge = document.getElementById('raccolta-count');
            const historyBadge = document.querySelector('#activities-history-container .activity-badge');
            
            if (!container) return;
            
            // ✅ Filtra per stagione selezionata nel dropdown Dettagli (se presente)
            const stagioneSel = parseInt(document.getElementById('dettagli-stagione-select')?.value) || null;
            const visibili = stagioneSel
                ? lotActivities.filter(a => new Date(a.date).getFullYear() === stagioneSel)
                : lotActivities;
            
            if (visibili.length === 0) {
                const msg = stagioneSel
                    ? `Nessuna attività di raccolta per la stagione ${stagioneSel}`
                    : 'Nessuna attività di raccolta registrata';
                container.innerHTML = `<p style="text-align: center; color: #666; padding: 20px;">${msg}</p>`;
                historyContainer.style.display = lotActivities.length > 0 ? 'block' : 'none';
                countBadge.textContent = '0';
                if (historyBadge) historyBadge.textContent = lotActivities.length;
                return;
            }
            
            historyContainer.style.display = 'block';
            countBadge.textContent = visibili.length;
            if (historyBadge) historyBadge.textContent = lotActivities.length;
            
            container.innerHTML = visibili.map(activity => `
                <div class="lotto-item" style="margin-bottom: 10px;">
                    <div class="lotto-info">
                        <h4>📅 Raccolta - ${new Date(activity.date).toLocaleDateString('it-IT')}</h4>
                        <p><strong>${activity.kg} kg</strong> raccolti</p>
                        ${activity.notes ? `<p>${activity.notes}</p>` : ''}
                        <small>Registrato il: ${new Date(activity.createdAt).toLocaleDateString('it-IT')} da ${activity.createdBy || 'Utente'}</small>
                    </div>
                    <div class="lotto-actions">
                        <div class="action-btn" onclick="deleteActivity(${activity.id})" title="Elimina attività">
                            <i class="fas fa-trash"></i>
                        </div>
                    </div>
                </div>
            `).join('');
            
            setTimeout(loadHistoryState, 100);
        }

        function displayAnalyses() {
            const container = document.getElementById('analyses-list');
            const historyContainer = document.getElementById('analyses-history-container');
            const countBadge = document.getElementById('analisi-count');
            const historyBadge = document.querySelector('#analyses-history-container .analysis-badge');
            
            if (!container) return;
            
            // ✅ Filtra per stagione selezionata (campo .year dell'analisi)
            const stagioneSel = parseInt(document.getElementById('dettagli-stagione-select')?.value) || null;
            const visibili = stagioneSel
                ? lotAnalyses.filter(a => parseInt(a.year) === stagioneSel)
                : lotAnalyses;
            
            if (visibili.length === 0) {
                const msg = stagioneSel
                    ? `Nessuna analisi caricata per la stagione ${stagioneSel}`
                    : 'Nessuna analisi caricata';
                container.innerHTML = `<p style="text-align: center; color: #666; padding: 20px;">${msg}</p>`;
                historyContainer.style.display = lotAnalyses.length > 0 ? 'block' : 'none';
                countBadge.textContent = '0';
                if (historyBadge) historyBadge.textContent = lotAnalyses.length;
                return;
            }
            
            historyContainer.style.display = 'block';
            countBadge.textContent = visibili.length;
            if (historyBadge) historyBadge.textContent = lotAnalyses.length;
            
            container.innerHTML = visibili.map(analysis => `
                <div class="analysis-file-item">
                    <div class="analysis-file-info">
                        <h4>🔬 Analisi ${analysis.year}</h4>
                        <p><strong>File:</strong> ${analysis.originalName}</p>
                        ${analysis.notes ? `<p><strong>Note:</strong> ${analysis.notes}</p>` : ''}
                        <div class="file-info">
                            <span class="file-size">${analysis.fileSize}</span>
                            <small>Caricato il: ${new Date(analysis.uploadDate).toLocaleDateString('it-IT')} da ${analysis.uploadedBy || 'Utente'}</small>
                        </div>
                    </div>
                    <div class="analysis-file-actions">
                        <button class="btn btn-secondary" onclick="downloadFile('${analysis.fileUrl}', '${analysis.originalName}')">
                            <i class="fas fa-download"></i> Scarica
                        </button>
                        <button class="btn btn-danger" onclick="deleteAnalysis(${analysis.id})">
                            <i class="fas fa-trash"></i> Elimina
                        </button>
                    </div>
                </div>
            `).join('');
            
            setTimeout(loadHistoryState, 100);
        }

        function deleteActivity(activityId) {
            // Controlla i permessi
            const permissions = getUserPermissions();
            if (!permissions.canEditLots) {
                showNotification('Non hai i permessi per eliminare attività', 'error');
                return;
            }
            
            if (confirm('Sei sicuro di voler eliminare questa attività?')) {
                lotActivities = lotActivities.filter(a => a.id !== activityId);
                saveLotActivities();
                displayActivities();
                showNotification('Attività eliminata', 'success');
            }
        }

        function deleteAnalysis(analysisId) {
            // Controlla i permessi
            const permissions = getUserPermissions();
            if (!permissions.canEditLots) {
                showNotification('Non hai i permessi per eliminare analisi', 'error');
                return;
            }
            
            if (confirm('Sei sicuro di voler eliminare questa analisi?')) {
                lotAnalyses = lotAnalyses.filter(a => a.id !== parseInt(analysisId));
                saveLotAnalyses();
                displayAnalyses();
                showNotification('Analisi eliminata', 'success');
            }
        }

        function downloadFile(url, filename) {
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            showNotification(`Download di ${filename} avviato`, 'success');
        }

        // ==================== GESTIONE ECONOMICA LOTTI ====================
        async function loadEconomicLotDetails(lotId) {
    currentEconomicLotId = lotId;
    
    const lot = allLots.find(l => l.id === parseInt(lotId));
    if (lot) {
        document.getElementById('economic-lot-info').innerHTML = `
            <h4><i class="fas fa-building"></i> ${lot.company_name}</h4>
            <p><i class="fas fa-map-marker-alt"></i> ${lot.location}</p>
            <p><i class="fas fa-wine-bottle"></i> ${lot.product_type} - ${lot.variety}</p>
            ${lot.field_lot ? `<p><i class="fas fa-map"></i> Lotto Campo: ${lot.field_lot}</p>` : ''}
        `;
        document.getElementById('economic-lot-info').style.display = 'block';
    }
    
    // ✅ 1. Carica le registrazioni
    await loadRegistrazioniEconomiche(lotId);
    
    // ✅ 2. PRIMA resetta il form
    resetFormEconomico();
    
    // ✅ 3. POI popola le stagioni
    popolaStagioniAgricole();
    
    // ✅ 4. Imposta anno di default e carica i beni attivi
    setTimeout(() => {
        const stagioneSelect = document.getElementById('stagione-agricola');
        if (stagioneSelect) {
            stagioneSelect.value = new Date().getFullYear();
            handleCambioStagione();
        }
    }, 150);
}

        function popolaStagioniAgricole() {
    const select = document.getElementById('stagione-agricola');
    if (!select) return;
    
    const annoCorrente = new Date().getFullYear();
    select.innerHTML = '<option value="">Seleziona anno</option>';
    
    for (let anno = annoCorrente + 1; anno >= 2000; anno--) {
        const option = document.createElement('option');
        option.value = anno;
        option.textContent = anno;
        select.appendChild(option);
    }
    
    // ✅ Usa onchange (non addEventListener) per evitare chiamate multiple
    select.onchange = handleCambioStagione;
}

        function calcolaKgRaccoltiAutomatico() {
            const stagione = document.getElementById('stagione-agricola').value;
            const lotId = currentEconomicLotId;
            
            if (!stagione) {
                showNotification('Seleziona prima la stagione agricola', 'warning');
                return;
            }
            
            if (!lotId) {
                showNotification('Seleziona prima un lotto', 'warning');
                return;
            }
            
            // ✅ Fallback: se lotActivities non è popolato per QUESTO lotto, leggi direttamente da localStorage
            //   (evita di chiamare loadLotActivities che invocherebbe displayActivities su un container non visibile)
            let attivita = lotActivities;
            const currentLotIdDom = document.getElementById('current-lot-id')?.value;
            if (!Array.isArray(attivita) || attivita.length === 0 || String(currentLotIdDom) !== String(lotId)) {
                try {
                    const saved = localStorage.getItem(`agriManager_activities_${lotId}`);
                    attivita = saved ? JSON.parse(saved) : [];
                } catch (e) {
                    attivita = [];
                }
            }
            
            const kgTotali = (attivita || [])
                .filter(att => {
                    const annoAttivita = new Date(att.date).getFullYear();
                    return annoAttivita === parseInt(stagione);
                })
                .reduce((totale, att) => totale + (parseFloat(att.kg) || 0), 0);
            
            document.getElementById('totale-kg-raccolti').value = kgTotali.toFixed(1);
            if (kgTotali === 0) {
                showNotification(`Nessuna attività di raccolta registrata per la stagione ${stagione}`, 'warning');
            } else {
                showNotification(`Calcolati automaticamente ${kgTotali} kg per la stagione ${stagione}`, 'success');
            }
        }

// ==================== GESTIONE METODO DI CALCOLO PREZZO ====================
// ==================== GESTIONE METODO DI CALCOLO PREZZO MIGLIORATA ====================
function toggleMetodoCalcolo() {
    console.log('🔄 toggleMetodoCalcolo() chiamato - Layout Invertito');
    
    const metodoKg = document.getElementById('metodo-prezzo-kg').checked;
    const campoKg = document.getElementById('campo-prezzo-kg');
    const campoTotale = document.getElementById('campo-prezzo-totale');
    const labelKg = document.getElementById('label-metodo-kg');
    const labelTotale = document.getElementById('label-metodo-totale');
    const inputKg = document.getElementById('prezzo-acquisto-vendita');
    const inputTotale = document.getElementById('prezzo-totale');
    
    // DEBUG
    console.log('Metodo KG:', metodoKg);
    console.log('Elementi trovati:', { campoKg: !!campoKg, campoTotale: !!campoTotale });
    
    // Reset completo
    [labelKg, labelTotale].forEach(el => el?.classList.remove('active'));
    [campoKg, campoTotale].forEach(el => el?.classList.remove('campo-prezzo-attivo'));
    
    if (metodoKg) {
        // 🎯 PREZZO AL KG ATTIVO (campo SINISTRA)
        if (campoKg) {
            campoKg.style.display = 'block';
            campoKg.classList.add('campo-prezzo-attivo');
            console.log('✅ Campo prezzo/kg attivato e evidenziato');
        }
        if (campoTotale) campoTotale.style.display = 'none';
        if (labelKg) labelKg.classList.add('active');
        if (inputTotale) inputTotale.value = '';
        
        setTimeout(() => inputKg?.focus(), 150);
        
    } else {
        // 🎯 PREZZO TOTALE ATTIVO (campo SINISTRA)
        if (campoKg) campoKg.style.display = 'none';
        if (campoTotale) {
            campoTotale.style.display = 'block';
            campoTotale.classList.add('campo-prezzo-attivo');
            console.log('✅ Campo prezzo totale attivato e evidenziato');
        }
        if (labelTotale) labelTotale.classList.add('active');
        if (inputKg) inputKg.value = '';
        
        setTimeout(() => inputTotale?.focus(), 150);
    }
    
    calcolaPrezzoAutomatico();
}

function calcolaPrezzoAutomatico() {
    const metodoKg = document.getElementById('metodo-prezzo-kg').checked;
    const prezzoKgInput = document.getElementById('prezzo-acquisto-vendita');
    const prezzoTotaleInput = document.getElementById('prezzo-totale');
    const kgRaccolti = parseFloat(document.getElementById('totale-kg-raccolti').value) || 0;
    const anteprima = document.getElementById('anteprima-calcolo');
    const anteprimaTesto = document.getElementById('anteprima-testo');
    
    // ✅ Se gli elementi non esistono, esci silenziosamente
    if (!anteprima || !anteprimaTesto) {
        return;
    }
    
    let calcoloValido = false;
    let testoAnteprima = '';
    
    if (metodoKg && prezzoKgInput.value && kgRaccolti > 0) {
        const prezzoKg = parseFloat(prezzoKgInput.value);
        const prezzoTotale = prezzoKg * kgRaccolti;
        testoAnteprima = `
            <strong>Prezzo al kg:</strong> €${prezzoKg.toFixed(2)}/kg<br>
            <strong>Kg raccolti:</strong> ${kgRaccolti} kg<br>
            <strong>Ricavi totali:</strong> €${prezzoTotale.toFixed(2)}
        `;
        calcoloValido = true;
    } else if (!metodoKg && prezzoTotaleInput.value && kgRaccolti > 0) {
        const prezzoTotale = parseFloat(prezzoTotaleInput.value);
        const prezzoKg = kgRaccolti > 0 ? prezzoTotale / kgRaccolti : 0;
        testoAnteprima = `
            <strong>Prezzo totale:</strong> €${prezzoTotale.toFixed(2)}<br>
            <strong>Kg raccolti:</strong> ${kgRaccolti} kg<br>
            <strong>Prezzo al kg:</strong> €${prezzoKg.toFixed(2)}/kg
        `;
        calcoloValido = true;
    }
    
    if (calcoloValido) {
        anteprima.style.display = 'block';
        anteprimaTesto.innerHTML = testoAnteprima;
    } else {
        anteprima.style.display = 'none';
    }
}

// Versione migliorata con calcolo automatico del prezzo
function calcolaKgRaccoltiAutomaticoCompleto() {
    const stagione = document.getElementById('stagione-agricola').value;
    const lotId = currentEconomicLotId;
    
    if (!stagione) {
        showNotification('Seleziona prima la stagione agricola', 'warning');
        return;
    }
    
    if (!lotId) {
        showNotification('Seleziona prima un lotto', 'warning');
        return;
    }
    
    // ✅ Fallback: se lotActivities non corrisponde a questo lotto, leggi direttamente da localStorage
    //    Risolve il caso in cui l'utente NON ha mai aperto la sezione "Attività di Raccolta" prima.
    let attivita = Array.isArray(lotActivities) ? lotActivities : [];
    let needFallback = attivita.length === 0;
    if (!needFallback && attivita.length > 0) {
        // Se la prima attività ha un lot_id e non corrisponde a questo lotto → ricarica
        const first = attivita[0];
        if (first && first.lot_id !== undefined && String(first.lot_id) !== String(lotId)) {
            needFallback = true;
        }
    }
    if (needFallback) {
        try {
            const saved = localStorage.getItem(`agriManager_activities_${lotId}`);
            attivita = saved ? JSON.parse(saved) : [];
            // Aggiorna anche la variabile globale così la prossima chiamata trova i dati
            lotActivities = attivita;
        } catch (e) {
            attivita = [];
        }
    }
    
    const kgTotali = attivita
        .filter(att => {
            const annoAttivita = new Date(att.date).getFullYear();
            return annoAttivita === parseInt(stagione);
        })
        .reduce((totale, att) => totale + (parseFloat(att.kg) || 0), 0);
    
    document.getElementById('totale-kg-raccolti').value = kgTotali.toFixed(1);
    if (kgTotali === 0) {
        showNotification(`Nessuna attività di raccolta registrata per la stagione ${stagione}`, 'warning');
    } else {
        showNotification(`Calcolati automaticamente ${kgTotali} kg per la stagione ${stagione}`, 'success');
    }
    
    // Calcolo automatico del prezzo
    if (typeof calcolaPrezzoAutomatico === 'function') calcolaPrezzoAutomatico();
}
        // ==================== GESTIONE BENI DUREVOLI CON AMMORTAMENTO ====================

let beniDurevoliCount = 0;

function aggiungiBeneDurevole() {
    const container = document.getElementById('beni-durevoli-container');
    const template = document.getElementById('bene-durevole-template');
    
    if (!container || !template) return;
    
    beniDurevoliCount++;
    
    const clone = template.content.cloneNode(true);
    const beneDiv = clone.querySelector('.bene-durevole-item');
    beneDiv.dataset.index = beniDurevoliCount;
    beneDiv.querySelector('.bene-index').textContent = `#${beniDurevoliCount}`;
    
    // Imposta anno corrente come default per anno inizio
    const annoInput = beneDiv.querySelector('.bene-anno-inizio');
    if (annoInput) {
        annoInput.value = new Date().getFullYear();
    }
    
    container.appendChild(clone);
}

function rimuoviBeneDurevole(button) {
    const beneDiv = button.closest('.bene-durevole-item');
    if (beneDiv) {
        beneDiv.remove();
    }
}

function aggiornaQuotaAmmortamento(element) {
    const beneDiv = element.closest('.bene-durevole-item');
    if (!beneDiv) return;
    
    const costoInput = beneDiv.querySelector('.bene-costo');
    const anniSelect = beneDiv.querySelector('.bene-anni');
    const quotaInput = beneDiv.querySelector('.bene-quota');
    
    const costo = parseFloat(costoInput?.value) || 0;
    const anni = parseInt(anniSelect?.value) || 1;
    
    const quota = costo / anni;
    if (quotaInput) {
        quotaInput.value = quota.toFixed(2);
    }
}

function raccogliBeniDurevoli() {
    const beni = [];
    const container = document.getElementById('beni-durevoli-container');
    if (!container) return beni;
    
    const beniDivs = container.querySelectorAll('.bene-durevole-item');
    
    beniDivs.forEach(div => {
        const desc = div.querySelector('.bene-desc')?.value?.trim() || '';
        const costo = parseFloat(div.querySelector('.bene-costo')?.value) || 0;
        const anni = parseInt(div.querySelector('.bene-anni')?.value) || 1;
        const quota = parseFloat(div.querySelector('.bene-quota')?.value) || 0;
        const annoInizio = parseInt(div.querySelector('.bene-anno-inizio')?.value) || new Date().getFullYear();
        
        if (desc && costo > 0) {
            beni.push({
                descrizione: desc,
                costo_totale: costo,
                anni_ammortamento: anni,
                quota_annuale: quota,
                anno_inizio: annoInizio
            });
        }
    });
    
    return beni;
}

function resetBeniDurevoli() {
    const container = document.getElementById('beni-durevoli-container');
    if (container) {
        container.innerHTML = '';
    }
    beniDurevoliCount = 0;
}

// ==================== CARICA BENI DUREVOLI ATTIVI DA STAGIONI PRECEDENTI ====================
function caricaBeniDurevoliAttivi(registrazioni, annoCorrente) {
    const beniAttivi = [];
    const beniGiaAggiunti = new Set(); // Per evitare duplicati
    
    // Ordina le registrazioni per data (dalla più vecchia alla più recente)
    const registrazioniOrdinate = [...registrazioni].sort((a, b) => {
        return (parseInt(a.stagione_agricola) || 0) - (parseInt(b.stagione_agricola) || 0);
    });
    
    registrazioniOrdinate.forEach(reg => {
        if (reg.beni_durevoli) {
            try {
                const beni = typeof reg.beni_durevoli === 'string' 
                    ? JSON.parse(reg.beni_durevoli) 
                    : reg.beni_durevoli;
                
                if (Array.isArray(beni)) {
                    beni.forEach(bene => {
                        const descrizione = bene.descrizione || '';
                        const annoInizio = bene.anno_inizio || parseInt(reg.stagione_agricola) || annoCorrente;
                        const anni = bene.anni_ammortamento || 1;
                        const annoFine = annoInizio + anni - 1;
                        const costo = bene.costo_totale || 0;
                        const quota = bene.quota_annuale || (costo / anni);
                        
                        // ✅ Verifica se il bene è ancora attivo per l'anno corrente
                        if (annoCorrente >= annoInizio && annoCorrente <= annoFine) {
                            const chiave = `${descrizione}_${annoInizio}_${costo}`;
                            
                            // Evita duplicati
                            if (!beniGiaAggiunti.has(chiave)) {
                                beniGiaAggiunti.add(chiave);
                                beniAttivi.push({
                                    descrizione: descrizione,
                                    costo_totale: costo,
                                    anni_ammortamento: anni,
                                    quota_annuale: quota,
                                    anno_inizio: annoInizio
                                });
                            }
                        }
                    });
                }
            } catch(e) {
                console.error('Errore parsing beni durevoli:', e);
            }
        }
    });
    
    return beniAttivi;
}

// ✅ NUOVA FUNZIONE: Gestisce il cambio stagione
async function handleCambioStagione() {
    const annoCorrente = parseInt(document.getElementById('stagione-agricola')?.value) || new Date().getFullYear();
    
    if (registrazioniEconomiche && registrazioniEconomiche.length > 0) {
        const beniAttivi = caricaBeniDurevoliAttivi(registrazioniEconomiche, annoCorrente);
        
        // Pulisci beni attuali
        resetBeniDurevoli();
        
        // Aggiungi beni attivi
        if (beniAttivi.length > 0) {
            beniAttivi.forEach(bene => {
                aggiungiBeneDurevole();
                const lastIdx = beniDurevoliCount;
                
                setTimeout(() => {
                    const beneDiv = document.querySelector(`.bene-durevole-item[data-index="${lastIdx}"]`);
                    if (beneDiv) {
                        const descInput = beneDiv.querySelector('.bene-desc');
                        const costoInput = beneDiv.querySelector('.bene-costo');
                        const anniSelect = beneDiv.querySelector('.bene-anni');
                        const quotaInput = beneDiv.querySelector('.bene-quota');
                        const annoInizioInput = beneDiv.querySelector('.bene-anno-inizio');
                        
                        if (descInput) descInput.value = bene.descrizione || '';
                        if (costoInput) {
                            costoInput.value = bene.costo_totale || 0;
                            aggiornaQuotaAmmortamento(costoInput);
                        }
                        if (anniSelect) {
                            anniSelect.value = bene.anni_ammortamento || 5;
                            setTimeout(() => aggiornaQuotaAmmortamento(costoInput), 10);
                        }
                        if (annoInizioInput) {
                            annoInizioInput.value = bene.anno_inizio || annoCorrente;
                        }
                    }
                }, 50);
            });
        } else {
            // Se non ci sono beni attivi, aggiungi un campo vuoto
            aggiungiBeneDurevole();
        }
    }
    
    // Ricalcola anteprima
    calcolaPrezzoAutomatico();
}

       async function salvaRegistrazioneEconomica() {
    const permissions = getUserPermissions();
    if (!permissions.canManageEconomics) {
        showNotification('Non hai i permessi per gestire i dati economici', 'error');
        return;
    }
    
    const lotId = currentEconomicLotId;
    if (!lotId) {
        showNotification('Seleziona prima un lotto', 'error');
        return;
    }
    
    const editingIdField = document.getElementById('editing-economic-id');
    const editingId = editingIdField ? editingIdField.value : null;
    
    const stagioneAgricola = document.getElementById('stagione-agricola').value;
    const dataAcquistoVendita = document.getElementById('data-acquisto-vendita').value;
    const metodoKg = document.getElementById('metodo-prezzo-kg').checked;
    const prezzoKgValue = parseFloat(document.getElementById('prezzo-acquisto-vendita').value) || 0;
    const prezzoTotaleValue = parseFloat(document.getElementById('prezzo-totale').value) || 0;
    const kgRaccolti = parseFloat(document.getElementById('totale-kg-raccolti').value) || 0;
    // ✅ I 3 costi sono importati dalla sezione Gestione Costi (campi nascosti)
    const costoPersonale = parseFloat(document.getElementById('costo-personale-valore')?.value) || 0;
    const costoMezziTecnici = parseFloat(document.getElementById('costo-mezzi-valore')?.value) || 0;
    const quotaAmmortamento = parseFloat(document.getElementById('costo-ammortamenti-valore')?.value) || 0;
            
    console.log('📊 Dati form:', {
        editingId,
        stagioneAgricola,
        dataAcquistoVendita,
        metodoKg,
        prezzoKgValue,
        prezzoTotaleValue,
        kgRaccolti,
        costoPersonale,
        costoMezziTecnici,
        quotaAmmortamento
    });
    
    // Calcola ricavi
    let prezzoKg, prezzoTotale, ricaviTotali;
    
    if (metodoKg) {
        prezzoKg = prezzoKgValue;
        prezzoTotale = prezzoKg * kgRaccolti;
        ricaviTotali = prezzoTotale;
    } else {
        prezzoTotale = prezzoTotaleValue;
        prezzoKg = kgRaccolti > 0 ? prezzoTotale / kgRaccolti : 0;
        ricaviTotali = prezzoTotale;
    }
    
    // ✅ TOTALE COSTI = personale + mezzi tecnici + quota ammortamento (sorgente: Gestione Costi)
    const costiTotali = costoPersonale + costoMezziTecnici + quotaAmmortamento;
    const bilancio = ricaviTotali - costiTotali;

    console.log('📊 Calcoli:', {
        prezzoKg,
        prezzoTotale,
        ricaviTotali,
        costoPersonale,
        costoMezziTecnici,
        quotaAmmortamento,
        costiTotali,
        bilancio
    });
    
    const registrazione = {
        lot_id: parseInt(lotId),
        stagione_agricola: stagioneAgricola,
        data_acquisto_vendita: dataAcquistoVendita,
        metodo_calcolo: metodoKg ? 'kg' : 'totale',
        prezzo_kg: prezzoKg,
        prezzo_totale: prezzoTotale,
        totale_kg: kgRaccolti,
        ricavi_totali: ricaviTotali,
        costo_personale: costoPersonale,
        costo_mezzi_tecnici: costoMezziTecnici,
        quota_ammortamento: quotaAmmortamento,
        costi_totali: costiTotali,
        bilancio: bilancio
    };

    console.log('🔍 Valori del form:', {
        stagione: document.getElementById('stagione-agricola').value,
        data: document.getElementById('data-acquisto-vendita').value,
        prezzoKg: document.getElementById('prezzo-acquisto-vendita').value,
        kg: document.getElementById('totale-kg-raccolti').value
    });    

    try {
        showSpinner('Salvataggio registrazione...');
        showNotification(editingId ? 'Aggiornamento in corso...' : 'Salvataggio in corso...', 'loading');
        
        const url = editingId ? `/economic/${editingId}` : '/economic';
        const method = editingId ? 'PUT' : 'POST';
        
        console.log(`📤 Invio ${method} a ${url}`, registrazione);
        
        const response = await apiCall(url, {
            method: method,
            body: registrazione
        });
        
        if (response.success) {
            showNotification(
                editingId ? 'Registrazione economica aggiornata con successo!' : 'Registrazione economica salvata con successo!', 
                'success'
            );
            
            if (editingIdField) editingIdField.value = '';
            
            const saveBtn = document.getElementById('save-economic-btn');
            if (saveBtn) saveBtn.textContent = '💾 Salva Registrazione';
            
            await loadRegistrazioniEconomiche(lotId);
            resetFormEconomico();
        } else {
            showNotification(response.error || 'Errore nel salvataggio', 'error');
        }
         hideSpinner();
    } catch (error) {
        console.error('Errore salvataggio:', error);
        showNotification('Errore nel salvataggio: ' + error.message, 'error');
        hideSpinner();
    }
}

async function importaCostiTotaliDaGestioneCosti() {
    const lotId = currentEconomicLotId;
    const stagione = document.getElementById('stagione-agricola').value;
    
    if (!lotId) {
        showNotification('Seleziona prima un lotto dal dropdown', 'error');
        return;
    }
    
    if (!stagione) {
        showNotification('Seleziona prima la stagione agricola', 'error');
        return;
    }
    
    try {
        showNotification('Recupero costi totali dalla sezione Gestione Costi...', 'loading');
        
        // Fetch in parallelo: personale + mezzi tecnici + ammortamenti (beni durevoli)
        const [resPersonale, resMezzi, resEconomic] = await Promise.all([
            apiCall(`/costi/personale/${lotId}/${stagione}`).catch(() => ({ totale: 0 })),
            apiCall(`/costi/mezzi/${lotId}/${stagione}`).catch(() => ({ totale: 0 })),
            apiCall(`/economic/${lotId}`).catch(() => ({ data: [] }))
        ]);
        
        const totalePersonale = resPersonale.totale || 0;
        const totaleMezzi = resMezzi.totale || 0;
        
        // ✅ Ammortamenti: calcola dai beni durevoli ATTIVI in questa stagione (stessa logica di Gestione Costi)
        const allRecords = resEconomic.data || [];
        let totaleAmmortamenti = 0;
        if (typeof caricaBeniDurevoliAttivi === 'function') {
            const beniAttivi = caricaBeniDurevoliAttivi(allRecords, parseInt(stagione));
            totaleAmmortamenti = beniAttivi.reduce((sum, b) => sum + Number(b.quota_annuale || 0), 0);
        }
        
        const totaleCosti = totalePersonale + totaleMezzi + totaleAmmortamenti;
        
        // Popola campi (visibile + nascosti)
        const campoVisibile = document.getElementById('costo-personale');
        document.getElementById('costo-personale-valore').value = totalePersonale.toFixed(2);
        document.getElementById('costo-mezzi-valore').value = totaleMezzi.toFixed(2);
        document.getElementById('costo-ammortamenti-valore').value = totaleAmmortamenti.toFixed(2);
        
        if (totaleCosti === 0) {
            campoVisibile.value = '';
            campoVisibile.placeholder = 'Nessun costo aggiunto';
            showNotification(`⚠️ Nessun costo registrato per la stagione ${stagione} nella sezione Gestione Costi`, 'warning');
        } else {
            campoVisibile.value = `€ ${totaleCosti.toFixed(2)}`;
            showNotification(
                `✅ Costi importati — Personale: €${totalePersonale.toFixed(2)} · Mezzi: €${totaleMezzi.toFixed(2)} · Ammortamenti: €${totaleAmmortamenti.toFixed(2)} · TOTALE: €${totaleCosti.toFixed(2)}`,
                'success'
            );
            
            if (typeof calcolaPrezzoAutomatico === 'function') {
                calcolaPrezzoAutomatico();
            }
        }
    } catch (error) {
        console.error('Errore importazione costi totali:', error);
        showNotification('Errore nel recupero: ' + error.message, 'error');
    }
}

// Backward compat: vecchio nome funzione (potrebbe essere ancora referenziato)
async function importaCostoPersonaleDaGestioneCosti() {
    return importaCostiTotaliDaGestioneCosti();
}

              function resetFormEconomico() {
    // Reset campi base
    document.getElementById('stagione-agricola').value = '';
    document.getElementById('data-acquisto-vendita').value = '';
    document.getElementById('totale-kg-raccolti').value = '';
    // ✅ Reset campo totale costi (visibile + 3 nascosti)
    const cp = document.getElementById('costo-personale');
    if (cp) { cp.value = ''; cp.placeholder = 'Nessun costo aggiunto'; }
    ['costo-personale-valore', 'costo-mezzi-valore', 'costo-ammortamenti-valore'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '0';
    });
    
    // Reset metodo calcolo
    document.getElementById('metodo-prezzo-kg').checked = true;
    document.getElementById('metodo-prezzo-totale').checked = false;
    document.getElementById('prezzo-acquisto-vendita').value = '';
    document.getElementById('prezzo-totale').value = '';
    toggleMetodoCalcolo();
          
    // ✅ PULISCI CAMPO HIDDEN DELL'ID
    const editingIdField = document.getElementById('editing-economic-id');
    if (editingIdField) {
        editingIdField.value = '';
    }
    
    // ✅ RIPRISTINA IL TESTO DEL PULSANTE
    const saveBtn = document.getElementById('save-economic-btn');
    if (saveBtn) {
        saveBtn.textContent = '💾 Salva Registrazione';
    }
    
    // Nascondi anteprima calcolo (se esiste)
    const anteprima = document.getElementById('anteprima-calcolo');
    if (anteprima) {
        anteprima.style.display = 'none';
    }
}

        // ==================== GESTIONE STORICO E BILANCIO ====================
       function displayRegistrazioniEconomiche() {
    const container = document.getElementById('registrazioni-economiche-list');
    const bilancioContainer = document.getElementById('bilancio-container');
    const countBadge = document.getElementById('economia-count');
    
    if (!container) {
        console.log('❌ Container registrazioni-economiche-list non trovato');
        return;
    }
    
    console.log('📊 currentEconomicLotId:', currentEconomicLotId);
    console.log('📊 registrazioniEconomiche totali:', registrazioniEconomiche);
    
    // Filtra per lotto corrente
    const registrazioniFiltrate = registrazioniEconomiche.filter(r => r.lot_id === currentEconomicLotId);
    
    console.log('📊 Registrazioni filtrate per lotto:', registrazioniFiltrate.length);
    
    if (registrazioniFiltrate.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Nessuna registrazione economica</p>';
        if (bilancioContainer) bilancioContainer.style.display = 'none';
        if (countBadge) countBadge.textContent = '0';
        return;
    }
    
    calcolaEBilanciaBilancio(registrazioniFiltrate);
    
    // ✅ HELPER: calcola costi REALI da componenti (single source of truth)
    const costiReali = (r) => Number(r.costo_personale || 0) + Number(r.costo_mezzi_tecnici || 0) + Number(r.quota_ammortamento || 0);
    // ✅ HELPER: registrazione "fantasma" creata da Gestione Costi → solo ammortamenti, no vendita
    const isFantasma = (r) => (Number(r.ricavi_totali || 0) === 0) && (Number(r.totale_kg || 0) === 0) && (Number(r.prezzo_kg || 0) === 0);
    
    // ✅ RAGGRUPPA PER STAGIONE
    const gruppi = {};
    registrazioniFiltrate.forEach(reg => {
        const stagione = reg.stagione_agricola || 'Senza anno';
        if (!gruppi[stagione]) gruppi[stagione] = [];
        gruppi[stagione].push(reg);
    });
    
    // ✅ Ordina le stagioni (dalla più recente)
    const stagioniOrdinate = Object.keys(gruppi).sort((a, b) => {
        if (a === 'Senza anno') return 1;
        if (b === 'Senza anno') return -1;
        return parseInt(b) - parseInt(a);
    });
    
    // ✅ Genera HTML con accordion per stagione
    container.innerHTML = stagioniOrdinate.map((stagione, idx) => {
        const regs = gruppi[stagione];
        // ✅ I record "fantasma" (solo ammortamenti, senza vendita) NON sono mostrati come riga separata.
        //    Le loro quote vengono comunque conteggiate nei totali della stagione tramite costiReali().
        const regsVisibili = regs.filter(r => !isFantasma(r));
        const totaleRicaviStagione = regs.reduce((sum, r) => sum + Number(r.ricavi_totali || 0), 0);
        // Costi: somma da componenti per TUTTI i record (vendite + fantasma per ammortamenti)
        const totaleCostiStagione = regs.reduce((sum, r) => sum + costiReali(r), 0);
        const bilancioStagione = totaleRicaviStagione - totaleCostiStagione;
        
        return `
            <div style="margin-bottom: 15px; border: 2px solid #e0e0e0; border-radius: 12px; overflow: hidden; transition: all 0.3s ease;">
                <!-- HEADER STAGIONE (CLICCABILE) -->
                <div onclick="toggleGruppoStagione(this)" 
                     style="background: linear-gradient(135deg, #4CAF50, #2E7D32); color: white; padding: 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <i class="fas fa-chevron-down gruppo-chevron" style="transition: transform 0.3s ease;"></i>
                        <div>
                            <strong style="font-size: 1.1rem;">📅 Stagione ${stagione}</strong>
                            <br>
                            <small style="opacity: 0.9;">${regs.length} registrazione${regs.length !== 1 ? 'i' : ''}</small>
                            <button onclick="event.stopPropagation(); eliminaStagioneEconomica('${stagione}', ${currentEconomicLotId})" 
        style="background: rgba(255,255,255,0.2); color: white; border: 2px solid rgba(255,255,255,0.5); padding: 8px 15px; border-radius: 20px; cursor: pointer; font-size: 0.85rem; font-weight: bold;"
        title="Elimina tutte le registrazioni di questa stagione">
    <i class="fas fa-trash-alt"></i> Elimina Stagione
</button>
                        </div>
                    </div>
                    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                        <span style="background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 0.9rem;">
                            💰 Ricavi: €${totaleRicaviStagione.toFixed(2)}
                        </span>
                        <span style="background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 0.9rem;">
                            ⚖️ Bilancio: €${bilancioStagione.toFixed(2)}
                        </span>
                    </div>
                </div>
                
                <!-- CONTENUTO STAGIONE (ESPANDIBILE) -->
                <div class="gruppo-content" style="display: ${idx === 0 ? 'block' : 'none'}; padding: 15px; background: #fafafa;">
                    ${regsVisibili.length === 0 ? `
                        <div style="text-align: center; color: #888; padding: 15px; font-style: italic; font-size: 0.9rem;">
                            <i class="fas fa-info-circle"></i>
                            Nessuna vendita registrata in questa stagione (solo quote di ammortamento da beni durevoli — vedi Gestione Costi)
                        </div>
                    ` : ''}
                    ${regsVisibili.map((reg, regIdx) => {
                        // ✅ Blocco "Beni in ammortamento" rimosso: ridondante con lo Storico Beni Durevoli
                        //    presente nella sezione Gestione Costi → Ammortamento Beni Durevoli.
                        const beniDurevoliHtml = '';
                        
                        // ✅ Dettaglio costi UNIVOCO per ogni registrazione (sempre visibile, anche zero)
                        const cpReg = Number(reg.costo_personale || 0);
                        const cmReg = Number(reg.costo_mezzi_tecnici || 0);
                        const caReg = Number(reg.quota_ammortamento || 0);
                        const ctReg = cpReg + cmReg + caReg;
                        const costItems = [];
                        if (cpReg > 0) costItems.push(`<span style="color:#2196F3;">👥 Personale: €${cpReg.toFixed(2)}</span>`);
                        if (cmReg > 0) costItems.push(`<span style="color:#FF9800;">🧪 Mezzi tecnici: €${cmReg.toFixed(2)}</span>`);
                        if (caReg > 0) costItems.push(`<span style="color:#9C27B0;">📦 Ammortamenti: €${caReg.toFixed(2)}</span>`);
                        
                        const costiDettaglio = costItems.length > 0 
                            ? `<div style="font-size: 12px; margin-top: 8px; padding: 8px; background: #fafafa; border-radius: 6px; border-left: 3px solid #f44336;">
                                 <strong style="color:#555;">💸 Dettaglio costi:</strong><br>
                                 ${costItems.join(' &nbsp;·&nbsp; ')}
                                 <br><strong style="color:#f44336;">Totale: €${ctReg.toFixed(2)}</strong>
                               </div>` 
                            : `<div style="font-size: 12px; margin-top: 8px; padding: 6px 10px; background: #f9f9f9; border-radius: 6px; color: #888; font-style: italic;">
                                 💸 Nessun costo aggiunto
                               </div>`;
                        
                        return `
                            <div style="background: white; padding: 12px; margin-bottom: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #eee;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                                    <div style="flex: 1; min-width: 200px;">
                                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                            <strong style="color: #333;">
                                                📅 ${reg.data_acquisto_vendita ? new Date(reg.data_acquisto_vendita).toLocaleDateString('it-IT') : 'N/D'}
                                            </strong>
                                            <span style="background: ${reg.metodo_calcolo === 'kg' ? '#2196F3' : '#FF9800'}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px;">
                                                ${reg.metodo_calcolo === 'kg' ? '€/kg' : '€ tot'}
                                            </span>
                                        </div>
                                        
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 13px;">
                                            <div>
                                                <span style="color: #4CAF50;">📈 Ricavi:</span>
                                                <strong>€${(reg.ricavi_totali || 0).toFixed(2)}</strong>
                                            </div>
                                            <div>
                                                <span style="color: #f44336;">💸 Costi:</span>
                                                <strong>€${ctReg.toFixed(2)}</strong>
                                            </div>
                                            <div>
                                                <span>🌾 Kg:</span>
                                                <strong>${reg.totale_kg || 0}</strong>
                                            </div>
                                            <div>
                                                <span>⚖️ Bilancio:</span>
                                                <strong style="color: ${(Number(reg.ricavi_totali || 0) - ctReg) >= 0 ? '#4CAF50' : '#f44336'};">
                                                    €${(Number(reg.ricavi_totali || 0) - ctReg).toFixed(2)}
                                                </strong>
                                            </div>
                                        </div>
                                        
                                        ${costiDettaglio}
                                        ${beniDurevoliHtml}
                                        
                                        <div style="margin-top: 8px; font-size: 11px; color: #999;">
                                            🕐 Registrato il ${new Date(reg.created_at).toLocaleDateString('it-IT')} da ${reg.created_by || 'Utente'}
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; gap: 5px; align-self: center;">
                                        <button onclick="modificaRegistrazioneEconomica(${reg.id})" 
                                                style="background: #2196F3; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;"
                                                title="Modifica">
                                            ✏️ Modifica
                                        </button>
                                        <button onclick="eliminaRegistrazioneEconomica(${reg.id})" 
                                                style="background: #f44336; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;"
                                                title="Elimina">
                                            🗑️ Elimina
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                    
                    <!-- RIEPILOGO STAGIONE -->
                    <div style="margin-top: 15px; padding: 12px; background: linear-gradient(135deg, #e8f5e9, #c8e6c9); border-radius: 8px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center;">
                        <div>
                            <small style="color: #666;">💰 Ricavi Totali</small>
                            <br>
                            <strong style="color: #4CAF50; font-size: 1.1rem;">€${totaleRicaviStagione.toFixed(2)}</strong>
                        </div>
                        <div>
                            <small style="color: #666;">💸 Costi Totali</small>
                            <br>
                            <strong style="color: #f44336; font-size: 1.1rem;">€${totaleCostiStagione.toFixed(2)}</strong>
                        </div>
                        <div>
                            <small style="color: #666;">⚖️ Bilancio</small>
                            <br>
                            <strong style="color: ${bilancioStagione >= 0 ? '#4CAF50' : '#f44336'}; font-size: 1.1rem;">€${bilancioStagione.toFixed(2)}</strong>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ✅ FUNZIONE TOGGLE GRUPPO STAGIONE
function toggleGruppoStagione(header) {
    const content = header.nextElementSibling;
    const chevron = header.querySelector('.gruppo-chevron');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    } else {
        content.style.display = 'none';
        if (chevron) chevron.style.transform = 'rotate(-90deg)';
    }
}

// ✅ FUNZIONE TOGGLE GRUPPO GIORNALIERO (registri Personale + Mezzi Tecnici)
function toggleGruppoGiornaliero(header) {
    const content = header.nextElementSibling;
    const chevron = header.querySelector('.gruppo-chevron-gp');
    if (!content) return;
    if (content.style.display === 'none') {
        content.style.display = 'block';
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    } else {
        content.style.display = 'none';
        if (chevron) chevron.style.transform = 'rotate(-90deg)';
    }
}

async function eliminaStagioneEconomica(stagione, lotId) {
    // Filtra le registrazioni di questa stagione
    const registrazioniStagione = registrazioniEconomiche.filter(
        r => r.lot_id === lotId && r.stagione_agricola === stagione
    );
    
    if (registrazioniStagione.length === 0) {
        showNotification('Nessuna registrazione da eliminare', 'warning');
        return;
    }
    
    // ✅ CONFERMA DI SICUREZZA
    const messaggio = `⚠️ Sei sicuro di voler eliminare TUTTE le ${registrazioniStagione.length} registrazioni della stagione ${stagione}?\n\nQuesta azione è IRREVERSIBILE!`;
    
    if (!confirm(messaggio)) {
        return;
    }
    
    // Seconda conferma
    if (!confirm(`⚠️ ULTIMA CONFERMA: elimino definitivamente la stagione ${stagione}?`)) {
        return;
    }
    
    try {
        showSpinner('Eliminazione stagione...');
        showNotification(`Eliminazione stagione ${stagione} in corso...`, 'loading');
        
        let eliminati = 0;
        let errori = 0;
        
        for (const reg of registrazioniStagione) {
            try {
                await apiCall(`/economic/${reg.id}`, { method: 'DELETE' });
                eliminati++;
            } catch (error) {
                errori++;
                console.error(`Errore eliminazione record ${reg.id}:`, error);
            }
        }
        
        if (eliminati > 0) {
            showNotification(`✅ Eliminate ${eliminati} registrazioni della stagione ${stagione}!`, 'success');
        }
        if (errori > 0) {
            showNotification(`⚠️ ${errori} registrazioni non sono state eliminate`, 'warning');
        }
        hideSpinner();
        // Ricarica i dati
        await loadRegistrazioniEconomiche(lotId);
        
    } catch (error) {
        console.error('Errore eliminazione stagione:', error);
        showNotification('Errore durante l\'eliminazione: ' + error.message, 'error');
        hideSpinner();
    }
}

        function calcolaEBilanciaBilancio(registrazioni) {
    const bilancioContainer = document.getElementById('bilancio-dettaglio');
    // ✅ Container rimosso (ridondante con sezione "Bilancio & Report"). Se non esiste, no-op.
    if (!bilancioContainer) return;
    
    // ✅ Ricalcola totali da componenti (single source of truth) — niente più discrepanze
    const totaleRicavi = registrazioni.reduce((sum, reg) => sum + Number(reg.ricavi_totali || 0), 0);
    const totalePersonale = registrazioni.reduce((sum, reg) => sum + Number(reg.costo_personale || 0), 0);
    const totaleMezzi = registrazioni.reduce((sum, reg) => sum + Number(reg.costo_mezzi_tecnici || 0), 0);
    const totaleAmmortamenti = registrazioni.reduce((sum, reg) => sum + Number(reg.quota_ammortamento || 0), 0);
    const totaleCosti = totalePersonale + totaleMezzi + totaleAmmortamenti;
    const bilancioFinale = totaleRicavi - totaleCosti;
    
    bilancioContainer.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
            <div style="text-align: center; padding: 15px; background: #E8F5E8; border-radius: 8px;">
                <h5 style="color: #4CAF50; margin: 0 0 5px 0;">💰 Ricavi Totali</h5>
                <p style="font-size: 1.5rem; font-weight: bold; color: #4CAF50;">€${totaleRicavi.toFixed(2)}</p>
            </div>
            <div style="text-align: center; padding: 15px; background: #FFEBEE; border-radius: 8px;">
                <h5 style="color: #f44336; margin: 0 0 5px 0;">💸 Costi Totali</h5>
                <p style="font-size: 1.5rem; font-weight: bold; color: #f44336;">€${totaleCosti.toFixed(2)}</p>
            </div>
            <div style="text-align: center; padding: 15px; background: ${bilancioFinale >= 0 ? '#E8F5E8' : '#FFEBEE'}; border-radius: 8px;">
                <h5 style="color: ${bilancioFinale >= 0 ? '#4CAF50' : '#f44336'}; margin: 0 0 5px 0;">📊 Bilancio Finale</h5>
                <p style="font-size: 1.5rem; font-weight: bold; color: ${bilancioFinale >= 0 ? '#4CAF50' : '#f44336'};">€${bilancioFinale.toFixed(2)}</p>
            </div>
        </div>
        <!-- ✅ BREAKDOWN COSTI (allineato con Gestione Costi) -->
        <div style="margin-top: 15px; padding: 12px; background: #fafafa; border-radius: 8px; border-left: 4px solid #f44336;">
            <h6 style="margin: 0 0 8px 0; color: #555; font-size: 0.9rem;">💸 Dettaglio costi totali</h6>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; font-size: 0.85rem;">
                <div style="padding: 8px; background: white; border-radius: 6px; border-left: 3px solid #2196F3;">
                    <span style="color: #555;">👥 Personale</span><br>
                    <strong style="color: #2196F3;">€${totalePersonale.toFixed(2)}</strong>
                </div>
                <div style="padding: 8px; background: white; border-radius: 6px; border-left: 3px solid #FF9800;">
                    <span style="color: #555;">🧪 Mezzi tecnici</span><br>
                    <strong style="color: #FF9800;">€${totaleMezzi.toFixed(2)}</strong>
                </div>
                <div style="padding: 8px; background: white; border-radius: 6px; border-left: 3px solid #9C27B0;">
                    <span style="color: #555;">📦 Ammortamenti</span><br>
                    <strong style="color: #9C27B0;">€${totaleAmmortamenti.toFixed(2)}</strong>
                </div>
            </div>
        </div>
    `;
}

        async function loadRegistrazioniEconomiche(lotId) {
    try {
        console.log('📊 Caricamento dati economici per lotto:', lotId);
        const response = await apiCall(`/economic/${lotId}`);
        registrazioniEconomiche = response.data || [];
        console.log('✅ Record caricati dal backend:', registrazioniEconomiche);
        displayRegistrazioniEconomiche();
    } catch (error) {
        console.error('Errore caricamento dati economici:', error);
        registrazioniEconomiche = [];
        displayRegistrazioniEconomiche();
    }
}

// Funzione helper per popolare il form economico con i dati di un record
function popolaFormEconomico(record) {
    console.log('📝 Popolamento form con record:', record);
    
    // Imposta ID nascosto per la modifica
    let economicIdField = document.getElementById('editing-economic-id');
    if (!economicIdField) {
        economicIdField = document.createElement('input');
        economicIdField.type = 'hidden';
        economicIdField.id = 'editing-economic-id';
        
        // ✅ CERCA UN CONTAINER VALIDO (più opzioni)
        const container = document.querySelector('#gestione-economica form') || 
                          document.querySelector('#gestione-economica .form-container') ||
                          document.querySelector('#gestione-economica') ||
                          document.getElementById('save-economic-btn')?.parentNode;
        
        if (container) {
            container.appendChild(economicIdField);
            console.log('🆔 Campo hidden aggiunto a:', container.tagName, container.id || '');
        } else {
            document.body.appendChild(economicIdField);
            console.log('🆔 Campo hidden aggiunto a body (fallback)');
        }
    }
    economicIdField.value = record.id;
    console.log('🆔 ID impostato:', economicIdField.value);
    
    // Stagione agricola
    document.getElementById('stagione-agricola').value = record.stagione_agricola || '';
    
    // Data
    if (record.data_acquisto_vendita) {
        const data = record.data_acquisto_vendita.split('T')[0];
        document.getElementById('data-acquisto-vendita').value = data;
    }
    
    // Metodo calcolo
    const metodoCalcolo = record.metodo_calcolo || 'kg';
    if (metodoCalcolo === 'kg') {
        document.getElementById('metodo-prezzo-kg').checked = true;
        document.getElementById('prezzo-acquisto-vendita').value = record.prezzo_kg || 0;
    } else {
        document.getElementById('metodo-prezzo-totale').checked = true;
        document.getElementById('prezzo-totale').value = record.prezzo_totale || 0;
    }
    toggleMetodoCalcolo();
    
    // Kg totali
    document.getElementById('totale-kg-raccolti').value = record.totale_kg || 0;
    
    // ✅ Popola i 3 campi nascosti dei costi + campo visibile totale
    const cp = Number(record.costo_personale || 0);
    const cm = Number(record.costo_mezzi_tecnici || 0);
    const ca = Number(record.quota_ammortamento || 0);
    const totale = cp + cm + ca;
    document.getElementById('costo-personale-valore').value = cp.toFixed(2);
    document.getElementById('costo-mezzi-valore').value = cm.toFixed(2);
    document.getElementById('costo-ammortamenti-valore').value = ca.toFixed(2);
    const campoVisibile = document.getElementById('costo-personale');
    if (campoVisibile) {
        campoVisibile.value = totale > 0 ? `€ ${totale.toFixed(2)}` : '';
        if (totale === 0) campoVisibile.placeholder = 'Nessun costo aggiunto';
    }
    // Compat: vecchio campo (se ancora referenziato altrove)
    const costiMezziInput = document.getElementById('costo-mezzi-tecnici');
    if (costiMezziInput) costiMezziInput.value = cm;
    
        // ✅ NUOVO POPOLAMENTO BENI DUREVOLI CON AMMORTAMENTO
    const container = document.getElementById('beni-durevoli-container');
    if (container) {
        container.innerHTML = '';
    }
    beniDurevoliCount = 0;
    
    let beniDurevoli = [];
    if (record.beni_durevoli) {
        try {
            beniDurevoli = typeof record.beni_durevoli === 'string' 
                ? JSON.parse(record.beni_durevoli) 
                : record.beni_durevoli;
        } catch (e) {
            console.error('Errore parsing beni durevoli:', e);
            beniDurevoli = [];
        }
    }
    
    if (Array.isArray(beniDurevoli) && beniDurevoli.length > 0) {
        beniDurevoli.forEach(bene => {
            // Aggiungi un nuovo bene durevole per ogni record salvato
            aggiungiBeneDurevole();
            const lastIdx = beniDurevoliCount;
            
            // Usa setTimeout per dare tempo al DOM di aggiornarsi
            setTimeout(() => {
                const beneDiv = document.querySelector(`.bene-durevole-item[data-index="${lastIdx}"]`);
                if (beneDiv) {
                    const descInput = beneDiv.querySelector('.bene-desc');
                    const costoInput = beneDiv.querySelector('.bene-costo');
                    const anniSelect = beneDiv.querySelector('.bene-anni');
                    const quotaInput = beneDiv.querySelector('.bene-quota');
                    const annoInizioInput = beneDiv.querySelector('.bene-anno-inizio');
                    
                    if (descInput) descInput.value = bene.descrizione || '';
                    if (costoInput) {
                        costoInput.value = bene.costo_totale || 0;
                        // Trigger aggiornamento quota
                        aggiornaQuotaAmmortamento(costoInput);
                    }
                    if (anniSelect) {
                        anniSelect.value = bene.anni_ammortamento || 5;
                        // Ri-aggiorna quota dopo aver impostato gli anni
                        setTimeout(() => aggiornaQuotaAmmortamento(costoInput), 10);
                    }
                    if (annoInizioInput) {
                        annoInizioInput.value = bene.anno_inizio || new Date().getFullYear();
                    }
                }
            }, 50);
        });
    } else {
        // Se non ci sono beni salvati, aggiungi un campo vuoto
        aggiungiBeneDurevole();
    }

    // Cambia il pulsante di salvataggio
    const saveBtn = document.getElementById('save-economic-btn');
    if (saveBtn) {
        saveBtn.textContent = '🔄 Aggiorna Registrazione';
    }
    
    // ✅ VERIFICA FINALE
    console.log('🔍 Verifica finale - campo hidden:', {
        element: document.getElementById('editing-economic-id'),
        value: document.getElementById('editing-economic-id')?.value
    });
    
    // Scrolla al form
    document.querySelector('#gestione-economica .form-container')?.scrollIntoView({ behavior: 'smooth' });
}

       async function modificaRegistrazioneEconomica(registrazioneId) {
    // Controlla i permessi
    const permissions = getUserPermissions();
    if (!permissions.canEditLots) {
        showNotification('Non hai i permessi per modificare registrazioni economiche', 'error');
        return;
    }
    
    console.log('🔧 Modifica registrazione economica ID:', registrazioneId);
    
    try {
        showNotification('Caricamento dati in corso...', 'loading');
        
        // ✅ CHIAMA L'API PER RECUPERARE I DATI AGGIORNATI
        const response = await apiCall(`/economic/record/${registrazioneId}`);
        const record = response.data;
        
        if (!record) {
            showNotification('Registrazione non trovata', 'error');
            return;
        }
        
        console.log('✅ Record caricato:', record);
        
        // Popola il form
        popolaFormEconomico(record);
        
        showNotification('Modifica la registrazione e salva le modifiche', 'info');
        
    } catch (error) {
        console.error('Errore caricamento registrazione:', error);
        showNotification('Errore nel caricamento dei dati: ' + error.message, 'error');
    }
}

        async function eliminaRegistrazioneEconomica(registrazioneId, showConfirm = true) {
    const permissions = getUserPermissions();
    if (!permissions.canEditLots) {
        showNotification('Non hai i permessi per eliminare registrazioni economiche', 'error');
        return;
    }
    
    if (showConfirm && !confirm('Sei sicuro di voler eliminare questa registrazione economica?')) {
        return;
    }
    
    try {
        showNotification('Eliminazione in corso...', 'loading');
        
        // Elimina dal backend
        const response = await apiCall(`/economic/${registrazioneId}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showNotification('Registrazione economica eliminata', 'success');
            // Ricarica i dati dal backend
            await loadRegistrazioniEconomiche(currentEconomicLotId);
        } else {
            showNotification(response.error || 'Errore durante l\'eliminazione', 'error');
        }
    } catch (error) {
        console.error('Errore eliminazione:', error);
        showNotification('Errore durante l\'eliminazione: ' + error.message, 'error');
    }
}

        // ==================== INIZIALIZZAZIONE ====================
        function initGestioneEconomica() {
            const dropdownMenu = document.getElementById('economic-lot-dropdown-menu');
            if (!dropdownMenu || allLots.length === 0) return;
            
            dropdownMenu.innerHTML = '';
            
            allLots.forEach((lot, index) => {
                const dropdownItem = document.createElement('button');
                dropdownItem.className = 'dropdown-item';
                dropdownItem.type = 'button';
                dropdownItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <div>
                            <strong>${lot.company_name}</strong><br>
                            <small>${lot.location} - ${lot.variety}</small>
                        </div>
                        <span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">
                            ${lot.product_type}
                        </span>
                    </div>
                `;
                
                dropdownItem.addEventListener('click', () => {
                    loadEconomicLotDetails(lot.id);
                    dropdownMenu.classList.remove('show');
                });
                
                dropdownMenu.appendChild(dropdownItem);
            });
        }

        // ==================== FUNZIONI RICERCA E FILTRI ====================
       function filterLots() {
    const searchText = document.getElementById('search-lots').value.toLowerCase().trim();
    
    if (!searchText) {
        displayLots(allLots);
        updateSearchStats(allLots.length, allLots.length);
        return;
    }
    
    const filteredLots = allLots.filter(lot => {
        // ✅ PROTEZIONE DA NULL/UNDEFINED
        const companyName = (lot.company_name || '').toLowerCase();
        const location = (lot.location || '').toLowerCase();
        const variety = (lot.variety || '').toLowerCase();
        const productCategory = (lot.product_category || '').toLowerCase();
        const fieldLot = (lot.field_lot || '').toLowerCase();
        const productType = (lot.product_type || '').toLowerCase();
        const id = String(lot.id || '');
        
        return companyName.includes(searchText) ||
               location.includes(searchText) ||
               variety.includes(searchText) ||
               productCategory.includes(searchText) ||
               fieldLot.includes(searchText) ||
               productType.includes(searchText) ||
               id.includes(searchText);
    });
    
    displayLots(filteredLots);
    updateSearchStats(filteredLots.length, allLots.length);
}

        function updateSearchStats(shown, total) {
            let statsElement = document.getElementById('search-stats');
            
            if (!statsElement) {
                statsElement = document.createElement('div');
                statsElement.id = 'search-stats';
                statsElement.className = 'search-stats';
                document.getElementById('search-lots').parentNode.appendChild(statsElement);
            }
            
            if (shown === total) {
                statsElement.innerHTML = `Mostrati tutti ${total} lotti`;
            } else {
                statsElement.innerHTML = `Mostrati ${shown} di ${total} lotti`;
            }
        }

        // ==================== ESPORTAZIONE EXCEL COMPLETA ====================
        async function exportToExcel() {
            // Controlla i permessi
            const permissions = getUserPermissions();
            if (!permissions.canExportData) {
                showNotification('Non hai i permessi per esportare dati', 'error');
                return;
            }
            
            if (!allLots || allLots.length === 0) {
                showNotification('Nessun dato da esportare', 'warning');
                return;
            }
            
            try {
                showNotification('Generazione file Excel con tutti i dati...', 'loading');
                
                const workbook = XLSX.utils.book_new();
                
                const lotsData = prepareLotsData();
                const worksheetLots = XLSX.utils.json_to_sheet(lotsData);
                XLSX.utils.book_append_sheet(workbook, worksheetLots, "Lotti Base");
                
                const activitiesData = await prepareActivitiesData();
                if (activitiesData.length > 0) {
                    const worksheetActivities = XLSX.utils.json_to_sheet(activitiesData);
                    XLSX.utils.book_append_sheet(workbook, worksheetActivities, "Attività Raccolta");
                }
                
                const analysesData = await prepareAnalysesData();
                if (analysesData.length > 0) {
                    const worksheetAnalyses = XLSX.utils.json_to_sheet(analysesData);
                    XLSX.utils.book_append_sheet(workbook, worksheetAnalyses, "Analisi");
                }
                
                const economicData = await prepareEconomicData();
                if (economicData.length > 0) {
                    const worksheetEconomic = XLSX.utils.json_to_sheet(economicData);
                    XLSX.utils.book_append_sheet(workbook, worksheetEconomic, "Gestione Economica");
                }
                
                const summaryData = prepareEconomicSummary(economicData);
                if (summaryData.length > 0) {
                    const worksheetSummary = XLSX.utils.json_to_sheet(summaryData);
                    XLSX.utils.book_append_sheet(workbook, worksheetSummary, "Riepilogo Economico");
                }
                
                const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
                saveAsExcelFile(excelBuffer, `cropbook_completo_${new Date().toISOString().split('T')[0]}.xlsx`);
                
                showNotification('File Excel generato con successo!', 'success');
                
            } catch (error) {
                console.error('Errore esportazione Excel:', error);
                showNotification('Errore nella generazione del file Excel', 'error');
            }
        }

        function prepareLotsData() {
    return allLots.map(lot => {
        console.log('Lotto per Excel:', lot); // DEBUG
        
        return {
            'ID Lotto': lot.id,
            'Azienda': lot.company_name,
            'Luogo': lot.location,
            'Tipo Prodotto': lot.product_type,
            'Prodotto': lot.product_category || (lot.product_category === '' ? '' : 'N/D'), // CORREZIONE
            'Varietà': lot.variety || (lot.variety === '' ? '' : 'N/D'),
            'Lotto Campo': lot.field_lot || '',
            'Superficie (ettari)': lot.field_size || '',
            'Coordinate GPS': lot.gps_coordinates,
            'Data Creazione': new Date(lot.created_at).toLocaleDateString('it-IT'),
            'Note': getLotNotes(lot.id) || ''
        };
    });
}

        async function prepareActivitiesData() {
    const allActivities = [];
    
    for (const lot of allLots) {
        const activities = getLotActivitiesFromStorage(lot.id);
        activities.forEach(activity => {
            allActivities.push({
                'ID Lotto': lot.id,
                'Azienda': lot.company_name,
                'Tipo Prodotto': lot.product_type,
                'Prodotto': lot.product_category || '', // NUOVO CAMPO
                'Varietà': lot.variety || '', // CAMPO ORA OPZIONALE
                'Data Raccolta': new Date(activity.date).toLocaleDateString('it-IT'),
                'Kg Raccolti': activity.kg,
                'Note Raccolta': activity.notes || '',
                'Data Registrazione': new Date(activity.createdAt).toLocaleDateString('it-IT'),
                'Registrato da': activity.createdBy || 'Utente'
            });
        });
    }
    
    return allActivities;
}

        async function prepareAnalysesData() {
    const allAnalyses = [];
    
    for (const lot of allLots) {
        const analyses = getLotAnalysesFromStorage(lot.id);
        analyses.forEach(analysis => {
            allAnalyses.push({
                'ID Lotto': lot.id,
                'Azienda': lot.company_name,
                'Tipo Prodotto': lot.product_type,
                'Prodotto': lot.product_category || '', // NUOVO CAMPO
                'Varietà': lot.variety || '', // CAMPO ORA OPZIONALE
                'Anno Riferimento': analysis.year,
                'Nome File': analysis.originalName,
                'Note Analisi': analysis.notes || '',
                'Dimensione File': analysis.fileSize,
                'Data Caricamento': new Date(analysis.uploadDate).toLocaleDateString('it-IT'),
                'Caricato da': analysis.uploadedBy || 'Utente'
            });
        });
    }
    
    return allAnalyses;
}

        async function prepareEconomicData() {
    const allEconomic = [];
    const savedRegistrations = localStorage.getItem('agriManager_registrazioni_economiche');
    
    if (savedRegistrations) {
        const registrazioniEconomiche = JSON.parse(savedRegistrations);
        
        for (const reg of registrazioniEconomiche) {
            const lot = allLots.find(l => l.id === reg.lotId);
            if (lot) {
                allEconomic.push({
                    'ID Lotto': reg.lotId,
                    'Azienda': lot.company_name,
                    'Tipo Prodotto': lot.product_type,
                    'Prodotto': lot.product_category || '',
                    'Varietà': lot.variety || '',
                    'Stagione Agricola': reg.stagioneAgricola,
                    'Data Acquisto/Vendita': new Date(reg.dataAcquistoVendita).toLocaleDateString('it-IT'),
                    'Metodo Calcolo': reg.metodoCalcolo === 'kg' ? 'Prezzo al kg' : 'Prezzo totale',
                    'Prezzo (€/kg)': reg.prezzoKg,
                    'Prezzo Totale (€)': reg.prezzoTotale,
                    'Kg Raccolti': reg.totaleKg,
                    'Ricavi Totali (€)': reg.ricaviTotali,
                    'Costo Mezzi Tecnici (€)': reg.costoMezziTecnici,
                    'Costo Personale (€)': reg.costoPersonale,
                    'Costo Beni Durevoli (€)': reg.beniDurevoli.reduce((sum, bene) => sum + (bene.costo || 0), 0),
                    'Costi Totali (€)': reg.costiTotali,
                    'Bilancio (€)': reg.bilancio,
                    'Beni Durevoli': reg.beniDurevoli.map(b => `${b.descrizione} (€${b.costo})`).join('; '),
                    'Data Registrazione': new Date(reg.createdAt).toLocaleDateString('it-IT'),
                    'Registrato da': reg.createdBy || 'Utente'
                });
            }
        }
    }
    
    return allEconomic;
}

        function prepareEconomicSummary(economicData) {
    const summaryMap = new Map();
    
    economicData.forEach(reg => {
        const key = `${reg['ID Lotto']}-${reg['Stagione Agricola']}`;
        if (!summaryMap.has(key)) {
            summaryMap.set(key, {
                'ID Lotto': reg['ID Lotto'],
                'Azienda': reg['Azienda'],
                'Tipo Prodotto': reg['Tipo Prodotto'],
                'Prodotto': reg['Prodotto'], // NUOVO CAMPO
                'Varietà': reg['Varietà'], // CAMPO ORA OPZIONALE
                'Stagione Agricola': reg['Stagione Agricola'],
                'Ricavi Totali (€)': 0,
                'Costi Totali (€)': 0,
                'Bilancio (€)': 0,
                'Numero Registrazioni': 0
            });
        }
        
        const summary = summaryMap.get(key);
        summary['Ricavi Totali (€)'] += reg['Ricavi Totali (€)'] || 0;
        summary['Costi Totali (€)'] += reg['Costi Totali (€)'] || 0;
        summary['Bilancio (€)'] += reg['Bilancio (€)'] || 0;
        summary['Numero Registrazioni'] += 1;
    });
    
    return Array.from(summaryMap.values());
}

        function getLotActivitiesFromStorage(lotId) {
            const saved = localStorage.getItem(`agriManager_activities_${lotId}`);
            return saved ? JSON.parse(saved) : [];
        }

        function getLotAnalysesFromStorage(lotId) {
            const saved = localStorage.getItem(`agriManager_analyses_${lotId}`);
            return saved ? JSON.parse(saved) : [];
        }

        function getLotNotes(lotId) {
            return '';
        }

        function saveAsExcelFile(buffer, fileName) {
            try {
                const data = new Blob([buffer], { 
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
                });
                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(data);
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                console.log('File Excel scaricato:', fileName);
            } catch (error) {
                console.error('Errore nel salvataggio del file Excel:', error);
                showNotification('Errore nel download del file Excel', 'error');
            }
        }

        function addExportButton() {
            const listaSection = document.getElementById('lista-section');
            if (!listaSection) return;
            
            const title = listaSection.querySelector('.section-title');
            if (!title) return;
            
            const existingBtn = document.getElementById('export-excel-btn');
            if (existingBtn) {
                existingBtn.remove();
            }
            
            const exportBtn = document.createElement('button');
            exportBtn.id = 'export-excel-btn';
            exportBtn.className = 'btn btn-primary';
            exportBtn.style.marginLeft = '15px';
            exportBtn.innerHTML = '<i class="fas fa-file-excel"></i> Esporta Excel Completo';
            exportBtn.onclick = exportToExcel;
            
            title.appendChild(exportBtn);
        }

        // ==================== FUNZIONI PRINCIPALI ====================
       function showSection(sectionId) {
    const permissions = getUserPermissions();
    
    if (sectionId === 'registrazione-section' && !permissions.canCreateLots) {
        showNotification('Non hai i permessi per creare nuovi lotti', 'error');
        return;
    }
    
    if (sectionId === 'dettagli-section' && !permissions.canAccessDetails) {
        showNotification('Non hai i permessi per accedere alla sezione Dettagli Lotti', 'error');
        return;
    }
    
    if (sectionId === 'gestione-economica-section' && !permissions.canAccessEconomic) {
        showNotification('Non hai i permessi per accedere alla sezione Gestione Economica', 'error');
        return;
    }
    
    if (sectionId === 'gestione-costi-section' && !permissions.canAccessCosts) {
        showNotification('Non hai i permessi per accedere alla sezione Gestione Costi', 'error');
        return;
    }

    if (sectionId === 'bilancio-section' && !permissions.canAccessBilancio) {
        showNotification('Non hai i permessi per accedere alla sezione Bilancio & Report', 'error');
        return;
    }

    if (sectionId === 'user-management-section' && !permissions.canManageUsers) {
        showNotification('Non hai i permessi per gestire gli utenti', 'error');
        return;
    }
    
    if (isMobileDevice()) {
        // Scroll all'inizio della sezione, ma senza smooth (causa scatti su Android).
        // Usiamo scroll diretto + requestAnimationFrame per attendere il rendering della sezione.
        requestAnimationFrame(() => {
            window.scrollTo(0, 0);
        });
    }
    
    // Rimuovi classe 'active' da TUTTE le sezioni e pulisci stili inline
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
        section.style.display = '';
    });
    
    // Mostra la sezione richiesta
const targetSection = document.getElementById(sectionId);
if (targetSection) {
    targetSection.classList.add('active');
    
    // ✅ Fix sezione utenti: NON usare cssText, solo classe e display base
    if (sectionId === 'user-management-section') {
        targetSection.style.display = 'block';
        targetSection.style.minHeight = '300px';
        // ❌ RIMUOVI targetSection.style.cssText = '...'
    }
    
    addHomeButton(targetSection, sectionId);
}
    
    // Nascondi il menu principale
    const mainMenu = document.querySelector('.main-menu');
    if (mainMenu) {
        mainMenu.style.display = (sectionId === 'home') ? 'grid' : 'none';
    }
    
    // Gestisci storico economico
    const storico = document.querySelector('.section-storico-economico');
    if (storico) {
        storico.style.display = (sectionId === 'gestione-economica-section') ? '' : 'none';
    }

    // ✅ Gestisci sezione utenti (nascondi quando non è attiva)
const sezioneUtenti = document.getElementById('user-management-section');
if (sezioneUtenti && sectionId !== 'user-management-section') {
    sezioneUtenti.style.display = 'none';
    sezioneUtenti.classList.remove('active');
}

    handleSectionSpecificActions(sectionId);
    
    // ✅ Aggiorna lo stato visuale dei pulsanti di navigazione inter-sezione
    if (typeof updateSectionNavState === 'function') {
        updateSectionNavState(sectionId);
    }
}

// ==================== GESTIONE AZIONI SPECIFICHE SEZIONI ====================
function handleSectionSpecificActions(sectionId) {
    switch(sectionId) {
        case 'aziende-section':
            loadAziendeDashboard();
            break;
        case 'lista-section':
            loadLots();
            break;
        case 'registrazione-section':
            // ✅ Popola dropdown aziende quando si entra nel form
            if (typeof loadCompaniesIntoSelect === 'function') loadCompaniesIntoSelect();
            break;
        case 'gestione-economica-section':
            initGestioneEconomica();
            break;
        case 'gestione-costi-section':  // ✅ AGGIUNGI QUESTO CASO
            initGestioneCosti();
            break;
        case 'dettagli-section':
            setTimeout(() => {
                if (allLots && allLots.length > 0) {
                    populateDropdownMenu();
                }
            }, 100);
            break;
            case 'bilancio-section':
    initBilancioSection();
    break;
        case 'user-management-section':
            loadUserManagement();
            break;
        case 'home':
            document.querySelector('.main-menu').style.display = 'grid';
            break;
    }
}

function addHomeButton(section, sectionId) {
    // ✅ Pulsante home ora è nell'header (icona). Niente più bottone in-section.
    // Manteniamo questa funzione solo per compatibilità + miglioria del header sezione.
    const headerHomeBtn = document.getElementById('header-home-btn');
    if (headerHomeBtn) {
        headerHomeBtn.style.display = (sectionId === 'home') ? 'none' : 'inline-flex';
    }
    if (sectionId === 'home') return;

    // Rimuovi eventuali vecchi bottoni "Torna alla home" creati in precedenza
    const oldBtn = section.querySelector('.nav-home-btn');
    if (oldBtn) oldBtn.remove();
    const oldNav = section.querySelector('.section-nav-controls');
    if (oldNav && !oldNav.children.length) oldNav.remove();

    enhanceSectionHeader(section, sectionId);
}

// Wrapper goHome per il bottone nell'header
function goHome() {
    const storico = document.querySelector('.section-storico-economico');
    if (storico) storico.style.display = 'none';
    showHome();
}

function enhanceSectionHeader(section, sectionId) {
    const sectionTitle = section.querySelector('.section-title');
    if (sectionTitle && !sectionTitle.classList.contains('enhanced')) {
        const originalHTML = sectionTitle.innerHTML;
        const newHeader = document.createElement('div');
        newHeader.className = 'section-header-enhanced';
        newHeader.innerHTML = `
            <div class="section-title-icon">
                <i class="${getSectionIcon(sectionId)}"></i>
            </div>
            <h2 class="section-title enhanced">${originalHTML}</h2>
        `;
        sectionTitle.parentNode.replaceChild(newHeader, sectionTitle);
    }
}

function getSectionIcon(sectionId) {
    const icons = {
        'registrazione-section': 'fas fa-clipboard-list',
        'lista-section': 'fas fa-list', 
        'dettagli-section': 'fas fa-info-circle',
        'gestione-economica-section': 'fas fa-chart-line',
        'user-management-section': 'fas fa-users-cog'
    };
    return icons[sectionId] || 'fas fa-folder';
}

function showHome() {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
        section.style.display = '';
        // ✅ Rimuovi anche minHeight residuo
        section.style.minHeight = '';
    });
    
    document.getElementById('main-menu').style.display = 'grid';
    
    const homeSection = document.getElementById('home-section');
    if (homeSection) {
        homeSection.style.display = 'block';
        homeSection.classList.add('active');
    }
}

        async function loadLots(page = 1) {
    try {
        showSpinner('Caricamento lotti...');  // ✅ MOSTRA SPINNER
        
        const url = `${API_BASE_URL}/lots?page=${page}&limit=${itemsPerPage}`;
        const response = await apiCall(url);
        
        allLots = response.data || [];
        lotsPagination = response.pagination;
        
        // Aggiorna variabili globali
        currentLotsPage = lotsPagination.currentPage;
        totalLotsPages = lotsPagination.totalPages;
        
        // Aggiorna UI paginazione
        updatePaginationUI();
        
        // Aggiorna contatore
        const countBadge = document.getElementById('lotti-count');
        if (countBadge) {
            countBadge.textContent = `${lotsPagination.totalItems} totale`;
        }
        
        // Mostra i lotti
        displayLots(allLots);
        
         hideSpinner();  // ✅ NASCONDI SPINNER
                       
    } catch (error) {
        hideSpinner();  // ✅ NASCONDI ANCHE IN CASO DI ERRORE
        console.error('Errore caricamento lotti:', error);
        showNotification('Errore nel caricamento lotti', 'error');
    }
}

function updatePaginationUI() {
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const currentPageSpan = document.getElementById('current-page');
    const totalPagesSpan = document.getElementById('total-pages');
    
    if (currentPageSpan) currentPageSpan.textContent = currentLotsPage;
    if (totalPagesSpan) totalPagesSpan.textContent = totalLotsPages;
    
    if (prevBtn) prevBtn.disabled = !lotsPagination.hasPrevPage;
    if (nextBtn) nextBtn.disabled = !lotsPagination.hasNextPage;
}

async function loadLotsPage(direction) {
    let newPage = currentLotsPage;
    
    if (direction === 'prev' && lotsPagination.hasPrevPage) {
        newPage = lotsPagination.prevPage;
    } else if (direction === 'next' && lotsPagination.hasNextPage) {
        newPage = lotsPagination.nextPage;
    }
    
    if (newPage !== currentLotsPage) {
        await loadLots(newPage);
    }
}

function changeItemsPerPage() {
    const select = document.getElementById('items-per-page');
    itemsPerPage = parseInt(select.value);
    loadLots(1); // Ricarica dalla prima pagina
}

        async function saveLot() {
    // Controlla i permessi
    const permissions = getUserPermissions();
    if (!permissions.canCreateLots) {
        showNotification('Non hai i permessi per creare nuovi lotti', 'error');
        return;
    }
    
    if (!validateLotForm()) {
        showNotification('Correggi gli errori nel form prima di salvare', 'error');
        return;
    }
    
    // ✅ Determina azienda (esistente o nuova inline)
    const companySelectValue = document.getElementById('company-select')?.value || '';
    let companyId = null;
    let companyName = '';
    if (companySelectValue && companySelectValue !== '__new__') {
        // Azienda esistente selezionata
        companyId = parseInt(companySelectValue);
        const opt = document.querySelector(`#company-select option[value="${companySelectValue}"]`);
        companyName = opt ? opt.textContent.trim() : '';
    } else if (companySelectValue === '__new__') {
        // Crea prima la nuova azienda
        const newName = (document.getElementById('company-name')?.value || '').trim();
        if (!newName || newName.length < 2) {
            showNotification('Inserisci la ragione sociale della nuova azienda', 'error');
            return;
        }
        const sectorsChecked = Array.from(document.querySelectorAll('#company-sectors-checkboxes input:checked')).map(cb => cb.value);
        const address = (document.getElementById('company-address')?.value || '').trim();
        try {
            showNotification('Creazione azienda...', 'loading');
            const cResp = await apiCall('/companies', {
                method: 'POST',
                body: { name: newName, sectors: sectorsChecked, address }
            });
            companyId = cResp.data.id;
            companyName = cResp.data.name;
        } catch (err) {
            showNotification(`Errore creazione azienda: ${err.message}`, 'error');
            return;
        }
    } else {
        showNotification('Seleziona un\'azienda o creane una nuova', 'error');
        return;
    }
    
    const productCategory = document.getElementById('product-category').value;
    const customProduct = document.getElementById('custom-product').value;
    
    // Determina il prodotto finale
    let finalProduct = '';
    if (productCategory === 'altri' && customProduct.trim()) {
        finalProduct = customProduct.trim();
    } else if (productCategory && productCategory !== 'altri') {
        finalProduct = productCategory;
    }
    
    const lottoData = {
        company_id: companyId,
        company_name: companyName,
        location: document.getElementById('location').value.trim(),
        gps_coordinates: document.getElementById('gps-coordinates').value.trim(),
        product_type: document.getElementById('product-type').value,
        product_category: finalProduct,
        variety: document.getElementById('variety').value.trim(),
        field_lot: document.getElementById('field-lot').value.trim(),
        field_size: parseFloat(document.getElementById('field-size').value) || 0,
        createdBy: currentUser.username
    };

    try {
        showNotification('Salvataggio in corso...', 'loading');
        
        const response = await apiCall('/lots', {
            method: 'POST',
            body: lottoData
        });
        
        // Reset del form
        document.getElementById('company-select').value = '';
        const ncf = document.getElementById('new-company-form');
        if (ncf) ncf.style.display = 'none';
        const cn = document.getElementById('company-name'); if (cn) cn.value = '';
        const ca = document.getElementById('company-address'); if (ca) ca.value = '';
        document.querySelectorAll('#company-sectors-checkboxes input:checked').forEach(cb => cb.checked = false);
        document.getElementById('location').value = '';
        document.getElementById('gps-coordinates').value = '';
        document.getElementById('product-type').value = '';
        document.getElementById('product-category').innerHTML = '<option value="">Seleziona prima la tipologia</option>';
        document.getElementById('custom-product').value = '';
        document.getElementById('custom-product-container').style.display = 'none';
        document.getElementById('variety').value = '';
        document.getElementById('field-lot').value = '';
        document.getElementById('field-size').value = '';
        
        showNotification(`✅ Lotto creato con ID: ${response.data.id}`, 'success');
        // Refresh dropdown aziende per riflettere nuovi conteggi
        if (typeof loadCompaniesIntoSelect === 'function') loadCompaniesIntoSelect();
        
        if (document.getElementById('lista-section').classList.contains('active')) {
            loadLots();
        }
        if (document.getElementById('aziende-section')?.classList.contains('active')) {
            if (typeof loadAziendeDashboard === 'function') loadAziendeDashboard();
        }
    } catch (error) {
        console.error('Errore salvataggio:', error);
        showNotification(`❌ Errore: ${error.message}`, 'error');
    }
}

        async function saveLotDetails() {
            showNotification('Le informazioni di base del lotto sono già salvate. Usa le sezioni specifiche per aggiungere attività di raccolta o analisi.', 'info');
        }

        function displayLots(lots) {
    const lotsList = document.getElementById('lots-list');
    lotsList.innerHTML = '';
    
    if (lots.length === 0) {
        if (allLots.length === 0) {
            lotsList.innerHTML = '<div class="lotto-item">Nessun lotto registrato</div>';
        } else {
            lotsList.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <h4>Nessun risultato trovato</h4>
                    <p>Prova con termini di ricerca diversi</p>
                </div>
            `;
        }
        return;
    }
    
    const permissions = getUserPermissions();
    
    lots.forEach(lot => {
        const lotItem = document.createElement('div');
        lotItem.className = 'lotto-item';
        
        // Costruisci le informazioni del prodotto
        let productInfo = '';
if (lot.product_category && lot.product_category.trim() !== '') {
    productInfo = ` - ${lot.product_category}`;
}
if (lot.variety && lot.variety.trim() !== '') {
    if (productInfo) {
        productInfo += ` (${lot.variety})`;
    } else {
        productInfo = ` - ${lot.variety}`;
    }
}
        
        lotItem.innerHTML = `
    <div class="lotto-info">
        <h3>${lot.company_name}</h3>
        <p>
            <i class="fas fa-map-marker-alt"></i> ${lot.location} - 
            <strong>${lot.product_type}</strong>
            ${lot.product_category ? ` - ${lot.product_category}` : ''}
            ${lot.variety ? ` (${lot.variety})` : ''}
        </p>
        ${lot.field_lot ? `<p><i class="fas fa-map"></i> Lotto: ${lot.field_lot}</p>` : ''}
        ${lot.field_size ? `<p><i class="fas fa-ruler-combined"></i> Superficie: ${lot.field_size} ettari</p>` : ''}
        <small>ID: ${lot.id} - Creato: ${new Date(lot.created_at).toLocaleDateString()} da ${lot.createdBy || 'Utente'}</small>
    </div>
            <div class="lotto-actions">
               <div class="action-btn" onclick="navigateToLot('${lot.gps_coordinates}')" title="Naviga su Maps" style="background: #4CAF50; color: white; border-color: #4CAF50;">
    <i class="fas fa-directions"></i>
</div>
<div class="action-btn" onclick="addGPSLater(${lot.id})" title="Aggiungi coordinate GPS" style="background: #FF9800; color: white; border-color: #FF9800;">
    <i class="fas fa-map-marker-alt"></i>
</div>
                <div class="action-btn" onclick="loadLotDetails(${lot.id})" title="Vedi dettagli completi" style="background: #2196F3; color: white; border-color: #2196F3;">
    <i class="fas fa-chart-bar"></i>
</div>
                <div class="action-btn" onclick="goToEconomicManagement(${lot.id})" title="Gestione Economica" style="background: #9C27B0; color: white; border-color: #9C27B0;">
                    <i class="fas fa-euro-sign"></i>
                </div>
                <div class="action-btn" onclick="showSection('gestione-costi-section'); setTimeout(() => loadCostiLotDetails(${lot.id}), 300);" title="Gestione Costi" style="background: #FF5722;">
                    <i class="fas fa-wallet"></i>
</div>
                ${permissions.canEditLots ? `
                <div class="action-btn" onclick="editFieldLot(${lot.id})" title="Modifica lotto campo">
                    <i class="fas fa-edit"></i>
                </div>
                ` : ''}
                ${permissions.canDeleteLots ? `
                <div class="action-btn" onclick="deleteLot(${lot.id})" title="Elimina lotto">
                    <i class="fas fa-trash"></i>
                </div>
                ` : ''}
            </div>
        `;
        lotsList.appendChild(lotItem);
    });
}

        function goToEconomicManagement(lotId) {
            console.log('Apertura gestione economica per lotto:', lotId);
            
            if (!allLots || allLots.length === 0) {
                loadLots().then(() => {
                    openEconomicManagement(lotId);
                });
            } else {
                openEconomicManagement(lotId);
            }
        }

        function openEconomicManagement(lotId) {
    const lot = allLots.find(l => l.id === parseInt(lotId));
    if (!lot) {
        showNotification('Lotto non trovato', 'error');
        return;
    }
    
    showSection('gestione-economica-section');
    if (typeof syncActiveLotId === 'function') syncActiveLotId(lotId);
    
    loadEconomicLotDetails(lotId);
    
    const dropdownToggle = document.querySelector('#economicLotDropdown');
    if (dropdownToggle) {
        dropdownToggle.innerHTML = `<i class="fas fa-list"></i> ${lot.company_name}`;
    }
    
    // ✅ CORREZIONE: Assicura che la sezione economica sia completamente visibile
    setTimeout(() => {
        const economicSection = document.querySelector('.section-economica .section-content');
        if (economicSection) {
            economicSection.style.maxHeight = 'none';
            economicSection.style.overflowY = 'visible';
            economicSection.classList.add('expanded');
            economicSection.classList.remove('collapsed');
        }
        
        const storicoSection = document.querySelector('.section-storico-economico .section-content');
        if (storicoSection) {
            storicoSection.style.maxHeight = 'none';
            storicoSection.style.overflowY = 'visible';
            storicoSection.classList.add('expanded');
            storicoSection.classList.remove('collapsed');
        }
        
        // Chiama anche il fix generale
        fixEconomicSectionVisibility();
    }, 200);
    
    showNotification(`Gestione economica per: ${lot.company_name}`, 'success');
}

        async function deleteLot(lotId) {
            // Controlla i permessi
            const permissions = getUserPermissions();
            if (!permissions.canDeleteLots) {
                showNotification('Non hai i permessi per eliminare lotti', 'error');
                return;
            }
            
            if (!confirm('Sei sicuro di voler eliminare questo lotto?')) {
                return;
            }
            
            try {
                showNotification('Eliminazione in corso...', 'loading');
                
                await apiCall(`/lots/${lotId}`, {
                    method: 'DELETE'
                });
                
                showNotification('Lotto eliminato con successo', 'success');
                loadLots();
            } catch (error) {
                console.error('Errore eliminazione:', error);
                showNotification(`Errore nell'eliminazione del lotto: ${error.message}`, 'error');
            }
        }

        async function editFieldLot(lotId) {
            // Controlla i permessi
            const permissions = getUserPermissions();
            if (!permissions.canEditLots) {
                showNotification('Non hai i permessi per modificare lotti', 'error');
                return;
            }
            
            try {
                showNotification('Caricamento dati lotto...', 'loading');
                
                const response = await apiCall(`/lots/${lotId}`);
                const lot = response.data;
                
                const newFieldLot = prompt('Inserisci il lotto campo:', lot.field_lot || '');
                if (newFieldLot === null) return;
                
                const newFieldSize = prompt('Inserisci la superficie in ettari:', lot.field_size || '');
                if (newFieldSize === null) return;
                
                const updateData = {
                    field_lot: newFieldLot.trim(),
                    field_size: parseFloat(newFieldSize) || 0
                };
                
                showNotification('Aggiornamento in corso...', 'loading');
                
                await apiCall(`/lots/${lotId}`, {
                    method: 'PATCH',
                    body: updateData
                });
                
                showNotification('Lotto aggiornato con successo!', 'success');
                loadLots();
                
            } catch (error) {
                console.error('Errore modifica lotto:', error);
                showNotification(`Errore nella modifica del lotto: ${error.message}`, 'error');
            }
        }

        function navigateToLot(gpsUrl) {
            if (gpsUrl && gpsUrl.includes('http')) {
                window.open(gpsUrl, '_blank');
            } else {
                showNotification('Link di navigazione non valido', 'error');
            }
        }

        function showNotification(message, type = 'info') {
            const types = {
                success: { icon: '✅', color: '#4CAF50', bgColor: '#f0f9f0' },
                error: { icon: '❌', color: '#f44336', bgColor: '#fdf0f0' },
                warning: { icon: '⚠️', color: '#ff9800', bgColor: '#fff9e6' },
                info: { icon: 'ℹ️', color: '#2196F3', bgColor: '#f0f8ff' },
                loading: { icon: '⏳', color: '#666', bgColor: '#f5f5f5' }
            };
            
            const config = types[type] || types.info;
            
            const oldNotification = document.getElementById('flash-notification');
            if (oldNotification) {
                oldNotification.remove();
            }
            
            const notification = document.createElement('div');
            notification.id = 'flash-notification';
            notification.innerHTML = `${config.icon} ${message}`;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: ${config.color};
                background-color: ${config.bgColor};
                border-left: 4px solid ${config.color};
                z-index: 1000;
                font-weight: 500;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                transition: all 0.3s ease;
                max-width: 300px;
            `;
            
            document.body.appendChild(notification);
            
            if (type !== 'loading') {
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.style.opacity = '0';
                        notification.style.transform = 'translateX(100px)';
                        setTimeout(() => notification.remove(), 300);
                    }
                }, 3000);
            }
            
            console.log(`${type.toUpperCase()}: ${message}`);
            
            return notification;
        }

// ==================== SPINNER FUNCTIONS ====================
function showSpinner(message = 'Caricamento in corso...') {
    const spinner = document.getElementById('loading-spinner');
    const spinnerMessage = document.getElementById('spinner-message');
    if (spinner) {
        spinner.style.display = 'flex';
        if (spinnerMessage) spinnerMessage.textContent = message;
    }
}

function hideSpinner() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.style.display = 'none';
    }
}

// ==================== FUNZIONI DI VALIDAZIONE ====================

function validateField(fieldId, minLength) {
    const field = document.getElementById(fieldId);
    if (!field) return true;
    
    const value = field.value.trim();
    
    if (minLength && value.length < minLength) {
        field.style.borderColor = 'var(--danger)';
        field.style.boxShadow = '0 0 0 3px rgba(244, 67, 54, 0.1)';
        
        // Mostra messaggio di errore
        const errorDiv = field.parentElement.querySelector('.field-error');
        if (errorDiv) {
            errorDiv.textContent = `Inserisci almeno ${minLength} caratteri`;
            errorDiv.style.display = 'block';
        }
        return false;
    }
    
    // Valido
    field.style.borderColor = 'var(--success)';
    field.style.boxShadow = 'none';
    const errorDiv = field.parentElement.querySelector('.field-error');
    if (errorDiv) errorDiv.style.display = 'none';
    return true;
}

function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    field.style.borderColor = '#ddd';
    field.style.boxShadow = 'none';
    
    const errorDiv = field.parentElement.querySelector('.field-error');
    if (errorDiv) errorDiv.style.display = 'none';
}

function validateOptionalField(fieldId, minLength) {
    const field = document.getElementById(fieldId);
    if (!field || !field.value.trim()) return true; // Campo vuoto = ok (opzionale)
    return validateField(fieldId, minLength);
}

function validateOptionalGoogleMapsUrl() {
    const field = document.getElementById('gps-coordinates');
    if (!field || !field.value.trim()) {
        clearFieldError('gps-coordinates');
        return true; // Opzionale
    }
    
    const url = field.value.trim();
    const isValid = url.includes('google.') && url.includes('/maps');
    
    if (!isValid) {
        field.style.borderColor = 'var(--danger)';
        showNotification('Inserisci un link Google Maps valido', 'warning');
        return false;
    }
    
    clearFieldError('gps-coordinates');
    return true;
}

        // ==================== GESTIONE UNIFICATA DEI DROPDOWN ====================
        function initAllDropdowns() {
    console.log('Inizializzazione dropdown universale...');
    
    const dropdowns = [
        { 
            toggle: '#lotDropdown', 
            menu: 'lot-dropdown-menu', 
            populate: populateDropdownMenu,
            name: 'Dettagli Lotti'
        },
        { 
            toggle: '#economicLotDropdown', 
            menu: 'economic-lot-dropdown-menu', 
            populate: populateEconomicDropdownMenu,
            name: 'Gestione Economica'
        }
    ];
    
    dropdowns.forEach(({ toggle, menu, populate, name }) => {
        const toggleEl = document.querySelector(toggle);
        const menuEl = document.getElementById(menu);
        
        if (toggleEl && menuEl) {
            console.log(`✅ Configurando dropdown: ${name}`);
            
            // RIMUOVI listener precedenti
            const newToggle = toggleEl.cloneNode(true);
            toggleEl.parentNode.replaceChild(newToggle, toggleEl);
            
            // Event listener unificato per click/tap
            newToggle.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log(`🎯 Cliccato dropdown: ${name}`);
                
                // Chiudi altri dropdown
                closeAllDropdownsExcept(menuEl);
                
                if (allLots.length > 0) {
                    populate();
                    menuEl.classList.add('show'); // FORZA APERTURA
                    console.log(`🔓 ${name} APERTO`);
                } else {
                    showNotification('Nessun lotto disponibile', 'warning');
                }
            });
        } else {
            console.log(`❌ Dropdown non trovato: ${name}`, { toggle, menu });
        }
    });
    
    // Chiudi dropdown quando si clicca/tocca fuori
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown')) {
            closeAllDropdowns();
        }
    });
    
    // Anche per touch su mobile
    document.addEventListener('touchstart', function(e) {
        if (!e.target.closest('.dropdown')) {
            closeAllDropdowns();
        }
    });
    
    console.log('✅ Dropdown inizializzati con successo');
}

function closeAllDropdownsExcept(exceptMenu) {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu !== exceptMenu) {
            menu.classList.remove('show');
        }
    });
}

function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('show');
    });
}

        // ==================== POPOLAMENTO UNIFICATO DEI DROPDOWN ====================
        function populateAllDropdowns() {
            populateDropdownMenu();
            populateEconomicDropdownMenu();
        }

        function populateDropdownMenu() {
    const dropdownMenu = document.getElementById('lot-dropdown-menu');
    if (!dropdownMenu || !allLots || allLots.length === 0) {
        console.log('Nessun lotto da mostrare nel dropdown dettagli');
        return;
    }
    
    console.log('Popolando dropdown dettagli con', allLots.length, 'lotti');
    dropdownMenu.innerHTML = '';
    
    allLots.forEach((lot, index) => {
        const dropdownItem = document.createElement('button');
        dropdownItem.className = 'dropdown-item';
        dropdownItem.type = 'button';
        dropdownItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div>
                    <strong>${lot.company_name}</strong><br>
                    <small>${lot.location} - ${lot.variety || 'Nessuna varietà'}</small>
                </div>
                <span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">
                    ${lot.product_type}
                </span>
            </div>
        `;
        
        dropdownItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Lotto selezionato in dettagli:', lot.id, lot.company_name);
            currentLotIndex = index;
            loadLotDetails(lot.id);
            dropdownMenu.classList.remove('show');
        });
        
        dropdownMenu.appendChild(dropdownItem);
    });
    
    const divider = document.createElement('div');
    divider.className = 'dropdown-divider';
    dropdownMenu.appendChild(divider);
    
    const viewAllItem = document.createElement('button');
    viewAllItem.className = 'dropdown-item';
    viewAllItem.type = 'button';
    viewAllItem.innerHTML = '<i class="fas fa-list"></i> Vedi tutti i lotti';
    viewAllItem.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showSection('lista-section');
        dropdownMenu.classList.remove('show');
    });
    dropdownMenu.appendChild(viewAllItem);
}

        function populateEconomicDropdownMenu() {
    const dropdownMenu = document.getElementById('economic-lot-dropdown-menu');
    if (!dropdownMenu || !allLots || allLots.length === 0) {
        console.log('Nessun lotto da mostrare nel dropdown economico');
        return;
    }
    
    console.log('Popolando dropdown economico con', allLots.length, 'lotti');
    dropdownMenu.innerHTML = '';
    
    allLots.forEach((lot, index) => {
        const dropdownItem = document.createElement('button');
        dropdownItem.className = 'dropdown-item';
        dropdownItem.type = 'button';
        dropdownItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div>
                    <strong>${lot.company_name}</strong><br>
                    <small>${lot.location} - ${lot.variety || 'Nessuna varietà'}</small>
                </div>
                <span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">
                    ${lot.product_type}
                </span>
            </div>
        `;
        
        dropdownItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Lotto selezionato in economia:', lot.id, lot.company_name);
            loadEconomicLotDetails(lot.id);
            dropdownMenu.classList.remove('show');
            
            const dropdownToggle = document.querySelector('#economicLotDropdown');
            if (dropdownToggle) {
                dropdownToggle.innerHTML = `<i class="fas fa-list"></i> ${lot.company_name}`;
            }
        });
        
        dropdownMenu.appendChild(dropdownItem);
    });
    
    const divider = document.createElement('div');
    divider.className = 'dropdown-divider';
    dropdownMenu.appendChild(divider);
    
    const viewAllItem = document.createElement('button');
    viewAllItem.className = 'dropdown-item';
    viewAllItem.type = 'button';
    viewAllItem.innerHTML = '<i class="fas fa-list"></i> Vedi tutti i lotti';
    viewAllItem.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showSection('lista-section');
        dropdownMenu.classList.remove('show');
    });
    dropdownMenu.appendChild(viewAllItem);
}

        // ==================== INIZIALIZZAZIONE GLOBALE MIGLIORATA ====================
        document.addEventListener('DOMContentLoaded', function() {
    console.log('Cropbook Frontend inizializzato');
    
    // Inizializza il sistema di autenticazione
    initAuthSystem();
    
    // Se c'è un utente loggato, mostra l'interfaccia principale
    if (currentUser) {
        showAppInterface();
    } else {
        showAuthInterface();
    }
            
            initAllDropdowns();
            initMobileFeatures();
            
            if (isMobileDevice()) {
                const gpsField = document.querySelector('#gps-coordinates').parentNode;
                const helpButton = gpsField.querySelector('.btn-help');
                if (helpButton) {
                    helpButton.insertAdjacentHTML('afterend', `
                        <button type="button" onclick="getCurrentLocation()" class="btn-help">
                            <i class="fas fa-location-arrow"></i> Usa posizione attuale
                        </button>
                    `);
                }
            }
            
            let lastTouchEnd = 0;
            document.addEventListener('touchend', function(event) {
                const now = (new Date()).getTime();
                if (now - lastTouchEnd <= 300) {
                    event.preventDefault();
                }
                lastTouchEnd = now;
            }, false);
            
            let resizeTimeout;
            window.addEventListener('resize', function() {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(function() {
                    if (isMobileDevice()) {
                        document.body.classList.add('mobile-device');
                    } else {
                        document.body.classList.remove('mobile-device');
                    }
                }, 250);
            });
            
            setTimeout(() => {
                addSectionControls();
                loadSectionState();
                loadHistoryState();
                optimizeMobileLoad();
                
// ==================== INIZIALIZZAZIONE NUOVO CAMPO PRODOTTO ====================
        document.getElementById('product-category').parentElement.style.display = 'none';
        // ==================== FINE INIZIALIZZAZIONE ====================

                setTimeout(() => {
                    if (allLots && allLots.length > 0) {
                        populateAllDropdowns();
                    }
                }, 500);
                
            }, 1000);
        });

// ==================== GESTIONE CAMPI AZIENDALI ====================
function toggleAziendaFields() {
    const selectedType = document.querySelector('input[name="user-type"]:checked');
    const aziendaFields = document.getElementById('azienda-fields');
    const requiredFields = ['register-ragione-sociale'];
    
    if (selectedType && (selectedType.value === 'titolare' || selectedType.value === 'azienda')) {
        aziendaFields.style.display = 'block';
        // Rendi obbligatori i campi aziendali
        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.required = true;
                field.parentElement.querySelector('label').classList.add('required-field');
            }
        });
    } else {
        aziendaFields.style.display = 'none';
        // Rimuovi obbligatorietà
        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.required = false;
                const label = field.parentElement.querySelector('label');
                if (label) label.classList.remove('required-field');
            }
        });
    }
}

// Gestione settore "Altro"
document.addEventListener('DOMContentLoaded', function() {
    const settoreSelect = document.getElementById('register-settore');
    if (settoreSelect) {
        settoreSelect.addEventListener('change', function() {
            const altroContainer = document.getElementById('altro-settore-container');
            if (this.value === 'altro') {
                altroContainer.style.display = 'block';
            } else {
                altroContainer.style.display = 'none';
            }
        });
    }
});

// ==================== SAFE AREA DETECTION MIGLIORATA ====================
function setupSafeArea() {
    console.log('🔄 Setup Safe Area Avviato...');
    
    // Rileva se è un dispositivo mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Rileva specificamente Android
    const isAndroid = /Android/i.test(navigator.userAgent);
    
    // Rileva dispositivi con notch (iPhone X+ e Android con notch)
    const hasNotch = (
        /iPhone/.test(navigator.userAgent) && 
        !/iPad/.test(navigator.userAgent) &&
        (window.screen.height >= 812 || window.devicePixelRatio >= 3)
    ) || (
        // Android con notch (rilevamento basato su aspect ratio)
        isAndroid && (window.screen.height / window.screen.width > 2.0)
    );
    
    console.log('📱 Info Dispositivo:', {
        isMobile,
        isAndroid,
        hasNotch,
        userAgent: navigator.userAgent,
        screenHeight: window.screen.height,
        screenWidth: window.screen.width,
        aspectRatio: window.screen.height / window.screen.width
    });
    
    // Applica classi appropriate
    if (isMobile) {
        document.body.classList.add('mobile-device');
        console.log('✅ Dispositivo mobile rilevato');
    }
    
    if (isAndroid) {
        document.body.classList.add('android-device');
        console.log('✅ Dispositivo Android rilevato - Aumento padding gesture bar');
        
        // Aggiungi padding extra per Android
        document.documentElement.style.setProperty('--extra-padding-top', '15px');
        document.documentElement.style.setProperty('--extra-padding-bottom', '28px');
        document.documentElement.style.setProperty('--extra-padding-sides', '12px');
    }
    
    if (hasNotch) {
        document.body.classList.add('notch-device');
        console.log('✅ Dispositivo con notch rilevato - Safe Area Attivata');
        // ⚠️ RIMOSSO reflow forzato (display:none + display:''):
        // su Android resettava lo scroll a 0 quando setupSafeArea veniva richiamato
        // dopo l'apertura della keyboard, l'orientation change, o un resize.
        // Le CSS variables --safe-area-* vengono applicate immediatamente dai browser
        // moderni senza bisogno di forzare il reflow.
    }
    
    // Debug: mostra i valori delle safe area
    const computedStyle = getComputedStyle(document.documentElement);
    console.log('📏 Safe Area Values:', {
        top: computedStyle.getPropertyValue('--safe-area-top'),
        bottom: computedStyle.getPropertyValue('--safe-area-bottom'),
        left: computedStyle.getPropertyValue('--safe-area-left'),
        right: computedStyle.getPropertyValue('--safe-area-right'),
        extraTop: computedStyle.getPropertyValue('--extra-padding-top'),
        extraBottom: computedStyle.getPropertyValue('--extra-padding-bottom')
    });
}

// ==================== MOBILE OPTIMIZATION COMPLETA ====================
function initMobileOptimizations() {
    if (!isMobileDevice()) return;
    
    console.log('📱 Avvio ottimizzazioni mobile...');
    
    // ✅ Anti scroll-jump: aggiungi classe 'is-scrolling' durante lo scroll
    // per disabilitare transition/animation che potrebbero causare reflow.
    let _scrollEndTimer = null;
    window.addEventListener('scroll', () => {
        if (!document.body.classList.contains('is-scrolling')) {
            document.body.classList.add('is-scrolling');
        }
        clearTimeout(_scrollEndTimer);
        _scrollEndTimer = setTimeout(() => {
            document.body.classList.remove('is-scrolling');
        }, 150);
    }, { passive: true });
    
    // Previeni zoom su input
    document.addEventListener('touchstart', function() {}, { passive: true });
    
    // Migliora lo scrolling
    document.documentElement.style.setProperty('--webkit-overflow-scrolling', 'touch');
    
    // Ottimizza i touch target
    document.querySelectorAll('button, .menu-item, .action-btn, .btn').forEach(element => {
        element.style.touchAction = 'manipulation';
        element.style.minHeight = '44px';
        element.style.minWidth = '44px';
    });
    
    // Keyboard avoidance: SOLO iOS (su Android il browser nativo gestisce meglio,
    // e fare scrollIntoView qui causava lo "scatto verso l'alto" su Android).
    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isiOS) {
        document.querySelectorAll('input, textarea, select').forEach(input => {
            input.addEventListener('focus', function() {
                setTimeout(() => {
                    this.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            });
        });
    }
    
    console.log('✅ Ottimizzazioni mobile completate');
}

// ==================== GESTIONE KEYBOARD SU ANDROID ====================
// ⚠️ Versione safe: NON forziamo più scroll su blur (causava il "salto su" sgradevole).
// Lasciamo che il browser gestisca nativamente lo scroll della keyboard tramite
// il meta viewport `interactive-widget=resizes-content`.
function initAndroidKeyboardHandler() {
    if (!isAndroidDevice()) return;
    console.log('📱 Android keyboard handler (modalità safe - no forced scroll)');
    // Non aggiungiamo più listener focus/blur che alterano window.scrollY.
    // L'unica cosa che ci serve è assicurare che gli input siano visibili
    // quando la keyboard si apre — lo fa nativamente Android se il meta viewport
    // è configurato con `interactive-widget=resizes-content`.
}

function isAndroidDevice() {
    return /Android/i.test(navigator.userAgent);
}

// ==================== CORREZIONE VISIBILITÀ SEZIONE ECONOMICA ====================
function fixEconomicSectionVisibility() {
    console.log('🔧 Fix visibilità sezione economica');
    
    // Assicura che la sezione economica sia completamente espansa
    const economicSection = document.querySelector('.section-economica');
    if (economicSection) {
        const content = economicSection.querySelector('.section-content');
        if (content && content.classList.contains('collapsed')) {
            // Se è collassata, espandila
            const header = economicSection.querySelector('.section-header');
            if (header) {
                console.log('📂 Espansione sezione economica');
                header.click();
            }
        }
        
        // Rimuovi eventuali limiti di altezza
        if (content) {
            content.style.maxHeight = 'none';
            content.style.overflowY = 'visible';
        }
    }
    
    // Stessa cosa per lo storico economico
    const storicoSection = document.querySelector('.section-storico-economico');
    if (storicoSection) {
        const content = storicoSection.querySelector('.section-content');
        if (content && content.classList.contains('collapsed')) {
            const header = storicoSection.querySelector('.section-header');
            if (header) {
                console.log('📂 Espansione sezione storico economico');
                header.click();
            }
        }
        if (content) {
            content.style.maxHeight = 'none';
            content.style.overflowY = 'visible';
        }
    }
}

// ==================== CORREZIONE VISUALIZZAZIONE PERMESSI MOBILE ====================
function fixPermissionsLayout() {
    if (!isMobileDevice()) return;
    
    console.log('📱 Ottimizzazione layout permessi mobile');
    
    // Trova il container dei pulsanti permessi
    const permissionsContainer = document.getElementById('user-permissions-container');
    if (!permissionsContainer) return;
    
    const actionsDiv = permissionsContainer.querySelector('.section-actions');
    if (!actionsDiv) return;
    
    // Assicura che i pulsanti siano in ordine corretto
    const buttons = actionsDiv.querySelectorAll('.btn');
    if (buttons.length >= 4) {
        // Riorganizza i pulsanti se necessario
        const saveBtn = buttons[0];
        const enableAllBtn = buttons[1];
        const disableAllBtn = buttons[2];
        const resetBtn = buttons[3];
        
        // Applica stili inline per garantire visibilità
        saveBtn.style.margin = '0';
        enableAllBtn.style.margin = '0';
        disableAllBtn.style.margin = '0';
        resetBtn.style.margin = '0';
        
        // Assicura che i colori siano corretti
        saveBtn.style.backgroundColor = 'var(--primary)';
        enableAllBtn.style.backgroundColor = '#2196F3';
        disableAllBtn.style.backgroundColor = '#f44336';
        resetBtn.style.backgroundColor = '#ff9800';
        
        // Testo bianco per tutti
        [saveBtn, enableAllBtn, disableAllBtn, resetBtn].forEach(btn => {
            btn.style.color = 'white';
        });
        
        console.log('✅ Layout permessi ottimizzato');
    }
}

// Chiama la funzione quando si carica la gestione utenti
function loadUserManagementWithFix() {
    loadUserManagement();
    setTimeout(() => {
        fixPermissionsLayout();
    }, 100);
}

// Modifica la funzione loadUserPermissions per applicare il fix dopo il caricamento
// (sostituisci la funzione esistente o aggiungi la chiamata)

// Esegui quando il DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM Ready - Inizializzazione Safe Area');
    setupSafeArea();
    initMobileOptimizations();
    initAndroidKeyboardHandler(); // ✅ AGGIUNGI QUESTA RIGA
});

// Esegui anche al resize e orientation change
// ⚠️ Versione safe: debounce + skip se è solo l'apertura della keyboard Android
// (riconoscibile da: stessa larghezza ma altezza ridotta -> probabilmente keyboard aperta).
let _lastViewportWidth = window.innerWidth;
let _lastViewportHeight = window.innerHeight;
let _safeAreaDebounce = null;
window.addEventListener('resize', function() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Se cambia solo l'altezza e in modo significativo (>150px) MENTRE un input è focus,
    // è la tastiera che si apre/chiude → NON ricalcolare safe area (causerebbe scroll jump).
    const sameWidth = (w === _lastViewportWidth);
    const heightDelta = Math.abs(h - _lastViewportHeight);
    const isInputFocused = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (sameWidth && heightDelta > 150 && isInputFocused) {
        // Keyboard event: ignora resize per safe area
        _lastViewportHeight = h;
        return;
    }
    _lastViewportWidth = w;
    _lastViewportHeight = h;
    // Debounce
    clearTimeout(_safeAreaDebounce);
    _safeAreaDebounce = setTimeout(setupSafeArea, 250);
});
window.addEventListener('orientationchange', function() {
    setTimeout(setupSafeArea, 300);
});

// ==================== SEZIONE SVILUPPATORE ====================
// ==================== ACCESSO SVILUPPATORE (PROTETTO SERVER-SIDE) ====================
// ⚠️ Sicurezza: nessuna password hardcoded. Il backend richiede:
//   - JWT valido (Authorization: Bearer ...)
//   - utente == super-admin (username='admin')
//   - password dev verificata contro DEV_PASSWORD_HASH in .env del server
//   - dev session token con scadenza 30 minuti memorizzato in sessionStorage
let devPasswordAttempts = 0;

// Attivazione con 7 click consecutivi (solo per super-admin)
function initDeveloperAccess() {
    let clickCount = 0;
    let clickTimer;
    
    document.addEventListener('click', function() {
        // Verifica se l'utente è il super-admin prima di attivare
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const token = localStorage.getItem('auth_token');
        
        // Se non è il super-admin, ignora i click
        if (!token || currentUser.username !== 'admin' || currentUser.role !== 'admin') {
            return;
        }
        
        clickCount++;
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { clickCount = 0; }, 1000);
        
        if (clickCount === 7) {
            showDeveloperLogin();
            clickCount = 0;
        }
    });
}

async function showDeveloperLogin() {
    // Validazione lato client minima — quella REALE è server-side
    const token = localStorage.getItem('auth_token');
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

    if (!token) {
        alert('⚠️ Devi prima effettuare il login come Amministratore Principale.');
        return;
    }
    if (currentUser.role !== 'admin' || currentUser.username !== 'admin') {
        alert('⚠️ Solo l\'utente super-admin "admin" può accedere a quest\'area.');
        return;
    }

    const password = prompt('🔐 Accesso Sviluppatore - Inserisci la password segreta:');
    if (!password) return;

    try {
        // ✅ Validazione server-side via /api/admin/dev/auth
        const res = await fetch(`${API_BASE_URL}/admin/dev/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ password })
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 429) {
            alert('🚫 Troppi tentativi falliti. Riprova fra 15 minuti.');
            return;
        }
        if (res.status === 404) {
            alert('⚠️ Pannello sviluppatore non disponibile su questo server (disabilitato in produzione).');
            return;
        }
        if (!res.ok) {
            devPasswordAttempts++;
            if (devPasswordAttempts >= 3) {
                alert('Troppi tentativi falliti su questo dispositivo. Per sicurezza il pannello è ora bloccato.');
                devPasswordAttempts = 0;
                return;
            }
            alert(`Password errata. Tentativi rimasti: ${3 - devPasswordAttempts}`);
            return;
        }

        // Salva dev token in sessionStorage (effimero — niente persistenza)
        sessionStorage.setItem('dev_token', data.devToken);
        sessionStorage.setItem('dev_token_exp', String(Date.now() + (data.expiresInSec * 1000)));
        devPasswordAttempts = 0;
        showDeveloperSection();
    } catch (err) {
        console.error('Errore dev auth:', err);
        alert('Errore di connessione al server: ' + (err.message || err));
    }
}

/**
 * Helper per chiamate API admin: aggiunge X-Dev-Token. Se scaduto, riapre il login.
 */
async function devApiCall(endpoint, options = {}) {
    const token = localStorage.getItem('auth_token');
    const devToken = sessionStorage.getItem('dev_token');
    const exp = parseInt(sessionStorage.getItem('dev_token_exp') || '0');

    if (!devToken || Date.now() > exp) {
        sessionStorage.removeItem('dev_token');
        sessionStorage.removeItem('dev_token_exp');
        throw new Error('DEV_SESSION_EXPIRED');
    }

    const res = await fetch(`${API_BASE_URL}/admin${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Dev-Token': devToken,
            ...(options.headers || {})
        }
    });

    if (res.status === 401 || res.status === 403) {
        sessionStorage.removeItem('dev_token');
        sessionStorage.removeItem('dev_token_exp');
        throw new Error('DEV_SESSION_EXPIRED');
    }
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
    }
    return res.json();
}

async function showDeveloperSection() {
    const devSection = document.getElementById('developer-section');
    if (!devSection) return;
    
    devSection.style.display = 'block';
    
    await loadDevUsers();
    await loadDevStats();
}

function closeDeveloperSection() {
    const devSection = document.getElementById('developer-section');
    if (devSection) devSection.style.display = 'none';
}

function showDevTab(tabName) {
    document.querySelectorAll('.dev-content').forEach(content => {
        content.style.display = 'none';
    });
    document.querySelectorAll('.dev-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.getElementById(`dev-${tabName}`).style.display = 'block';
    event.target.classList.add('active');
}

function formatDate(dateString) {
    if (!dateString) return 'N/D';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('it-IT');
    } catch (e) {
        return 'Data non valida';
    }
}

async function loadDevUsers() {
    try {
        let users = [];
        try {
            const response = await devApiCall('/dev/users');
            users = response.data || [];
        } catch (devErr) {
            if (devErr.message === 'DEV_SESSION_EXPIRED') {
                const container = document.getElementById('dev-users-list');
                if (container) container.innerHTML = '<p style="color: orange;">⚠️ Sessione dev scaduta. Riapri il pannello (7 click).</p>';
                closeDeveloperSection();
                return;
            }
            // Fallback: per compatibilità leggi via /auth/users (richiede comunque autenticazione)
            const response = await apiCall('/auth/users');
            users = response.data || [];
        }

        const container = document.getElementById('dev-users-list');
        if (!container) return;
        
        if (users.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">Nessun utente registrato</p>';
            return;
        }
        
        // Organizza gli utenti per gerarchia
        const adminUsers = users.filter(u => u.role === 'admin');
        const regularUsers = users.filter(u => u.role !== 'admin');
        
        // Costruisci mappa dei sottoutenti per parent_id
        const usersByParent = {};
        regularUsers.forEach(user => {
            const parentId = user.parent_id;
            if (!usersByParent[parentId]) {
                usersByParent[parentId] = [];
            }
            usersByParent[parentId].push(user);
        });
        
        let tableHtml = `
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #4CAF50; color: white;">
                            <th style="padding: 10px; text-align: left;">Gerarchia</th>
                            <th style="padding: 10px; text-align: left;">ID</th>
                            <th style="padding: 10px; text-align: left;">Username</th>
                            <th style="padding: 10px; text-align: left;">Email</th>
                            <th style="padding: 10px; text-align: left;">Ruolo</th>
                            <th style="padding: 10px; text-align: left;">Tipo</th>
                            <th style="padding: 10px; text-align: left;">Data Reg.</th>
                            <th style="padding: 10px; text-align: left;">Azienda</th>
                            <th style="padding: 10px; text-align: left;">Privacy</th>
                            <th style="padding: 10px; text-align: left;">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Mostra ADMIN con i loro sottoutenti
        for (const admin of adminUsers) {
            const isSuperAdmin = admin.username === 'admin';
            const adminIcon = isSuperAdmin ? '👑 ' : '📁 ';
            const adminStyle = isSuperAdmin ? 'style="background: #2c3e50; color: white;"' : '';
            
            tableHtml += `
                <tr style="border-bottom: 1px solid #ddd; background: #f0f8ff;" ${adminStyle}>
                    <td style="padding: 8px;"><strong>${adminIcon}${admin.username} ${isSuperAdmin ? '(SUPER ADMIN)' : '(ADMIN)'}</strong></td>
                    <td style="padding: 8px;">${admin.id}</td>
                    <td style="padding: 8px;"><strong>${escapeHtml(admin.username)}</strong></td>
                    <td style="padding: 8px;">${escapeHtml(admin.email || '-')}</td>
                    <td style="padding: 8px;"><span class="role-badge role-${admin.role}">${admin.role}</span></td>
                    <td style="padding: 8px;">${admin.user_type === 'libero_professionista' ? '📋 Libero' : (admin.user_type === 'titolare' ? '👔 Titolare' : '🏢 Azienda')}</td>
                    <td style="padding: 8px;">${new Date(admin.created_at).toLocaleDateString('it-IT')}</td>
                    <td style="padding: 8px;">${admin.privacy_accepted ? '✅ ' + formatDate(admin.privacy_accepted_at) : '❌ Non accettato'}</td>
                    <td style="padding: 8px;">-</td>
                    <td style="padding: 8px; text-align: center;">
                        <button onclick="deleteUserFromDev(${admin.id}, '${escapeHtml(admin.username)}')" 
                                style="background: #f44336; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                            🗑️ Elimina
                        </button>
                    </td>
                </tr>
            `;
            
            // Mostra i sottoutenti di questo admin
            const subUsers = usersByParent[admin.id] || [];
            for (const subUser of subUsers) {
                let aziendaNome = '-';
                if (subUser.azienda_data) {
                    try {
                        const azienda = typeof subUser.azienda_data === 'string' ? JSON.parse(subUser.azienda_data) : subUser.azienda_data;
                        aziendaNome = azienda.ragione_sociale || '-';
                    } catch(e) {}
                }
                
                tableHtml += `
                    <tr style="border-bottom: 1px solid #ddd; background: #f9f9f9;">
                        <td style="padding: 8px; padding-left: 30px;">└─ 📄 ${escapeHtml(subUser.username)}</td>
                        <td style="padding: 8px;">${subUser.id}</td>
                        <td style="padding: 8px;">${escapeHtml(subUser.username)}</td>
                        <td style="padding: 8px;">${escapeHtml(subUser.email || '-')}</td>
                        <td style="padding: 8px;"><span class="role-badge role-${subUser.role}">${subUser.role}</span></td>
                        <td style="padding: 8px;">${subUser.user_type === 'libero_professionista' ? '📋 Libero' : (subUser.user_type === 'titolare' ? '👔 Titolare' : '🏢 Azienda')}</td>
                        <td style="padding: 8px;">${new Date(subUser.created_at).toLocaleDateString('it-IT')}</td>
                        <td style="padding: 8px;">${escapeHtml(aziendaNome)}</td>
                        <td style="padding: 8px;">${subUser.privacy_accepted ? '✅ ' + formatDate(subUser.privacy_accepted_at) : '❌ Non accettato'}</td>
                        <td style="padding: 8px; text-align: center;">
                            <button onclick="deleteUserFromDev(${subUser.id}, '${escapeHtml(subUser.username)}')" 
                                    style="background: #f44336; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                                🗑️ Elimina
                            </button>
                        </td>
                    </tr>
                `;
            }
        }
        
        tableHtml += `
                    </tbody>
                 </table>
            </div>
            <p style="margin-top: 15px; font-weight: bold;">📊 Totale utenti: ${users.length}</p>
            <p style="margin-top: 10px; font-size: 0.8rem; color: #666;">
                <i class="fas fa-info-circle"></i> 📁 = Amministratore | └─ 📄 = Sottoutente (creato dall\'admin sopra)
            </p>
        `;
        
        container.innerHTML = tableHtml;
    } catch (error) {
        console.error('Errore caricamento utenti:', error);
        const container = document.getElementById('dev-users-list');
        if (container) {
            let errorMsg = error.message || 'Errore sconosciuto';
            if (errorMsg.includes('401') || errorMsg.includes('Non autorizzato')) {
                container.innerHTML = '<p style="color: orange;">⚠️ Non hai i permessi per visualizzare gli utenti. Devi essere loggato come Admin.</p>';
            } else {
                container.innerHTML = `<p style="color: red;">❌ Errore nel caricamento degli utenti: ${errorMsg}</p>`;
            }
        }
    }
}

async function deleteUserFromDev(userId, username) {
    // Conferma eliminazione
    const confirmMessage = `⚠️ ATTENZIONE! ⚠️\n\nStai per eliminare l'utente "${username}" (ID: ${userId})\n\nQuesto eliminera PERMANENTEMENTE:\n- Tutti i lotti creati da questo utente\n- Tutte le attività di raccolta\n- Tutte le analisi caricate\n- Tutti i dati economici\n- I sotto-utenti associati (operatori/visitatori creati da lui)\n\nQuesta operazione NON PUÒ ESSERE ANNULLATA!\n\nSei sicuro di voler continuare?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Seconda conferma per sicurezza
    const secondConfirm = prompt(`Digita "CONFERMA" per eliminare definitivamente l'utente "${username}":`);
    if (secondConfirm !== 'CONFERMA') {
        showNotification('Eliminazione annullata', 'info');
        return;
    }
    
    try {
        showNotification(`Eliminazione utente ${username} in corso...`, 'loading');
        
        // Chiamata API per eliminare l'utente e tutti i suoi dati
        const response = await apiCall(`/auth/users/${userId}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showNotification(`✅ Utente "${username}" eliminato con successo! Tutti i suoi dati sono stati rimossi.`, 'success');
            
            // Rimuovi la riga dalla tabella
            const row = document.getElementById(`dev-user-row-${userId}`);
            if (row) {
                row.remove();
            }
            
            // Ricarica le statistiche
            await loadDevStats();
            
            // Aggiorna anche la gestione utenti nel frontend principale
            if (typeof loadUserManagement === 'function') {
                await loadUserManagement();
                await populateUserSelector();
            }
        } else {
            showNotification(response.error || 'Errore durante l\'eliminazione', 'error');
        }
    } catch (error) {
        console.error('Errore eliminazione utente:', error);
        showNotification(error.message || 'Errore durante l\'eliminazione', 'error');
    }
}

async function loadDevStats() {
    try {
        const users = await loadUsersFromBackend();
        const lots = allLots || [];
        
        const stats = {
            totalUsers: users.length,
            adminUsers: users.filter(u => u.role === 'admin').length,
            operatorUsers: users.filter(u => u.role === 'operatore').length,
            visitorUsers: users.filter(u => u.role === 'visitatore').length,
            liberiProfessionisti: users.filter(u => u.user_type === 'libero_professionista').length,
            titolari: users.filter(u => u.user_type === 'titolare').length,
            aziende: users.filter(u => u.user_type === 'azienda').length,
            totalLots: lots.length,
            registrationsThisMonth: users.filter(u => new Date(u.created_at) > new Date(Date.now() - 30*24*60*60*1000)).length
        };
        
        const container = document.getElementById('dev-stats-container');
        if (!container) return;
        
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div class="stat-card"><h4>👥 Totale Utenti</h4><div class="stat-number">${stats.totalUsers}</div></div>
                <div class="stat-card"><h4>👑 Admin</h4><div class="stat-number">${stats.adminUsers}</div></div>
                <div class="stat-card"><h4>🔧 Operatori</h4><div class="stat-number">${stats.operatorUsers}</div></div>
                <div class="stat-card"><h4>👁️ Visitatori</h4><div class="stat-number">${stats.visitorUsers}</div></div>
                <div class="stat-card"><h4>📋 Liberi Prof.</h4><div class="stat-number">${stats.liberiProfessionisti}</div></div>
                <div class="stat-card"><h4>👔 Titolari</h4><div class="stat-number">${stats.titolari}</div></div>
                <div class="stat-card"><h4>🏢 Aziende</h4><div class="stat-number">${stats.aziende}</div></div>
                <div class="stat-card"><h4>📦 Lotti Creati</h4><div class="stat-number">${stats.totalLots}</div></div>
                <div class="stat-card"><h4>📅 Registrazioni (30gg)</h4><div class="stat-number">${stats.registrationsThisMonth}</div></div>
            </div>
        `;
    } catch (error) {
        console.error('Errore caricamento statistiche:', error);
        const container = document.getElementById('dev-stats-container');
        if (container) {
            container.innerHTML = '<p style="color: red;">❌ Errore nel caricamento delle statistiche</p>';
        }
    }
}

async function searchUserForRecovery() {
    const email = document.getElementById('recovery-email')?.value.trim();
    if (!email) {
        showNotification('Inserisci un email', 'error');
        return;
    }
    
    try {
        const users = await loadUsersFromBackend();
        const user = users.find(u => u.email === email);
        
        const resultDiv = document.getElementById('recovery-result');
        if (!resultDiv) return;
        
        if (!user) {
            resultDiv.innerHTML = `<p style="color: red;">❌ Nessun utente trovato con email: ${email}</p>`;
            return;
        }
        
        let aziendaInfo = '';
        if (user.azienda_data) {
            try {
                const azienda = typeof user.azienda_data === 'string' ? JSON.parse(user.azienda_data) : user.azienda_data;
                aziendaInfo = `<p><strong>Azienda:</strong> ${azienda.ragione_sociale || '-'}</p>`;
            } catch(e) {}
        }
        
        resultDiv.innerHTML = `
            <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin-top: 15px;">
                <h4>✅ Utente trovato</h4>
                <p><strong>Username:</strong> ${user.username}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Ruolo:</strong> ${user.role}</p>
                <p><strong>Data registrazione:</strong> ${new Date(user.created_at).toLocaleDateString()}</p>
                ${aziendaInfo}
                <button onclick="generateTemporaryPassword('${user.id}', '${user.username}')" class="btn btn-secondary" style="margin-top: 10px;">🔑 Genera password temporanea</button>
            </div>
        `;
    } catch (error) {
        showNotification('Errore nella ricerca', 'error');
    }
}

function generateTemporaryPassword(userId, username) {
    const tempPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 1000);
    showNotification(`Password temporanea per ${username}: ${tempPassword}`, 'success');
}

async function exportAllUsersData() {
    try {
        showNotification('Generazione export utenti in corso...', 'loading');
        
        const response = await apiCall('/auth/users');
        const users = response.data || [];
        
        if (users.length === 0) {
            showNotification('Nessun utente da esportare', 'warning');
            return;
        }
        
        // Prepara i dati per l'export
        const exportData = users.map(user => {
            let ragioneSociale = '';
            let partitaIva = '';
            let indirizzo = '';
            let telefono = '';
            let settore = '';
            let noteAziendali = '';
            
            if (user.azienda_data) {
                try {
                    const azienda = typeof user.azienda_data === 'string' ? JSON.parse(user.azienda_data) : user.azienda_data;
                    ragioneSociale = azienda.ragione_sociale || '';
                    partitaIva = azienda.partita_iva || '';
                    indirizzo = azienda.indirizzo || '';
                    telefono = azienda.telefono || '';
                    settore = azienda.settore || '';
                    noteAziendali = azienda.note || '';
                } catch(e) {}
            }
            
            return {
                'ID': user.id,
                'Username': user.username,
                'Email': user.email || '',
                'Ruolo': user.role,
                'Tipologia Utente': user.user_type === 'libero_professionista' ? 'Libero Professionista' : (user.user_type === 'titolare' ? 'Titolare' : 'Azienda'),
                'Data Registrazione': new Date(user.created_at).toLocaleDateString('it-IT'),
                'Ragione Sociale': ragioneSociale,
                'Partita IVA': partitaIva,
                'Indirizzo': indirizzo,
                'Telefono': telefono,
                'Settore': settore,
                'Note Aziendali': noteAziendali,
                'Creato da (Parent ID)': user.parent_id || '',
                'Creato da (Parent Username)': user.parent_username || '',
                'Tipo Utente': user.role === 'admin' ? 'Amministratore' : 'Sottoutente'
            };
        });
        
        // Crea un workbook e un worksheet usando XLSX
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Utenti');
        
        // Imposta la larghezza delle colonne (opzionale)
        worksheet['!cols'] = [
            {wch:8},   // ID
            {wch:15},  // Username
            {wch:25},  // Email
            {wch:12},  // Ruolo
            {wch:20},  // Tipologia Utente
            {wch:15},  // Data Registrazione
            {wch:30},  // Ragione Sociale
            {wch:18},  // Partita IVA
            {wch:30},  // Indirizzo
            {wch:15},  // Telefono
            {wch:20},  // Settore
            {wch:30},  // Note Aziendali
            {wch:20},  // Creato da (Parent ID)
            {wch:25},  // Creato da (Parent Username)
            {wch:15}   // Tipo Utente
        ];
        
        // Scrivi il file
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        saveAsExcelFile(excelBuffer, `cropbook_utenti_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        showNotification(`Esportati ${users.length} utenti con successo!`, 'success');
        
    } catch (error) {
        console.error('Errore export utenti:', error);
        showNotification('Errore nell\'esportazione degli utenti', 'error');
    }
}

// Funzione per salvare il file Excel
function saveAsExcelFile(buffer, fileName) {
    const data = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(data);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
}

async function exportAllLotsData() {
    try {
        showNotification('Generazione export lotti in corso...', 'loading');
        
        const response = await apiCall('/lots');
        const lots = response.data || [];
        
        if (lots.length === 0) {
            showNotification('Nessun lotto da esportare', 'warning');
            return;
        }
        
        // Prepara i dati per l'export
        const exportData = lots.map(lot => {
            return {
                'ID Lotto': lot.id,
                'Azienda': lot.company_name,
                'Luogo': lot.location,
                'Tipologia Prodotto': lot.product_type,
                'Prodotto': lot.product_category || '',
                'Varietà': lot.variety || '',
                'Lotto Campo': lot.field_lot || '',
                'Superficie (ettari)': lot.field_size || '',
                'Coordinate GPS': lot.gps_coordinates || '',
                'Proprietario ID': lot.owner_id || '',
                'Proprietario Username': lot.owner_username || '',
                'Creato da': lot.created_by || '',
                'Data Creazione': new Date(lot.created_at).toLocaleDateString('it-IT'),
                'Ultimo Aggiornamento': lot.updated_at ? new Date(lot.updated_at).toLocaleDateString('it-IT') : ''
            };
        });
        
        // Crea workbook e worksheet
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Lotti');
        
        // Imposta larghezza colonne
        worksheet['!cols'] = [
            {wch:10},  // ID Lotto
            {wch:20},  // Azienda
            {wch:20},  // Luogo
            {wch:18},  // Tipologia Prodotto
            {wch:15},  // Prodotto
            {wch:15},  // Varietà
            {wch:15},  // Lotto Campo
            {wch:15},  // Superficie
            {wch:50},  // Coordinate GPS
            {wch:15},  // Proprietario ID
            {wch:20},  // Proprietario Username
            {wch:15},  // Creato da
            {wch:15},  // Data Creazione
            {wch:15}   // Ultimo Aggiornamento
        ];
        
        // Salva file
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        saveAsExcelFile(excelBuffer, `cropbook_lotti_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        showNotification(`Esportati ${lots.length} lotti con successo!`, 'success');
        
    } catch (error) {
        console.error('Errore export lotti:', error);
        showNotification('Errore nell\'esportazione dei lotti', 'error');
    }
}

async function exportAllActivitiesData() {
    try {
        showNotification('Generazione export attività in corso...', 'loading');
        
        // Prima recupera tutti i lotti
        const lotsResponse = await apiCall('/lots');
        const lots = lotsResponse.data || [];
        
        if (lots.length === 0) {
            showNotification('Nessun lotto trovato', 'warning');
            return;
        }
        
        let allActivities = [];
        
        // Per ogni lotto, recupera le attività
        for (const lot of lots) {
            try {
                const activitiesResponse = await apiCall(`/activities/${lot.id}`);
                const activities = activitiesResponse.data || [];
                
                for (const activity of activities) {
                    allActivities.push({
                        'ID Lotto': lot.id,
                        'Azienda': lot.company_name,
                        'Luogo': lot.location,
                        'Tipologia Prodotto': lot.product_type,
                        'Prodotto': lot.product_category || '',
                        'Varietà': lot.variety || '',
                        'Data Raccolta': new Date(activity.date).toLocaleDateString('it-IT'),
                        'Kg Raccolti': activity.kg,
                        'Note': activity.notes || '',
                        'Registrato il': new Date(activity.created_at).toLocaleDateString('it-IT'),
                        'Registrato da': activity.created_by || ''
                    });
                }
            } catch(e) {
                console.error(`Errore recupero attività per lotto ${lot.id}:`, e);
            }
        }
        
        if (allActivities.length === 0) {
            showNotification('Nessuna attività da esportare', 'warning');
            return;
        }
        
        // Crea workbook e worksheet
        const worksheet = XLSX.utils.json_to_sheet(allActivities);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Attività Raccolta');
        
        // Imposta larghezza colonne
        worksheet['!cols'] = [
            {wch:10},  // ID Lotto
            {wch:20},  // Azienda
            {wch:20},  // Luogo
            {wch:18},  // Tipologia Prodotto
            {wch:15},  // Prodotto
            {wch:15},  // Varietà
            {wch:15},  // Data Raccolta
            {wch:12},  // Kg Raccolti
            {wch:30},  // Note
            {wch:15},  // Registrato il
            {wch:15}   // Registrato da
        ];
        
        // Salva file
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        saveAsExcelFile(excelBuffer, `cropbook_attivita_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        showNotification(`Esportate ${allActivities.length} attività con successo!`, 'success');
        
    } catch (error) {
        console.error('Errore export attività:', error);
        showNotification('Errore nell\'esportazione delle attività', 'error');
    }
}

async function exportAllEconomicData() {
    try {
        showNotification('Generazione export dati economici in corso...', 'loading');
        
        // Recupera tutti i lotti
        const lotsResponse = await apiCall('/lots');
        const lots = lotsResponse.data || [];
        
        if (lots.length === 0) {
            showNotification('Nessun lotto trovato', 'warning');
            return;
        }
        
        let allEconomicRecords = [];
        
        // Per ogni lotto, recupera i dati economici
        for (const lot of lots) {
            try {
                // Usa apiCall che già gestisce il token
                const economicResponse = await apiCall(`/economic/${lot.id}`);
                const records = economicResponse.data || [];
                
                console.log(`Lotto ${lot.id} (${lot.company_name}): ${records.length} record economici`);
                
                for (const record of records) {
                    // Gestisci beni durevoli
                    let beniDurevoliText = '';
                    if (record.beni_durevoli) {
                        try {
                            let beni = record.beni_durevoli;
                            if (typeof beni === 'string') {
                                beni = JSON.parse(beni);
                            }
                            if (Array.isArray(beni) && beni.length > 0) {
                                beniDurevoliText = beni.map(b => `${b.descrizione || 'N/D'}: €${b.costo || 0}`).join('; ');
                            }
                        } catch(e) {
                            beniDurevoliText = String(record.beni_durevoli);
                        }
                    }
                    
                    allEconomicRecords.push({
                        'ID Lotto': lot.id,
                        'Azienda': lot.company_name,
                        'Luogo': lot.location,
                        'Tipologia Prodotto': lot.product_type,
                        'Prodotto': lot.product_category || '',
                        'Varietà': lot.variety || '',
                        'Stagione Agricola': record.stagione_agricola || record.stagioneAgricola || '',
                        'Data Acquisto/Vendita': (record.data_acquisto_vendita || record.dataAcquistoVendita) ? 
                            new Date(record.data_acquisto_vendita || record.dataAcquistoVendita).toLocaleDateString('it-IT') : '',
                        'Metodo Calcolo': (record.metodo_calcolo || record.metodoCalcolo) === 'kg' ? 'Prezzo al kg' : 'Prezzo totale',
                        'Prezzo (€/kg)': record.prezzo_kg || record.prezzoKg || 0,
                        'Prezzo Totale (€)': record.prezzo_totale || record.prezzoTotale || 0,
                        'Kg Raccolti': record.totale_kg || record.totaleKg || 0,
                        'Ricavi Totali (€)': record.ricavi_totali || record.ricaviTotali || 0,
                        'Costo Mezzi Tecnici (€)': record.costo_mezzi_tecnici || record.costoMezziTecnici || 0,
                        'Costo Personale (€)': record.costo_personale || record.costoPersonale || 0,
                        'Costo Beni Durevoli (€)': 0,
                        'Costi Totali (€)': record.costi_totali || record.costiTotali || 0,
                        'Bilancio (€)': record.bilancio || 0,
                        'Beni Durevoli (dettaglio)': beniDurevoliText,
                        'Registrato il': new Date(record.created_at || record.createdAt).toLocaleDateString('it-IT'),
                        'Registrato da': record.created_by || record.createdBy || ''
                    });
                }
            } catch(e) {
                console.error(`Errore recupero dati economici per lotto ${lot.id}:`, e.message);
            }
        }
        
        if (allEconomicRecords.length === 0) {
            showNotification('Nessun dato economico trovato nel database', 'warning');
            return;
        }
        
        // Crea workbook e worksheet
        const worksheet = XLSX.utils.json_to_sheet(allEconomicRecords);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Dati Economici');
        
        // Imposta larghezza colonne
        worksheet['!cols'] = [
            {wch:10}, {wch:20}, {wch:20}, {wch:18}, {wch:15},
            {wch:15}, {wch:12}, {wch:15}, {wch:15}, {wch:12},
            {wch:12}, {wch:12}, {wch:15}, {wch:15}, {wch:15},
            {wch:18}, {wch:15}, {wch:15}, {wch:40}, {wch:15}, {wch:15}
        ];
        
        // Salva file
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        saveAsExcelFile(excelBuffer, `cropbook_economico_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        showNotification(`Esportati ${allEconomicRecords.length} record economici con successo!`, 'success');
        
    } catch (error) {
        console.error('Errore export dati economici:', error);
        showNotification('Errore nell\'esportazione dei dati economici: ' + error.message, 'error');
    }
}

function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    // Ottieni tutte le chiavi (colonne) dal primo oggetto
    const headers = Object.keys(data[0]);
    
    // Crea le righe CSV
    const csvRows = [];
    
    // Aggiungi intestazioni (usa ; come separatore per Excel italiano)
    csvRows.push(headers.join(';'));
    
    // Aggiungi dati
    for (const row of data) {
        const values = headers.map(header => {
            let val = row[header];
            
            // Se è undefined o null, stringa vuota
            if (val === undefined || val === null) {
                val = '';
            }
            
            // Se è un oggetto, converti in JSON
            if (typeof val === 'object') {
                val = JSON.stringify(val);
            }
            
            // Converti in stringa
            let strVal = String(val);
            
            // Se contiene punto e virgola, virgolette o newline, racchiudi tra virgolette
            if (strVal.includes(';') || strVal.includes('"') || strVal.includes('\n') || strVal.includes(',')) {
                // Raddoppia le virgolette
                strVal = strVal.replace(/"/g, '""');
                strVal = `"${strVal}"`;
            }
            
            return strVal;
        });
        csvRows.push(values.join(';'));
    }
    
    return csvRows.join('\n');
}

function downloadCSV(csv, filename) {
    // Aggiungi BOM per supporto caratteri italiani
    // Specifica che il separatore è il punto e virgola
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Inizializza accesso sviluppatore
initDeveloperAccess();

function showPrivacyPolicy() {
    document.getElementById('privacy-modal').style.display = 'flex';
}

function closePrivacyModal() {
    document.getElementById('privacy-modal').style.display = 'none';
}

// Chiudi il modale cliccando fuori
const privacyModal = document.getElementById('privacy-modal');
if (privacyModal) {
    privacyModal.addEventListener('click', function(e) {
        if (e.target === this) {
            closePrivacyModal();
        }
    });
}

// ==================== VARIABILI GLOBALI SEZIONE COSTI ====================
let currentCostiLotId = null;
let currentCostiStagione = null;
let beniDurevoliCostiCount = 0;
let currentVistaMezzi = 'giornaliera';

// ==================== INIZIALIZZAZIONE SEZIONE COSTI ====================
// Funzione per inizializzare il dropdown dei lotti nella sezione costi
function initCostiLotDropdown() {
    const dropdownBtn = document.getElementById('costiLotDropdown');
    const dropdownMenu = document.getElementById('costi-lot-dropdown-menu');
    
    if (!dropdownBtn || !dropdownMenu) return;
    
    // Rimuovi listener precedenti
    dropdownBtn.removeEventListener('click', toggleCostiDropdown);
    
    // Aggiungi listener per toggle
    dropdownBtn.addEventListener('click', toggleCostiDropdown);
    
    // Chiudi dropdown cliccando fuori
    document.addEventListener('click', function(e) {
        if (!dropdownBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.remove('show');
        }
    });
}

function toggleCostiDropdown(e) {
    e.stopPropagation();
    const dropdownMenu = document.getElementById('costi-lot-dropdown-menu');
    if (dropdownMenu) {
        dropdownMenu.classList.toggle('show');
    }
}

function initGestioneCosti() {
    const dropdownMenu = document.getElementById('costi-lot-dropdown-menu');
    if (!dropdownMenu || allLots.length === 0) return;
    
    dropdownMenu.innerHTML = '';
    
    allLots.forEach(lot => {
        const dropdownItem = document.createElement('button');
        dropdownItem.className = 'dropdown-item';
        dropdownItem.type = 'button';
        dropdownItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div>
                    <strong>${lot.company_name}</strong><br>
                    <small>${lot.location} - ${lot.variety || ''}</small>
                </div>
                <span style="background: #FF5722; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">
                    ${lot.product_type}
                </span>
            </div>
        `;
        dropdownItem.addEventListener('click', (e) => {
            e.stopPropagation();
            loadCostiLotDetails(lot.id);
            dropdownMenu.classList.remove('show');
        });
        dropdownMenu.appendChild(dropdownItem);
    });
    
    // ✅ Inizializza il toggle del dropdown
    initCostiLotDropdown();
    // ✅ Inizializza beni durevoli con un campo vuoto
    initBeniDurevoliCosti();
}

// ==================== VARIABILI BILANCIO ====================
let currentBilancioLotId = null;
let chartRicaviCosti = null;
let chartDettaglioCosti = null;
let chartMultiStagione = null;

// ==================== INIZIALIZZAZIONE BILANCIO ====================
function initBilancioSection() {
    const dropdownMenu = document.getElementById('bilancio-lot-dropdown-menu');
    if (!dropdownMenu || allLots.length === 0) return;
    
    dropdownMenu.innerHTML = '';
    allLots.forEach(lot => {
        const item = document.createElement('button');
        item.className = 'dropdown-item';
        item.type = 'button';
        item.innerHTML = `<strong>${lot.company_name}</strong><br><small>${lot.location}</small>`;
        item.addEventListener('click', () => {
            loadBilancioData(lot.id);
            dropdownMenu.classList.remove('show');
        });
        dropdownMenu.appendChild(item);
    });
    
    // Inizializza dropdown click
    const dropdownBtn = document.getElementById('bilancioLotDropdown');
    const dropdown = document.getElementById('bilancio-lot-dropdown-menu');
    dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });
}

// ==================== CARICA DATI BILANCIO ====================
async function loadBilancioData(lotId) {
    currentBilancioLotId = lotId;
    if (typeof syncActiveLotId === 'function') syncActiveLotId(lotId);
    
    const lot = allLots.find(l => l.id === parseInt(lotId));
    const badge = document.getElementById('bilancio-lot-badge');
    if (lot && badge) {
        badge.textContent = `📋 ${lot.company_name} - ${lot.location}`;
        badge.style.display = 'inline-block';
    }
    
    // Popola stagioni
    const stagioneSelect = document.getElementById('bilancio-stagione');
    const stagioni = new Set();
    
    try {
        // Carica registrazioni economiche
        const economicResponse = await apiCall(`/economic/${lotId}`);
        const records = economicResponse.data || [];
        records.forEach(r => { if (r.stagione_agricola) stagioni.add(r.stagione_agricola); });
        
        // Carica costi personale
        const personaleResponse = await apiCall(`/costi/personale/${lotId}/2020`);
        (personaleResponse.data || []).forEach(r => { if (r.stagione_agricola) stagioni.add(r.stagione_agricola); });
        
        // Carica mezzi tecnici
        const mezziResponse = await apiCall(`/costi/mezzi/${lotId}/2020`);
        (mezziResponse.data || []).forEach(r => { if (r.stagione_agricola) stagioni.add(r.stagione_agricola); });
        
    } catch(e) {}
    
    stagioneSelect.innerHTML = '<option value="">Tutte le stagioni</option>';
    [...stagioni].sort().reverse().forEach(s => {
        stagioneSelect.innerHTML += `<option value="${s}">📅 Stagione ${s}</option>`;
    });
    
    stagioneSelect.onchange = function() {
        aggiornaDashboardBilancio(lotId, this.value);
    };
    
    aggiornaDashboardBilancio(lotId, '');
}

// ==================== AGGIORNA DASHBOARD ====================
async function aggiornaDashboardBilancio(lotId, stagione) {
    showNotification('Caricamento dati...', 'loading');
    
    let ricaviTotali = 0;
    let costiPersonale = 0;
    let costiMezziTecnici = 0;
    let costiAmmortamenti = 0;
    
    try {
        // Ricavi dalla sezione economica
        const economicResponse = await apiCall(`/economic/${lotId}`);
        let records = economicResponse.data || [];
        if (stagione) records = records.filter(r => r.stagione_agricola === stagione);
        ricaviTotali = records.reduce((sum, r) => sum + (r.ricavi_totali || 0), 0);
        
        // ✅ Costi personale + mezzi tecnici: se stagione specifica → un solo fetch,
        //   se "Tutte le stagioni" → fetch su TUTTE le stagioni presenti nei record e somma.
        const stagioniDaSommare = stagione
            ? [stagione]
            : [...new Set(records.map(r => r.stagione_agricola).filter(Boolean))];
        
        if (stagioniDaSommare.length > 0) {
            const totaliPersonale = await Promise.all(
                stagioniDaSommare.map(s => apiCall(`/costi/personale/${lotId}/${s}`).catch(() => ({ totale: 0 })))
            );
            const totaliMezzi = await Promise.all(
                stagioniDaSommare.map(s => apiCall(`/costi/mezzi/${lotId}/${s}`).catch(() => ({ totale: 0 })))
            );
            costiPersonale = totaliPersonale.reduce((s, r) => s + Number(r.totale || 0), 0);
            costiMezziTecnici = totaliMezzi.reduce((s, r) => s + Number(r.totale || 0), 0);
        }
        
        // Ammortamenti dalle registrazioni economiche
        records.forEach(record => {
            if (record.beni_durevoli) {
                try {
                    const beni = typeof record.beni_durevoli === 'string' ? JSON.parse(record.beni_durevoli) : record.beni_durevoli;
                    if (Array.isArray(beni)) {
                        beni.forEach(bene => {
                            const anno = parseInt(record.stagione_agricola) || new Date().getFullYear();
                            const inizio = bene.anno_inizio || anno;
                            const fine = inizio + (bene.anni_ammortamento || 1) - 1;
                            if (anno >= inizio && anno <= fine) {
                                costiAmmortamenti += bene.quota_annuale || 0;
                            }
                        });
                    }
                } catch(e) {}
            }
        });
        
    } catch(e) {
        console.error('Errore caricamento bilancio:', e);
    }
    
    const costiTotali = costiPersonale + costiMezziTecnici + costiAmmortamenti;
    const bilancio = ricaviTotali - costiTotali;
    
    // Aggiorna card
    document.getElementById('bilancio-ricavi').textContent = `€${ricaviTotali.toFixed(2)}`;
    document.getElementById('bilancio-costi').textContent = `€${costiTotali.toFixed(2)}`;
    document.getElementById('bilancio-finale').textContent = `€${bilancio.toFixed(2)}`;
    
    // Aggiorna grafici
    aggiornaGrafici(ricaviTotali, costiPersonale, costiMezziTecnici, costiAmmortamenti);
    
    // ✅ Grafico multi-stagione (ultime 5) — fire-and-forget, non blocca
    aggiornaGraficoMultiStagione(lotId).catch(err => console.error('multi-stagione error:', err));
    
    showNotification('Dati caricati!', 'success');
}

// ==================== GRAFICI CHART.JS ====================
function aggiornaGrafici(ricavi, personale, mezzi, ammortamenti) {
    const costiTotali = personale + mezzi + ammortamenti;
    const totaleComplessivo = ricavi + costiTotali;
    
    // Funzione per calcolare la percentuale
    const percentuale = (valore) => totaleComplessivo > 0 ? ((valore / totaleComplessivo) * 100).toFixed(1) : '0.0';
    
    // Grafico Ricavi vs Costi
    const ctx1 = document.getElementById('chart-ricavi-costi')?.getContext('2d');
    if (ctx1) {
        if (chartRicaviCosti) chartRicaviCosti.destroy();
        chartRicaviCosti = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: [`Ricavi (${percentuale(ricavi)}%)`, `Costi (${percentuale(costiTotali)}%)`],
                datasets: [{
                    data: [ricavi || 0.01, costiTotali || 0.01],
                    backgroundColor: ['#4CAF50', '#f44336'],
                    borderWidth: 3,
                    borderColor: '#fff',
                    hoverBorderColor: '#fff',
                    hoverBorderWidth: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { 
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            font: { size: 13 },
                            usePointStyle: true,
                            pointStyleWidth: 12
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                const valore = ctx.raw;
                                const perc = ((valore / totaleComplessivo) * 100).toFixed(1);
                                return `${ctx.label.split(' (')[0]}: €${valore.toFixed(2)} (${perc}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Grafico Dettaglio Costi
    const ctx2 = document.getElementById('chart-dettaglio-costi')?.getContext('2d');
    if (ctx2) {
        if (chartDettaglioCosti) chartDettaglioCosti.destroy();
        
        const percentualeCosti = (valore) => costiTotali > 0 ? ((valore / costiTotali) * 100).toFixed(1) : '0.0';
        
        chartDettaglioCosti = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: [
                    `Personale (${percentualeCosti(personale)}%)`, 
                    `Mezzi Tecnici (${percentualeCosti(mezzi)}%)`, 
                    `Ammortamenti (${percentualeCosti(ammortamenti)}%)`
                ],
                datasets: [{
                    data: [personale || 0.01, mezzi || 0.01, ammortamenti || 0.01],
                    backgroundColor: ['#FF5722', '#2196F3', '#9C27B0'],
                    borderWidth: 3,
                    borderColor: '#fff',
                    hoverBorderColor: '#fff',
                    hoverBorderWidth: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { 
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            font: { size: 13 },
                            usePointStyle: true,
                            pointStyleWidth: 12
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                const valore = ctx.raw;
                                const perc = ((valore / costiTotali) * 100).toFixed(1);
                                return `${ctx.label.split(' (')[0]}: €${valore.toFixed(2)} (${perc}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
}

// ✅ CONFRONTO ULTIME 5 STAGIONI — Card list (mobile-friendly, no canvas illeggibile)
async function aggiornaGraficoMultiStagione(lotId) {
    const container = document.getElementById('multi-stagione-list');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#888;"><i class="fas fa-spinner fa-spin"></i> Caricamento confronto stagioni...</div>';
    
    // Recupera tutte le registrazioni del lotto
    const resp = await apiCall(`/economic/${lotId}`);
    const records = resp.data || [];
    
    const stagioniSet = new Set(records.map(r => r.stagione_agricola).filter(Boolean));
    const annoCorrente = new Date().getFullYear();
    stagioniSet.add(String(annoCorrente));
    const stagioni = Array.from(stagioniSet).sort((a, b) => parseInt(b) - parseInt(a)).slice(0, 5);
    
    const datiStagioni = [];
    for (const s of stagioni) {
        const recsS = records.filter(r => String(r.stagione_agricola) === String(s));
        const ricavi = recsS.reduce((sum, r) => sum + Number(r.ricavi_totali || 0), 0);
        let personale = 0, mezzi = 0;
        try { personale = Number((await apiCall(`/costi/personale/${lotId}/${s}`)).totale || 0); } catch (_) {}
        try { mezzi = Number((await apiCall(`/costi/mezzi/${lotId}/${s}`)).totale || 0); } catch (_) {}
        let amm = 0;
        if (typeof caricaBeniDurevoliAttivi === 'function') {
            const attivi = caricaBeniDurevoliAttivi(records, parseInt(s));
            amm = attivi.reduce((sum, b) => sum + Number(b.quota_annuale || 0), 0);
        }
        const costi = personale + mezzi + amm;
        datiStagioni.push({ stagione: s, ricavi, personale, mezzi, amm, costi, bilancio: ricavi - costi });
    }
    
    if (datiStagioni.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#888; font-style: italic;">Nessuna stagione da confrontare.</div>';
        return;
    }
    
    // Trova il valore max per scalare le barre orizzontali in modo proporzionale
    const maxValore = Math.max(...datiStagioni.flatMap(d => [d.ricavi, d.costi]), 1);
    
    container.innerHTML = datiStagioni.map(d => {
        const wRicavi = (d.ricavi / maxValore * 100).toFixed(1);
        const wCosti = (d.costi / maxValore * 100).toFixed(1);
        const bilancioPositivo = d.bilancio >= 0;
        // Breakdown costi: percentuali sulla larghezza dei costi totali
        const pctPersonale = d.costi > 0 ? (d.personale / d.costi * 100) : 0;
        const pctMezzi = d.costi > 0 ? (d.mezzi / d.costi * 100) : 0;
        const pctAmm = d.costi > 0 ? (d.amm / d.costi * 100) : 0;
        
        return `
            <div class="multi-stagione-card">
                <div class="ms-card-header">
                    <span class="ms-card-title">📆 ${d.stagione}</span>
                    <span class="ms-card-bilancio ${bilancioPositivo ? 'positivo' : 'negativo'}">
                        ${bilancioPositivo ? '▲' : '▼'} €${d.bilancio.toFixed(2)}
                    </span>
                </div>
                <div class="ms-card-body">
                    <div class="ms-row">
                        <span class="ms-label"><i class="fas fa-arrow-up" style="color:#4CAF50;"></i> Ricavi</span>
                        <div class="ms-bar-wrapper">
                            <div class="ms-bar ms-bar-ricavi" style="width: ${wRicavi}%;"></div>
                        </div>
                        <span class="ms-value">€${d.ricavi.toFixed(2)}</span>
                    </div>
                    <div class="ms-row">
                        <span class="ms-label"><i class="fas fa-arrow-down" style="color:#f44336;"></i> Costi</span>
                        <div class="ms-bar-wrapper">
                            <div class="ms-bar-stack" style="width: ${wCosti}%;">
                                ${d.personale > 0 ? `<div class="ms-bar-segment seg-personale" style="width: ${pctPersonale}%;" title="Personale €${d.personale.toFixed(2)}"></div>` : ''}
                                ${d.mezzi > 0 ? `<div class="ms-bar-segment seg-mezzi" style="width: ${pctMezzi}%;" title="Mezzi tecnici €${d.mezzi.toFixed(2)}"></div>` : ''}
                                ${d.amm > 0 ? `<div class="ms-bar-segment seg-amm" style="width: ${pctAmm}%;" title="Ammortamenti €${d.amm.toFixed(2)}"></div>` : ''}
                            </div>
                        </div>
                        <span class="ms-value">€${d.costi.toFixed(2)}</span>
                    </div>
                    <div class="ms-breakdown">
                        ${d.personale > 0 ? `<span class="ms-chip chip-personale">👥 Pers. €${d.personale.toFixed(0)}</span>` : ''}
                        ${d.mezzi > 0 ? `<span class="ms-chip chip-mezzi">🧪 Mezzi €${d.mezzi.toFixed(0)}</span>` : ''}
                        ${d.amm > 0 ? `<span class="ms-chip chip-amm">📦 Amm. €${d.amm.toFixed(0)}</span>` : ''}
                        ${(d.personale + d.mezzi + d.amm) === 0 ? '<span class="ms-chip ms-chip-empty">Nessun costo</span>' : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== ESPORTAZIONE PDF (Report Bilancio) ====================
async function esportaBilancioPDF() {
    if (!currentBilancioLotId) {
        showNotification('Seleziona prima un lotto', 'warning');
        return;
    }
    showNotification('Generazione PDF in corso...', 'loading');
    showSpinner('Generazione PDF...');
    try {
        const stagione = document.getElementById('bilancio-stagione')?.value || '';
        const token = localStorage.getItem('auth_token');
        const url = `${API_BASE_URL}/reports/bilancio/${currentBilancioLotId}` +
                    (stagione ? `?stagione=${encodeURIComponent(stagione)}` : '');

        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) {
            let msg = 'Errore generazione PDF';
            try { msg = (await res.json()).error || msg; } catch(_) {}
            throw new Error(msg);
        }

        const blob = await res.blob();
        const lot = allLots.find(l => l.id === parseInt(currentBilancioLotId));
        const lotName = (lot?.company_name || 'lotto').replace(/[^a-z0-9]/gi, '_');
        const filename = `bilancio_${lotName}_${stagione || 'tutte'}.pdf`;

        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);

        hideSpinner();
        showNotification('Report PDF scaricato 📄', 'success');
    } catch (error) {
        hideSpinner();
        console.error('Errore PDF:', error);
        showNotification(error.message || 'Errore nella generazione PDF', 'error');
    }
}


// ==================== ESPORTAZIONE EXCEL COMPLETA ====================
async function esportaBilancioCompleto() {
    if (!currentBilancioLotId) {
        showNotification('Seleziona prima un lotto', 'warning');
        return;
    }
    
    showNotification('Generazione report Excel...', 'loading');
    
    try {
        showSpinner('Generazione report Excel...');
        const workbook = XLSX.utils.book_new();
        const lot = allLots.find(l => l.id === parseInt(currentBilancioLotId));
        
        // 1. Foglio Lotto
        const lotSheet = XLSX.utils.json_to_sheet([{
            'ID Lotto': lot?.id || '',
            'Azienda': lot?.company_name || '',
            'Luogo': lot?.location || '',
            'Prodotto': lot?.product_type || '',
            'Categoria': lot?.product_category || '',
            'Varietà': lot?.variety || '',
            'Lotto Campo': lot?.field_lot || '',
            'Superficie (ha)': lot?.field_size || '',
            'GPS': lot?.gps_coordinates || ''
        }]);
        XLSX.utils.book_append_sheet(workbook, lotSheet, 'Lotto');
        
        // 2. Foglio Ricavi
        try {
            const economicRes = await apiCall(`/economic/${currentBilancioLotId}`);
            if (economicRes.data?.length > 0) {
                const ricaviSheet = XLSX.utils.json_to_sheet(economicRes.data.map(r => ({
                    'Stagione': r.stagione_agricola || '',
                    'Data': r.data_acquisto_vendita || '',
                    'Metodo': r.metodo_calcolo || '',
                    'Prezzo/kg': r.prezzo_kg || 0,
                    'Prezzo Totale': r.prezzo_totale || 0,
                    'Kg Raccolti': r.totale_kg || 0,
                    'Ricavi Totali': r.ricavi_totali || 0,
                    'Costo Personale': r.costo_personale || 0
                })));
                XLSX.utils.book_append_sheet(workbook, ricaviSheet, 'Ricavi');
            }
        } catch(e) {}
        
        // 3. Foglio Attività Raccolta
        try {
            const activitiesRes = await apiCall(`/activities/${currentBilancioLotId}`);
            if (activitiesRes.data?.length > 0) {
                const activitiesSheet = XLSX.utils.json_to_sheet(activitiesRes.data.map(a => ({
                    'Data': a.date || '',
                    'Kg': a.kg || 0,
                    'Note': a.notes || ''
                })));
                XLSX.utils.book_append_sheet(workbook, activitiesSheet, 'Raccolta');
            }
        } catch(e) {}
        
        // 4. Foglio Analisi
        try {
            const analysesRes = await apiCall(`/analyses/${currentBilancioLotId}`);
            if (analysesRes.data?.length > 0) {
                const analysesSheet = XLSX.utils.json_to_sheet(analysesRes.data.map(a => ({
                    'Anno': a.year || '',
                    'Nome File': a.original_name || '',
                    'Data Caricamento': a.created_at || '',
                    'Note': a.notes || ''
                })));
                XLSX.utils.book_append_sheet(workbook, analysesSheet, 'Analisi');
            }
        } catch(e) {}
        
        // 5. Foglio Costi Personale (tutte le stagioni)
        try {
            const stagioni = new Set();
            const economicData = await apiCall(`/economic/${currentBilancioLotId}`);
            (economicData.data || []).forEach(r => { if (r.stagione_agricola) stagioni.add(r.stagione_agricola); });
            
            let tuttiCostiPersonale = [];
            for (const stagione of stagioni) {
                try {
                    const persRes = await apiCall(`/costi/personale/${currentBilancioLotId}/${stagione}`);
                    if (persRes.data?.length > 0) {
                        tuttiCostiPersonale = tuttiCostiPersonale.concat(persRes.data);
                    }
                } catch(e) {}
            }
            
            if (tuttiCostiPersonale.length > 0) {
                const costiPersSheet = XLSX.utils.json_to_sheet(tuttiCostiPersonale.map(c => ({
                    'Stagione': c.stagione_agricola || '',
                    'Data': c.data_attivita || '',
                    'Operatori': c.numero_operatori || 0,
                    'Qualifica': c.qualifica || '',
                    'Ore': c.ore_lavorate || 0,
                    'Attività': c.attivita || '',
                    'Costo Orario': c.costo_orario || 0,
                    'Costo Totale': c.costo_totale || 0,
                    'Note': c.note || ''
                })));
                XLSX.utils.book_append_sheet(workbook, costiPersSheet, 'Costi Personale');
            }
        } catch(e) {}
        
        // 6. Foglio Mezzi Tecnici
        try {
            const stagioni = new Set();
            const economicData = await apiCall(`/economic/${currentBilancioLotId}`);
            (economicData.data || []).forEach(r => { if (r.stagione_agricola) stagioni.add(r.stagione_agricola); });
            
            let tuttiMezzi = [];
            for (const stagione of stagioni) {
                try {
                    const mezziRes = await apiCall(`/costi/mezzi/${currentBilancioLotId}/${stagione}`);
                    if (mezziRes.data?.length > 0) tuttiMezzi = tuttiMezzi.concat(mezziRes.data);
                } catch(e) {}
            }
            
            if (tuttiMezzi.length > 0) {
                const mezziSheet = XLSX.utils.json_to_sheet(tuttiMezzi.map(m => ({
                    'Stagione': m.stagione_agricola || '',
                    'Data': m.data_registrazione || '',
                    'Categoria': m.categoria || '',
                    'Descrizione': m.descrizione || '',
                    'Importo': m.importo || 0
                })));
                XLSX.utils.book_append_sheet(workbook, mezziSheet, 'Mezzi Tecnici');
            }
        } catch(e) {}
        
        // Salva file
        const nomeFile = `Cropbook_Report_${lot?.company_name || 'Lotto'}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, nomeFile);
        
        showNotification('Report Excel generato con successo!', 'success');
        hideSpinner();
    } catch(error) {
        console.error('Errore esportazione:', error);
        showNotification('Errore nella generazione del report: ' + error.message, 'error');
        hideSpinner();
    }
}

// ==================== CARICAMENTO LOTTO NELLA SEZIONE COSTI ====================
async function loadCostiLotDetails(lotId) {
    currentCostiLotId = lotId;
    if (typeof syncActiveLotId === 'function') syncActiveLotId(lotId);
    
    const lot = allLots.find(l => l.id === parseInt(lotId));
    if (lot) {
        document.getElementById('costi-lot-info').innerHTML = `
            <h4><i class="fas fa-building"></i> ${lot.company_name}</h4>
            <p><i class="fas fa-map-marker-alt"></i> ${lot.location}</p>
            <p><i class="fas fa-wine-bottle"></i> ${lot.product_type} - ${lot.variety || ''}</p>
            ${lot.field_lot ? `<p><i class="fas fa-map"></i> Lotto Campo: ${lot.field_lot}</p>` : ''}
        `;
        document.getElementById('costi-lot-info').style.display = 'block';
    }
    
    // 1. Imposta stagione default
    const annoCorrente = new Date().getFullYear();
    currentCostiStagione = annoCorrente;
    currentTariffeStagione = annoCorrente; // ✅ Sincronizza
    
    // 2. Popola il selettore stagione tariffe
    popolaStagioniTariffe();
    
    // 3. Carica tariffe
    await loadTariffeManodopera(annoCorrente);
    
    // 4. Popola dropdown attività predefinite
    await popolaAttivitaPredefinite();
    
    // 5. Carica costi personale
    await loadCostiPersonale(lotId, annoCorrente);
    
    // 6. Carica mezzi tecnici
    await loadMezziTecnici(lotId, annoCorrente);
    
    // 7. Carica beni durevoli (usa caricaBeniDurevoliAttivi internamente)
    await loadBeniDurevoliCosti(lotId, annoCorrente);
    
    // 8. Aggiorna il riepilogo totale costi
    aggiornaRiepilogoCosti();
}
// ==================== TARIFFE MANODOPERA ====================

async function loadTariffeManodopera(stagione) {
    try {
        const response = await apiCall(`/costi/tariffe/${stagione}`);
        const tariffa = response.data;
        document.getElementById('tariffa-standard').value = tariffa.costo_orario_standard || 15.00;
        document.getElementById('tariffa-specializzato').value = tariffa.costo_orario_specializzato || 22.00;
    } catch (error) {
        console.error('Errore caricamento tariffe:', error);
    }
}

async function salvaTariffeManodopera() {
    const stagione = currentCostiStagione || new Date().getFullYear();
    const standard = parseFloat(document.getElementById('tariffa-standard').value) || 15.00;
    const specializzato = parseFloat(document.getElementById('tariffa-specializzato').value) || 22.00;
    
    try {
        await apiCall(`/costi/tariffe/${stagione}`, {
            method: 'PUT',
            body: {
                costo_orario_standard: standard,
                costo_orario_specializzato: specializzato
            }
        });
        showNotification('Tariffe aggiornate con successo!', 'success');
    } catch (error) {
        showNotification('Errore aggiornamento tariffe: ' + error.message, 'error');
    }
}

// ==================== GESTIONE STAGIONE TARIFFE ====================

// Variabile per tenere traccia della stagione selezionata per le tariffe
let currentTariffeStagione = new Date().getFullYear();

// Popola il selettore stagione per le tariffe
function popolaStagioniTariffe() {
    const select = document.getElementById('tariffe-stagione-select');
    if (!select) return;
    
    const annoCorrente = new Date().getFullYear();
    select.innerHTML = '';
    
    // Opzioni da 5 anni fa a 5 anni nel futuro
    for (let anno = annoCorrente - 5; anno <= annoCorrente + 5; anno++) {
        const option = document.createElement('option');
        option.value = anno;
        option.textContent = anno;
        if (anno === currentTariffeStagione) {
            option.selected = true;
        }
        select.appendChild(option);
    }
}

// Cambia stagione e ricarica le tariffe
async function cambiaStagioneTariffe() {
    const select = document.getElementById('tariffe-stagione-select');
    if (!select) return;
    
    currentTariffeStagione = parseInt(select.value);
    currentCostiStagione = parseInt(select.value); // ✅ Aggiorna anche la stagione costi
    
    // Ricarica le tariffe
    await loadTariffeManodopera(currentTariffeStagione);
    
    // ✅ Ricarica TUTTI i costi per la nuova stagione
    if (currentCostiLotId) {
        await loadCostiPersonale(currentCostiLotId, currentTariffeStagione);
        await loadMezziTecnici(currentCostiLotId, currentTariffeStagione);
        await loadBeniDurevoliCosti(currentCostiLotId, currentTariffeStagione);
        aggiornaRiepilogoCosti();
    }
    
    // ✅ Aggiorna badge stagione
    const badge = document.getElementById('costi-stagione-badge');
    if (badge) badge.textContent = `Anno ${currentTariffeStagione}`;
}

// Modifica loadTariffeManodopera per usare currentTariffeStagione
async function loadTariffeManodopera(stagione) {
    try {
        currentTariffeStagione = stagione || currentTariffeStagione;
        const response = await apiCall(`/costi/tariffe/${currentTariffeStagione}`);
        const tariffa = response.data;
        document.getElementById('tariffa-standard').value = tariffa.costo_orario_standard || 15.00;
        document.getElementById('tariffa-specializzato').value = tariffa.costo_orario_specializzato || 22.00;
        
        // Aggiorna il selettore stagione
        const select = document.getElementById('tariffe-stagione-select');
        if (select) {
            select.value = currentTariffeStagione;
        }
    } catch (error) {
        console.error('Errore caricamento tariffe:', error);
    }
}

// ==================== ATTIVITÀ PREDEFINITE ====================

async function popolaAttivitaPredefinite() {
    try {
        const response = await apiCall('/costi/attivita');
        const attivita = response.data || [];
        
        const select = document.getElementById('costo-attivita-select');
        select.innerHTML = '<option value="">Seleziona attività predefinita...</option>' +
            '<option value="__altra__">✏️ Altra attività (scrivi liberamente)...</option>';
        
        attivita.forEach(a => {
            select.innerHTML += `<option value="${a.nome}">${a.nome}</option>`;
        });
    } catch (error) {
        console.error('Errore caricamento attività:', error);
    }
}

function handleAttivitaSelect() {
    const select = document.getElementById('costo-attivita-select');
    const inputLibero = document.getElementById('costo-attivita-libera');
    
    if (select.value === '__altra__') {
        inputLibero.style.display = 'block';
        inputLibero.value = '';
        inputLibero.focus();
    } else {
        inputLibero.style.display = 'none';
        inputLibero.value = select.value;
    }
}

// ✅ NUOVA FUNZIONE: Salva attività personalizzata dopo che l'utente ha finito di scrivere
async function salvaNuovaAttivita() {
    const inputLibero = document.getElementById('costo-attivita-libera');
    const nome = inputLibero?.value?.trim();
    
    if (!nome || nome === '__altra__') return;
    
    // Verifica se esiste già
    const select = document.getElementById('costo-attivita-select');
    const esiste = Array.from(select.options).some(opt => opt.value.toLowerCase() === nome.toLowerCase());
    
    if (!esiste) {
        try {
            await apiCall('/costi/attivita', {
                method: 'POST',
                body: { nome: nome, categoria: 'personalizzata' }
            });
            
            // Ricarica la lista attività
            await popolaAttivitaPredefinite();
            
            // Riseleziona l'attività appena creata
            const newOption = Array.from(select.options).find(opt => opt.value === nome);
            if (newOption) {
                select.value = nome;
                inputLibero.style.display = 'none';
            }
        } catch (error) {
            console.error('Errore salvataggio attività:', error);
        }
    }
}

// ==================== COSTI PERSONALE ====================

async function loadCostiPersonale(lotId, stagione) {
    try {
        const response = await apiCall(`/costi/personale/${lotId}/${stagione}`);
        const records = response.data || [];
        const totale = response.totale || 0;
        
        document.getElementById('totale-costo-personale').textContent = `€${totale.toFixed(2)}`;
        aggiornaRiepilogoCosti();
        displayRegistroPersonale(records, 'giornaliera');
    } catch (error) {
        console.error('Errore caricamento costi personale:', error);
    }
}

function displayRegistroPersonale(records, vista = 'giornaliera') {
    const container = document.getElementById('costi-personale-registro');

     // Intestazione con stagione
    const headerHtml = `
        <div style="background: #FF5722; color: white; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; text-align: center;">
            <strong>📅 Stagione ${currentCostiStagione || currentTariffeStagione} - ${records.length} attività</strong>
        </div>
    `;
    
    if (records.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">Nessuna attività registrata</p>';
        return;
    }
    
    let html = '';
    
    if (vista === 'giornaliera') {
        // Raggruppa per data
        const gruppi = {};
        records.forEach(r => {
            const data = r.data_attivita;
            if (!gruppi[data]) gruppi[data] = [];
            gruppi[data].push(r);
        });
        
        html = Object.entries(gruppi).sort((a, b) => b[0].localeCompare(a[0])).map(([data, recs], gIdx) => {
            const totaleGiorno = recs.reduce((sum, r) => sum + (r.costo_totale || 0), 0);
            const aperto = gIdx === 0; // ✅ solo il primo giorno espanso di default → vista compatta
            return `
                <div style="margin-bottom: 8px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                    <div onclick="toggleGruppoGiornaliero(this)" style="background: #FF5722; color: white; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;">
                        <strong style="display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-chevron-down gruppo-chevron-gp" style="transition: transform 0.2s ease; transform: rotate(${aperto ? 0 : -90}deg); font-size: 0.8rem;"></i>
                            📅 ${new Date(data).toLocaleDateString('it-IT', {weekday: 'long', day: 'numeric', month: 'long'})}
                        </strong>
                        <span style="display: inline-flex; align-items: center; gap: 8px;">
                            <span style="background: rgba(255,255,255,0.25); padding: 2px 8px; border-radius: 10px; font-size: 0.78rem;">${recs.length} att.</span>
                            <strong>€${totaleGiorno.toFixed(2)}</strong>
                        </span>
                    </div>
                    <div class="gruppo-content-gp" style="padding: 10px; display: ${aperto ? 'block' : 'none'};">
                        ${recs.map(r => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid #eee;">
                                <div>
                                    <strong>${r.attivita || 'Attività generica'}</strong><br>
                                    <small>${r.numero_operatori} op. ${r.qualifica} × ${r.ore_lavorate}h (€${r.costo_orario}/h)</small>
                                </div>
                                <div style="text-align: right;">
                                    <strong>€${(r.costo_totale || 0).toFixed(2)}</strong><br>
                                    <button onclick="eliminaCostoPersonale(${r.id})" style="background: none; border: none; color: #f44336; cursor: pointer; font-size: 12px;">🗑️</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
        
    } else if (vista === 'settimanale') {
        // Raggruppa per settimana
        const gruppiSettimana = {};
        records.forEach(r => {
            const data = new Date(r.data_attivita);
            const inizioSettimana = new Date(data);
            inizioSettimana.setDate(data.getDate() - data.getDay() + 1);
            const chiave = inizioSettimana.toISOString().split('T')[0];
            if (!gruppiSettimana[chiave]) gruppiSettimana[chiave] = [];
            gruppiSettimana[chiave].push(r);
        });
        
        html = Object.entries(gruppiSettimana).sort((a, b) => b[0].localeCompare(a[0])).map(([settimana, recs]) => {
            const totaleSettimana = recs.reduce((sum, r) => sum + (r.costo_totale || 0), 0);
            const fineSettimana = new Date(settimana);
            fineSettimana.setDate(fineSettimana.getDate() + 6);
            return `
                <div style="margin-bottom: 10px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                    <div style="background: #FF5722; color: white; padding: 8px 12px; display: flex; justify-content: space-between;">
                        <strong>📆 ${new Date(settimana).toLocaleDateString('it-IT')} - ${fineSettimana.toLocaleDateString('it-IT')}</strong>
                        <span>Totale: €${totaleSettimana.toFixed(2)}</span>
                    </div>
                    <div style="padding: 10px;">
                        <p style="text-align: center; color: #666;">${recs.length} attività | ${recs.reduce((sum, r) => sum + (r.ore_lavorate || 0), 0)} ore totali</p>
                    </div>
                </div>
            `;
        }).join('');
        
    } else if (vista === 'mensile') {
        // Raggruppa per mese
        const gruppiMese = {};
        records.forEach(r => {
            const data = new Date(r.data_attivita);
            const chiave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
            if (!gruppiMese[chiave]) gruppiMese[chiave] = [];
            gruppiMese[chiave].push(r);
        });
        
        html = Object.entries(gruppiMese).sort((a, b) => b[0].localeCompare(a[0])).map(([mese, recs]) => {
            const totaleMese = recs.reduce((sum, r) => sum + (r.costo_totale || 0), 0);
            const [anno, numMese] = mese.split('-');
            const nomeMese = new Date(anno, numMese - 1).toLocaleDateString('it-IT', {month: 'long', year: 'numeric'});
            return `
                <div style="margin-bottom: 10px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                    <div style="background: #FF5722; color: white; padding: 8px 12px; display: flex; justify-content: space-between;">
                        <strong>🗓️ ${nomeMese}</strong>
                        <span>Totale: €${totaleMese.toFixed(2)}</span>
                    </div>
                    <div style="padding: 10px;">
                        <p style="text-align: center; color: #666;">${recs.length} attività | ${recs.reduce((sum, r) => sum + (r.ore_lavorate || 0), 0)} ore totali</p>
                    </div>
                </div>
            `;
        }).join('');
    } else if (vista === 'annuale') {
        // ✅ Raggruppa per anno
        const gruppiAnno = {};
        records.forEach(r => {
            const anno = new Date(r.data_attivita).getFullYear();
            if (!gruppiAnno[anno]) gruppiAnno[anno] = [];
            gruppiAnno[anno].push(r);
        });
        html = Object.entries(gruppiAnno).sort((a, b) => b[0] - a[0]).map(([anno, recs]) => {
            const totaleAnno = recs.reduce((sum, r) => sum + (r.costo_totale || 0), 0);
            const oreTotali = recs.reduce((sum, r) => sum + (r.ore_lavorate || 0), 0);
            const operatoriTotali = recs.reduce((sum, r) => sum + (r.numero_operatori || 0), 0);
            return `
                <div style="margin-bottom: 10px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                    <div style="background: #FF5722; color: white; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                        <strong style="font-size: 1.05rem;">📆 Anno ${anno}</strong>
                        <strong style="font-size: 1.1rem;">€${totaleAnno.toFixed(2)}</strong>
                    </div>
                    <div style="padding: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; text-align: center; font-size: 0.85rem;">
                        <div><strong>${recs.length}</strong><br><small>attività</small></div>
                        <div><strong>${oreTotali}</strong><br><small>ore tot.</small></div>
                        <div><strong>${operatoriTotali}</strong><br><small>operatori (cumul.)</small></div>
                        <div><strong>€${(oreTotali > 0 ? totaleAnno / oreTotali : 0).toFixed(2)}</strong><br><small>€/ora media</small></div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    container.innerHTML = headerHtml + html;
}

function cambiaVistaRegistro(vista) {
    const lotId = currentCostiLotId;
    const stagione = currentCostiStagione;
    if (lotId && stagione) {
        loadCostiPersonale(lotId, stagione);
        // Modifica la funzione displayRegistroPersonale per accettare la vista
        const originalDisplay = displayRegistroPersonale;
        // Ricarica con la vista corretta
        apiCall(`/costi/personale/${lotId}/${stagione}`).then(response => {
            displayRegistroPersonale(response.data || [], vista);
        });
    }
}

async function salvaCostoPersonale() {
    if (!currentCostiLotId) {
        showNotification('Seleziona prima un lotto', 'error');
        return;
    }
    
    const dataAttivita = document.getElementById('costo-data-attivita').value;
    if (!dataAttivita) {
        showNotification('Inserisci la data dell\'attività', 'error');
        return;
    }
    
    // ✅ SALVA LA NUOVA ATTIVITÀ (se è stata inserita una personalizzata)
    const select = document.getElementById('costo-attivita-select');
    const inputLibero = document.getElementById('costo-attivita-libera');
    let nomeAttivita = '';
    
    if (select.value === '__altra__' && inputLibero.value.trim()) {
        nomeAttivita = inputLibero.value.trim();
        // Salva la nuova attività nel database
        try {
            showSpinner('Salvataggio attività...');
            await apiCall('/costi/attivita', {
                method: 'POST',
                body: { nome: nomeAttivita, categoria: 'personalizzata' }
            });
            // Ricarica la lista per il futuro
            await popolaAttivitaPredefinite();
            hideSpinner();
        } catch (error) {
            console.error('Errore salvataggio attività:', error);
            hideSpinner();
        }
    } else {
        nomeAttivita = select.value !== '__altra__' ? select.value : '';
    }
    
    const dati = {
        lot_id: currentCostiLotId,
        stagione_agricola: currentCostiStagione || new Date().getFullYear(),
        data_attivita: dataAttivita,
        numero_operatori: parseInt(document.getElementById('costo-numero-operatori').value) || 1,
        qualifica: document.getElementById('costo-qualifica').value,
        ore_lavorate: parseFloat(document.getElementById('costo-ore-lavorate').value) || 6.5,
        attivita: nomeAttivita,
        note: document.getElementById('costo-note').value
    };
    
    try {
        showNotification('Salvataggio in corso...', 'loading');
        await apiCall('/costi/personale', {
            method: 'POST',
            body: dati
        });
        
        showNotification('Attività registrata con successo!', 'success');
        resetCostoPersonaleForm();
        await loadCostiPersonale(currentCostiLotId, currentCostiStagione);
    } catch (error) {
        showNotification('Errore: ' + error.message, 'error');
    }
}

async function eliminaCostoPersonale(id) {
    if (!confirm('Eliminare questa attività?')) return;
    
    try {
        await apiCall(`/costi/personale/${id}`, { method: 'DELETE' });
        showNotification('Attività eliminata', 'success');
        await loadCostiPersonale(currentCostiLotId, currentCostiStagione);
    } catch (error) {
        showNotification('Errore: ' + error.message, 'error');
    }
}

function resetCostoPersonaleForm() {
    document.getElementById('costo-data-attivita').value = '';
    document.getElementById('costo-numero-operatori').value = '1';
    document.getElementById('costo-qualifica').value = 'standard';
    document.getElementById('costo-ore-lavorate').value = '6.5';
    document.getElementById('costo-attivita-select').value = '';
    document.getElementById('costo-attivita-libera').value = '';
    document.getElementById('costo-attivita-libera').style.display = 'none';
    document.getElementById('costo-note').value = '';
}

// ==================== MEZZI TECNICI ====================

async function loadMezziTecnici(lotId, stagione) {
    try {
        const response = await apiCall(`/costi/mezzi/${lotId}/${stagione}`);
        const records = response.data || [];
        const totale = response.totale || 0;
        
        document.getElementById('totale-mezzi-tecnici').textContent = `€${totale.toFixed(2)}`;
        aggiornaRiepilogoCosti();
        displayMezziTecniciRegistro(records, currentVistaMezzi);
    } catch (error) {
        console.error('Errore caricamento mezzi tecnici:', error);
    }
}

function cambiaVistaMezzi(vista) {
    currentVistaMezzi = vista;
    if (currentCostiLotId && currentCostiStagione) {
        loadMezziTecnici(currentCostiLotId, currentCostiStagione);
    }
}

function displayMezziTecniciRegistro(records, vista = 'giornaliera') {
    const container = document.getElementById('mezzi-tecnici-registro');
    
    if (records.length === 0) {
        container.innerHTML = `
            <div style="background: #2196F3; color: white; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; text-align: center;">
                <strong>📅 Stagione ${currentCostiStagione || currentTariffeStagione} - 0 registrazioni</strong>
            </div>
            <p style="text-align: center; color: #666;">Nessun costo registrato</p>
        `;
        return;
    }
    
    // Intestazione comune
    let html = `
        <div style="background: #2196F3; color: white; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; text-align: center;">
            <strong>📅 Stagione ${currentCostiStagione || currentTariffeStagione} - ${records.length} registrazioni | Totale: €${records.reduce((sum, r) => sum + (r.importo || 0), 0).toFixed(2)}</strong>
        </div>
    `;
    
    if (vista === 'giornaliera') {
        // Raggruppa per data
        const gruppi = {};
        records.forEach(r => {
            const data = r.data_registrazione || 'Senza data';
            if (!gruppi[data]) gruppi[data] = [];
            gruppi[data].push(r);
        });
        
        html += Object.entries(gruppi).sort((a, b) => b[0].localeCompare(a[0])).map(([data, recs], gIdx) => {
            const totaleGiorno = recs.reduce((sum, r) => sum + (r.importo || 0), 0);
            const aperto = gIdx === 0; // ✅ solo primo giorno espanso → vista compatta
            return `
                <div style="margin-bottom: 8px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                    <div onclick="toggleGruppoGiornaliero(this)" style="background: #2196F3; color: white; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;">
                        <strong style="display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-chevron-down gruppo-chevron-gp" style="transition: transform 0.2s ease; transform: rotate(${aperto ? 0 : -90}deg); font-size: 0.8rem;"></i>
                            📅 ${data !== 'Senza data' ? new Date(data).toLocaleDateString('it-IT', {weekday: 'long', day: 'numeric', month: 'long'}) : 'Senza data'}
                        </strong>
                        <span style="display: inline-flex; align-items: center; gap: 8px;">
                            <span style="background: rgba(255,255,255,0.25); padding: 2px 8px; border-radius: 10px; font-size: 0.78rem;">${recs.length} reg.</span>
                            <strong>€${totaleGiorno.toFixed(2)}</strong>
                        </span>
                    </div>
                    <div class="gruppo-content-gp" style="padding: 10px; display: ${aperto ? 'block' : 'none'};">
                        ${recs.map(r => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid #eee;">
                                <div>
                                    <strong>${r.descrizione || 'Senza descrizione'}</strong>
                                    <small style="display: block; color: #666;">${r.categoria}</small>
                                </div>
                                <div style="text-align: right;">
                                    <strong>€${(r.importo || 0).toFixed(2)}</strong>
                                    <button onclick="eliminaMezzoTecnico(${r.id})" style="background: none; border: none; color: #f44336; cursor: pointer; font-size: 11px; display: block;">🗑️</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
        
    } else if (vista === 'settimanale') {
        const gruppi = {};
        records.forEach(r => {
            if (r.data_registrazione) {
                const data = new Date(r.data_registrazione);
                const inizioSettimana = new Date(data);
                inizioSettimana.setDate(data.getDate() - data.getDay() + 1);
                const chiave = inizioSettimana.toISOString().split('T')[0];
                if (!gruppi[chiave]) gruppi[chiave] = [];
                gruppi[chiave].push(r);
            }
        });
        
        html += Object.entries(gruppi).sort((a, b) => b[0].localeCompare(a[0])).map(([settimana, recs]) => {
            const totale = recs.reduce((sum, r) => sum + (r.importo || 0), 0);
            const fineSettimana = new Date(settimana);
            fineSettimana.setDate(fineSettimana.getDate() + 6);
            return `
                <div style="margin-bottom: 10px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                    <div style="background: #2196F3; color: white; padding: 8px 12px; display: flex; justify-content: space-between;">
                        <strong>📆 ${new Date(settimana).toLocaleDateString('it-IT')} - ${fineSettimana.toLocaleDateString('it-IT')}</strong>
                        <span>Totale: €${totale.toFixed(2)}</span>
                    </div>
                    <div style="padding: 10px; text-align: center;">
                        <p style="color: #666;">${recs.length} registrazioni</p>
                    </div>
                </div>
            `;
        }).join('');
        
    } else if (vista === 'mensile') {
        const gruppi = {};
        records.forEach(r => {
            if (r.data_registrazione) {
                const data = new Date(r.data_registrazione);
                const chiave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
                if (!gruppi[chiave]) gruppi[chiave] = [];
                gruppi[chiave].push(r);
            }
        });
        
        html += Object.entries(gruppi).sort((a, b) => b[0].localeCompare(a[0])).map(([mese, recs]) => {
            const totale = recs.reduce((sum, r) => sum + (r.importo || 0), 0);
            const [anno, numMese] = mese.split('-');
            const nomeMese = new Date(anno, numMese - 1).toLocaleDateString('it-IT', {month: 'long', year: 'numeric'});
            return `
                <div style="margin-bottom: 10px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                    <div style="background: #2196F3; color: white; padding: 8px 12px; display: flex; justify-content: space-between;">
                        <strong>🗓️ ${nomeMese}</strong>
                        <span>Totale: €${totale.toFixed(2)}</span>
                    </div>
                    <div style="padding: 10px; text-align: center;">
                        <p style="color: #666;">${recs.length} registrazioni</p>
                    </div>
                </div>
            `;
        }).join('');
    } else if (vista === 'annuale') {
        // ✅ Raggruppa per anno
        const gruppi = {};
        records.forEach(r => {
            if (r.data_registrazione) {
                const anno = new Date(r.data_registrazione).getFullYear();
                if (!gruppi[anno]) gruppi[anno] = [];
                gruppi[anno].push(r);
            }
        });
        html += Object.entries(gruppi).sort((a, b) => b[0] - a[0]).map(([anno, recs]) => {
            const totale = recs.reduce((sum, r) => sum + (r.importo || 0), 0);
            // Raggruppa per categoria per il breakdown
            const perCat = {};
            recs.forEach(r => {
                const cat = r.categoria || 'Altro';
                perCat[cat] = (perCat[cat] || 0) + Number(r.importo || 0);
            });
            const breakdown = Object.entries(perCat).sort((a, b) => b[1] - a[1])
                .map(([cat, val]) => `<span style="background:#E3F2FD;color:#1565C0;padding:2px 8px;border-radius:10px;font-size:0.78rem;margin:2px;display:inline-block;">${cat}: €${val.toFixed(2)}</span>`)
                .join(' ');
            return `
                <div style="margin-bottom: 10px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                    <div style="background: #2196F3; color: white; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                        <strong style="font-size: 1.05rem;">📆 Anno ${anno}</strong>
                        <strong style="font-size: 1.1rem;">€${totale.toFixed(2)}</strong>
                    </div>
                    <div style="padding: 10px;">
                        <p style="text-align: center; color: #666; margin-bottom: 6px;">${recs.length} registrazioni</p>
                        <div style="text-align: center;">${breakdown}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    container.innerHTML = html;
}

async function salvaCostoMezziTecnici() {
    if (!currentCostiLotId) {
        showNotification('Seleziona prima un lotto', 'error');
        return;
    }
    
    const dati = {
        lot_id: currentCostiLotId,
        stagione_agricola: currentCostiStagione || new Date().getFullYear(),
        data_registrazione: document.getElementById('mezzi-data').value,
        descrizione: document.getElementById('mezzi-descrizione').value,
        importo: parseFloat(document.getElementById('mezzi-importo').value) || 0,
        categoria: document.getElementById('mezzi-categoria').value
    };
    
    if (dati.importo <= 0) {
        showNotification('Inserisci un importo valido', 'error');
        return;
    }
    
    try {
        showSpinner('Salvataggio costo...');
        await apiCall('/costi/mezzi', {
            method: 'POST',
            body: dati
        });
        showNotification('Costo registrato!', 'success');
        resetMezziTecniciForm();
        await loadMezziTecnici(currentCostiLotId, currentCostiStagione);
        hideSpinner();
    } catch (error) {
        showNotification('Errore: ' + error.message, 'error');
        hideSpinner();
    }
}

async function eliminaMezzoTecnico(id) {
    if (!confirm('Eliminare questo costo?')) return;
    try {
        await apiCall(`/costi/mezzi/${id}`, { method: 'DELETE' });
        showNotification('Costo eliminato', 'success');
        await loadMezziTecnici(currentCostiLotId, currentCostiStagione);
    } catch (error) {
        showNotification('Errore: ' + error.message, 'error');
    }
}

function resetMezziTecniciForm() {
    document.getElementById('mezzi-data').value = '';
    document.getElementById('mezzi-descrizione').value = '';
    document.getElementById('mezzi-importo').value = '';
    document.getElementById('mezzi-categoria').value = 'fitofarmaci';
}

// ==================== BENI DUREVOLI (VERSIONE COSTI) ====================

function initBeniDurevoliCosti() {
    const container = document.getElementById('beni-durevoli-costi-container');
    if (container) {
        container.innerHTML = '';
    }
    beniDurevoliCostiCount = 0;
    aggiungiBeneDurevoleCosti();
}

function aggiungiBeneDurevoleCosti() {
    const container = document.getElementById('beni-durevoli-costi-container');
    const template = document.getElementById('bene-durevole-template');
    
    if (!container || !template) return;
    
    beniDurevoliCostiCount++;
    
    const clone = template.content.cloneNode(true);
    const beneDiv = clone.querySelector('.bene-durevole-item');
    beneDiv.dataset.index = beniDurevoliCostiCount;
    beneDiv.querySelector('.bene-index').textContent = `#${beniDurevoliCostiCount}`;
    
    const annoInput = beneDiv.querySelector('.bene-anno-inizio');
    if (annoInput) {
        annoInput.value = new Date().getFullYear();
    }
    
    // ✅ Aggiungi listener per aggiornare la quota quando cambiano costo o anni
    const costoInput = beneDiv.querySelector('.bene-costo');
    const anniSelect = beneDiv.querySelector('.bene-anni');
    
    if (costoInput) {
        costoInput.addEventListener('input', function() {
            aggiornaQuotaAmmortamento(this);
        });
    }
    if (anniSelect) {
        anniSelect.addEventListener('change', function() {
            aggiornaQuotaAmmortamento(costoInput || this);
        });
    }
    
    container.appendChild(clone);
}
// ==================== BENI DUREVOLI COSTI (COMPLETO) ====================

// Raccoglie i beni durevoli dal form costi
function raccogliBeniDurevoliCosti() {
    const beni = [];
    const container = document.getElementById('beni-durevoli-costi-container');
    if (!container) return beni;
    
    const beniDivs = container.querySelectorAll('.bene-durevole-item');
    
    beniDivs.forEach(div => {
        const desc = div.querySelector('.bene-desc')?.value?.trim() || '';
        const costo = parseFloat(div.querySelector('.bene-costo')?.value) || 0;
        const anni = parseInt(div.querySelector('.bene-anni')?.value) || 1;
        const quota = parseFloat(div.querySelector('.bene-quota')?.value) || 0;
        const annoInizio = parseInt(div.querySelector('.bene-anno-inizio')?.value) || new Date().getFullYear();
        
        if (desc && costo > 0) {
            beni.push({
                descrizione: desc,
                costo_totale: costo,
                anni_ammortamento: anni,
                quota_annuale: quota,
                anno_inizio: annoInizio
            });
        }
    });
    
    return beni;
}

// Salva i beni durevoli come costo (collegato alla stagione)
// ==================== BENI DUREVOLI COSTI (VERSIONE COMPLETA CON AMMORTAMENTO) ====================

// Salva i beni durevoli usando la STESSA logica della sezione Ricavi
async function salvaBeniDurevoliCosti() {
    if (!currentCostiLotId) {
        showNotification('Seleziona prima un lotto', 'error');
        return;
    }
    
    // ✅ RACCOGLI I BENI E RICALCOLA LE QUOTE
    const beni = [];
    const container = document.getElementById('beni-durevoli-costi-container');
    if (!container) return;
    
    const beniDivs = container.querySelectorAll('.bene-durevole-item');
    
    beniDivs.forEach(div => {
        const desc = div.querySelector('.bene-desc')?.value?.trim() || '';
        const costo = parseFloat(div.querySelector('.bene-costo')?.value) || 0;
        const anni = parseInt(div.querySelector('.bene-anni')?.value) || 1;
        const annoInizio = parseInt(div.querySelector('.bene-anno-inizio')?.value) || new Date().getFullYear();
        
        // ✅ RICALCOLA LA QUOTA (non leggere dal campo readonly)
        const quota = costo / anni;
        
        if (desc && costo > 0) {
            beni.push({
                descrizione: desc,
                costo_totale: costo,
                anni_ammortamento: anni,
                quota_annuale: quota,  // ✅ QUOTA RICALCOLATA
                anno_inizio: annoInizio
            });
        }
    });
    
    if (beni.length === 0) {
        showNotification('Inserisci almeno un bene durevole con descrizione e costo', 'error');
        return;
    }
    
    const stagione = currentCostiStagione || new Date().getFullYear();
    
    // ✅ CALCOLA LA QUOTA TOTALE PER QUESTA STAGIONE
    let totaleQuotaAmmortamento = 0;
    
    beni.forEach(bene => {
        const annoInizio = bene.anno_inizio || stagione;
        const anniAmmortamento = bene.anni_ammortamento || 1;
        const annoFine = annoInizio + anniAmmortamento - 1;
        
        if (stagione >= annoInizio && stagione <= annoFine) {
            totaleQuotaAmmortamento += bene.quota_annuale || 0;
        }
    });
    
    console.log('📊 Beni da salvare:', beni);
    console.log('📊 Quota totale ammortamento:', totaleQuotaAmmortamento);
    
    try {
        showNotification('Salvataggio beni durevoli...', 'loading');
        
        await apiCall('/economic', {
            method: 'POST',
            body: {
                lot_id: currentCostiLotId,
                stagione_agricola: String(stagione),
                data_acquisto_vendita: new Date().toISOString().split('T')[0],
                metodo_calcolo: 'totale',
                prezzo_kg: 0,
                prezzo_totale: 0,
                totale_kg: 0,
                ricavi_totali: 0,
                costo_mezzi_tecnici: 0,
                costo_personale: 0,
                beni_durevoli: beni,
                costi_totali: totaleQuotaAmmortamento,
                bilancio: -totaleQuotaAmmortamento
            }
        });
        
        document.getElementById('totale-ammortamento-costi').textContent = `€${totaleQuotaAmmortamento.toFixed(2)}`;
        aggiornaRiepilogoCosti();
        
        // ✅ Refresh immediato dello storico beni durevoli (recupera dal server, no reload pagina)
        await loadBeniDurevoliCosti(currentCostiLotId, stagione);
        
        showNotification('Beni durevoli salvati! Quota annuale: €' + totaleQuotaAmmortamento.toFixed(2), 'success');
        
    } catch (error) {
        showNotification('Errore salvataggio: ' + error.message, 'error');
    }
}

// Carica beni durevoli da TUTTE le registrazioni (stessa logica di caricaBeniDurevoliAttivi)
async function loadBeniDurevoliCosti(lotId, stagione) {
    try {
        // ✅ Usa la stessa funzione che abbiamo già creato per la sezione Ricavi!
        // Recupera TUTTE le registrazioni del lotto
        const response = await apiCall(`/economic/${lotId}`);
        const allRecords = response.data || [];
        
        // Usa caricaBeniDurevoliAttivi per trovare quelli ancora attivi
        const beniAttivi = caricaBeniDurevoliAttivi(allRecords, stagione);
        
        // ✅ Renderizza lo storico completo (tutti i beni mai registrati per il lotto)
        renderStoricoBeniDurevoli(allRecords, stagione);
        
        // Calcola il totale delle quote
        let totaleQuote = 0;
        beniAttivi.forEach(bene => {
            totaleQuote += bene.quota_annuale || 0;
        });
        
        // Popola il form con i beni attivi
        const container = document.getElementById('beni-durevoli-costi-container');
        if (container) {
            container.innerHTML = '';
            beniDurevoliCostiCount = 0;
            
            if (beniAttivi.length > 0) {
                beniAttivi.forEach(bene => {
                    aggiungiBeneDurevoleCosti();
                    const lastIdx = beniDurevoliCostiCount;
                    
                    setTimeout(() => {
                        const beneDiv = document.querySelector(`#beni-durevoli-costi-container .bene-durevole-item[data-index="${lastIdx}"]`);
                        if (beneDiv) {
                            const descInput = beneDiv.querySelector('.bene-desc');
                            const costoInput = beneDiv.querySelector('.bene-costo');
                            const anniSelect = beneDiv.querySelector('.bene-anni');
                            const quotaInput = beneDiv.querySelector('.bene-quota');
                            const annoInizioInput = beneDiv.querySelector('.bene-anno-inizio');
                            
                            if (descInput) descInput.value = bene.descrizione || '';
                            if (costoInput) {
                                costoInput.value = bene.costo_totale || 0;
                                aggiornaQuotaAmmortamento(costoInput);
                            }
                            if (anniSelect) {
                                anniSelect.value = bene.anni_ammortamento || 5;
                                setTimeout(() => aggiornaQuotaAmmortamento(costoInput), 10);
                            }
                            if (quotaInput) quotaInput.value = (bene.quota_annuale || 0).toFixed(2);
                            if (annoInizioInput) annoInizioInput.value = bene.anno_inizio || stagione;
                        }
                    }, 50);
                });
            } else {
                // Se non ci sono beni attivi, aggiungi un campo vuoto
                aggiungiBeneDurevoleCosti();
            }
        }
        
        // Aggiorna il totale visualizzato
        document.getElementById('totale-ammortamento-costi').textContent = `€${totaleQuote.toFixed(2)}`;
        aggiornaRiepilogoCosti();
        
    } catch (error) {
        console.error('Errore caricamento beni durevoli costi:', error);
    }
}
// ==================== RIEPILOGO COSTI ====================

function aggiornaRiepilogoCosti() {
    const personale = parseFloat(document.getElementById('totale-costo-personale').textContent.replace('€', '')) || 0;
    const mezzi = parseFloat(document.getElementById('totale-mezzi-tecnici').textContent.replace('€', '')) || 0;
    const ammortamenti = parseFloat(document.getElementById('totale-ammortamento-costi').textContent.replace('€', '')) || 0;
    const totale = personale + mezzi + ammortamenti;
    // Aggiorna la stagione nel riepilogo
const riepilogoStagione = document.getElementById('riepilogo-stagione');
if (riepilogoStagione) {
    riepilogoStagione.textContent = currentCostiStagione || currentTariffeStagione || new Date().getFullYear();
}
    
    document.getElementById('riepilogo-personale').textContent = `€${personale.toFixed(2)}`;
    document.getElementById('riepilogo-mezzi').textContent = `€${mezzi.toFixed(2)}`;
    document.getElementById('riepilogo-ammortamenti').textContent = `€${ammortamenti.toFixed(2)}`;
    document.getElementById('riepilogo-totale-costi').textContent = `€${totale.toFixed(2)}`;
}

// ==================== STORICO BENI DUREVOLI (CROPBOOK) ====================
/**
 * Renderizza lo storico completo dei beni durevoli mai registrati per il lotto.
 * Mostra per ognuno: descrizione, quota annuale, scadenza ammortamento,
 * e un badge ATTIVO / TERMINATO / FUTURO rispetto alla stagione di riferimento.
 */
function renderStoricoBeniDurevoli(records, stagioneRiferimento) {
    const container = document.getElementById('beni-durevoli-storico');
    const counter = document.getElementById('beni-storico-counter');
    if (!container) return;
    
    const stagioneRef = parseInt(stagioneRiferimento) || new Date().getFullYear();
    const beniMap = new Map(); // chiave univoca → bene + riferimento al record sorgente
    
    (records || []).forEach(reg => {
        if (!reg.beni_durevoli) return;
        let beni;
        try {
            beni = typeof reg.beni_durevoli === 'string' ? JSON.parse(reg.beni_durevoli) : reg.beni_durevoli;
        } catch (e) { return; }
        if (!Array.isArray(beni)) return;
        beni.forEach((bene, idx) => {
            const descrizione = (bene.descrizione || '').trim() || '(Senza nome)';
            const annoInizio = parseInt(bene.anno_inizio) || parseInt(reg.stagione_agricola) || stagioneRef;
            const anniAmm = parseInt(bene.anni_ammortamento) || 1;
            const costo = Number(bene.costo_totale) || 0;
            const quota = Number(bene.quota_annuale) || (anniAmm > 0 ? costo / anniAmm : 0);
            const annoFine = annoInizio + anniAmm - 1;
            const chiave = `${descrizione.toLowerCase()}__${annoInizio}__${costo}`;
            // Mantieni il primo che incontri (i record sono ordinati per data nelle altre logiche; qui basta dedupe)
            if (!beniMap.has(chiave)) {
                beniMap.set(chiave, { descrizione, annoInizio, anniAmm, costo, quota, annoFine, recordId: reg.id, indexInRecord: idx });
            }
        });
    });
    
    const lista = Array.from(beniMap.values()).sort((a, b) => {
        // ordinamento: prima attivi/futuri, poi terminati; entro lo stesso gruppo per anno_fine decrescente
        const sa = a.annoFine >= stagioneRef ? 0 : 1;
        const sb = b.annoFine >= stagioneRef ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return b.annoFine - a.annoFine;
    });
    
    // Counter
    const attivi = lista.filter(b => stagioneRef >= b.annoInizio && stagioneRef <= b.annoFine).length;
    const totali = lista.length;
    if (counter) {
        counter.textContent = totali === 0 ? '0 beni' : `${attivi}/${totali} attivi`;
    }
    
    if (totali === 0) {
        container.innerHTML = `<div class="bene-storico-empty">
            <i class="fas fa-inbox" style="margin-right:6px;"></i>
            Nessun bene durevole registrato per questo lotto.
        </div>`;
        return;
    }
    
    container.innerHTML = lista.map(b => {
        let stato, badgeClass, badgeLabel, badgeIcon;
        if (stagioneRef < b.annoInizio) {
            stato = 'futuro';
            badgeClass = 'futuro';
            badgeLabel = 'Futuro';
            badgeIcon = 'fa-hourglass-start';
        } else if (stagioneRef > b.annoFine) {
            stato = 'terminato';
            badgeClass = 'terminato';
            badgeLabel = 'Terminato';
            badgeIcon = 'fa-flag-checkered';
        } else {
            stato = 'attivo';
            badgeClass = 'attivo';
            badgeLabel = 'Attivo';
            badgeIcon = 'fa-circle-check';
        }
        const esc = (s) => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
        return `
            <div class="bene-storico-row is-${stato}" data-anno-inizio="${b.annoInizio}" data-anno-fine="${b.annoFine}">
                <span class="bene-storico-badge ${badgeClass}" title="Stato per stagione ${stagioneRef}">
                    <i class="fas ${badgeIcon}"></i> ${badgeLabel}
                </span>
                <div class="bene-storico-info">
                    <div class="bene-titolo" title="${esc(b.descrizione)}">${esc(b.descrizione)}</div>
                    <div class="bene-meta">
                        <span><i class="fas fa-calendar-alt"></i> ${b.annoInizio}–${b.annoFine} (${b.anniAmm} ${b.anniAmm === 1 ? 'anno' : 'anni'})</span>
                        <span class="meta-quota"><i class="fas fa-coins"></i> Quota: €${b.quota.toFixed(2)}/anno</span>
                        <span class="meta-scadenza"><i class="fas fa-clock"></i> Scadenza: ${b.annoFine}</span>
                    </div>
                </div>
                <div class="bene-storico-actions">
                    <button type="button" class="bene-storico-delete-btn" data-testid="bene-storico-delete-btn"
                            onclick="eliminaBeneStorico(${b.recordId}, ${b.indexInRecord}, '${esc(b.descrizione)}')"
                            title="Elimina questo bene durevole">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Elimina un bene durevole dalla relativa registrazione economica.
 * Richiede conferma; aggiorna il record via PUT /api/economic/:id e refresha lo storico.
 */
async function eliminaBeneStorico(recordId, indexInRecord, descrizione) {
    if (!confirm(`⚠️ Sei sicuro di voler eliminare il bene "${descrizione}"?\n\nQuesta azione è IRREVERSIBILE.`)) {
        return;
    }
    try {
        showNotification('Eliminazione bene...', 'loading');
        // 1. Recupera il record sorgente
        const lotId = currentCostiLotId;
        if (!lotId) {
            showNotification('Lotto non disponibile', 'error');
            return;
        }
        const economicResp = await apiCall(`/economic/${lotId}`);
        const allRecords = economicResp.data || [];
        const record = allRecords.find(r => r.id === Number(recordId));
        if (!record) {
            showNotification('Registrazione non trovata', 'error');
            return;
        }
        // 2. Decodifica array beni, rimuovi quello all'indice
        let beni = [];
        try {
            beni = typeof record.beni_durevoli === 'string' ? JSON.parse(record.beni_durevoli) : (record.beni_durevoli || []);
        } catch (e) {
            beni = [];
        }
        if (!Array.isArray(beni) || indexInRecord >= beni.length) {
            showNotification('Bene non trovato nel record', 'error');
            return;
        }
        beni.splice(indexInRecord, 1);
        // 3. Ricalcola quota_ammortamento del record (somma quote rimaste)
        const nuovaQuotaAmm = beni.reduce((s, b) => s + Number(b.quota_annuale || 0), 0);
        // 4. PUT del record aggiornato
        const payload = {
            ...record,
            beni_durevoli: beni,
            quota_ammortamento: nuovaQuotaAmm,
            costi_totali: Number(record.costo_personale || 0) + Number(record.costo_mezzi_tecnici || 0) + nuovaQuotaAmm,
            bilancio: Number(record.ricavi_totali || 0) - (Number(record.costo_personale || 0) + Number(record.costo_mezzi_tecnici || 0) + nuovaQuotaAmm)
        };
        // Se il record diventa completamente vuoto (era fantasma e ora niente beni) → eliminalo
        const restaFantasma = Number(payload.ricavi_totali || 0) === 0 && Number(payload.totale_kg || 0) === 0 && beni.length === 0;
        if (restaFantasma) {
            await apiCall(`/economic/${record.id}`, { method: 'DELETE' });
        } else {
            await apiCall(`/economic/${record.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        }
        // 5. Refresh storico
        const stagione = currentCostiStagione || new Date().getFullYear();
        await loadBeniDurevoliCosti(lotId, stagione);
        showNotification(`Bene "${descrizione}" eliminato`, 'success');
    } catch (err) {
        console.error('eliminaBeneStorico errore:', err);
        showNotification('Errore eliminazione bene: ' + err.message, 'error');
    }
}
// ============================================================================


// ==================== AGGIORNA HANDLESECTIONSECTIONACTIONS ====================
// Aggiungi questo caso nella funzione handleSectionSpecificActions esistente:
// case 'gestione-costi-section':
//     initGestioneCosti();
//     break;

// ==================== DASHBOARD AZIENDE ====================
const SETTORI_PREDEFINITI = ['olivicoltura', 'viticoltura', 'frutticoltura', 'orticoltura', 'cerealicoltura', 'zootecnia', 'apicoltura', 'florovivaismo'];
let cachedCompanies = [];
let currentEditingCompanyId = null;

async function loadAziendeDashboard() {
    const grid = document.getElementById('aziende-grid');
    if (!grid) return;
    try {
        const resp = await apiCall('/companies');
        cachedCompanies = resp.data || [];
        renderAziendeGrid(cachedCompanies);
    } catch (err) {
        grid.innerHTML = `<div style="text-align:center;padding:24px;color:#c62828;">Errore caricamento aziende: ${err.message}</div>`;
    }
}

function renderAziendeGrid(items) {
    const grid = document.getElementById('aziende-grid');
    if (!grid) return;
    if (!items || items.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center;padding:40px;color:#888;">
                <i class="fas fa-building" style="font-size: 3rem; color:#ddd; display: block; margin-bottom: 12px;"></i>
                <p>Nessuna azienda registrata. Crea la tua prima azienda per iniziare!</p>
                <button onclick="apriNuovaAzienda()" class="btn btn-primary" style="margin-top: 10px;">
                    <i class="fas fa-plus-circle"></i> Crea Azienda
                </button>
            </div>`;
        return;
    }
    const esc = (s) => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    grid.innerHTML = items.map(c => {
        const sectors = (c.sectors || '').split(',').map(s => s.trim()).filter(Boolean);
        const sectorsHtml = sectors.length > 0
            ? sectors.map(s => `<span class="azienda-sector-chip">${esc(s)}</span>`).join('')
            : '<span style="font-size: 0.75rem; color: #999; font-style: italic;">Settori non specificati</span>';
        return `
            <div class="azienda-card" data-testid="azienda-card-${c.id}">
                <div class="azienda-card-header">
                    <h3 class="azienda-name" onclick="apriDettagliAzienda(${c.id})">📋 ${esc(c.name)}</h3>
                    <span class="azienda-lots-badge ${c.lots_count === 0 ? 'empty' : ''}">${c.lots_count} ${c.lots_count === 1 ? 'lotto' : 'lotti'}</span>
                </div>
                <div class="azienda-sectors">${sectorsHtml}</div>
                ${c.address ? `<div class="azienda-address"><i class="fas fa-map-marker-alt"></i> ${esc(c.address)}</div>` : ''}
                <div class="azienda-actions">
                    <button class="azienda-action-btn view" onclick="apriDettagliAzienda(${c.id})" title="Vedi lotti">
                        <i class="fas fa-eye"></i> Lotti
                    </button>
                    <button class="azienda-action-btn report" onclick="scaricaBilancioAzienda(${c.id})" title="Scarica PDF bilancio azienda">
                        <i class="fas fa-file-pdf"></i> Report
                    </button>
                    <button class="azienda-action-btn edit" onclick="openCompanyEditor(${c.id})" title="Modifica azienda">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function filterAziendeList() {
    const q = (document.getElementById('aziende-search')?.value || '').trim().toLowerCase();
    const filtered = !q ? cachedCompanies : cachedCompanies.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.sectors || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q)
    );
    renderAziendeGrid(filtered);
}

async function apriDettagliAzienda(companyId) {
    // Vai a lista lotti filtrata per questa azienda
    showSection('lista-section');
    const c = cachedCompanies.find(x => x.id === companyId);
    if (c) {
        const search = document.getElementById('search-lots');
        if (search) { search.value = c.name; if (typeof filterLots === 'function') filterLots(); }
    }
}

async function scaricaBilancioAzienda(companyId) {
    const c = cachedCompanies.find(x => x.id === companyId);
    if (!c) return;
    if (c.lots_count === 0) {
        showNotification('L\'azienda non ha lotti, nessun dato da esportare', 'warning');
        return;
    }
    showNotification('Generazione PDF...', 'loading');
    try {
        const token = localStorage.getItem('agriManager_token');
        const resp = await fetch(`${API_BASE_URL}/reports/bilancio-azienda/${companyId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bilancio-azienda-${c.name.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        showNotification('PDF scaricato', 'success');
    } catch (err) {
        showNotification(`Errore: ${err.message}`, 'error');
    }
}

function apriNuovaAzienda() {
    openCompanyEditor(null);
}

function openCompanyEditor(companyId) {
    currentEditingCompanyId = companyId;
    const modal = document.getElementById('company-modal');
    if (!modal) return;
    const c = companyId ? cachedCompanies.find(x => x.id === companyId) : null;
    document.getElementById('company-modal-title').innerHTML = c
        ? '<i class="fas fa-edit"></i> Modifica Azienda'
        : '<i class="fas fa-building"></i> Nuova Azienda';
    document.getElementById('modal-company-name').value = c ? c.name : '';
    document.getElementById('modal-company-address').value = c ? (c.address || '') : '';
    renderSectorsCheckboxes('modal-company-sectors', (c?.sectors || '').split(',').map(s => s.trim()).filter(Boolean));
    modal.style.display = 'flex';
}

function chiudiCompanyModal() {
    const modal = document.getElementById('company-modal');
    if (modal) modal.style.display = 'none';
    currentEditingCompanyId = null;
}

function renderSectorsCheckboxes(containerId, selected = []) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = SETTORI_PREDEFINITI.map(s => {
        const isChecked = selected.includes(s);
        return `<label class="sector-chip-input ${isChecked ? 'is-checked' : ''}">
            <input type="checkbox" value="${s}" ${isChecked ? 'checked' : ''} onchange="this.parentElement.classList.toggle('is-checked', this.checked)">
            ${s.charAt(0).toUpperCase() + s.slice(1)}
        </label>`;
    }).join('');
}

async function salvaCompany() {
    const name = (document.getElementById('modal-company-name').value || '').trim();
    if (!name || name.length < 2) {
        showNotification('Ragione sociale obbligatoria (min 2 caratteri)', 'error');
        return;
    }
    const sectors = Array.from(document.querySelectorAll('#modal-company-sectors input:checked')).map(cb => cb.value);
    const address = (document.getElementById('modal-company-address').value || '').trim();
    try {
        showNotification('Salvataggio...', 'loading');
        if (currentEditingCompanyId) {
            await apiCall(`/companies/${currentEditingCompanyId}`, { method: 'PUT', body: { name, sectors, address } });
            showNotification('Azienda aggiornata', 'success');
        } else {
            await apiCall('/companies', { method: 'POST', body: { name, sectors, address } });
            showNotification('Azienda creata', 'success');
        }
        chiudiCompanyModal();
        await loadAziendeDashboard();
        if (typeof loadCompaniesIntoSelect === 'function') loadCompaniesIntoSelect();
    } catch (err) {
        showNotification(`Errore: ${err.message}`, 'error');
    }
}

// ===== Form Lotto: popola select aziende =====
async function loadCompaniesIntoSelect() {
    const select = document.getElementById('company-select');
    if (!select) return;
    try {
        const resp = await apiCall('/companies');
        cachedCompanies = resp.data || [];
        const current = select.value;
        select.innerHTML = '<option value="">-- Seleziona azienda esistente --</option>'
            + cachedCompanies.map(c => `<option value="${c.id}">${c.name}${c.lots_count ? ` (${c.lots_count})` : ''}</option>`).join('')
            + '<option value="__new__">➕ Nuova Azienda</option>';
        if (current && Array.from(select.options).some(o => o.value === current)) select.value = current;
    } catch (_) {}
}

function onCompanySelectChange() {
    const v = document.getElementById('company-select').value;
    const newForm = document.getElementById('new-company-form');
    const editBtn = document.getElementById('company-edit-btn');
    if (v === '__new__') {
        if (newForm) newForm.style.display = 'block';
        if (editBtn) editBtn.style.display = 'none';
        renderSectorsCheckboxes('company-sectors-checkboxes', []);
        currentEditingCompanyId = null;
    } else if (v && v !== '') {
        if (newForm) newForm.style.display = 'none';
        if (editBtn) editBtn.style.display = 'inline-flex';
        currentEditingCompanyId = parseInt(v);
    } else {
        if (newForm) newForm.style.display = 'none';
        if (editBtn) editBtn.style.display = 'none';
        currentEditingCompanyId = null;
    }
}
// ==============================================================

