import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { useAccount } from '../../auth/AccountContext';
import { Settings, Moon, Sun, Users, Volume2, Phone, Bookmark, Archive, UserPlus, LogOut, IdCard, Check, Copy } from 'lucide-react';
import { getAvatarColor, getInitials } from './ChatListItem';
import { motion, AnimatePresence } from 'framer-motion';
import { InstallAppButton } from '../shared/InstallButton';

interface Props {
  onClose: () => void;
}

export function HamburgerMenu({ onClose }: Props) {
  const { state, dispatch, t } = useApp();
  const { signOut } = useAccount();
  const [copied, setCopied] = useState(false);

  const menuItems = [
    { icon: <Users size={20} />, label: t('newGroup'), action: () => { dispatch({ type: 'TOGGLE_CREATE_GROUP' }); onClose(); } },
    { icon: <Volume2 size={20} />, label: t('newChannel'), action: () => { dispatch({ type: 'TOGGLE_CREATE_CHANNEL' }); onClose(); } },
    { icon: <UserPlus size={20} />, label: t('contacts'), action: () => { dispatch({ type: 'TOGGLE_CONTACTS' }); onClose(); } },
    { icon: <Phone size={20} />, label: t('calls'), action: () => onClose() },
    { icon: <Bookmark size={20} />, label: t('savedMessages'), action: () => { dispatch({ type: 'SET_ACTIVE_CHAT', chatId: 'chat_saved' }); onClose(); } },
    { icon: <Archive size={20} />, label: t('archivedChats'), action: () => { dispatch({ type: 'TOGGLE_ARCHIVED_FOLDER' }); onClose(); } },
    { type: 'divider' as const },
    { icon: state.theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />, label: state.theme === 'dark' ? t('darkMode') : t('nightMode'), action: () => { dispatch({ type: 'SET_THEME', theme: state.theme === 'dark' ? 'night' : 'dark' }); } },
    { icon: <Settings size={20} />, label: t('settings'), action: () => { dispatch({ type: 'TOGGLE_SETTINGS' }); onClose(); } },
  ];

  const address = state.session?.userId ?? '';

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: -300 }}
          animate={{ x: 0 }}
          exit={{ x: -300 }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className="w-[280px] h-full bg-tg-sidebar shadow-2xl overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Signed-in account */}
          <div className="p-4 pb-3 border-b border-black/20">
            <button
              onClick={() => { dispatch({ type: 'TOGGLE_PROFILE' }); onClose(); }}
              className="flex items-center gap-3 w-full hover:bg-tg-hover rounded-lg p-2 transition-colors"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${getAvatarColor(state.currentUser.id || 'me')}`}>
                {getInitials(state.currentUser.name || '?')}
              </div>
              <div className="text-left min-w-0">
                <div className="text-sm font-medium text-tg-text truncate">{state.currentUser.name}</div>
                <div className="text-xs text-tg-text-secondary truncate">@{state.currentUser.username}</div>
              </div>
            </button>
          </div>

          {/* Your address — this is what other people add to reach you */}
          <div className="px-4 py-3 border-b border-black/20">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-tg-text-secondary">
              <IdCard size={13} /> My address
            </div>
            <div className="mt-2 rounded-lg bg-tg-input p-2 font-mono text-[11px] text-tg-text break-all leading-relaxed">{address}</div>
            <button
              onClick={copyAddress}
              className="mt-2 w-full h-9 rounded-lg bg-tg-accent text-white text-xs font-medium hover:bg-tg-accent-hover transition-colors flex items-center justify-center gap-2"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy address'}
            </button>
            <p className="mt-2 text-[10px] text-tg-text-secondary leading-relaxed">
              Share this with a friend. They add it under Contacts → Add by address, and you can write to each other.
            </p>
          </div>

          <div className="pt-2"><InstallAppButton /></div>

          <div className="py-2">
            {menuItems.map((item, i) => {
              if (item.type === 'divider') {
                return <div key={i} className="my-1 border-b border-black/20" />;
              }
              return (
                <button
                  key={i}
                  onClick={item.action}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-tg-hover transition-colors text-left"
                >
                  <span className="text-tg-text-secondary">{item.icon}</span>
                  <span className="text-sm text-tg-text">{item.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => { signOut(); onClose(); }}
              className="w-full flex items-center gap-4 px-4 py-3 hover:bg-tg-hover transition-colors text-left"
            >
              <span className="text-tg-red"><LogOut size={20} /></span>
              <span className="text-sm text-tg-red">Sign out</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
