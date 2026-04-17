const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

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

// Sostituisci la creazione della tabella users con questa:
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

// Funzione per creare admin di default
async function createDefaultAdmin() {
    const bcrypt = require('bcrypt');
    
    const adminExists = await db.getAsync('SELECT id FROM users WHERE username = ?', ['admin']);
    
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        db.run(
            `INSERT INTO users (username, email, password_hash, role, user_type)
             VALUES (?, ?, ?, ?, ?)`,
            ['admin', 'admin@agrimanager.com', hashedPassword, 'admin', 'libero_professionista']
        );
        console.log('✅ Utente admin creato di default (username: admin, password: admin123)');
    }
}

  // Tabella dettagli lotti
  db.run(`CREATE TABLE IF NOT EXISTS lot_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_id INTEGER NOT NULL,
    cost_per_kg REAL,
    estimated_kg REAL,
    purchase_date TEXT,
    harvested_kg REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lot_id) REFERENCES lots (id)
  )`, (err) => {
    if (err) {
      console.error('❌ Errore creazione tabella lot_details:', err);
    } else {
      console.log('✅ Tabella lot_details verificata');
    }
  });

  // Tabella utenti (per il futuro)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    permissions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('❌ Errore creazione tabella users:', err);
    } else {
      console.log('✅ Tabella users verificata');
    }
  });
}

// Funzione helper per promisificare le query
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