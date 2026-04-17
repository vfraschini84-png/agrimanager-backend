const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const authRoutes = require('./routes/auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// DEBUG: Test delle routes prima del caricamento
console.log('=== 🧪 DEBUG ROUTES ===');

// Importa le routes con gestione errori migliorata
let lotsRoutes;
try {
  console.log('1. Tentativo di caricamento routes/lots...');
  lotsRoutes = require('./routes/lots');
  console.log('2. Routes caricate, verifico i metodi...');
  
  // Debug dei metodi disponibili
  if (lotsRoutes && lotsRoutes.stack) {
    console.log('3. Metodi routes disponibili:');
    lotsRoutes.stack.forEach(layer => {
      if (layer.route) {
        console.log(`   ${Object.keys(layer.route.methods).join(', ').toUpperCase()} ${layer.route.path}`);
      }
    });
  }
  
  app.use('/api/lots', lotsRoutes);
  console.log('✅ Routes montate correttamente');
} catch (error) {
  console.log('❌ Errore caricamento routes:', error.message);
  console.log('Stack:', error.stack);
  
app.use('/api/auth', authRoutes);

  // Route di fallback più dettagliate
  app.get('/api/lots', (req, res) => {
    res.json({ message: 'API test - GET funziona' });
  });
  
  app.post('/api/lots/:id/details', (req, res) => {
    res.json({ message: 'API test - POST funziona', id: req.params.id });
  });
}

// Aggiungi route PUT di test
app.put('/api/test-put', (req, res) => {
  res.json({ message: 'PUT funziona', data: req.body });
});

app.put('/api/lots/:lotId/details/:recordId', (req, res) => {
  res.json({ 
    message: 'PUT route di test', 
    lotId: req.params.lotId, 
    recordId: req.params.recordId,
    data: req.body 
  });
});

// Route di base
app.get('/', (req, res) => {
  res.json({ 
    message: 'API AgriManager Backend',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

// Gestione errori
app.use((err, req, res, next) => {
  console.error('❌ Errore:', err.stack);
  res.status(500).json({ 
    error: 'Errore interno del server',
    message: err.message 
  });
});

// Avvia il server - MODIFICATO PER MOBILE
app.listen(PORT, '0.0.0.0', () => {
  console.log('==================================');
  console.log('🚀 Server AgriManager avviato!');
  console.log(`📍 Porta: ${PORT}`);
  console.log('🌐 ACCESSIBILE DA:');
  console.log(`   - Computer: http://localhost:${PORT}`);
  console.log(`   - IP Locale: http://192.168.0.69:${PORT}`);
  console.log(`   - Rete: http://[qualsiasi-ip-rete]:${PORT}`);
  console.log('📱 Per mobile: usa http://192.168.0.69:3000');
  console.log('==================================');
});