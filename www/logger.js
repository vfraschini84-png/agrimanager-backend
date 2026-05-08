// logger.js - Winston logging setup
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Creare directory logs se non esiste
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'agrimanager' },
    transports: [
        // File per errori
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 10
        }),
        // File per tutto
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 30
        })
    ],
});

// Console in development e test
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, ...rest }) => {
                return `${timestamp} [${level}]: ${message} ${Object.keys(rest).length ? JSON.stringify(rest) : ''}`;
            })
        ),
    }));
}

module.exports = logger;
