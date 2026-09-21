import { useState, useEffect } from 'react';
import { Download, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Captures the browser's install prompt so the app can show its own "Install App" button. */
export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) setInstalled(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setPromptEvent(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setPromptEvent(null);
    return choice.outcome === 'accepted';
  };

  return { canInstall: !!promptEvent, installed, promptInstall };
}

export function InstallAppButton() {
  const { canInstall, installed, promptInstall } = useInstallPrompt();
  const [hint, setHint] = useState(false);
  if (installed) return null;

  const handleClick = async () => {
    if (canInstall) {
      const ok = await promptInstall();
      if (ok) setHint(false);
      return;
    }
    setHint(true);
  };

  return (
    <div className="px-2 pb-2">
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-3 px-2 py-3 rounded-lg bg-tg-accent/15 hover:bg-tg-accent/25 transition-colors text-left"
      >
        <span className="w-9 h-9 rounded-full bg-tg-accent/25 flex items-center justify-center text-tg-accent">
          {canInstall ? <Download size={18} /> : <Smartphone size={18} />}
        </span>
        <span className="flex-1">
          <span className="block text-sm text-tg-accent">Install App</span>
          <span className="block text-[11px] text-tg-text-secondary">
            {canInstall ? 'Add to your home screen — no browser bars' : 'Standalone app mode'}
          </span>
        </span>
      </button>
      {hint && !canInstall && (
        <div className="mt-1 px-2 text-[11px] text-tg-text-secondary">
          Open your browser menu and choose “Add to Home Screen” / “Install app”. On iOS use Share → Add to Home Screen.
        </div>
      )}
    </div>
  );
}
