import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import type { Message } from '../../types';
import { Check, CheckCheck, Reply, Forward, Copy, Pin, Trash2, Edit3, Eye, EyeOff, Lock, Bookmark, Printer, Type, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CodeBlock, ParticleExplosion, TagInput, UnitConverterCard, CaseConverterPopup } from '../features/AdvancedFeatures';
import { PhotoView, VideoView, VideoNoteView, FileView, VoiceView, MusicView, LinkPreviewCard } from './MediaViews';

interface Props {
  message: Message;
  /** Same sender as the message above, within a minute. */
  isGrouped: boolean;
  /** Last message of that run — this one carries the bubble's "tail" corner. */
  isLast?: boolean;
  isSelected: boolean;
}

const quickReactions = ['👍', '❤️', '🔥', '😂', '👏', '⚡'];

export function MessageBubble({ message, isGrouped, isLast, isSelected }: Props) {
  const { state, dispatch, getUser, t, deliverDelete } = useApp();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [viewOnceBurnt, setViewOnceBurnt] = useState(false);
  const [particles, setParticles] = useState<{ id: number; emoji: string; x: number; y: number } | null>(null);
  const [showCase, setShowCase] = useState(false);
  const [editedText, setEditedText] = useState(message.text);
  const contextRef = useRef<HTMLDivElement>(null);
  const isMe = message.senderId === 'user_me';
  const user = getUser(message.senderId);
  const senderName = user?.name?.split(' ')[0] || 'Unknown';

  useEffect(() => { const h = (e: MouseEvent) => { if (contextRef.current && !contextRef.current.contains(e.target as Node)) { setShowContextMenu(false); setShowCase(false); } }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);

  // Scroll to search hit
  useEffect(() => {
    if (state.searchHits.length > 0 && state.searchHits[state.currentSearchHitIndex] === message.id) {
      contextRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      contextRef.current?.classList.add('ring-2', 'ring-tg-accent');
      const t = setTimeout(() => contextRef.current?.classList.remove('ring-2', 'ring-tg-accent'), 1500);
      return () => clearTimeout(t);
    }
  }, [state.currentSearchHitIndex, state.searchHits, message.id]);

  if (message.deletedForEveryone) return <div className="flex justify-center my-1"><div className="bg-tg-sidebar/50 rounded-lg px-4 py-2 text-xs text-tg-text-secondary italic">This message was deleted</div></div>;
  if (message.selfDestruct) { const elapsed = Date.now() - message.timestamp; if (elapsed > message.selfDestruct * 1000) return null; }

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = message.text.match(urlRegex);
  const hasCodeBlock = /```/.test(message.text);
  const textWithoutCode = message.text.replace(/```[\s\S]*?```/g, '').trim();

  // Media messages sit flush in the bubble; captions keep the normal padding.
  const hasOwnText = Boolean(message.text?.trim()) || !['photo', 'video', 'music', 'file', 'location'].includes(message.type);

  // Feature 4: Trigger particles
  const triggerParticles = (emoji: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setParticles({ id: Date.now(), emoji, x: rect.left + rect.width / 2, y: rect.top });
  };

  const renderText = (text: string) => {
    const spoilerRegex = /\|\|(.+?)\|\|/g;
    const parts = text.split(spoilerRegex);
    return parts.map((part, i) => {
      if (i % 2 === 1) return <span key={i} className={`cursor-pointer select-none ${spoilerRevealed ? 'spoiler-revealed' : 'spoiler-hidden'}`} onClick={() => setSpoilerRevealed(!spoilerRevealed)}>{part}</span>;
      let processed = part.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code class="bg-black/20 px-1 rounded text-tg-accent text-[13px]">$1</code>');
      return <span key={i} dangerouslySetInnerHTML={{ __html: processed.replace(/\n/g, '<br/>') }} />;
    });
  };

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isGrouped ? 'bubble-run' : 'mt-3'} group`} ref={contextRef}>
      <div className={`relative max-w-[85%] sm:max-w-[420px] ${isMe ? 'ml-auto' : 'mr-auto'}`}>
        {/* Floating quick actions, only where there is room beside the bubble */}
        <div className={`hidden md:flex absolute top-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-20 ${isMe ? 'right-full mr-2' : 'left-full ml-2'}`}>
          <button
            onClick={(e) => { dispatch({ type: 'TOGGLE_REACTION', messageId: message.id, emoji: '❤️' }); triggerParticles('❤️', e); }}
            className="w-8 h-8 rounded-full bg-tg-elevated/90 backdrop-blur shadow-md hover:bg-tg-hover text-sm"
            title="React with ❤️"
          >❤️</button>
          <button
            onClick={() => dispatch({ type: 'SET_REPLY_TO', messageId: message.id })}
            className="w-8 h-8 rounded-full bg-tg-elevated/90 backdrop-blur shadow-md hover:bg-tg-hover flex items-center justify-center"
            title={t('reply')}
          ><Reply size={15} className="text-tg-text-secondary" /></button>
          <button
            onClick={() => setShowContextMenu(true)}
            className="w-8 h-8 rounded-full bg-tg-elevated/90 backdrop-blur shadow-md hover:bg-tg-hover flex items-center justify-center"
            title="More"
          ><MoreHorizontal size={15} className="text-tg-text-secondary" /></button>
        </div>
        {isSelected && <div className="absolute inset-0 bg-tg-accent/20 rounded-[18px] z-10 border-2 border-tg-accent" />}

        <div className={`relative bubble ${hasOwnText ? 'px-3 py-[7px]' : 'p-1'} ${isMe ? 'bubble-out' : 'bubble-in'} ${isLast ? (isMe ? 'bubble-tail-out' : 'bubble-tail-in') : ''} ${message.isPinned ? 'ring-1 ring-tg-accent/60' : ''}`}
          onClick={() => { if (state.selectedMessages.length > 0) dispatch({ type: 'SELECT_MESSAGE', messageId: message.id }); }}
          onContextMenu={(e) => { e.preventDefault(); setShowContextMenu(true); }}>

          {message.postedAsGroup && !isMe && <div className="flex items-center gap-1 text-[11px] text-tg-accent mb-0.5">📢 {state.chats.find(c => c.id === message.chatId)?.name}</div>}
          {!isGrouped && !isMe && !message.postedAsGroup && <div className="text-[13.5px] font-semibold mb-0.5" style={{ color: 'var(--color-tg-accent)' }}>{senderName}{user?.emojiStatus && ` ${user.emojiStatus}`}</div>}

          {!isMe && !message.postedAsGroup && (() => { const chat = state.chats.find(c => c.id === message.chatId); const title = chat?.adminTitles?.[message.senderId]; if (!title) return null; return <div className="text-[10px] text-tg-accent/70 mb-0.5">{title}</div>; })()}

          {message.replyTo && (() => { const rm = state.messages.find(m => m.id === message.replyTo); if (!rm) return null; return <div className="bg-black/20 rounded-lg px-2 py-1 mb-1.5 border-l-2 border-tg-accent"><div className="text-[11px] font-medium text-tg-accent">{getUser(rm.senderId)?.name || 'Unknown'}</div><div className="text-[11px] text-tg-text-secondary truncate">{rm.text}</div></div>; })()}
          {message.forwardedFrom && <div className="flex items-center gap-1 text-[11px] text-tg-accent mb-1"><Forward size={12} /> Forwarded</div>}

          {message.viewOnce && !message.viewOnceOpened && !viewOnceBurnt ? (
            <ViewOnceMedia message={message} onOpen={() => dispatch({ type: 'EDIT_MESSAGE', messageId: message.id, newText: message.text })} onBurn={() => setViewOnceBurnt(true)} />
          ) : message.viewOnce && viewOnceBurnt ? (
            <div className="flex items-center gap-2 py-3 px-2 text-sm text-tg-text-secondary italic"><EyeOff size={16} /> This message has been opened and expired</div>
          ) : message.type === 'text' ? (
            <div className="text-[14.5px] leading-[21px] whitespace-pre-wrap break-words">
              {hasCodeBlock ? message.text.split(/(```[\s\S]*?```)/g).map((part, i) => part.startsWith('```') ? <CodeBlock key={i} text={part} /> : <span key={i}>{textWithoutCode ? renderText(part) : renderText(part)}</span>) : renderText(message.text)}
            </div>
          ) : null}

          {/* Feature 9: Unit converter */}
          {message.type === 'text' && <UnitConverterCard text={message.text} />}

          {/* Real voice message: playable audio, seekable waveform, speed switching */}
          {message.type === 'voice' && <VoiceView messageId={message.id} />}

          {/* Real media */}
          {message.type === 'photo' && message.photoUrl && <PhotoView url={message.photoUrl} isMe={isMe} />}
          {message.type === 'video' && message.videoUrl && (message.videoNote ? <VideoNoteView url={message.videoUrl} /> : <VideoView url={message.videoUrl} />)}
          {message.type === 'music' && <MusicView messageId={message.id} />}
          {message.type === 'file' && (message.fileUrl || message.fileName) && (
            <FileView url={message.fileUrl} name={message.fileName || message.text || 'file'} size={message.fileSize} isMe={isMe} />
          )}

          {message.type === 'poll' && message.poll && <PollDisplay poll={message.poll} messageId={message.id} isMe={isMe} />}
          {message.type === 'gift' && message.gift && <div className="text-center py-2"><div className="text-4xl animate-bounce">{message.gift.emoji}</div><div className={`text-xs mt-1 ${isMe ? 'text-white/60' : 'text-tg-text-secondary'}`}>{message.gift.name}</div></div>}
          {message.type === 'location' && message.location && (
            <div className="rounded-lg overflow-hidden bg-tg-sidebar w-[min(280px,70vw)] mb-1">
              {/* Real OpenStreetMap snapshot of the shared coordinates */}
              <iframe
                title={`Map ${message.location.lat.toFixed(4)}, ${message.location.lng.toFixed(4)}`}
                className="w-full h-40 border-0 bg-tg-bg"
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${(message.location.lng - 0.008).toFixed(4)}%2C${(message.location.lat - 0.006).toFixed(4)}%2C${(message.location.lng + 0.008).toFixed(4)}%2C${(message.location.lat + 0.006).toFixed(4)}&layer=mapnik&marker=${message.location.lat}%2C${message.location.lng}`}
              />
              <a
                href={`https://www.openstreetmap.org/?mlat=${message.location.lat}&mlon=${message.location.lng}#map=16/${message.location.lat}/${message.location.lng}`}
                target="_blank" rel="noreferrer noopener" onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 p-2 text-xs text-tg-accent hover:underline"
              >
                📍 {message.location.lat.toFixed(4)}, {message.location.lng.toFixed(4)} — open in maps
              </a>
            </div>
          )}
          {message.type === 'sticker' && <div className="text-6xl py-2">{message.text}</div>}
          {urls && urls.length > 0 && message.type === 'text' && <LinkPreviewCard url={urls[0]} />}
          {message.priceStars && !(message.paidBy || []).includes('user_me') && (
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg p-3 mt-1 border border-amber-500/30">
              <div className="flex items-center gap-2 text-sm"><Lock size={16} className="text-amber-400" /><span className="text-amber-300 font-medium">⭐ {message.priceStars} Stars to unlock</span></div>
              <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UNLOCK_PAID_POST', messageId: message.id }); }} className="mt-2 px-3 py-1 bg-amber-500 text-white text-xs rounded-full">Unlock for ⭐ {message.priceStars}</button>
            </div>
          )}
          {message.splitBill && <SplitBillCard splitBill={message.splitBill} messageId={message.id} isMe={isMe} />}

          {/* Tags & bookmark indicator */}
          {(message.tags && message.tags.length > 0) || message.isBookmarked ? (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {message.isBookmarked && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">⭐</span>}
              {(message.tags || []).map(tag => <span key={tag} className="text-[10px] bg-tg-accent/20 text-tg-accent px-1.5 py-0.5 rounded-full">#{tag}</span>)}
            </div>
          ) : null}

          <div className={`flex items-center justify-end gap-1 ${hasOwnText ? 'mt-[3px] -mb-px' : 'mt-1 px-1'} select-none`}>
            {message.editedAt && <span className={`text-[10px] ${isMe ? 'text-white/50' : 'text-tg-text-secondary'}`}>edited</span>}
            {message.scheduledAt && <span className="text-[10px] text-amber-400" title="Scheduled message">🕐 {formatTime(message.scheduledAt)}</span>}
            {message.sendWhenOnline && <span className="text-[10px]" title="Queued until the recipient is online">⏳</span>}
            {isMe && message.deliveryPending && !message.sendWhenOnline && (
              <span className="text-[10px] opacity-80 flex items-center gap-0.5" title="Waiting in the outbox — it goes out as soon as they are reachable">
                🕓 pending
              </span>
            )}
            {message.sentWithoutSound && <span className="text-[10px]" title="Sent without sound">🔇</span>}
            <span className={`text-[11px] tabular-nums ${isMe ? 'text-tg-text-time-out' : 'text-tg-text-time-in'}`}>{formatTime(message.timestamp)}</span>
            {/* Telegram's read ticks: bright on an outgoing bubble, muted otherwise */}
            {isMe && (message.readBy.length > 1
              ? <CheckCheck size={15} strokeWidth={2.4} className="text-[#bfe3ff]" />
              : <Check size={15} strokeWidth={2.4} className="text-white/55" />)}
          </div>

          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(message.reactions).map(([emoji, users]) => (
                <button key={emoji} onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_REACTION', messageId: message.id, emoji }); triggerParticles(emoji, e); }} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors hover:scale-105 ${users.includes('user_me') ? 'bg-tg-accent/35 ring-1 ring-tg-accent/50' : 'bg-black/20'}`}>
                  <span>{emoji}</span><span className={isMe ? 'text-white/70' : 'text-tg-text-secondary'}>{users.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Context menu */}
        <AnimatePresence>
          {showContextMenu && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className={`absolute z-50 ${isMe ? 'right-0' : 'left-0'} bottom-full mb-1`}>
              <div className="card w-52 overflow-hidden py-1">
                <div className="flex items-center justify-center gap-1 px-2 py-2 border-b border-black/20">
                  {quickReactions.map(emoji => <button key={emoji} onClick={(e) => { dispatch({ type: 'TOGGLE_REACTION', messageId: message.id, emoji }); triggerParticles(emoji, e); setShowContextMenu(false); }} className="text-lg hover:scale-125 transition-transform p-0.5">{emoji}</button>)}
                </div>
                <CtxItem icon={<Reply size={16} />} label={t('reply')} onClick={() => { dispatch({ type: 'SET_REPLY_TO', messageId: message.id }); setShowContextMenu(false); }} />
                <CtxItem icon={<Copy size={16} />} label={t('copy')} onClick={() => { navigator.clipboard.writeText(message.text); setShowContextMenu(false); }} />
                {isMe && <CtxItem icon={<Edit3 size={16} />} label={t('edit')} onClick={() => { dispatch({ type: 'SET_EDITING', messageId: message.id }); setShowContextMenu(false); }} />}
                <CtxItem icon={<Forward size={16} />} label={t('forward')} onClick={() => { dispatch({ type: 'SET_FORWARDING', messageId: message.id }); setShowContextMenu(false); }} />
                <CtxItem icon={<Pin size={16} />} label={message.isPinned ? 'Unpin' : 'Pin'} onClick={() => { dispatch({ type: 'PIN_MESSAGE', messageId: message.id }); setShowContextMenu(false); }} />
                {/* Feature 8: Tag & Bookmark */}
                <CtxItem icon={<Bookmark size={16} />} label={message.isBookmarked ? 'Remove Bookmark' : 'Bookmark'} onClick={() => { dispatch({ type: 'TOGGLE_BOOKMARK', messageId: message.id }); setShowContextMenu(false); }} />
                <div className="px-3 py-1"><TagInput messageId={message.id} /></div>
                {/* Feature 16: Case converter */}
                {message.type === 'text' && message.text && <CtxItem icon={<Type size={16} />} label="Convert Case" onClick={() => { setEditedText(message.text); setShowCase(!showCase); }} />}
                {/* Feature 18: Print */}
                <CtxItem icon={<Printer size={16} />} label="Print Chat" onClick={() => { window.print(); setShowContextMenu(false); }} />
                <div className="my-1 border-b border-black/20" />
                {isMe && <CtxItem icon={<Trash2 size={16} className="text-tg-red" />} label={t('delete')} onClick={() => { dispatch({ type: 'DELETE_MESSAGE', messageId: message.id }); deliverDelete(message.id); setShowContextMenu(false); }} danger />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {showCase && <CaseConverterPopup text={editedText} onApply={(t) => { dispatch({ type: 'EDIT_MESSAGE', messageId: message.id, newText: t }); setShowCase(false); }} onClose={() => setShowCase(false)} />}
      </div>

      {/* Particles overlay */}
      {particles && <ParticleExplosion emoji={particles.emoji} x={particles.x} y={particles.y} onDone={() => setParticles(null)} />}
    </div>
  );
}

function CtxItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-tg-hover transition-colors ${danger ? 'text-tg-red' : 'text-tg-text'}`}><span className={danger ? 'text-tg-red' : 'text-tg-text-secondary'}>{icon}</span>{label}</button>;
}

function ViewOnceMedia({ message, onOpen, onBurn }: { message: Message; onOpen: () => void; onBurn: () => void }) {
  const [viewing, setViewing] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const handleOpen = () => { setViewing(true); onOpen(); let c = 5; const timer = setInterval(() => { c--; setCountdown(c); if (c <= 0) { clearInterval(timer); setViewing(false); onBurn(); } }, 1000); };
  if (viewing) return (
    <div className="rounded-lg bg-tg-bg/50 p-2 text-center min-w-[200px] relative">
      {message.photoUrl ? (
        <div className="relative rounded-lg overflow-hidden">
          <img src={message.photoUrl} alt="" className="max-h-[260px] w-full object-cover select-none" draggable={false} />
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-[10px] text-white">🔥 {countdown}s</span>
        </div>
      ) : (
        <>
          <div className="text-4xl mb-2">🔥</div>
          <div className="text-sm text-tg-text">{message.text || 'View-once media'}</div>
        </>
      )}
      <div className="text-xs text-tg-accent mt-1">Closes in {countdown}s — cannot be reopened</div>
    </div>
  );
  return <button onClick={handleOpen} className="flex items-center gap-2 py-3 px-3 rounded-lg bg-tg-accent/10 border border-tg-accent/20 hover:bg-tg-accent/20 transition-colors w-full"><Eye size={18} className="text-tg-accent" /><span className="text-sm text-tg-accent">Tap to view once</span><span className="text-lg">🔥</span></button>;
}

function SplitBillCard({ splitBill, messageId }: { splitBill: NonNullable<Message['splitBill']>; messageId: string; isMe: boolean }) {
  const { dispatch, getUser } = useApp();
  const pp = splitBill.totalAmount / splitBill.participants.length;
  const allPaid = splitBill.participants.every(p => p.paid);
  return (
    <div className="bg-tg-bg/50 rounded-lg p-3 mt-1 border border-tg-accent/20 w-[min(260px,68vw)]">
      <div className="text-sm font-medium text-tg-accent mb-1">💰 {splitBill.title}</div>
      <div className="text-xs text-tg-text-secondary mb-2">Total: {splitBill.totalAmount} • {splitBill.participants.length} people • {pp.toFixed(2)} each</div>
      {splitBill.participants.map(p => <div key={p.userId} className="flex items-center justify-between py-1 text-xs"><span className="text-tg-text">{getUser(p.userId)?.name || p.userId}</span>{p.paid ? <span className="text-tg-green">✓ Paid</span> : <button onClick={() => dispatch({ type: 'MARK_SPLIT_PAID', messageId, userId: p.userId })} className="text-tg-accent hover:underline">Mark paid</button>}</div>)}
      {allPaid && <div className="text-xs text-tg-green mt-2 font-medium">✅ All settled!</div>}
    </div>
  );
}

function PollDisplay({ poll, messageId, isMe }: { poll: NonNullable<Message['poll']>; messageId: string; isMe: boolean }) {
  const { dispatch } = useApp();
  const total = poll.options.reduce((s, o) => s + o.votes.length, 0);
  const hasVoted = poll.options.some(o => o.votes.includes('user_me'));
  return (
    <div className="w-[min(260px,68vw)]">
      <div className="text-[14px] font-medium mb-2">📊 {poll.question}</div>
      {poll.options.map((o, i) => { const pct = total > 0 ? Math.round((o.votes.length / total) * 100) : 0; return <button key={i} onClick={(e) => { e.stopPropagation(); if (!hasVoted) dispatch({ type: 'VOTE_POLL', messageId, optionIndex: i }); }} className={`w-full relative rounded-lg px-3 py-2 mb-1 text-left overflow-hidden ${hasVoted ? 'cursor-default' : 'hover:bg-white/10'} ${o.votes.includes('user_me') ? 'ring-1 ring-tg-accent' : ''}`}>{hasVoted && <div className="absolute inset-0 bg-tg-accent/20" style={{ width: `${pct}%` }} />}<div className="relative flex items-center justify-between"><div className="flex items-center gap-2">{!hasVoted && <div className="w-4 h-4 rounded-full border-2 border-tg-text-secondary/50" />}<span className="text-sm">{o.text}</span></div>{hasVoted && <span className="text-xs font-medium text-tg-accent">{pct}%</span>}</div></button>; })}
      <div className={`text-[11px] mt-1 ${isMe ? 'text-white/50' : 'text-tg-text-secondary'}`}>{total} votes{poll.isAnonymous ? ' • Anonymous' : ''}</div>
    </div>
  );
}
