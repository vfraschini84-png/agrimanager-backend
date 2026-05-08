const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const logger = require('./logger');

// ✅ Path DB da env (default fuori da www/ per non esporlo via static)
const dbPath = path.resolve(__dirname, process.env.DATABASE_PATH || '../data/agrimanager.db');
const dbDir = path.dirname(dbPath);

// Crea cartella DB se non esiste
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Crea connessione al database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        logger.error('Errore connessione database', { error: err.message, dbPath });
    } else {
        logger.info('✅ Connesso al database SQLite', { dbPath });
        // Abilita foreign keys (SQLite di default le ignora)
        db.run('PRAGMA foreign_keys = ON');
        initializeDatabase().catch(err => {
            logger.error('Errore inizializzazione DB', { error: err.message, stack: err.stack });
        });
    }
});

// ==================== HELPER PROMISIFICATI (definiti PRIMA di init) ====================
db.getAsync = function(sql, params = []) {
    return new Promise((resolve, reject) => {
        this.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

db.allAsync = function(sql, params = []) {
    return new Promise((resolve, reject) => {
        this.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

db.runAsync = function(sql, params = []) {
    return new Promise((resolve, reject) => {
        this.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
};

// Helper transazione: esegue un async fn dentro BEGIN/COMMIT, rollback su errore
db.withTransaction = async function(fn) {
    await this.runAsync('BEGIN IMMEDIATE');
    try {
        const result = await fn();
        await this.runAsync('COMMIT');
        return result;
    } catch (err) {
        try { await this.runAsync('ROLLBACK'); } catch (_) { /* ignore */ }
        throw err;
    }
};

// ==================== INIZIALIZZAZIONE (sequenziale, non annidata) ====================
async function initializeDatabase() {
    const tables = [
        {
            name: 'lots',
            sql: `CREATE TABLE IF NOT EXISTS lots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_name TEXT NOT NULL,
                location TEXT NOT NULL,
                gps_coordinates TEXT,
                product_type TEXT NOT NULL,
                product_category TEXT,
                variety TEXT,
                field_lot TEXT,
                field_size REAL,
                owner_id INTEGER,
                owner_username TEXT,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        },
        {
            name: 'lot_details',
            sql: `CREATE TABLE IF NOT EXISTS lot_details (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lot_id INTEGER NOT NULL,
                cost_per_kg REAL,
                estimated_kg REAL,
                purchase_date TEXT,
                harvested_kg REAL,
                owner_id INTEGER,
                owner_username TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lot_id) REFERENCES lots (id) ON DELETE CASCADE
            )`
        },
        {
            name: 'users',
            sql: `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'visitatore',
                user_type TEXT NOT NULL DEFAULT 'libero_professionista',
                azienda_data TEXT,
                permissions TEXT,
                parent_id INTEGER,
                parent_username TEXT,
                privacy_accepted BOOLEAN DEFAULT 0,
                privacy_accepted_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        },
        {
            name: 'activities',
            sql: `CREATE TABLE IF NOT EXISTS activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lot_id INTEGER NOT NULL,
                type TEXT DEFAULT 'raccolta',
                date TEXT NOT NULL,
                kg REAL NOT NULL,
                notes TEXT,
                owner_id INTEGER,
                owner_username TEXT,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lot_id) REFERENCES lots (id) ON DELETE CASCADE
            )`
        },
        {
            name: 'analyses',
            sql: `CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lot_id INTEGER NOT NULL,
                year INTEGER NOT NULL,
                filename TEXT,
                original_name TEXT,
                file_url TEXT,
                notes TEXT,
                file_size TEXT,
                owner_id INTEGER,
                owner_username TEXT,
                uploaded_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lot_id) REFERENCES lots (id) ON DELETE CASCADE
            )`
        },
        {
            name: 'economic_records',
            sql: `CREATE TABLE IF NOT EXISTS economic_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lot_id INTEGER NOT NULL,
                stagione_agricola TEXT,
                data_acquisto_vendita TEXT,
                metodo_calcolo TEXT,
                prezzo_kg REAL,
                prezzo_totale REAL,
                totale_kg REAL,
                ricavi_totali REAL,
                costo_mezzi_tecnici REAL,
                costo_personale REAL,
                beni_durevoli TEXT,
                costi_totali REAL,
                bilancio REAL,
                anni_ammortamento INTEGER DEFAULT 1,
                quota_ammortamento REAL DEFAULT 0,
                ammortamento_residuo REAL DEFAULT 0,
                owner_id INTEGER,
                owner_username TEXT,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lot_id) REFERENCES lots (id) ON DELETE CASCADE
            )`
        },
        {
            name: 'password_reset_tokens',
            sql: `CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at DATETIME NOT NULL,
                used BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`
        },
        {
            name: 'tariffe_manodopera',
            sql: `CREATE TABLE IF NOT EXISTS tariffe_manodopera (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stagione_agricola TEXT NOT NULL,
                costo_orario_standard REAL DEFAULT 15.00,
                costo_orario_specializzato REAL DEFAULT 22.00,
                owner_id INTEGER,
                owner_username TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(stagione_agricola, owner_id)
            )`
        },
        {
            name: 'attivita_predefinite',
            sql: `CREATE TABLE IF NOT EXISTS attivita_predefinite (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                categoria TEXT DEFAULT 'generale',
                owner_id INTEGER,
                owner_username TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        },
        {
            name: 'costi_personale',
            sql: `CREATE TABLE IF NOT EXISTS costi_personale (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lot_id INTEGER NOT NULL,
                stagione_agricola TEXT NOT NULL,
                data_attivita TEXT NOT NULL,
                numero_operatori INTEGER DEFAULT 1,
                qualifica TEXT DEFAULT 'standard',
                ore_lavorate REAL DEFAULT 6.5,
                attivita TEXT,
                costo_orario REAL,
                costo_totale REAL,
                note TEXT,
                owner_id INTEGER,
                owner_username TEXT,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lot_id) REFERENCES lots (id) ON DELETE CASCADE
            )`
        },
        {
            name: 'costi_mezzi_tecnici',
            sql: `CREATE TABLE IF NOT EXISTS costi_mezzi_tecnici (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lot_id INTEGER NOT NULL,
                stagione_agricola TEXT NOT NULL,
                data_registrazione TEXT,
                descrizione TEXT,
                importo REAL DEFAULT 0,
                categoria TEXT DEFAULT 'fitofarmaci',
                owner_id INTEGER,
                owner_username TEXT,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lot_id) REFERENCES lots (id) ON DELETE CASCADE
            )`
        }
    ];

    for (const t of tables) {
        try {
            await db.runAsync(t.sql);
            logger.info(`✅ Tabella ${t.name} verificata`);
        } catch (err) {
            logger.error(`Errore creazione tabella ${t.name}`, { error: err.message });
            throw err;
        }
    }

    // Indici per performance
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_lots_owner ON lots(owner_id)',
        'CREATE INDEX IF NOT EXISTS idx_lots_created ON lots(created_at DESC)',
        'CREATE INDEX IF NOT EXISTS idx_activities_lot ON activities(lot_id)',
        'CREATE INDEX IF NOT EXISTS idx_analyses_lot ON analyses(lot_id)',
        'CREATE INDEX IF NOT EXISTS idx_economic_lot ON economic_records(lot_id)',
        'CREATE INDEX IF NOT EXISTS idx_lot_details_lot ON lot_details(lot_id)',
        'CREATE INDEX IF NOT EXISTS idx_costi_personale_lot ON costi_personale(lot_id)',
        'CREATE INDEX IF NOT EXISTS idx_costi_personale_stagione ON costi_personale(stagione_agricola)',
        'CREATE INDEX IF NOT EXISTS idx_costi_mezzi_lot ON costi_mezzi_tecnici(lot_id)',
        'CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token)'
    ];

    for (const idx of indexes) {
        try { await db.runAsync(idx); } catch (err) {
            logger.warn('Indice già presente o errore', { error: err.message });
        }
    }
    logger.info('✅ Indici verificati');

    // Seed admin + attività predefinite (idempotenti)
    await createDefaultAdmin();
    await migrateAdminPrivacy();
    await inserisciAttivitaPredefinite();
}

// Migrazione: assicura che il super-admin abbia privacy_accepted=1
// (così può creare sotto-utenti senza dover ri-accettare la privacy)
async function migrateAdminPrivacy() {
    try {
        await db.runAsync(
            `UPDATE users SET privacy_accepted = 1, privacy_accepted_at = COALESCE(privacy_accepted_at, datetime('now'))
             WHERE username = 'admin' AND (privacy_accepted IS NULL OR privacy_accepted = 0)`
        );
    } catch (err) {
        logger.error('Errore migrateAdminPrivacy', { error: err.message });
    }
}

// Funzione per creare admin di default (idempotente)
async function createDefaultAdmin() {
    try {
        const adminExists = await db.getAsync('SELECT id FROM users WHERE username = ?', ['admin']);
        if (adminExists) return;

        const crypto = require('crypto');
        const tempPassword = crypto.randomBytes(6).toString('hex');
        const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
        const hashedPassword = await bcrypt.hash(tempPassword, saltRounds);

        await db.runAsync(
            `INSERT INTO users (username, email, password_hash, role, user_type, privacy_accepted, privacy_accepted_at)
             VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`,
            ['admin', 'admin@agrimanager.com', hashedPassword, 'admin', 'libero_professionista']
        );

        logger.warn('🔐 Nuovo utente admin creato — CAMBIA QUESTA PASSWORD AL PRIMO ACCESSO', {
            username: 'admin',
            tempPassword
        });

        if (process.env.NODE_ENV !== 'production') {
            console.log('==================================================');
            console.log('🔐 NUOVO UTENTE ADMIN CREATO');
            console.log('👤 Username: admin');
            console.log(`🔑 Password: ${tempPassword}`);
            console.log('⚠️  CAMBIA QUESTA PASSWORD AL PRIMO ACCESSO!');
            console.log('==================================================');
        }
    } catch (error) {
        logger.error('Errore verifica admin', { error: error.message });
    }
}

// Funzione per inserire attività predefinite di default (idempotente)
async function inserisciAttivitaPredefinite() {
    const attivitaDefault = [
        'Potatura', 'Raccolta', 'Irrigazione', 'Concimazione',
        'Trattamento fitosanitario', 'Lavorazione terreno', 'Semina',
        'Trapianto', 'Diradamento', 'Cimatura', 'Legatura',
        'Sfogliatura', 'Pulizia campo', 'Manutenzione impianti',
        'Controllo qualità', 'Selezione prodotto', 'Confezionamento',
        'Trasporto', 'Vendemmia', 'Pigiatura'
    ];

    for (const nome of attivitaDefault) {
        try {
            await db.runAsync(
                `INSERT OR IGNORE INTO attivita_predefinite (nome, categoria, owner_id, owner_username)
                 VALUES (?, 'generale', 1, 'admin')`,
                [nome]
            );
        } catch (err) {
            if (!String(err.message).includes('UNIQUE')) {
                logger.error('Errore inserimento attività predefinita', { nome, error: err.message });
            }
        }
    }
    logger.info('✅ Attività predefinite verificate');
}

module.exports = db;
