// ✅ Carica .env PRIMA di qualunque modulo che lo usi
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const logger = require('./logger');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger');

// ==================== FAIL-FAST SU CONFIG MANCANTE ====================
const REQUIRED_ENV = ['JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
    logger.error('❌ Variabili .env mancanti', { missing });
    console.error(`\n❌ Configurazione mancante: ${missing.join(', ')}\n   Crea il file www/.env (vedi www/.env.example)\n`);
    process.exit(1);
}

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// trust proxy (rate-limit corretto dietro reverse proxy)
app.set('trust proxy', 1);

// ==================== RATE LIMITING ====================
const isTest = NODE_ENV === 'test';
const passthrough = (req, res, next) => next();

const generalLimiter = isTest ? passthrough : rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Troppe richieste. Riprova più tardi.' },
    standardHeaders: true,
    legacyHeaders: false
});

const loginLimiter = isTest ? passthrough : rateLimit({
    windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '10', 10),
    message: { error: 'Troppi tentativi di accesso. Riprova fra qualche minuto.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
});

// ==================== SICUREZZA HTTP ====================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                'https://cdnjs.cloudflare.com',
                'https://kit.fontawesome.com',
                'https://cdn.jsdelivr.net',
                'https://static.cloudflareinsights.com',
                'https://unpkg.com'
            ],
            scriptSrcAttr: ["'self'", "'unsafe-inline'"],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://cdnjs.cloudflare.com',
                'https://fonts.googleapis.com',
                'https://unpkg.com'
            ],
            fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com', 'data:'],
            imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
            connectSrc: [
                "'self'",
                'https://api.ipify.org',
                'https://cdn.jsdelivr.net',
                'https://unpkg.com',
                'https://nominatim.openstreetmap.org',
                'https://*.tile.openstreetmap.org',
                'https://server.arcgisonline.com'
            ],
            objectSrc: ["'none'"],
            frameAncestors: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.use(compression());

// ==================== CORS WHITELIST ====================
const allowedOrigins = (process.env.ALLOWED_ORIGINS ||
    'http://localhost:3000,http://127.0.0.1:3000,capacitor://localhost,http://localhost:5500,http://192.168.0.69:5500')
    .split(',').map(o => o.trim()).filter(Boolean);

// Pattern aggiuntivi: sottodomini Emergent preview e localhost dev
const ORIGIN_PATTERNS = [
    /^https?:\/\/([a-z0-9-]+\.)*preview\.emergentagent\.com$/i,
    /^https?:\/\/([a-z0-9-]+\.)*preview\.emergentcf\.cloud$/i,
    /^https?:\/\/([a-z0-9-]+\.)*emergentagent\.com$/i,
    /^http:\/\/localhost(:\d+)?$/i,
    /^http:\/\/127\.0\.0\.1(:\d+)?$/i
];

const corsOptions = {
    origin: (origin, callback) => {
        // Permetti richieste server-to-server / curl / mobile webview senza origin
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (ORIGIN_PATTERNS.some(re => re.test(origin))) return callback(null, true);
        logger.warn('CORS bloccato', { origin });
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600
};
app.use(cors(corsOptions));

app.use(bodyParser.json({ limit: '10mb' }));

// ==================== STATIC SICURO ====================
// ⚠️ Esponiamo SOLO file statici sicuri, NON l'intera directory www/ (che contiene .db / .env / .js).
const PUBLIC_FILES = [
    'index.html',
    'reset-password.html'
];
PUBLIC_FILES.forEach(file => {
    app.get(`/${file}`, (req, res) => res.sendFile(path.join(__dirname, file)));
});

// Assets statici: SOLO le cartelle css/ e js/ (mai esporre tutta www/)
const staticOpts = {
    maxAge: NODE_ENV === 'production' ? '7d' : 0,
    fallthrough: true,
    setHeaders: (res, filePath) => {
        // Difesa: blocca file sensibili anche se finissero per sbaglio in /css o /js
        const lower = filePath.toLowerCase();
        if (lower.endsWith('.env') || lower.endsWith('.db') || lower.endsWith('.sqlite')) {
            res.status(403).end();
        }
    }
};
app.use('/css', express.static(path.join(__dirname, 'css'), staticOpts));
app.use('/js', express.static(path.join(__dirname, 'js'), staticOpts));

app.get('/', (req, res) => {
    logger.info('GET /', { ip: req.ip });
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== HEALTH ====================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        env: NODE_ENV,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// ==================== SWAGGER ====================
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
    customCss: '.swagger-ui .topbar { display: none }'
}));
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpecs);
});

// ==================== RATE-LIMIT MIRATI ====================
// Login DEVE precedere il mount delle route /api/auth
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/forgot-password', loginLimiter);
app.use('/api/', generalLimiter);

// ==================== ROUTES ====================
const mountRoute = (mountPath, modulePath) => {
    try {
        const router = require(modulePath);
        app.use(mountPath, router);
        logger.info(`✅ Route ${mountPath} montata`);
    } catch (err) {
        logger.error(`❌ Errore caricamento route ${mountPath}`, { error: err.message, stack: err.stack });
    }
};

mountRoute('/api/auth', './routes/auth');
mountRoute('/api/lots', './routes/lots');
mountRoute('/api/activities', './routes/activities');
mountRoute('/api/analyses', './routes/analyses');
mountRoute('/api/economic', './routes/economic');
mountRoute('/api/costi', './routes/costi');
mountRoute('/api/reports', './routes/reports');
mountRoute('/api/admin', './routes/admin');

// ==================== 404 ====================
app.use((req, res) => {
    logger.warn('404 Not Found', { method: req.method, url: req.originalUrl, ip: req.ip });
    res.status(404).json({
        error: 'Endpoint non trovato',
        path: req.originalUrl,
        method: req.method
    });
});

// ==================== ERROR HANDLER ====================
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    // CORS error → 403 (non 500)
    if (err && err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'Origine non consentita (CORS)' });
    }

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

    const response = {
        error: statusCode === 500 && NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message || 'Unknown error'
    };
    if (NODE_ENV === 'development') response.stack = err.stack;

    res.status(statusCode).json(response);
});

// ==================== AVVIO SERVER ====================
// In ambiente Emergent il routing pubblico manda /api/* alla porta 8001 e tutto il resto a 3000.
// Per servire sia il frontend (index.html) sia le API dallo stesso processo, ascoltiamo su entrambe.
const PORTS = [PORT];
const EXTRA = parseInt(process.env.EXTRA_PORT || '8001', 10);
if (EXTRA && EXTRA !== PORT) PORTS.push(EXTRA);

// In modalità test NON aprire le porte (Supertest usa l'app in-process)
const servers = NODE_ENV === 'test' ? [] : PORTS.map(p => app.listen(p, '0.0.0.0', () => {
    logger.info('🚀 Server Cropbook in ascolto', { port: p, nodeEnv: NODE_ENV });
    if (NODE_ENV !== 'production') {
        console.log(`==================================`);
        console.log(`🚀 Cropbook pronto su porta ${p}`);
        console.log(`📍 http://localhost:${p}`);
        console.log(`📚 http://localhost:${p}/api-docs`);
        console.log(`🩺 http://localhost:${p}/api/health`);
        console.log(`==================================`);
    }
}));

// ==================== GRACEFUL SHUTDOWN ====================
const shutdown = (signal) => {
    logger.info(`${signal} ricevuto, chiusura server...`);
    Promise.all(servers.map(s => new Promise(resolve => s.close(resolve))))
        .then(() => {
            logger.info('Server chiusi');
            process.exit(0);
        });
    setTimeout(() => {
        logger.error('Timeout chiusura, forzo exit');
        process.exit(1);
    }, 10000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
