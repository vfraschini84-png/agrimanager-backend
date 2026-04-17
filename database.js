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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('❌ Errore creazione tabella users:', err);
        } else {
            console.log('✅ Tabella users verificata');
            
            // Crea utente admin di default se non esiste
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