const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class DatabaseBackup {
    constructor() {
        this.dbPath = path.join(__dirname, 'cropbook.db');
        this.backupDir = path.join(__dirname, 'backups');
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.backupPath = path.join(this.backupDir, `cropbook-${this.timestamp}.db`);
    }

    async createBackup() {
        console.log('🔄 Avvio procedura di backup...');
        
        // Crea cartella backups
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
            console.log('✅ Cartella backups creata');
        }

        // Verifica database
        if (!fs.existsSync(this.dbPath)) {
            throw new Error(`Database non trovato: ${this.dbPath}`);
        }

        // Crea backup
        fs.copyFileSync(this.dbPath, this.backupPath);
        
        // Statistiche
        const stats = fs.statSync(this.backupPath);
        const backupSize = (stats.size / 1024).toFixed(2);
        
        console.log('✅ Backup creato con successo!');
        console.log(`📁 Percorso: ${this.backupPath}`);
        console.log(`💾 Dimensione: ${backupSize} KB`);
        console.log(`⏰ Data: ${new Date().toLocaleString()}`);
        
        return this.backupPath;
    }

    listBackups() {
        if (!fs.existsSync(this.backupDir)) {
            return [];
        }
        
        const backups = fs.readdirSync(this.backupDir)
            .filter(file => file.endsWith('.db'))
            .map(file => {
                const filePath = path.join(this.backupDir, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    path: filePath,
                    size: (stats.size / 1024).toFixed(2) + ' KB',
                    date: stats.mtime
                };
            })
            .sort((a, b) => b.date - a.date);
        
        return backups;
    }

    cleanupOldBackups(maxBackups = 10) {
        const backups = this.listBackups();
        
        if (backups.length > maxBackups) {
            const toDelete = backups.slice(maxBackups);
            toDelete.forEach(backup => {
                fs.unlinkSync(backup.path);
                console.log(`🗑️ Eliminato backup vecchio: ${backup.name}`);
            });
        }
    }
}

// Esegui il backup
const backupManager = new DatabaseBackup();

async function main() {
    try {
        await backupManager.createBackup();
        
        // Lista backup esistenti
        console.log('\n📋 Elenco backup:');
        const backups = backupManager.listBackups();
        backups.forEach((backup, index) => {
            console.log(`${index + 1}. ${backup.name} (${backup.size})`);
        });
        
        // Pulizia backup vecchi (mantieni solo gli ultimi 5)
        backupManager.cleanupOldBackups(5);
        
    } catch (error) {
        console.error('❌ Errore durante il backup:', error.message);
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    main();
}

module.exports = DatabaseBackup;