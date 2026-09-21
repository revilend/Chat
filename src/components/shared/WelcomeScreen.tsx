import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { Copy, Check, UserPlus, Bookmark, Sparkles, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { formatUserId } from '../../utils/identity';
import { UserAvatar } from './UserAvatar';

export function WelcomeScreen() {
  const { state, dispatch } = useApp();
  const [copied, setCopied] = useState(false);
  const address = state.session?.userId ?? '';

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  const status = state.netStatus;
  const statusView = status === 'online'
    ? { icon: <Wifi size={14} />, text: 'Connected — people can reach you', className: 'text-tg-green' }
    : status === 'connecting'
      ? { icon: <Loader2 size={14} className="animate-spin" />, text: 'Connecting…', className: 'text-amber-400' }
      : status === 'error'
        ? { icon: <WifiOff size={14} />, text: state.netDetail || 'Could not connect', className: 'text-tg-red' }
        : { icon: <WifiOff size={14} />, text: 'Offline', className: 'text-tg-text-secondary' };

  return (
    <div className="h-full flex items-center justify-center bg-tg-bg tg-doodle px-6 overflow-y-auto">
      <div className="max-w-md w-full py-10">
        <div className="flex flex-col items-center text-center">
          <UserAvatar
            name={state.currentUser.name}
            id={state.currentUser.id || 'me'}
            avatar={state.currentUser.avatar}
            avatarColor={state.currentUser.avatarColor}
            size={84}
            className="shadow-2xl"
          />
          <h1 className="mt-5 text-xl font-medium text-tg-text">
            You are signed in as {state.currentUser.name}
          </h1>
          <div className="text-[13px] text-tg-text-secondary mt-1">@{state.currentUser.username}</div>
          <div className={`mt-2 flex items-center gap-1.5 text-xs ${statusView.className}`}>
            {statusView.icon} {statusView.text}
          </div>
        </div>

        {/* ID card */}
        <div className="mt-7 card p-4">
          <div className="text-[11px] uppercase tracking-wide text-tg-text-secondary">Your ID</div>
          <div className="mt-1.5 text-center font-mono text-[34px] leading-tight tracking-[0.18em] text-tg-text">
            {formatUserId(address)}
          </div>
          <button
            onClick={copyAddress}
            className="btn btn-primary mt-3 w-full h-11 rounded-xl text-sm"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy my ID'}
          </button>
          <p className="mt-3 text-[11px] text-tg-text-secondary leading-relaxed">
            Send these six digits to a friend. When they add them under Contacts, their chat appears here and
            your messages travel straight between your two devices.
          </p>
        </div>          <div className="mt-4 grid gap-2">
          <button
            onClick={() => dispatch({ type: 'TOGGLE_CONTACTS' })}
            className="flex items-center gap-3 rounded-2xl bg-tg-sidebar/80 backdrop-blur-sm border border-white/5 px-4 py-3 hover:bg-tg-hover transition-colors text-left"
          >
            <UserPlus size={18} className="text-tg-accent" />
            <span className="flex-1">
              <span className="block text-sm text-tg-text">Add a contact</span>
              <span className="block text-[11px] text-tg-text-secondary">Paste the 6-digit ID of someone you want to write to</span>
            </span>
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_ACTIVE_CHAT', chatId: 'chat_saved' })}
            className="flex items-center gap-3 rounded-2xl bg-tg-sidebar/80 backdrop-blur-sm border border-white/5 px-4 py-3 hover:bg-tg-hover transition-colors text-left"
          >
            <Bookmark size={18} className="text-tg-accent" />
            <span className="flex-1">
              <span className="block text-sm text-tg-text">Saved Messages</span>
              <span className="block text-[11px] text-tg-text-secondary">Your private notebook — notes, links, files</span>
            </span>
          </button>
          <div className="flex items-start gap-3 rounded-2xl bg-tg-sidebar/80 backdrop-blur-sm border border-white/5 px-4 py-3">
            <Sparkles size={18} className="text-tg-accent mt-0.5" />
            <span>
              <span className="block text-sm text-tg-text">Everything else is real too</span>
              <span className="block text-[11px] text-tg-text-secondary leading-relaxed">
                Voice notes with effects and trimming, photos, video messages, groups with admins and slow mode,
                channels, polls, split bills, a sticker maker, scheduled messages and a wallet.
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
