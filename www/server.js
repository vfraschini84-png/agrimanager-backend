const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// ✅ LOGGING
const logger = require('./logger');

// ✅ SWAGGER DOCUMENTATION
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger');

// ✅ NUOVI MIDDLEWARE DI SICUREZZA
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ CONFIGURA RATE LIMITING (protezione anti-abuso)
// Disabilitato in test/development se NODE_ENV === 'test'
const limiter = process.env.NODE_ENV === 'test' 
    ? (req, res, next) => next() // Bypass rate limit nei test
    : rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minuti
        max: 100, // Limite 100 richieste per IP
        message: { error: 'Troppe richieste. Riprova più tardi.' },
        standardHeaders: true,
        legacyHeaders: false,
    });

// ✅ APPLICA MIDDLEWARE DI SICUREZZA
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'", 
                "'unsafe-inline'", 
                "'unsafe-eval'", 
                "https://cdnjs.cloudflare.com", 
                "https://kit.fontawesome.com",
                "https://cdn.jsdelivr.net",  // ✅ AGGIUNTO per xlsx
                "https://cdn.jsdelivr.net"
            ],
            scriptSrcAttr: [
                "'self'",
                "'unsafe-inline'"  // ✅ AGGIUNTO per onclick negli attributi
            ],
            styleSrc: [
                "'self'", 
                "'unsafe-inline'", 
                "https://cdnjs.cloudflare.com", 
                "https://fonts.googleapis.com"
            ],
            fontSrc: [
                "'self'", 
                "https://cdnjs.cloudflare.com", 
                "https://fonts.gstatic.com"
            ],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: [
    "'self'", 
    "http://localhost:3000", 
    "http://192.168.0.69:3000",
    "http://192.168.0.69:3001",
    "https://192.168.0.69:3000",
    "https://api.ipify.org",
    "https://cdn.jsdelivr.net"  // ✅ AGGIUNGI  
],
        },
    },
}));

app.use(compression()); // Compressione gzip per risposte più veloci
app.use('/api/', limiter); // Rate limiting solo sulle API

// ✅ CONFIGURAZIONE CORS WHITELIST
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 
    'http://localhost:3000,http://127.0.0.1:3000,http://192.168.0.69:3000').split(',');

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn('CORS blocked request', { origin, allowedOrigins });
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600
};

// Middleware esistenti
app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '10mb' })); // Limita dimensione JSON

// ==================== ROUTE PER IL FRONTEND ====================
// Route per servire index.html (percorso corretto)
app.get('/', (req, res) => {
    logger.info('GET /', { ip: req.ip });
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve file statici dalla cartella www
app.use(express.static(__dirname));

// ✅ SWAGGER DOCUMENTATION
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
    swaggerOptions: {
        url: '/api-docs.json',
    },
    customCss: '.swagger-ui .topbar { display: none }',
}));
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpecs);
});

// DEBUG: Test delle routes prima del caricamento
logger.info('🧪 Inizio caricamento routes');

// ==================== ROUTE LOTS ====================
let lotsRoutes;
try {
    console.log('1. Tentativo di caricamento routes/lots...');
    lotsRoutes = require('./routes/lots');
    console.log('2. Routes caricate, verifico i metodi...');

    if (lotsRoutes && lotsRoutes.stack) {
        console.log('3. Metodi routes disponibili:');
        lotsRoutes.stack.forEach(layer => {
            if (layer.route) {
                console.log(`   ${Object.keys(layer.route.methods).join(', ').toUpperCase()} ${layer.route.path}`);
            }
        });
    }

    app.use('/api/lots', lotsRoutes);
    console.log('✅ Routes lots montate correttamente');
} catch (error) {
    console.log('❌ Errore caricamento routes lots:', error.message);
}

// ==================== ROUTE AUTH ====================
try {
    console.log('1b. Tentativo di caricamento routes/auth...');
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    console.log('✅ Routes auth montate correttamente');
} catch (error) {
    console.log('❌ Errore caricamento routes auth:', error.message);
}

// ==================== ROUTE ACTIVITIES ====================
try {
    console.log('1c. Tentativo di caricamento routes/activities...');
    const activitiesRoutes = require('./routes/activities');
    app.use('/api/activities', activitiesRoutes);
    console.log('✅ Routes activities montate correttamente');
} catch (error) {
    console.log('❌ Errore caricamento routes activities:', error.message);
}

// ==================== ROUTE ANALYSES ====================
try {
    console.log('1d. Tentativo di caricamento routes/analyses...');
    const analysesRoutes = require('./routes/analyses');
    app.use('/api/analyses', analysesRoutes);
    console.log('✅ Routes analyses montate correttamente');
} catch (error) {
    console.log('❌ Errore caricamento routes analyses:', error.message);
}

// ==================== ROUTE ECONOMIC ====================
try {
    console.log('1e. Tentativo di caricamento routes/economic...');
    const economicRoutes = require('./routes/economic');
    app.use('/api/economic', economicRoutes);
    console.log('✅ Routes economic montate correttamente');
} catch (error) {
    console.log('❌ Errore caricamento routes economic:', error.message);
}

// ==================== ROUTE COSTI ====================
try {
    console.log('1f. Tentativo di caricamento routes/costi...');
    const costiRoutes = require('./routes/costi');
    app.use('/api/costi', costiRoutes);
    console.log('✅ Routes costi montate correttamente');
} catch (error) {
    console.log('❌ Errore caricamento routes costi:', error.message);
}

// ==================== ROUTE DI TEST ====================
app.put('/api/test-put', (req, res) => {
    res.json({ message: 'PUT funziona', data: req.body });
});

// ==================== GESTIONE ERRORI ====================
// 404 Handler (DEVE venire prima di error handler)
app.use((req, res) => {
    logger.warn('404 Not Found', { method: req.method, url: req.originalUrl, ip: req.ip });
    res.status(404).json({
        error: 'Endpoint non trovato',
        path: req.originalUrl,
        method: req.method
    });
});

// Global Error Handler (DEVE essere ultimo!)
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || err.status || 500;
    
    logger.error('Unhandled Error', {
        message: err.message,
        statusCode,
        stack: err.stack,
        path: req.path,
        method: req.method,
        user: req.user?.username || 'anonymous',
        ip: req.ip
    });
    
    // Non esporre stack trace in produzione
    const response = {
        error: statusCode === 500 && process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message || 'Unknown error'
    };
    
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }
    
    res.status(statusCode).json(response);
});

// ==================== AVVIO SERVER ====================
app.listen(PORT, '0.0.0.0', () => {
    logger.info('🚀 Server AgriManager avviato!', {
        port: PORT,
        nodeEnv: process.env.NODE_ENV || 'development',
        allowedOrigins
    });
    console.log('==================================');
    console.log('🚀 Server AgriManager avviato!');
    console.log(`📍 Porta: ${PORT}`);
    console.log('🌐 ACCESSIBILE DA:');
    console.log(`   - Frontend: http://localhost:${PORT}`);
    console.log(`   - API: http://localhost:${PORT}/api`);
    console.log(`   - IP Locale: http://192.168.0.69:${PORT}`);
    console.log('==================================');
});