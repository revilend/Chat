/**
 * Keeps an already-open app up to date.
 *
 * An installed PWA (and a background browser tab) keeps running the code it
 * started with — a phone never reloads it by itself, so a new deploy simply
 * never arrives. This compares the bundle this page is running against the one
 * the server is serving now and reloads once when they differ.
 */

const RELOAD_GUARD = 'teleflow.reloadedAt';
const MIN_GAP_MS = 30_000;

/** The JavaScript bundle this page is actually running. */
function runningBundle(): string | null {
  if (typeof document === 'undefined') return null;
  const sources = Array.from(document.querySelectorAll('script[src]'))
    .map(script => script.getAttribute('src') ?? '');
  return sources.find(src => src.includes('assets/')) ?? null;
}

/** True when the server has a build we are not running. */
export async function checkForNewVersion(): Promise<void> {
  if (!import.meta.env.PROD) return;
  const running = runningBundle();
  if (!running) return;

  // Never loop: at most one reload every half minute.
  const lastReload = Number(sessionStorage.getItem(RELOAD_GUARD) ?? 0);
  if (Date.now() - lastReload < MIN_GAP_MS) return;

  try {
    // Bypass every cache: a stale index.html is exactly what we are looking for.
    const response = await fetch('./index.html', { cache: 'no-store' });
    if (!response.ok) return;
    const html = await response.text();
    const deployed = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/);
    if (!deployed || running.includes(deployed[0])) return;

    sessionStorage.setItem(RELOAD_GUARD, String(Date.now()));
    window.location.reload();
  } catch { /* offline — keep running what we already have */ }
}

/** Watches for a new deploy while the app stays open. */
export function watchForNewVersion(): void {
  if (!import.meta.env.PROD || typeof document === 'undefined') return;
  void checkForNewVersion();
  // Coming back to the app (phone home screen, tab switch) is the moment a
  // user expects the newest version.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForNewVersion();
  });
  setInterval(() => { void checkForNewVersion(); }, 5 * 60 * 1000);
}
