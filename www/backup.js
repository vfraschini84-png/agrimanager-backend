const fs = require('fs');
const path = require('path');

console.log('🔄 Creazione backup del database...');

const dbPath = path.join(__dirname, 'cropbook.db');
const backupDir = path.join(__dirname, 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `cropbook-${timestamp}.db`);

// Crea cartella backups se non esiste
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
    console.log('✅ Cartella backups creata');
}

// Verifica che il database esista
if (!fs.existsSync(dbPath)) {
    console.log('❌ Database non trovato:', dbPath);
    process.exit(1);
}

// Copia il database
try {
    fs.copyFileSync(dbPath, backupPath);
    console.log('✅ Backup creato con successo!');
    console.log('📁 Percorso backup:', backupPath);
    console.log('💾 Dimensione:', (fs.statSync(backupPath).size / 1024).toFixed(2) + ' KB');
} catch (error) {
    console.log('❌ Errore durante il backup:', error.message);
}