/* ==============================================================
   Cropbook PWA — registrazione Service Worker + prompt install
   ============================================================== */
(function () {
    // Registrazione Service Worker (best-effort, non blocca l'app)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then(function (reg) {
                    console.log('[PWA] Service Worker registrato:', reg.scope);
                    reg.addEventListener('updatefound', function () {
                        var nw = reg.installing;
                        if (!nw) return;
                        nw.addEventListener('statechange', function () {
                            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('[PWA] Nuova versione disponibile — attiva al prossimo refresh');
                            }
                        });
                    });
                })
                .catch(function (err) { console.warn('[PWA] SW registration failed:', err); });
        });
    }

    // Prompt di installazione (Chrome/Edge/Android)
    var deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferredPrompt = e;
        var btn = document.getElementById('pwa-install-btn');
        if (btn) btn.style.display = 'inline-flex';
    });

    window.installPWA = async function () {
        var btn = document.getElementById('pwa-install-btn');
        if (!deferredPrompt) {
            var msg = (window.t ? window.t('pwa.install_ios_hint') : null)
                || "Per installare: apri il menu del browser e scegli 'Aggiungi a schermata Home' (iOS Safari) oppure 'Installa app' (Chrome/Edge).";
            if (window.showNotification) window.showNotification(msg, 'info');
            else alert(msg);
            return;
        }
        deferredPrompt.prompt();
        try {
            var choice = await deferredPrompt.userChoice;
            console.log('[PWA] Install choice:', choice && choice.outcome);
        } catch (_) {}
        deferredPrompt = null;
        if (btn) btn.style.display = 'none';
    };

    window.addEventListener('appinstalled', function () {
        var btn = document.getElementById('pwa-install-btn');
        if (btn) btn.style.display = 'none';
        if (window.showNotification) {
            window.showNotification(
                (window.t ? window.t('pwa.installed') : null) || '✅ App installata!',
                'success'
            );
        }
    });
})();
