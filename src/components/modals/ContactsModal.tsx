import { useState, useMemo } from 'react';
import { useApp } from '../../store/AppContext';
import { useAccount } from '../../auth/AccountContext';
import { X, Search, UserPlus, MessageSquare, Copy, Check, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getInitials, getAvatarColor } from '../layout/ChatListItem';
import { ContactNoteEditor } from '../features/AdvancedFeatures';
import { formatUserId, isValidUserId, normalizeUserId } from '../../utils/identity';

export function ContactsModal() {
  const { state, dispatch, getUser, t } = useApp();
  const { addPeer, isPeerOnline } = useAccount();
  const [search, setSearch] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'warn' | 'error'; text: string }>({ kind: 'idle', text: '' });
  const [copied, setCopied] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const myAddress = state.session?.userId ?? '';

  const contacts = useMemo(() => {
    const list = state.contacts
      .filter(c => c.isContact)
      .map(c => ({ ...c, user: getUser(c.userId) }))
      .filter(c => c.user);

    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(c =>
      c.user!.name.toLowerCase().includes(q) ||
      c.user!.username.toLowerCase().includes(q) ||
      c.userId.toLowerCase().includes(q)
    );
  }, [state.contacts, state.users, search]);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(myAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatus({ kind: 'warn', text: 'Copy the address above manually.' });
    }
  };

  const connect = async () => {
    const value = normalizeUserId(address);
    if (!isValidUserId(value)) {
      setStatus({ kind: 'error', text: 'That is not a valid ID. Ask your friend for their 6-digit Teleflow ID.' });
      return;
    }
    setStatus({ kind: 'busy', text: 'Connecting to that ID…' });
    try {
      const online = await addPeer(value);
      setAddress('');
      setStatus(online
        ? { kind: 'ok', text: 'Connected — you can write now.' }
        : { kind: 'warn', text: 'Added. That person is offline right now, so the chat will connect as soon as they open the app.' });
    } catch (err) {
      setStatus({ kind: 'error', text: (err as Error).message });
    }
  };

  const startChat = (userId: string) => {
    const existingChat = state.chats.find(c =>
      c.type === 'private' && c.members.includes(userId) && c.members.includes('user_me')
    );
    const chatId = existingChat?.id ?? `chat_peer_${userId}`;
    if (!existingChat) {
      dispatch({
        type: 'ADD_CHAT',
        chat: {
          id: chatId, type: 'private', name: getUser(userId)?.name || userId, avatar: '',
          members: ['user_me', userId], admins: [], unreadCount: 0, isPinned: false, isArchived: false, isMuted: false,
        },
      });
    }
    dispatch({ type: 'SET_ACTIVE_CHAT', chatId });
    dispatch({ type: 'TOGGLE_CONTACTS' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md h-full md:h-[90vh] md:max-h-[640px] card rounded-none md:rounded-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center gap-3 px-4 h-[56px] border-b border-black/20 flex-shrink-0">
          <button onClick={() => dispatch({ type: 'TOGGLE_CONTACTS' })} className="p-1">
            <X size={20} className="text-tg-text-secondary" />
          </button>
          <h2 className="text-base font-medium text-tg-text">{t('contacts')}</h2>
        </div>

        {/* Your own ID — six digits, meant to be read out loud */}
        <div className="px-4 py-3 border-b border-black/20 bg-tg-input/30">
          <div className="text-[11px] uppercase tracking-wide text-tg-text-secondary">My ID</div>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 font-mono text-[26px] leading-none tracking-[0.16em] text-tg-text">
              {formatUserId(myAddress)}
            </div>
            <button onClick={copyAddress} className="p-2 rounded-lg hover:bg-tg-hover" title="Copy my ID">
              {copied ? <Check size={16} className="text-tg-green" /> : <Copy size={16} className="text-tg-text-secondary" />}
            </button>
          </div>
        </div>

        <div className="px-3 py-2">
          <div className="flex items-center bg-tg-input rounded-full px-3 h-9">
            <Search size={14} className="text-tg-text-secondary mr-2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search')}
              className="bg-transparent outline-none text-tg-text text-sm w-full placeholder:text-tg-text-secondary"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {contacts.map(({ user, userId }) => {
            const online = isPeerOnline(userId) || user!.isOnline;
            return (
              <div key={userId} className="flex items-center gap-3 px-3 py-2 hover:bg-tg-hover transition-colors">
                <div className="relative">
                  <div style={{ background: getAvatarColor(user!.name || userId) }} className="avatar-sheen w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {getInitials(user!.name)}
                  </div>
                  {online && <span className="online-dot absolute bottom-0 right-0 w-3 h-3 rounded-full" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-tg-text flex items-center gap-1">
                    {user!.name}
                    {user!.emojiStatus && <span>{user!.emojiStatus}</span>}
                  </div>
                  <div className="text-[13px] text-tg-text-secondary">
                    {online
                      ? <span className="text-tg-online">{t('online')}</span>
                      : user!.username ? `@${user!.username}` : 'offline'}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setSelectedUserId(selectedUserId === userId ? null : userId)} className="p-2 rounded-full hover:bg-tg-hover" title="Private note">
                    <span className="text-xs">📝</span>
                  </button>
                  <button onClick={() => startChat(userId)} className="p-2 rounded-full hover:bg-tg-hover">
                    <MessageSquare size={16} className="text-tg-text-secondary" />
                  </button>
                </div>
                {selectedUserId === userId && <div className="w-full"><ContactNoteEditor userId={userId} /></div>}
              </div>
            );
          })}

          {contacts.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-tg-text-secondary">
              No contacts yet. Share your 6-digit ID, or add a friend's ID below.
            </div>
          )}

          {/* Connect to a real person by their six-digit ID */}
          <div className="border-t border-black/20 mt-2 pt-3 px-3 pb-4">
            <div className="text-xs text-tg-text-secondary mb-2 px-1">Add by ID</div>
            <div className="flex items-center gap-2">
              <input
                value={address}
                inputMode="numeric"
                maxLength={12}
                onChange={e => { setAddress(e.target.value); setStatus({ kind: 'idle', text: '' }); }}
                onKeyDown={e => { if (e.key === 'Enter') void connect(); }}
                placeholder="Your friend's 6-digit ID"
                className="flex-1 bg-tg-input rounded-lg px-3 py-2 text-sm font-mono tracking-widest text-tg-text outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-tg-text-secondary"
              />
              <button
                onClick={() => void connect()}
                disabled={status.kind === 'busy'}
                className="px-3 py-2 bg-tg-accent text-white text-sm rounded-lg hover:bg-tg-accent-hover transition-colors disabled:opacity-60 flex items-center gap-1.5"
              >
                {status.kind === 'busy' ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                Add
              </button>
            </div>
            {status.text && (
              <div className={`mt-2 px-1 text-xs ${status.kind === 'ok' ? 'text-tg-green' : status.kind === 'error' ? 'text-tg-red' : status.kind === 'warn' ? 'text-amber-400' : 'text-tg-text-secondary'}`}>
                {status.text}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
