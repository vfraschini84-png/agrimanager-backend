const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

// Percorso assoluto del database
const dbPath = path.join(__dirname, 'agrimanager.db');

// Crea connessione al database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Errore connessione database:', err.message);
    } else {
        console.log('✅ Connesso al database SQLite:', dbPath);
        initializeDatabase();
    }
});

// Inizializza le tabelle
function initializeDatabase() {
    // Tabella lotti
    db.run(`CREATE TABLE IF NOT EXISTS lots (
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
    )`, (err) => {
        if (err) {
            console.error('❌ Errore creazione tabella lots:', err);
        } else {
            console.log('✅ Tabella lots verificata');
        }
    });

    // Tabella dettagli lotti
    db.run(`CREATE TABLE IF NOT EXISTS lot_details (
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
    )`, (err) => {
        if (err) {
            console.error('❌ Errore creazione tabella lot_details:', err);
        } else {
            console.log('✅ Tabella lot_details verificata');
        }
    });

    // Tabella utenti
    db.run(`CREATE TABLE IF NOT EXISTS users (
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
)`, (err) => {
    if (err) {
        console.error('❌ Errore creazione tabella users:', err);
    } else {
        console.log('✅ Tabella users verificata');
        createDefaultAdmin();
    }
});

    // Tabella attività di raccolta
    db.run(`CREATE TABLE IF NOT EXISTS activities (
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
    )`, (err) => {
        if (err) {
            console.error('❌ Errore creazione tabella activities:', err);
        } else {
            console.log('✅ Tabella activities verificata');
        }
    });

    // Tabella analisi
    db.run(`CREATE TABLE IF NOT EXISTS analyses (
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
    )`, (err) => {
        if (err) {
            console.error('❌ Errore creazione tabella analyses:', err);
        } else {
            console.log('✅ Tabella analyses verificata');
        }
    });
  
    // Tabella registrazioni economiche
    db.run(`CREATE TABLE IF NOT EXISTS economic_records (
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
    )`, (err) => {
        if (err) {
            console.error('❌ Errore creazione tabella economic_records:', err);
        } else {
            console.log('✅ Tabella economic_records verificata');
        }
    });

    // Tabella per token di reset password
db.run(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
)`, (err) => {
    if (err) {
        console.error('❌ Errore creazione tabella password_reset_tokens:', err);
    } else {
        console.log('✅ Tabella password_reset_tokens verificata');

        // Tabella tariffe manodopera (una per stagione)
db.run(`CREATE TABLE IF NOT EXISTS tariffe_manodopera (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stagione_agricola TEXT NOT NULL,
    costo_orario_standard REAL DEFAULT 15.00,
    costo_orario_specializzato REAL DEFAULT 22.00,
    owner_id INTEGER,
    owner_username TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(stagione_agricola, owner_id)
)`, (err) => {
    if (err && !err.message.includes('already exists')) {
        console.error('❌ Errore creazione tabella tariffe_manodopera:', err);
    } else {
        console.log('✅ Tabella tariffe_manodopera verificata');
    }
});

// Tabella attività predefinite (condivisa tra tutti gli utenti)
db.run(`CREATE TABLE IF NOT EXISTS attivita_predefinite (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    categoria TEXT DEFAULT 'generale',
    owner_id INTEGER,
    owner_username TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
    if (err && !err.message.includes('already exists')) {
        console.error('❌ Errore creazione tabella attivita_predefinite:', err);
    } else {
        console.log('✅ Tabella attivita_predefinite verificata');
        // Inserisci attività predefinite di default se la tabella è vuota
        inserisciAttivitaPredefinite();
    }
});

// Tabella costi personale (registrazioni giornaliere)
db.run(`CREATE TABLE IF NOT EXISTS costi_personale (
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
)`, (err) => {
    if (err && !err.message.includes('already exists')) {
        console.error('❌ Errore creazione tabella costi_personale:', err);
    } else {
        console.log('✅ Tabella costi_personale verificata');
    }
});

// Tabella costi mezzi tecnici (per lotto/stagione)
db.run(`CREATE TABLE IF NOT EXISTS costi_mezzi_tecnici (
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
)`, (err) => {
    if (err && !err.message.includes('already exists')) {
        console.error('❌ Errore creazione tabella costi_mezzi_tecnici:', err);
    } else {
        console.log('✅ Tabella costi_mezzi_tecnici verificata');
    }
});

// Aggiungi indici per performance
db.run(`CREATE INDEX IF NOT EXISTS idx_costi_personale_lot ON costi_personale(lot_id)`, (err) => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_costi_personale_stagione ON costi_personale(stagione_agricola)`, (err) => {});
db.run(`CREATE INDEX IF NOT EXISTS idx_costi_mezzi_lot ON costi_mezzi_tecnici(lot_id)`, (err) => {});
            // ==================== CREAZIONE INDICI PER PERFORMANCE ====================
    console.log('📊 Creazione indici per ottimizzazione query...');

    // Indici per multi-tenant
    db.run(`CREATE INDEX IF NOT EXISTS idx_lots_owner ON lots(owner_id)`, (err) => {
        if (err && !err.message.includes('already exists')) {
            console.error('❌ Errore creazione indice idx_lots_owner:', err.message);
        } else {
            console.log('✅ Indice idx_lots_owner verificato');
        }
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_activities_lot ON activities(lot_id)`, (err) => {
        if (err && !err.message.includes('already exists')) {
            console.error('❌ Errore creazione indice idx_activities_lot:', err.message);
        } else {
            console.log('✅ Indice idx_activities_lot verificato');
        }
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_analyses_lot ON analyses(lot_id)`, (err) => {
        if (err && !err.message.includes('already exists')) {
            console.error('❌ Errore creazione indice idx_analyses_lot:', err.message);
        } else {
            console.log('✅ Indice idx_analyses_lot verificato');
        }
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_economic_lot ON economic_records(lot_id)`, (err) => {
        if (err && !err.message.includes('already exists')) {
            console.error('❌ Errore creazione indice idx_economic_lot:', err.message);
        } else {
            console.log('✅ Indice idx_economic_lot verificato');
        }
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_lot_details_lot ON lot_details(lot_id)`, (err) => {
        if (err && !err.message.includes('already exists')) {
            console.error('❌ Errore creazione indice idx_lot_details_lot:', err.message);
        } else {
            console.log('✅ Indice idx_lot_details_lot verificato');
        }
    });

    // Indice per ordinamento cronologico
    db.run(`CREATE INDEX IF NOT EXISTS idx_lots_created ON lots(created_at DESC)`, (err) => {
        if (err && !err.message.includes('already exists')) {
            console.error('❌ Errore creazione indice idx_lots_created:', err.message);
        } else {
            console.log('✅ Indice idx_lots_created verificato');
        }
    });

    console.log('✅ Tutti gli indici verificati');
    }
});

}

// Funzione per creare admin di default
async function createDefaultAdmin() {
    try {
        const adminExists = await db.getAsync('SELECT id FROM users WHERE username = ?', ['admin']);
        
        if (!adminExists) {
            // Genera una password casuale di 12 caratteri
            const crypto = require('crypto');
            const tempPassword = crypto.randomBytes(6).toString('hex');
            
            const hashedPassword = await bcrypt.hash(tempPassword, 10);
            await db.runAsync(
                `INSERT INTO users (username, email, password_hash, role, user_type)
                 VALUES (?, ?, ?, ?, ?)`,
                ['admin', 'admin@agrimanager.com', hashedPassword, 'admin', 'libero_professionista']
            );
            
            console.log('==================================================');
            console.log('🔐 NUOVO UTENTE ADMIN CREATO');
            console.log(`👤 Username: admin`);
            console.log(`🔑 Password: ${tempPassword}`);
            console.log('⚠️  CAMBIA QUESTA PASSWORD AL PRIMO ACCESSO!');
            console.log('==================================================');
        }
    } catch (error) {
        console.error('❌ Errore verifica admin:', error);
    }
}

// Funzione per inserire attività predefinite di default
function inserisciAttivitaPredefinite() {
    const attivitaDefault = [
        'Potatura', 'Raccolta', 'Irrigazione', 'Concimazione',
        'Trattamento fitosanitario', 'Lavorazione terreno', 'Semina',
        'Trapianto', 'Diradamento', 'Cimatura', 'Legatura',
        'Sfogliatura', 'Pulizia campo', 'Manutenzione impianti',
        'Controllo qualità', 'Selezione prodotto', 'Confezionamento',
        'Trasporto', 'Vendemmia', 'Pigiatura'
    ];
    
    attivitaDefault.forEach(nome => {
        db.run(
            `INSERT OR IGNORE INTO attivita_predefinite (nome, categoria, owner_id, owner_username) 
             VALUES (?, 'generale', 1, 'admin')`,
            [nome],
            (err) => {
                if (err && !err.message.includes('UNIQUE')) {
                    console.error('Errore inserimento attività predefinita:', err);
                }
            }
        );
    });
    console.log('✅ Attività predefinite verificate');
}

// ==================== FUNZIONI HELPER PROMISIFICATE ====================
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

module.exports = db;