/*! coi-serviceworker v0.1.7 - MIT License */
/* Enables crossOriginIsolated on static hosts like GitHub Pages */
let coepCredentialless = false;
if (typeof window === 'undefined') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

  self.addEventListener('fetch', function (event) {
    if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
      return;
    }
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.status === 0) {
          return response;
        }

        const newHeaders = new Headers(response.headers);
        newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
        if (coepCredentialless) {
          newHeaders.set('Cross-Origin-Embedder-Policy', 'credentialless');
        } else {
          newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
        }

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }).catch((e) => console.error(e))
    );
  });
} else {
  (() => {
    // Check if browser already supports crossOriginIsolated
    if (window.crossOriginIsolated) {
      return;
    }
    const currentScript = document.currentScript;
    const registrationUrl = currentScript ? currentScript.src : 'coi-serviceworker.js';
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(registrationUrl).then(
        (registration) => {
          registration.addEventListener('updatefound', () => {
            window.location.reload();
          });
          if (registration.active && !navigator.serviceWorker.controller) {
            window.location.reload();
          }
        },
        (err) => {
          console.warn('COI Service Worker registration failed:', err);
        }
      );
    }
  })();
}
