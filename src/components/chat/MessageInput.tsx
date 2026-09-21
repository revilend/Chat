import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import type { Chat, Message } from '../../types';
import { Smile, Paperclip, Mic, Send, Image, MapPin, FileText, BarChart3, Clock, X, Slash, Bell, Star, EyeOff, Video, Scissors, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { describeFile, blobToDataUrl } from '../../utils/media';
import { VoiceCapture, VideoNoteCapture, processVoiceClip, decodeAudioUrl, waveformFromBuffer, VOICE_EFFECTS, type VoiceEffect } from '../../utils/audioFx';

const emojiList = ['😀','😂','😍','🥰','😎','🤔','👍','❤️','🔥','✨','🎉','💯','🙏','👋','😢','😡','🥳','😴','🤗','😏','💪','🚀','⭐','🌟','💫','🎂','🎵','📸','🎮','💻','📱','☕','🍕','🌈','⚽','🎯','💎','🦄','🐱','🐶'];
const stickers = ['😀','😂','😍','🥺','😎','🤯','🥳','💀','👻','🤖','👽','🦊','🐱','🐶','🦁','🐸','🐧','🦄','🐝','🦋'];
const quickReplies = ['Hello! 👋','Thanks! 🙏','Got it 👍','Sounds good!','On my way!','Be right there','Let me check','Sure thing!'];
const wallpapers = ['#0e1621', '#1a1a2e', '#16213e', '#0f3460', '#1b1b2f', '#2d132c', '#192a56', '#1e272e', '#2c3e50', '#2d3436'];

interface Props { chat: Chat; }

export function MessageInput({ chat }: Props) {
  const { state, dispatch, t, sendMessage, notifyTyping, deliver, deliverEdit } = useApp();
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [showScheduled, setShowScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [priceStars, setPriceStars] = useState(0);
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [voiceEffect, setVoiceEffect] = useState<VoiceEffect>('normal');
  const [recordError, setRecordError] = useState('');
  const [levels, setLevels] = useState<number[]>([]);
  // Post-recording trim + effect stage
  const [clip, setClip] = useState<{ url: string; duration: number; waveform: number[] } | null>(null);
  const [trim, setTrim] = useState({ start: 0, end: 0 });
  const [sendingClip, setSendingClip] = useState(false);
  const [silentHint, setSilentHint] = useState(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChatIdRef = useRef(chat.id);

  // Drafts are really saved per chat and restored when you come back
  const updateText = (value: string) => {
    setText(value);
    if (value.trim()) notifyTyping(chat.id);
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => dispatch({ type: 'SET_DRAFT', chatId: chat.id, draft: value.trim() }), 350);
  };

  useEffect(() => {
    if (lastChatIdRef.current === chat.id) return;
    lastChatIdRef.current = chat.id;
    setText(chat.draft || '');
  }, [chat.id, chat.draft]);
  // Circular video message
  const [videoNote, setVideoNote] = useState<{ active: boolean; url: string | null }>({ active: false, url: null });
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureRef = useRef<VoiceCapture | null>(null);
  const videoCaptureRef = useRef<VideoNoteCapture | null>(null);
  const editingMsg = state.editingMessageId ? state.messages.find(m => m.id === state.editingMessageId) : null;
  const replyingMsg = state.replyTo ? state.messages.find(m => m.id === state.replyTo) : null;

  useEffect(() => { if (editingMsg) { setText(editingMsg.text); inputRef.current?.focus(); } }, [editingMsg]);
  useEffect(() => { if (replyingMsg) inputRef.current?.focus(); }, [replyingMsg]);

  const slowModeRemaining = (() => { if (!chat.slowMode || chat.slowMode <= 0 || !chat.lastMessageTime) return 0; return Math.max(0, chat.slowMode - (Date.now() - chat.lastMessageTime) / 1000); })();

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (linksBlocked) { setRecordError('🔗 Links are turned off for members in this group'); return; }
    if (state.editingMessageId) { dispatch({ type: 'EDIT_MESSAGE', messageId: state.editingMessageId, newText: trimmed }); deliverEdit(state.editingMessageId, trimmed); setText(''); return; }
    if (showScheduled && scheduledDate && scheduledTime) {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).getTime();
      dispatch({ type: 'SEND_MESSAGE', message: { id: `msg_sch_${Date.now()}`, chatId: chat.id, senderId: 'user_me', text: trimmed, timestamp: scheduledAt, scheduledAt, type: 'text', readBy: ['user_me'] } });
      setText(''); setShowScheduled(false); setScheduledDate(''); setScheduledTime(''); return;
    }
    const extras: Partial<Message> = { replyTo: state.replyTo || undefined, topicId: state.activeTopicId || undefined };
    if (showPriceInput && priceStars > 0) { extras.priceStars = priceStars; setShowPriceInput(false); setPriceStars(0); }
    sendMessage(chat.id, trimmed, extras);
    setText('');
  };

  // Right-click or long-press the send button to dispatch silently
  const handleSendSilent = () => {
    const trimmed = text.trim();
    if (!trimmed || state.editingMessageId) return;
    sendMessage(chat.id, trimmed, { replyTo: state.replyTo || undefined, sentWithoutSound: true });
    setText('');
    setSilentHint(true);
    setTimeout(() => setSilentHint(false), 1800);
  };

  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const startLongPress = (e: React.MouseEvent | React.TouchEvent) => {
    if ('button' in e && e.button !== 0) return;
    longPressFiredRef.current = false;
    longPressRef.current = setTimeout(() => { longPressFiredRef.current = true; handleSendSilent(); }, 450);
  };
  const endLongPress = () => { if (longPressRef.current) clearTimeout(longPressRef.current); longPressRef.current = null; };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } if (e.key === 'Escape') { if (state.editingMessageId) dispatch({ type: 'SET_EDITING', messageId: null }); if (state.replyTo) dispatch({ type: 'SET_REPLY_TO', messageId: null }); } };
  const formatRecordTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleVoiceRecord = async () => {
    if (isRecording) {
      setIsRecording(false);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      const capture = captureRef.current;
      captureRef.current = null;
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      try {
        const blob = capture ? await capture.stop() : new Blob();
        const url = await blobToDataUrl(blob);
        // Real duration + real waveform measured from the recorded audio
        const buffer = await decodeAudioUrl(url);
        const duration = Math.max(1, Math.round(buffer.duration));
        setClip({ url, duration, waveform: waveformFromBuffer(buffer, 40) });
        setTrim({ start: 0, end: duration });
      } catch (err) {
        setRecordError((err as Error).message || 'Recording failed');
      }
      setIsRecording(false);
      setRecordTime(0);
      setLevels([]);
    } else {
      setRecordError('');
      const capture = new VoiceCapture();
      try {
        await capture.start();
        captureRef.current = capture;
        setIsRecording(true); setRecordTime(0); setLevels([]);
        recordTimerRef.current = setInterval(() => {
          setRecordTime(prev => prev + 1);
          setLevels(prev => [...prev.slice(-29), capture.level()]);
        }, 120);
      } catch (err) {
        setRecordError((err as Error).message || 'Microphone access denied');
      }
    }
  };

  const cancelClip = () => {
    captureRef.current?.cancel();
    captureRef.current = null;
    videoCaptureRef.current?.cancel();
    videoCaptureRef.current = null;
    setClip(null);
    setVideoNote({ active: false, url: null });
    setIsRecording(false);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setRecordTime(0);
  };

  // Applies the chosen effect + trim window, then sends the voice message
  const sendVoiceClip = async () => {
    if (!clip) return;
    setSendingClip(true);
    try {
      const trimmed = trim.start > 0 || trim.end < clip.duration;
      const needsProcessing = voiceEffect !== 'normal' || trimmed;
      const processed = needsProcessing
        ? await processVoiceClip(clip.url, { effect: voiceEffect, start: trim.start, end: trim.end })
        : { dataUrl: clip.url, duration: clip.duration, waveform: clip.waveform };
      deliver({
        id: `msg_voice_${Date.now()}`, chatId: chat.id, senderId: 'user_me', text: '',
        timestamp: Date.now(), type: 'voice', readBy: ['user_me'],
        audioUrl: processed.dataUrl, audioDuration: processed.duration, audioWaveform: processed.waveform,
        voiceEffect,
      });
      setClip(null);
      setVoiceEffect('normal');
    } catch (err) {
      setRecordError((err as Error).message || 'Could not process the recording');
    }
    setSendingClip(false);
  };

  // Circular video message: record from the camera and send as a video note
  const startVideoNote = async () => {
    setRecordError('');
    const capture = new VideoNoteCapture();
    try {
      const stream = await capture.start();
      videoCaptureRef.current = capture;
      setVideoNote({ active: true, url: null });
      setTimeout(() => { if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream; }, 0);
    } catch (err) {
      setRecordError((err as Error).message || 'Camera access denied');
    }
  };

  const stopVideoNote = async () => {
    const capture = videoCaptureRef.current;
    videoCaptureRef.current = null;
    if (!capture) { setVideoNote({ active: false, url: null }); return; }
    try {
      const blob = await capture.stop();
      const url = await blobToDataUrl(blob);
      deliver({
        id: `msg_vnote_${Date.now()}`, chatId: chat.id, senderId: 'user_me', text: '',
        timestamp: Date.now(), type: 'video', videoNote: true, videoUrl: url, readBy: ['user_me'],
      });
      setVideoNote({ active: false, url: null });
      setShowAttach(false);
    } catch (err) {
      setRecordError((err as Error).message || 'Video message failed');
      setVideoNote({ active: false, url: null });
    }
  };

  // Read the picked files for real, so photos/files are actually attached
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const pending = await Promise.all(Array.from(files).map(describeFile));
      dispatch({ type: 'SET_PENDING_MEDIA', files: pending });
    } catch (err) {
      setRecordError((err as Error).message || 'Could not read the selected files');
    }
    e.target.value = '';
  };

  useEffect(() => { if (text === '__START_GAME_SNAKE__') { dispatch({ type: 'SET_MINI_APP', app: 'snake' }); setText(''); } if (text === '__START_GAME_2048__') { dispatch({ type: 'SET_MINI_APP', app: '2048' }); setText(''); } }, [text, dispatch]);

  const isGroupAdmin = chat.type === 'group' && chat.admins.includes('user_me');
  // Real enforcement of the group's member permissions
  const permissions = chat.permissions || { canSendMedia: true, canSendStickers: true, canEmbedLinks: true, canSendPolls: true };
  const perms = isGroupAdmin ? { canSendMedia: true, canSendStickers: true, canEmbedLinks: true, canSendPolls: true } : permissions;
  const linksBlocked = !perms.canEmbedLinks && /https?:\/\//.test(text);
  const mediaBlocked = !perms.canSendMedia;

  return (
    <div className="flex-shrink-0 bg-tg-sidebar border-t border-black/20">
      <AnimatePresence>
        {(replyingMsg || editingMsg) && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-tg-reply-bar border-b border-black/20 px-4 py-2 flex items-center gap-2"><div className="flex-1 min-w-0"><div className="text-xs font-medium text-tg-accent">{editingMsg ? `✏️ ${t('edit')}` : `↩ ${t('replyTo')}`}</div><div className="text-xs text-tg-text-secondary truncate">{(editingMsg || replyingMsg)?.text}</div></div><button onClick={() => { dispatch({ type: 'SET_REPLY_TO', messageId: null }); dispatch({ type: 'SET_EDITING', messageId: null }); setText(''); }} className="p-1 hover:bg-tg-hover rounded-full"><X size={16} className="text-tg-text-secondary" /></button></motion.div>}
      </AnimatePresence>
      <AnimatePresence>
        {showScheduled && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-tg-reply-bar border-b border-black/20 px-4 py-2 flex items-center gap-3"><Clock size={16} className="text-tg-accent" /><input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="bg-tg-input rounded px-2 py-1 text-xs text-tg-text outline-none" /><input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} className="bg-tg-input rounded px-2 py-1 text-xs text-tg-text outline-none" /><button onClick={() => setShowScheduled(false)}><X size={14} className="text-tg-text-secondary" /></button></motion.div>}
      </AnimatePresence>
      {slowModeRemaining > 0 && <div className="bg-tg-reply-bar border-b border-black/20 px-4 py-1.5 text-xs text-amber-400">⏳ Slow mode: wait {Math.ceil(slowModeRemaining)}s</div>}
      <AnimatePresence>
        {showPriceInput && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-tg-reply-bar border-b border-black/20 px-4 py-2 flex items-center gap-3"><Star size={16} className="text-amber-400" /><span className="text-xs text-tg-text">Set price:</span><input type="number" min={1} max={1000} value={priceStars} onChange={e => setPriceStars(Number(e.target.value))} className="w-20 bg-tg-input rounded px-2 py-1 text-xs text-tg-text outline-none" placeholder="Stars" /><span className="text-xs text-tg-text-secondary">⭐</span><button onClick={() => { setShowPriceInput(false); setPriceStars(0); }}><X size={14} className="text-tg-text-secondary" /></button></motion.div>}
      </AnimatePresence>
      {recordError && <div className="bg-tg-reply-bar border-b border-black/20 px-4 py-1.5 text-xs text-tg-red flex items-center gap-2"><span className="flex-1">{recordError}</span><button onClick={() => setRecordError('')}><X size={12} /></button></div>}
      {silentHint && <div className="bg-tg-reply-bar border-b border-black/20 px-4 py-1.5 text-xs text-tg-text-secondary">🔇 Message sent without sound</div>}

      {/* Live recording: real microphone level meter */}
      <AnimatePresence>
        {isRecording && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-tg-reply-bar border-b border-black/20 px-4 py-2 flex items-center gap-3">
          <div className="w-3 h-3 bg-tg-red rounded-full animate-pulse" />
          <span className="text-[15px] text-tg-text">{formatRecordTime(recordTime)}</span>
          <div className="flex-1 flex items-center gap-1 h-6">
            {(levels.length ? levels : Array.from({ length: 30 }, () => 0.2)).slice(-30).map((v, i) => (
              <div key={i} className="w-[3px] bg-tg-accent/60 rounded-full" style={{ height: `${Math.max(3, v * 24)}px` }} />
            ))}
          </div>
          <span className="text-[10px] text-tg-text-secondary">tap mic to stop</span>
        </motion.div>}
      </AnimatePresence>

      {/* Voice note trimmer + effects (after recording) */}
      <AnimatePresence>
        {clip && !isRecording && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-tg-reply-bar border-b border-black/20 px-4 py-2">
          <div className="flex items-center gap-2 mb-1.5">
            <Scissors size={14} className="text-tg-accent" />
            <span className="text-xs text-tg-text flex-1">Trim: {trim.start.toFixed(1)}s – {trim.end.toFixed(1)}s ({Math.max(0, trim.end - trim.start).toFixed(1)}s)</span>
            <span className="text-[10px] text-tg-text-secondary">{clip.duration}s total</span>
          </div>
          <div className="flex items-end gap-[2px] h-8 mb-2">
            {clip.waveform.map((v, i) => {
              const at = (i / clip.waveform.length) * clip.duration;
              const inTrim = at >= trim.start && at <= trim.end;
              return <div key={i} className={`flex-1 rounded-full ${inTrim ? 'bg-tg-accent' : 'bg-tg-text-secondary/30'}`} style={{ height: `${Math.max(3, v * 30)}px` }} />;
            })}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-tg-text-secondary">
            <span>start</span>
            <input type="range" min={0} max={clip.duration} step={0.1} value={trim.start}
              onChange={e => setTrim(t => ({ ...t, start: Math.min(Number(e.target.value), t.end - 0.2) }))} className="flex-1" />
            <input type="range" min={0} max={clip.duration} step={0.1} value={trim.end}
              onChange={e => setTrim(t => ({ ...t, end: Math.max(Number(e.target.value), t.start + 0.2) }))} className="flex-1" />
            <span>end</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <Wand2 size={14} className="text-tg-accent" />
            {VOICE_EFFECTS.map(e => (
              <button key={e.id} onClick={() => setVoiceEffect(e.id)} className={`px-2 py-1 rounded text-[11px] ${voiceEffect === e.id ? 'bg-tg-accent text-white' : 'bg-tg-input text-tg-text-secondary hover:bg-tg-hover'}`}>{e.icon} {e.label}</button>
            ))}
            <div className="flex-1" />
            <button onClick={cancelClip} className="px-3 py-1 rounded text-[11px] bg-tg-input text-tg-text-secondary">Cancel</button>
            <button onClick={sendVoiceClip} disabled={sendingClip} className="px-3 py-1 rounded text-[11px] bg-tg-accent text-white disabled:opacity-60">{sendingClip ? 'sending…' : 'Send'}</button>
          </div>
        </motion.div>}
      </AnimatePresence>

      {/* Circular video message recorder */}
      <AnimatePresence>
        {videoNote.active && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-tg-reply-bar border-b border-black/20 px-4 py-3 flex items-center gap-4">
          <video ref={videoPreviewRef} autoPlay muted playsInline className="w-20 h-20 rounded-full object-cover bg-black" />
          <div className="flex-1 text-xs text-tg-text-secondary">Recording a video message…</div>
          <button onClick={cancelClip} className="px-3 py-1.5 rounded text-xs bg-tg-input text-tg-text-secondary">Cancel</button>
          <button onClick={stopVideoNote} className="px-3 py-1.5 rounded text-xs bg-tg-accent text-white">Send</button>
        </motion.div>}
      </AnimatePresence>

      <div className="flex items-end gap-1 px-2 py-2 min-w-0 border-t border-black/25 bg-tg-header/60">
        <div className="relative shrink-0">
          <button onClick={() => { setShowEmoji(!showEmoji); setShowAttach(false); setShowQuickReplies(false); }} className="icon-btn" title="Emoji and stickers"><Smile size={22} /></button>
          <AnimatePresence>
            {showEmoji && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="card absolute bottom-full mb-2 left-0 p-2.5 w-[292px] z-50">
              <div className="grid grid-cols-8 gap-0.5 max-h-[200px] overflow-y-auto">{emojiList.map((emoji, i) => <button key={i} onClick={() => { setText(prev => prev + emoji); inputRef.current?.focus(); }} className="w-8 h-8 flex items-center justify-center text-lg hover:bg-tg-hover rounded transition-colors">{emoji}</button>)}</div>
              <div className="mt-2 pt-2 border-t border-black/20">
                <div className="text-[10px] text-tg-text-secondary mb-1">Stickers{!perms.canSendStickers && <span className="text-tg-red"> • admin only</span>}</div>
                <div className={`flex gap-1 flex-wrap ${perms.canSendStickers ? '' : 'opacity-40 pointer-events-none'}`}>{stickers.map((s, i) => <button key={i} onClick={() => setText(prev => prev + s)} className="text-2xl hover:scale-125 transition-transform">{s}</button>)}</div>
              </div>
            </motion.div>}
          </AnimatePresence>
        </div>

        <div className="relative shrink-0">
          <button onClick={() => { setShowAttach(!showAttach); setShowEmoji(false); setShowQuickReplies(false); }} className="icon-btn" title="Attach"><Paperclip size={22} /></button>
          <AnimatePresence>
            {showAttach && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="card absolute bottom-full mb-2 left-0 py-1.5 w-60 z-50">
              {/* Feature 13: Media file picker with confirmation */}
              <label className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-tg-hover transition-colors text-left ${mediaBlocked ? 'opacity-40' : 'cursor-pointer'}`}>
                <Image size={18} className="text-blue-500" /><span className="text-[15px] text-tg-text">{t('media')}</span>
                {mediaBlocked && <span className="text-[10px] text-tg-red ml-auto">admin only</span>}
                <input type="file" multiple accept="image/*,video/*" className="hidden" disabled={mediaBlocked} onChange={handleFileSelect} />
              </label>
              <label className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-tg-hover transition-colors text-left cursor-pointer">
                <FileText size={18} className="text-purple-500" /><span className="text-[15px] text-tg-text">{t('files')}</span>
                <input type="file" multiple className="hidden" onChange={handleFileSelect} />
              </label>
              <button onClick={() => { if (navigator.geolocation) navigator.geolocation.getCurrentPosition((pos) => deliver({ id: `msg_loc_${Date.now()}`, chatId: chat.id, senderId: 'user_me', text: '', timestamp: Date.now(), type: 'location', location: { lat: pos.coords.latitude, lng: pos.coords.longitude }, readBy: ['user_me'] }), () => setRecordError('Location unavailable — allow location access and try again')); setShowAttach(false); }} className="w-full flex items-center gap-3.5 px-3.5 py-2.5 hover:bg-tg-hover transition-colors text-left"><MapPin size={18} className="text-green-500" /><span className="text-[15px] text-tg-text">{t('sendLocation')}</span></button>
              <button onClick={() => { dispatch({ type: 'TOGGLE_POLL_MODAL' }); setShowAttach(false); }} disabled={!perms.canSendPolls} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-tg-hover transition-colors text-left disabled:opacity-40"><BarChart3 size={18} className="text-orange-500" /><span className="text-[15px] text-tg-text">{t('poll')}</span>{!perms.canSendPolls && <span className="text-[10px] text-tg-red ml-auto">admin only</span>}</button>
              {chat.type === 'group' && <button onClick={() => { dispatch({ type: 'TOGGLE_SPLIT_BILL' }); setShowAttach(false); }} className="w-full flex items-center gap-3.5 px-3.5 py-2.5 hover:bg-tg-hover transition-colors text-left"><span className="text-lg">💰</span><span className="text-[15px] text-tg-text">Split Bill</span></button>}
              <div className="border-t border-black/20 my-1" />
              <button onClick={() => { dispatch({ type: 'TOGGLE_REMINDER_MODAL' }); setShowAttach(false); }} className="w-full flex items-center gap-3.5 px-3.5 py-2.5 hover:bg-tg-hover transition-colors text-left"><Bell size={18} className="text-yellow-500" /><span className="text-[15px] text-tg-text">Set Reminder</span></button>
              {chat.type === 'private' && <button onClick={() => { const trimmed = text.trim(); if (trimmed) { deliver({ id: `msg_online_${Date.now()}`, chatId: chat.id, senderId: 'user_me', text: trimmed, timestamp: Date.now(), type: 'text', readBy: ['user_me'], sendWhenOnline: true }); setText(''); } setShowAttach(false); }} className="w-full flex items-center gap-3.5 px-3.5 py-2.5 hover:bg-tg-hover transition-colors text-left"><Clock size={18} className="text-teal-400" /><span className="text-[15px] text-tg-text">Send When Online</span></button>}
              {chat.type === 'channel' && <button onClick={() => { setShowPriceInput(true); setShowAttach(false); }} className="w-full flex items-center gap-3.5 px-3.5 py-2.5 hover:bg-tg-hover transition-colors text-left"><Star size={18} className="text-amber-400" /><span className="text-[15px] text-tg-text">Paid Post</span></button>}
              {isGroupAdmin && <button onClick={() => { if (text.trim()) { dispatch({ type: 'POST_AS_ANONYMOUS', chatId: chat.id, text: text.trim() }); setText(''); } setShowAttach(false); }} className="w-full flex items-center gap-3.5 px-3.5 py-2.5 hover:bg-tg-hover transition-colors text-left"><EyeOff size={18} className="text-cyan-500" /><span className="text-[15px] text-tg-text">Post Anonymously</span></button>}
              <button onClick={startVideoNote} className="w-full flex items-center gap-3.5 px-3.5 py-2.5 hover:bg-tg-hover transition-colors text-left"><Video size={18} className="text-cyan-400" /><span className="text-[15px] text-tg-text">Video Message</span></button>
              <button onClick={() => { setShowScheduled(true); setShowAttach(false); }} className="w-full flex items-center gap-3.5 px-3.5 py-2.5 hover:bg-tg-hover transition-colors text-left"><Clock size={18} className="text-indigo-400" /><span className="text-[15px] text-tg-text">Send Later</span></button>
              <button onClick={() => { setShowWallpaperPicker(!showWallpaperPicker); setShowAttach(false); }} className="w-full flex items-center gap-3.5 px-3.5 py-2.5 hover:bg-tg-hover transition-colors text-left"><span className="text-lg">🎨</span><span className="text-[15px] text-tg-text">Chat Wallpaper</span></button>
            </motion.div>}
          </AnimatePresence>
          <AnimatePresence>
            {showWallpaperPicker && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="card absolute bottom-full mb-2 left-0 p-3.5 w-60 z-50">
              <div className="text-xs text-tg-text-secondary mb-2">Chat Wallpaper</div>
              <div className="grid grid-cols-5 gap-1.5">
                {wallpapers.map((c, i) => <button key={i} onClick={() => { dispatch({ type: 'SET_CHAT_WALLPAPER', chatId: chat.id, wallpaper: c }); setShowWallpaperPicker(false); }} className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${chat.wallpaper === c ? 'border-tg-accent' : 'border-transparent'}`} style={{ background: c }} />)}
                <button onClick={() => { dispatch({ type: 'SET_CHAT_WALLPAPER', chatId: chat.id, wallpaper: undefined }); setShowWallpaperPicker(false); }} className="w-8 h-8 rounded-full border-2 border-tg-red/50 flex items-center justify-center text-tg-red text-xs">✕</button>
              </div>
            </motion.div>}
          </AnimatePresence>
        </div>

        <div className="relative shrink-0">
          <button onClick={() => { setShowQuickReplies(!showQuickReplies); setShowEmoji(false); setShowAttach(false); }} className="icon-btn hidden sm:inline-flex" title="Quick replies"><Slash size={22} /></button>
          <AnimatePresence>
            {showQuickReplies && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="card absolute bottom-full mb-2 left-0 py-1.5 w-60 z-50">
              {quickReplies.map((r, i) => <button key={i} onClick={() => { setText(r); setShowQuickReplies(false); inputRef.current?.focus(); }} className="w-full text-left px-3 py-2 text-sm text-tg-text hover:bg-tg-hover transition-colors">{r}</button>)}
            </motion.div>}
          </AnimatePresence>
        </div>

        <div className="flex-1 min-w-0 relative">
          <textarea ref={inputRef} value={text} onChange={e => { updateText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }} onKeyDown={handleKeyDown} placeholder={t('send')} rows={1} className="w-full bg-tg-input rounded-2xl px-4 py-2.5 text-[15px] text-tg-text placeholder:text-tg-text-secondary outline-none resize-none max-h-[120px] border border-transparent focus:border-tg-accent/60 transition-colors" />
        </div>

        {text ? (
          <button
            onClick={() => { if (longPressFiredRef.current) { longPressFiredRef.current = false; return; } handleSend(); }}
            onContextMenu={(e) => { e.preventDefault(); handleSendSilent(); }}
            onMouseDown={startLongPress}
            onMouseUp={endLongPress}
            onMouseLeave={endLongPress}
            onTouchStart={startLongPress}
            onTouchEnd={endLongPress}
            title="Send • right-click or long-press to send without sound"
            className="w-11 h-11 rounded-full bg-tg-accent hover:bg-tg-accent-hover flex items-center justify-center shadow-lg shadow-tg-accent/30"
          >
            <Send size={20} className="text-white" />
          </button>
        ) : (
          <button onClick={handleVoiceRecord} disabled={!!clip} className={`w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-40 shadow-lg ${isRecording ? 'bg-tg-red animate-pulse shadow-tg-red/30' : 'bg-tg-accent hover:bg-tg-accent-hover shadow-tg-accent/30'}`} title="Record voice message"><Mic size={22} className="text-white" /></button>
        )}
      </div>
    </div>
  );
}
