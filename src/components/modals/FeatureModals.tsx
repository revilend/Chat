import { useState, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { X, Bell, Star, Trophy, Calculator, UserPlus, Check, Image, Plus, Trash2, Zap, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Reminder, StickerPack, StickerItem } from '../../types';

// Feature 7: Reminder Modal
export function ReminderModal() {
  const { state, dispatch } = useApp();
  const [text, setText] = useState('');
  const [remindDate, setRemindDate] = useState('');
  const [remindTime, setRemindTime] = useState('');

  const create = () => {
    if (!text.trim() || !remindDate || !remindTime) return;
    const remindAt = new Date(`${remindDate}T${remindTime}`).getTime();
    const reminder: Reminder = { id: `rem_${Date.now()}`, chatId: state.reminderChatId || 'chat_saved', text: text.trim(), remindAt, triggered: false };
    dispatch({ type: 'ADD_REMINDER', reminder });
    setText(''); setRemindDate(''); setRemindTime('');
  };

  if (!state.showReminderModal) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => dispatch({ type: 'TOGGLE_REMINDER_MODAL' })}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()} className="bg-tg-sidebar rounded-2xl shadow-2xl p-4 w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-medium text-tg-text flex items-center gap-2"><Bell size={18} /> Set Reminder</h3>
          <button onClick={() => dispatch({ type: 'TOGGLE_REMINDER_MODAL' })}><X size={18} className="text-tg-text-secondary" /></button>
        </div>
        <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Reminder text..." className="w-full bg-tg-input rounded-lg px-3 py-2 text-sm text-tg-text outline-none mb-3" autoFocus />
        <div className="flex gap-2 mb-3">
          <input type="date" value={remindDate} onChange={e => setRemindDate(e.target.value)} className="flex-1 bg-tg-input rounded-lg px-3 py-2 text-sm text-tg-text outline-none" />
          <input type="time" value={remindTime} onChange={e => setRemindTime(e.target.value)} className="flex-1 bg-tg-input rounded-lg px-3 py-2 text-sm text-tg-text outline-none" />
        </div>
        <button onClick={create} disabled={!text.trim() || !remindDate || !remindTime} className="w-full py-2.5 rounded-lg bg-tg-accent text-white text-sm font-medium disabled:opacity-50">Set Reminder</button>
        {/* Active reminders */}
        {state.reminders.filter(r => !r.triggered).length > 0 && (
          <div className="mt-3 border-t border-black/20 pt-3">
            <div className="text-xs text-tg-text-secondary mb-2">Upcoming</div>
            {state.reminders.filter(r => !r.triggered).map(r => (
              <div key={r.id} className="flex items-center gap-2 py-1.5 text-sm text-tg-text">
                <Clock size={14} className="text-tg-accent" />
                <span className="flex-1 truncate">{r.text}</span>
                <span className="text-[10px] text-tg-text-secondary">{new Date(r.remindAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Feature 9: Join Requests Approval
export function JoinRequestModal() {
  const { state, dispatch, getUser } = useApp();
  if (!state.showJoinApproval) return null;

  const requests = state.chats.flatMap(c => (c.pendingJoinRequests || []).map(uid => ({ chatId: c.id, chatName: c.name, userId: uid })));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => dispatch({ type: 'TOGGLE_JOIN_APPROVAL' })}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()} className="bg-tg-sidebar rounded-2xl shadow-2xl p-4 w-full max-w-sm max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-medium text-tg-text flex items-center gap-2"><UserPlus size={18} /> Join Requests</h3>
          <button onClick={() => dispatch({ type: 'TOGGLE_JOIN_APPROVAL' })}><X size={18} className="text-tg-text-secondary" /></button>
        </div>
        {requests.length === 0 ? <p className="text-sm text-tg-text-secondary text-center py-4">No pending requests</p> : requests.map(({ chatId, chatName, userId }) => {
          const user = getUser(userId);
          return (
            <div key={`${chatId}-${userId}`} className="flex items-center gap-3 py-2 border-b border-black/10">
              <div className="w-10 h-10 rounded-full bg-tg-accent/30 flex items-center justify-center text-white text-sm font-semibold">{user?.name?.[0] || '?'}</div>
              <div className="flex-1">
                <div className="text-sm text-tg-text">{user?.name || userId}</div>
                <div className="text-[10px] text-tg-text-secondary">wants to join {chatName}</div>
              </div>
              <button onClick={() => dispatch({ type: 'APPROVE_JOIN', chatId, userId })} className="p-1.5 bg-tg-green/20 rounded-full"><Check size={14} className="text-tg-green" /></button>
              <button onClick={() => dispatch({ type: 'DENY_JOIN', chatId, userId })} className="p-1.5 bg-tg-red/20 rounded-full"><X size={14} className="text-tg-red" /></button>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

// Feature 10: Wallet Modal
export function WalletModal() {
  const { state, dispatch } = useApp();
  if (!state.showWalletModal) return null;
  const w = state.wallet;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => dispatch({ type: 'TOGGLE_WALLET' })}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()} className="bg-tg-sidebar rounded-2xl shadow-2xl p-4 w-full max-w-sm max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium text-tg-text flex items-center gap-2"><Star size={18} className="text-amber-400" /> Wallet</h3>
          <button onClick={() => dispatch({ type: 'TOGGLE_WALLET' })}><X size={18} className="text-tg-text-secondary" /></button>
        </div>
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl p-4 text-center mb-4 border border-amber-500/20">
          <div className="text-3xl font-bold text-amber-400">⭐ {w.stars}</div>
          <div className="text-xs text-tg-text-secondary mt-1">Teleflow Stars</div>
        </div>
        <div className="flex gap-2 mb-4">
          {[10, 50, 100, 500].map(amount => (
            <button key={amount} onClick={() => dispatch({ type: 'PURCHASE_STARS', amount })} className="flex-1 py-2 bg-tg-input rounded-lg text-xs text-tg-text hover:bg-tg-hover transition-colors">⭐ {amount}</button>
          ))}
        </div>
        {w.transactions.length > 0 && (
          <div>
            <div className="text-xs text-tg-text-secondary mb-2">History</div>
            {w.transactions.slice(0, 10).map(tx => (
              <div key={tx.id} className="flex items-center gap-2 py-1.5 text-xs border-b border-black/10">
                <span className={tx.type === 'purchase' ? 'text-tg-green' : 'text-tg-red'}>{tx.type === 'purchase' ? '+' : ''}{tx.amount} ⭐</span>
                <span className="flex-1 text-tg-text">{tx.description}</span>
                <span className="text-tg-text-secondary">{new Date(tx.timestamp).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Feature 12: Leaderboard Modal
export function LeaderboardModal() {
  const { state, dispatch, getUser } = useApp();
  if (!state.showLeaderboard) return null;
  const chat = state.chats.find(c => c.id === state.activeChatId);
  if (!chat) return null;

  const counts: Record<string, number> = {};
  state.messages.filter(m => m.chatId === chat.id).forEach(m => { counts[m.senderId] = (counts[m.senderId] || 0) + 1; });
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => dispatch({ type: 'TOGGLE_LEADERBOARD' })}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()} className="bg-tg-sidebar rounded-2xl shadow-2xl p-4 w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-medium text-tg-text flex items-center gap-2"><Trophy size={18} /> Top Members</h3>
          <button onClick={() => dispatch({ type: 'TOGGLE_LEADERBOARD' })}><X size={18} className="text-tg-text-secondary" /></button>
        </div>
        {sorted.map(([uid, count], i) => {
          const user = getUser(uid);
          return (
            <div key={uid} className={`flex items-center gap-3 py-2.5 px-2 rounded-lg ${i === 0 ? 'bg-amber-500/10' : ''} ${i < 3 ? '' : 'border-b border-black/10'}`}>
              <span className="text-lg w-8 text-center">{medals[i] || `${i + 1}.`}</span>
              <div className="w-8 h-8 rounded-full bg-tg-accent/30 flex items-center justify-center text-white text-xs font-semibold">{user?.name?.[0] || '?'}</div>
              <div className="flex-1 text-sm text-tg-text">{user?.name || uid}</div>
              <div className="text-xs text-tg-accent font-medium">{count} msgs</div>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

// Feature 13: Split Bill Modal
export function SplitBillModal() {
  const { state, dispatch } = useApp();
  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const chat = state.chats.find(c => c.id === state.activeChatId);

  if (!state.showSplitBill || !chat) return null;

  const create = () => {
    const amount = parseFloat(totalAmount);
    if (!title.trim() || isNaN(amount) || amount <= 0) return;
    const participants = chat.members.map(uid => ({ userId: uid, share: amount / chat.members.length, paid: uid === 'user_me' }));
    dispatch({ type: 'CREATE_SPLIT_BILL', chatId: chat.id, splitBill: { title: title.trim(), totalAmount: amount, participants, createdBy: 'user_me' } });
    setTitle(''); setTotalAmount('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => dispatch({ type: 'TOGGLE_SPLIT_BILL' })}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()} className="bg-tg-sidebar rounded-2xl shadow-2xl p-4 w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-medium text-tg-text flex items-center gap-2"><Calculator size={18} /> Split Bill</h3>
          <button onClick={() => dispatch({ type: 'TOGGLE_SPLIT_BILL' })}><X size={18} className="text-tg-text-secondary" /></button>
        </div>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="What's the bill for?" className="w-full bg-tg-input rounded-lg px-3 py-2 text-sm text-tg-text outline-none mb-3" autoFocus />
        <input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder="Total amount" className="w-full bg-tg-input rounded-lg px-3 py-2 text-sm text-tg-text outline-none mb-3" />
        <div className="text-xs text-tg-text-secondary mb-3">
          Split between {chat.members.length} members = {totalAmount && !isNaN(parseFloat(totalAmount)) ? (parseFloat(totalAmount) / chat.members.length).toFixed(2) : '—'} each
        </div>
        <button onClick={create} disabled={!title.trim() || !totalAmount} className="w-full py-2.5 rounded-lg bg-tg-accent text-white text-sm font-medium disabled:opacity-50">Create Split Bill</button>
      </motion.div>
    </div>
  );
}

// Feature 14: Channel Boost Modal
export function BoostModal({ chatId, onClose }: { chatId: string; onClose?: () => void }) {
  const { state, dispatch } = useApp();
  const chat = state.chats.find(c => c.id === chatId);
  if (!chat) return null;
  const level = chat.boostLevel || 0;
  const count = chat.boostCount || 0;
  const nextLevelAt = (level + 1) * 10;
  return (
    <div className="bg-tg-bg/50 rounded-lg p-3 border border-tg-accent/20 mt-2">
      <div className="flex items-center gap-2 mb-2">
        <Zap size={16} className="text-tg-accent" />
        <span className="text-sm font-medium text-tg-text">Channel Boost</span>
        <span className="text-xs px-2 py-0.5 bg-tg-accent/20 rounded-full text-tg-accent">Level {level}</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-2 bg-tg-input rounded-full overflow-hidden">
          <div className="h-full bg-tg-accent rounded-full transition-all" style={{ width: `${Math.min(100, (count / nextLevelAt) * 100)}%` }} />
        </div>
        <span className="text-[10px] text-tg-text-secondary">{count}/{nextLevelAt}</span>
      </div>
      <button onClick={() => dispatch({ type: 'BOOST_CHANNEL', chatId })} className="w-full py-1.5 bg-tg-accent/20 text-tg-accent text-xs rounded-lg hover:bg-tg-accent/30 transition-colors">Boost Channel ⚡</button>
      {onClose && <button onClick={onClose} className="w-full mt-1 py-1 text-[11px] text-tg-text-secondary hover:text-tg-text">Close</button>}
    </div>
  );
}

// Feature 15: Sticker Pack Creator
export function StickerCreatorModal() {
  const { state, dispatch } = useApp();
  const [packName, setPackName] = useState('');
  const [stickerItems, setStickerItems] = useState<StickerItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!state.showStickerCreator) return null;

  const addSticker = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setStickerItems(prev => [...prev, { id: `stk_${Date.now()}`, dataUrl }]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const save = () => {
    if (!packName.trim() || stickerItems.length === 0) return;
    const pack: StickerPack = { id: `pack_${Date.now()}`, name: packName.trim(), stickers: stickerItems, createdBy: 'user_me', createdAt: Date.now() };
    dispatch({ type: 'ADD_STICKER_PACK', pack });
    setPackName(''); setStickerItems([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => dispatch({ type: 'TOGGLE_STICKER_CREATOR' })}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()} className="bg-tg-sidebar rounded-2xl shadow-2xl p-4 w-full max-w-sm max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-medium text-tg-text flex items-center gap-2"><Image size={18} /> Sticker Pack Creator</h3>
          <button onClick={() => dispatch({ type: 'TOGGLE_STICKER_CREATOR' })}><X size={18} className="text-tg-text-secondary" /></button>
        </div>
        <input type="text" value={packName} onChange={e => setPackName(e.target.value)} placeholder="Pack name..." className="w-full bg-tg-input rounded-lg px-3 py-2 text-sm text-tg-text outline-none mb-3" autoFocus />
        <div className="grid grid-cols-4 gap-2 mb-3">
          {stickerItems.map((s, i) => (
            <div key={s.id} className="relative group">
              <img src={s.dataUrl} className="w-full aspect-square object-cover rounded-lg bg-tg-input" alt="" />
              <button onClick={() => setStickerItems(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0.5 right-0.5 w-5 h-5 bg-tg-red rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} className="text-white" /></button>
            </div>
          ))}
          <button onClick={() => fileInputRef.current?.click()} className="w-full aspect-square bg-tg-input rounded-lg flex items-center justify-center hover:bg-tg-hover transition-colors border-2 border-dashed border-tg-text-secondary/30">
            <Plus size={20} className="text-tg-text-secondary" />
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={addSticker} className="hidden" />
        <button onClick={save} disabled={!packName.trim() || stickerItems.length === 0} className="w-full py-2.5 rounded-lg bg-tg-accent text-white text-sm font-medium disabled:opacity-50">Save Pack</button>
        {/* Existing packs */}
        {state.stickerPacks.length > 0 && (
          <div className="mt-3 border-t border-black/20 pt-3">
            <div className="text-xs text-tg-text-secondary mb-2">My Packs</div>
            {state.stickerPacks.map(pack => (
              <div key={pack.id} className="flex items-center gap-2 py-2 border-b border-black/10">
                <div className="flex gap-1">{pack.stickers.slice(0, 4).map(s => <img key={s.id} src={s.dataUrl} className="w-8 h-8 rounded bg-tg-input" alt="" />)}</div>
                <span className="flex-1 text-sm text-tg-text">{pack.name}</span>
                <button onClick={() => dispatch({ type: 'DELETE_STICKER_PACK', packId: pack.id })}><Trash2 size={14} className="text-tg-red" /></button>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Feature 7b: Reminder alert — really fires at the designated time
export function ReminderAlert() {
  const { state, dispatch } = useApp();
  const due = state.reminders.find(r => r.triggered);
  if (!due) return null;
  const chat = state.chats.find(c => c.id === due.chatId);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={() => dispatch({ type: 'DISMISS_REMINDER', reminderId: due.id })}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-tg-sidebar rounded-2xl shadow-2xl p-5 w-full max-w-sm text-center"
      >
        <motion.div animate={{ rotate: [0, -12, 12, 0] }} transition={{ repeat: Infinity, duration: 1.4 }} className="text-5xl mb-2">⏰</motion.div>
        <h3 className="text-base font-medium text-tg-text mb-1">Reminder</h3>
        <p className="text-sm text-tg-text mb-1">{due.text}</p>
        <p className="text-[11px] text-tg-text-secondary mb-4">{new Date(due.remindAt).toLocaleString()}{chat ? ` • ${chat.name}` : ''}</p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              dispatch({ type: 'DISMISS_REMINDER', reminderId: due.id });
              dispatch({ type: 'ADD_REMINDER', reminder: { ...due, id: `rem_${Date.now()}`, remindAt: Date.now() + 5 * 60 * 1000, triggered: false } });
            }}
            className="flex-1 py-2 rounded-lg bg-tg-input text-tg-text text-sm"
          >
            Snooze 5 min
          </button>
          <button onClick={() => dispatch({ type: 'DISMISS_REMINDER', reminderId: due.id })} className="flex-1 py-2 rounded-lg bg-tg-accent text-white text-sm">Dismiss</button>
        </div>
      </motion.div>
    </div>
  );
}

// Feature 18: Admin Title Setter (inline in Settings)
export function AdminTitleSetter({ chatId }: { chatId: string }) {
  const { state, dispatch, getUser } = useApp();
  const chat = state.chats.find(c => c.id === chatId);
  if (!chat) return null;
  return (
    <div className="py-2">
      <div className="text-xs text-tg-text-secondary mb-2 px-4">Admin Titles</div>
      {chat.admins.map(uid => {
        const user = getUser(uid);
        return (
          <div key={uid} className="flex items-center gap-2 px-4 py-2">
            <span className="text-sm text-tg-text flex-1">{user?.name || uid}</span>
            <input type="text" value={chat.adminTitles?.[uid] || ''} onChange={e => dispatch({ type: 'SET_ADMIN_TITLE', chatId, userId: uid, title: e.target.value })}
              placeholder="Title..." className="w-28 bg-tg-input rounded px-2 py-1 text-xs text-tg-text outline-none" />
          </div>
        );
      })}
    </div>
  );
}
