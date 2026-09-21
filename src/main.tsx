import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { watchForNewVersion } from './utils/version';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register the service worker so the app can be installed and used offline.
// Relative path keeps it working on GitHub Pages project sites (username.github.io/repo/).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // The page was already controlled before this load: if a new service worker
    // takes over now, a newer build is live and we should move to it.
    const alreadyControlled = Boolean(navigator.serviceWorker.controller);
    let reloading = false;

    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
      .then((registration) => {
        const refresh = () => {
          void registration.update().catch(() => { /* offline */ });
        };
        refresh();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') refresh();
        });
        setInterval(refresh, 5 * 60 * 1000);
      })
      .catch(() => { /* offline support is optional — the app still runs */ });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!alreadyControlled || reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}

// A PWA that is left open never reloads itself, so new deploys are picked up here.
watchForNewVersion();
