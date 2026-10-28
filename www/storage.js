// Emergent Object Storage client (file dei lotti)
const logger = require('./logger');

const STORAGE_BASE = ((process.env.INTEGRATION_PROXY_URL || '').trim() || 'https://integrations.emergentagent.com').replace(/\/+$/, '');
const STORAGE_URL = `${STORAGE_BASE}/objstore/api/v1/storage`;
const APP_NAME = 'cropbook';

let storageKey = null;

async function initStorage(force = false) {
    if (storageKey && !force) return storageKey;
    const resp = await fetch(`${STORAGE_URL}/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emergent_key: process.env.EMERGENT_LLM_KEY })
    });
    if (!resp.ok) throw new Error(`Storage init fallito (${resp.status})`);
    storageKey = (await resp.json()).storage_key;
    return storageKey;
}

async function storageFetch(path, options, retried = false) {
    const key = await initStorage();
    const resp = await fetch(`${STORAGE_URL}/objects/${path}`, {
        ...options,
        headers: { ...(options.headers || {}), 'X-Storage-Key': key }
    });
    if (resp.status === 404 && !retried) {
        await initStorage(true);
        return storageFetch(path, options, true);
    }
    if (!resp.ok) {
        const err = new Error(`Storage error ${resp.status}`);
        err.status = resp.status;
        throw err;
    }
    return resp;
}

async function putObject(path, data, contentType) {
    const resp = await storageFetch(path, { method: 'PUT', headers: { 'Content-Type': contentType }, body: data });
    return resp.json();
}

async function getObject(path) {
    const resp = await storageFetch(path, { method: 'GET' });
    return { data: Buffer.from(await resp.arrayBuffer()), contentType: resp.headers.get('content-type') || 'application/octet-stream' };
}

function initOnStartup() {
    initStorage()
        .then(() => logger.info('✅ Object storage inizializzato'))
        .catch(err => logger.error('❌ Object storage init fallito', { error: err.message }));
}

module.exports = { APP_NAME, initStorage, putObject, getObject, initOnStartup };
