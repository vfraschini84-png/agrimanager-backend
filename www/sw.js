/* ==============================================================
   Cropbook Service Worker — offline shell + smart caching
   ============================================================== */
const CACHE_VERSION = 'cropbook-v1.15.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Assets essenziali da precachare (app shell)
const APP_SHELL = [
    '/',
    '/index.html',
    '/css/cropbook.css',
    '/js/i18n.js',
    '/js/cropbook.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            // Best-effort: se qualcosa fallisce non blocca l'installazione
            return Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// Strategie:
// - Navigazione (HTML): network-first con fallback cache (per aggiornamenti UI immediati)
// - /api/*: network-only (nessuna cache di dati che cambiano tra utenti/tenant)
// - static (css/js/img/font): cache-first + refresh in background
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Solo richieste same-origin
    if (url.origin !== self.location.origin) return;

    // Non cachare API dati (multi-tenant, dati sensibili, real-time)
    if (url.pathname.startsWith('/api/')) {
        return; // lascia il default (network)
    }

    // Navigazione HTML → network-first
    if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const clone = res.clone();
                    caches.open(RUNTIME_CACHE).then((c) => c.put(req, clone)).catch(() => {});
                    return res;
                })
                .catch(() => caches.match(req).then((r) => r || caches.match('/index.html')))
        );
        return;
    }

    // Static assets → cache-first con stale-while-revalidate
    event.respondWith(
        caches.match(req).then((cached) => {
            const fetchPromise = fetch(req).then((res) => {
                if (res && res.status === 200 && res.type === 'basic') {
                    const clone = res.clone();
                    caches.open(RUNTIME_CACHE).then((c) => c.put(req, clone)).catch(() => {});
                }
                return res;
            }).catch(() => cached);
            return cached || fetchPromise;
        })
    );
});

// Permetti update forzati dal client (skipWaiting)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
