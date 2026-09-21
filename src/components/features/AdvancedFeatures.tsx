import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { X, Copy, Check, ChevronUp, ChevronDown, Printer, Tag, Bookmark, ArrowRightLeft, Type, Megaphone, Shield, MessageSquare, Settings, Film } from 'lucide-react';
import { messageFromPendingMedia, formatBytes } from '../../utils/media';
import { decodeAudioUrl, waveformFromBuffer } from '../../utils/audioFx';
import { motion } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════════
   Feature 1: Code Syntax Highlighting + Copy
   ═══════════════════════════════════════════════════════════════ */
const langKeywords: Record<string, string[]> = {
  javascript: ['const','let','var','function','return','if','else','for','while','class','import','export','default','new','this','async','await','try','catch','throw','switch','case','break','continue','typeof','instanceof','null','undefined','true','false'],
  python: ['def','class','return','if','elif','else','for','while','import','from','as','try','except','raise','with','lambda','True','False','None','print','self','yield','pass','break','continue'],
  html: ['html','head','body','div','span','p','a','img','script','style','link','meta','title','h1','h2','h3','ul','li','table','tr','td','th','form','input','button','select','option','textarea'],
  css: ['color','background','margin','padding','border','font','display','position','width','height','flex','grid','text-align','overflow','transition','transform','animation','opacity','z-index',':hover',':focus'],
  cpp: ['int','float','double','char','bool','void','class','struct','public','private','protected','virtual','override','return','if','else','for','while','switch','case','break','continue','new','delete','nullptr','template','typename','namespace','using','std','cout','cin','endl'],
};

const langColors: Record<string, { keyword: string; string: string; comment: string; number: string }> = {
  javascript: { keyword: '#c792ea', string: '#c3e88d', comment: '#546e7a', number: '#f78c6c' },
  python: { keyword: '#c792ea', string: '#c3e88d', comment: '#546e7a', number: '#f78c6c' },
  html: { keyword: '#f07178', string: '#c3e88d', comment: '#546e7a', number: '#f78c6c' },
  css: { keyword: '#82aaff', string: '#c3e88d', comment: '#546e7a', number: '#f78c6c' },
  cpp: { keyword: '#c792ea', string: '#c3e88d', comment: '#546e7a', number: '#f78c6c' },
};

function detectLang(code: string): string {
  if (/\b(const|let|var|function|=>|async|await)\b/.test(code)) return 'javascript';
  if (/\b(def |class |import |from |print\(|self\.)/.test(code)) return 'python';
  if (/<\/?[a-z][\s\S]*>/i.test(code)) return 'html';
  if (/\b(margin|padding|border|background|:hover|@media)\b/.test(code)) return 'css';
  if (/\b(std::|cout|cin|#include|nullptr|template)\b/.test(code)) return 'cpp';
  return 'javascript';
}

function highlightCode(code: string, lang: string): React.ReactNode {
  const colors = langColors[lang] || langColors.javascript;
  const keywords = langKeywords[lang] || langKeywords.javascript;
  const lines = code.split('\n');
  return lines.map((line, li) => {
    const parts: React.ReactNode[] = [];
    // Comment
    const commentIdx = line.indexOf('//');
    if (commentIdx >= 0) {
      parts.push(<span key={`c${li}`}>{colorize(line.slice(0, commentIdx), keywords, colors)}</span>);
      parts.push(<span key={`cm${li}`} style={{ color: colors.comment }}>{line.slice(commentIdx)}</span>);
    } else {
      parts.push(<span key={`t${li}`}>{colorize(line, keywords, colors)}</span>);
    }
    return <div key={li}>{parts}{li < lines.length - 1 ? '\n' : ''}</div>;
  });
}

function colorize(text: string, keywords: string[], colors: Record<string, string>): React.ReactNode {
  const regex = new RegExp(`('(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*")|(\\b(?:${keywords.join('|')})\\b)|(\\b\\d+\\.?\\d*\\b)|(/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)*/|#[^\\n]*)`, 'g');
  const result: React.ReactNode[] = [];
  let last = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) result.push(<span key={`p${last}`}>{text.slice(last, m.index)}</span>);
    if (m[1]) result.push(<span key={`s${m.index}`} style={{ color: colors.string }}>{m[1]}</span>);
    else if (m[2]) result.push(<span key={`k${m.index}`} style={{ color: colors.keyword, fontWeight: 600 }}>{m[2]}</span>);
    else if (m[3]) result.push(<span key={`n${m.index}`} style={{ color: colors.number }}>{m[3]}</span>);
    else if (m[4]) result.push(<span key={`c${m.index}`} style={{ color: colors.comment, fontStyle: 'italic' }}>{m[4]}</span>);
    else result.push(<span key={`x${m.index}`}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) result.push(<span key={`e${last}`}>{text.slice(last)}</span>);
  return result;
}

export function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const match = text.match(/```(\w+)?\n([\s\S]*?)```/);
  if (!match) return null;
  const lang = match[1] || detectLang(match[2]);
  const code = match[2].trim();
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="rounded-lg overflow-hidden bg-[#1e1e2e] border border-white/5 my-1 text-[13px] font-mono">
      <div className="flex items-center justify-between px-3 py-1 bg-white/5 text-tg-text-secondary text-[10px]">
        <span>{lang}</span>
        <button onClick={(e) => { e.stopPropagation(); copy(); }} className="flex items-center gap-1 hover:text-tg-accent transition-colors">
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy Code</>}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-[#e0e0e0] whitespace-pre-wrap leading-relaxed">
        <code>{highlightCode(code, lang)}</code>
      </pre>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Feature 4: Full-Screen Particle Reactions
   ═══════════════════════════════════════════════════════════════ */
interface Particle { id: number; x: number; y: number; vx: number; vy: number; emoji: string; life: number; size: number; rotation: number; }

export function ParticleExplosion({ emoji, x, y, onDone }: { emoji: string; x: number; y: number; onDone: () => void }) {
  const [particles] = useState<Particle[]>(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i, x, y,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 14 - 4,
      emoji, life: 1,
      size: 16 + Math.random() * 24,
      rotation: Math.random() * 360,
    }))
  );
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    let f = 0;
    const id = setInterval(() => { f++; setFrame(f); if (f > 60) { clearInterval(id); onDone(); } }, 16);
    return () => clearInterval(id);
  }, [onDone]);
  return (
    <div className="fixed inset-0 pointer-events-none z-[100]">
      {particles.map(p => {
        const t = frame / 60;
        const px = p.x + p.vx * frame * 0.8;
        const py = p.y + p.vy * frame * 0.8 + 0.5 * 9.8 * frame * frame * 0.1;
        const opacity = 1 - t;
        const scale = 1 + t * 0.5;
        return <div key={p.id} className="absolute" style={{ left: px, top: py, fontSize: p.size, opacity, transform: `scale(${scale}) rotate(${p.rotation + frame * 3}deg)` }}>{p.emoji}</div>;
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Feature 8: Tag & Bookmark Drawer
   ═══════════════════════════════════════════════════════════════ */
export function BookmarksDrawer() {
  const { state, dispatch } = useApp();

  if (!state.showBookmarks) return null;

  const allTags = [...new Set(state.messages.flatMap(m => m.tags || []))];
  const filtered = state.messages.filter(m => {
    if (state.tagFilter) return (m.tags || []).includes(state.tagFilter);
    return m.isBookmarked || (m.tags && m.tags.length > 0);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-16" onClick={() => dispatch({ type: 'TOGGLE_BOOKMARKS_VIEW' })}>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} onClick={e => e.stopPropagation()} className="bg-tg-sidebar rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/20">
          <h3 className="text-base font-medium text-tg-text flex items-center gap-2"><Bookmark size={18} /> Bookmarks & Tags</h3>
          <button onClick={() => dispatch({ type: 'TOGGLE_BOOKMARKS_VIEW' })}><X size={18} className="text-tg-text-secondary" /></button>
        </div>
        {/* Tag filter bar */}
        <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-black/10">
          <button onClick={() => dispatch({ type: 'SET_TAG_FILTER', tag: null })} className={`text-[11px] px-2 py-1 rounded-full whitespace-nowrap ${!state.tagFilter ? 'bg-tg-accent text-white' : 'bg-tg-input text-tg-text-secondary'}`}>All</button>
          {allTags.map(tag => (
            <button key={tag} onClick={() => dispatch({ type: 'SET_TAG_FILTER', tag: state.tagFilter === tag ? null : tag })} className={`text-[11px] px-2 py-1 rounded-full whitespace-nowrap ${state.tagFilter === tag ? 'bg-tg-accent text-white' : 'bg-tg-input text-tg-text-secondary'}`}>#{tag}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.length === 0 && <p className="text-sm text-tg-text-secondary text-center py-6">No bookmarks or tagged messages</p>}
          {filtered.map(m => (
            <div key={m.id} className="bg-tg-bg/50 rounded-lg p-2.5 border border-black/10">
              <div className="text-xs text-tg-text-secondary mb-1">{new Date(m.timestamp).toLocaleString()}</div>
              <div className="text-sm text-tg-text line-clamp-2">{m.text}</div>
              <div className="flex gap-1 mt-1.5">
                {(m.tags || []).map(tag => <span key={tag} className="text-[10px] bg-tg-accent/20 text-tg-accent px-1.5 py-0.5 rounded-full">#{tag}</span>)}
                {m.isBookmarked && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">⭐ Saved</span>}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export function TagInput({ messageId }: { messageId: string }) {
  const { dispatch } = useApp();
  const [input, setInput] = useState('');
  const [show, setShow] = useState(false);
  const quickTags = ['important', 'study', 'work', 'todo', 'review', 'idea'];
  return (
    <div className="relative">
      <button onClick={() => setShow(!show)} className="p-1 hover:bg-tg-hover rounded"><Tag size={12} className="text-tg-text-secondary" /></button>
      {show && (
        <div className="absolute bottom-full left-0 mb-1 bg-tg-sidebar rounded-lg shadow-xl border border-black/20 p-2 w-40 z-50">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && input.trim()) { dispatch({ type: 'ADD_TAG', messageId, tag: input.trim() }); setInput(''); setShow(false); } }} placeholder="Add tag..." className="w-full bg-tg-input rounded px-2 py-1 text-xs text-tg-text outline-none mb-1" autoFocus />
          <div className="flex flex-wrap gap-1">
            {quickTags.map(t => <button key={t} onClick={() => { dispatch({ type: 'ADD_TAG', messageId, tag: t }); setShow(false); }} className="text-[10px] bg-tg-input px-1.5 py-0.5 rounded text-tg-text-secondary hover:bg-tg-hover">#{t}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Feature 9: In-Chat Unit/Currency Converter
   ═══════════════════════════════════════════════════════════════ */
const conversions: Record<string, (n: number) => number> = {
  'usd_to_uzs': n => n * 12700, 'uzs_to_usd': n => n / 12700,
  'eur_to_usd': n => n * 1.08, 'usd_to_eur': n => n / 1.08,
  'kg_to_lbs': n => n * 2.20462, 'lbs_to_kg': n => n / 2.20462,
  'km_to_miles': n => n * 0.621371, 'miles_to_km': n => n / 0.621371,
  'c_to_f': n => n * 9 / 5 + 32, 'f_to_c': n => (n - 32) * 5 / 9,
  'cm_to_inch': n => n / 2.54, 'inch_to_cm': n => n * 2.54,
  'l_to_gal': n => n * 0.264172, 'gal_to_l': n => n / 0.264172,
};

function parseConversion(text: string): { value: number; from: string; to: string; result: number; label: string } | null {
  const patterns = [
    { re: /(\d+\.?\d*)\s*(?:usd|\$)\s+(?:in|to)\s+(?:uzs|sum)/i, from: 'usd_to_uzs', label: '$ → soʻm' },
    { re: /(\d+\.?\d*)\s*(?:uzs|sum)\s+(?:in|to)\s+(?:usd|\$)/i, from: 'uzs_to_usd', label: 'soʻm → $' },
    { re: /(\d+\.?\d*)\s*kg\s+(?:in|to)\s*lbs?/i, from: 'kg_to_lbs', label: 'kg → lbs' },
    { re: /(\d+\.?\d*)\s*lbs?\s+(?:in|to)\s*kg/i, from: 'lbs_to_kg', label: 'lbs → kg' },
    { re: /(\d+\.?\d*)\s*km\s+(?:in|to)\s*(?:miles?|mi)/i, from: 'km_to_miles', label: 'km → mi' },
    { re: /(\d+\.?\d*)\s*(?:miles?|mi)\s+(?:in|to)\s*km/i, from: 'miles_to_km', label: 'mi → km' },
    { re: /(\d+\.?\d*)\s*[c°]\s+(?:in|to)\s*f/i, from: 'c_to_f', label: '°C → °F' },
    { re: /(\d+\.?\d*)\s*f\s+(?:in|to)\s*[c°]/i, from: 'f_to_c', label: '°F → °C' },
    { re: /(\d+\.?\d*)\s*cm\s+(?:in|to)\s*inch/i, from: 'cm_to_inch', label: 'cm → inch' },
    { re: /(\d+\.?\d*)\s*inch(?:es)?\s+(?:in|to)\s*cm/i, from: 'inch_to_cm', label: 'inch → cm' },
    { re: /(\d+\.?\d*)\s*l(?:iters?)?\s+(?:in|to)\s*gal(?:lons?)?/i, from: 'l_to_gal', label: 'L → gal' },
    { re: /(\d+\.?\d*)\s*gal(?:lons?)?\s+(?:in|to)\s*l(?:iters?)?/i, from: 'gal_to_l', label: 'gal → L' },
    { re: /(\d+\.?\d*)\s*(?:eur|€)\s+(?:in|to)\s*(?:usd|\$)/i, from: 'eur_to_usd', label: '€ → $' },
    { re: /(\d+\.?\d*)\s*(?:usd|\$)\s+(?:in|to)\s*(?:eur|€)/i, from: 'usd_to_eur', label: '$ → €' },
  ];
  for (const p of patterns) {
    const m = text.match(p.re);
    if (m) { const v = parseFloat(m[1]); return { value: v, from: p.from, to: '', result: conversions[p.from](v), label: p.label }; }
  }
  return null;
}

export function UnitConverterCard({ text }: { text: string }) {
  const conv = parseConversion(text);
  if (!conv) return null;
  return (
    <div className="bg-gradient-to-r from-tg-accent/10 to-tg-accent/5 rounded-lg p-3 mt-1 border border-tg-accent/20 flex items-center gap-3">
      <ArrowRightLeft size={18} className="text-tg-accent flex-shrink-0" />
      <div>
        <div className="text-xs text-tg-text-secondary">{conv.label}</div>
        <div className="text-sm text-tg-text font-medium">{conv.value.toLocaleString()} → {conv.result.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Feature 10: Private Contact Notes
   ═══════════════════════════════════════════════════════════════ */
export function ContactNoteEditor({ userId }: { userId: string }) {
  const { state, dispatch } = useApp();
  const contact = state.contacts.find(c => c.userId === userId);
  const [note, setNote] = useState(contact?.privateNote || '');
  if (!contact) return null;
  return (
    <div className="mt-3 px-4">
      <div className="text-xs text-tg-accent mb-1">📝 Private Note (only you can see)</div>
      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a private note..." className="w-full bg-tg-input rounded-lg px-3 py-2 text-xs text-tg-text outline-none resize-none" rows={2} />
      {note !== (contact.privateNote || '') && (
        <button onClick={() => dispatch({ type: 'SET_CONTACT_NOTE', userId, note }) } className="text-[10px] text-tg-accent mt-1 hover:underline">Save note</button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Feature 11: Calendar Grid History Viewer
   ═══════════════════════════════════════════════════════════════ */
export function CalendarViewer() {
  const { state, dispatch, getUser } = useApp();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  if (!state.showCalendarViewer) return null;

  const chatMessages = state.messages.filter(m => m.chatId === state.activeChatId);
  const selectedDay = state.calendarDate ? new Date(state.calendarDate) : null;
  const dayMessages = selectedDay ? chatMessages.filter(m => {
    const d = new Date(m.timestamp);
    return d.getFullYear() === selectedDay.getFullYear() && d.getMonth() === selectedDay.getMonth() && d.getDate() === selectedDay.getDate();
  }) : [];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Days that have messages
  const activeDays = new Set(chatMessages.filter(m => { const d = new Date(m.timestamp); return d.getFullYear() === year && d.getMonth() === month; }).map(m => new Date(m.timestamp).getDate()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => dispatch({ type: 'TOGGLE_CALENDAR_VIEWER' })}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()} className="bg-tg-sidebar rounded-2xl shadow-2xl p-4 w-full max-w-sm max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }} className="p-1 hover:bg-tg-hover rounded">◀</button>
          <h3 className="text-sm font-medium text-tg-text">{monthNames[month]} {year}</h3>
          <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }} className="p-1 hover:bg-tg-hover rounded">▶</button>
        </div>
        <button onClick={() => dispatch({ type: 'TOGGLE_CALENDAR_VIEWER' })} className="absolute top-3 right-3"><X size={16} className="text-tg-text-secondary" /></button>
        <div className="grid grid-cols-7 gap-0.5 text-center mb-2">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="text-[10px] text-tg-text-secondary py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const hasMsg = activeDays.has(day);
            const isSelected = state.calendarDate === `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            return (
              <button key={day} onClick={() => dispatch({ type: 'SET_CALENDAR_DATE', date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` })}
                className={`aspect-square rounded-lg text-xs flex items-center justify-center transition-colors ${isSelected ? 'bg-tg-accent text-white' : hasMsg ? 'bg-tg-accent/20 text-tg-text hover:bg-tg-accent/30' : 'text-tg-text-secondary hover:bg-tg-hover'}`}>
                {day}
              </button>
            );
          })}
        </div>
        {dayMessages.length > 0 && (
          <div className="mt-3 border-t border-black/20 pt-3">
            <div className="text-xs text-tg-text-secondary mb-2">{dayMessages.length} message{dayMessages.length > 1 ? 's' : ''} on {new Date(state.calendarDate).toLocaleDateString()}</div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {dayMessages.map(m => (
                <div key={m.id} className="bg-tg-bg/50 rounded-lg p-2 text-xs">
                  <div className="text-tg-text-secondary">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {getUser(m.senderId)?.name}</div>
                  <div className="text-tg-text line-clamp-2 mt-0.5">{m.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Feature 15: Search Hit Navigator
   ═══════════════════════════════════════════════════════════════ */
export function SearchNavigator() {
  const { state, dispatch } = useApp();
  if (state.searchHits.length === 0) return null;
  return (
    <div className="flex items-center gap-1 bg-tg-input rounded-lg px-2 py-1">
      <span className="text-[11px] text-tg-text min-w-[50px] text-center">{state.currentSearchHitIndex + 1} of {state.searchHits.length}</span>
      <button onClick={() => dispatch({ type: 'CYCLE_SEARCH_HIT', direction: -1 })} className="p-0.5 hover:bg-tg-hover rounded"><ChevronUp size={14} className="text-tg-text-secondary" /></button>
      <button onClick={() => dispatch({ type: 'CYCLE_SEARCH_HIT', direction: 1 })} className="p-0.5 hover:bg-tg-hover rounded"><ChevronDown size={14} className="text-tg-text-secondary" /></button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Feature 16: Quick Text Case Converter
   ═══════════════════════════════════════════════════════════════ */
export function CaseConverterPopup({ text, onApply, onClose }: { text: string; onApply: (t: string) => void; onClose: () => void }) {
  const cases = [
    { label: 'UPPERCASE', fn: (s: string) => s.toUpperCase() },
    { label: 'lowercase', fn: (s: string) => s.toLowerCase() },
    { label: 'Title Case', fn: (s: string) => s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) },
    { label: 'sentence case', fn: (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() },
  ];
  return (
    <div className="bg-tg-sidebar rounded-lg shadow-xl border border-black/20 py-1 w-36 absolute z-50">
      <div className="px-2 py-1 text-[10px] text-tg-text-secondary flex items-center gap-1"><Type size={10} /> Convert case</div>
      {cases.map(c => (
        <button key={c.label} onClick={() => { onApply(c.fn(text)); onClose(); }} className="w-full text-left px-3 py-1.5 text-xs text-tg-text hover:bg-tg-hover">{c.label}</button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Feature 17: Announcement Bulletin Banner
   ═══════════════════════════════════════════════════════════════ */
export function AnnouncementBanner() {
  const { state, dispatch } = useApp();
  const chat = state.chats.find(c => c.id === state.activeChatId);
  if (!chat || !chat.announcements || chat.announcements.length === 0) return null;
  const idx = state.announcementIndex % chat.announcements.length;
  return (
    <div className="bg-tg-accent/10 border-b border-tg-accent/20 px-4 py-1.5 flex items-center gap-2">
      <Megaphone size={14} className="text-tg-accent flex-shrink-0" />
      <div className="flex-1 text-xs text-tg-text truncate">{chat.announcements[idx]}</div>
      <div className="flex items-center gap-0.5">
        <button onClick={() => dispatch({ type: 'SET_ANNOUNCEMENT_INDEX', index: (idx - 1 + chat.announcements!.length) % chat.announcements!.length })} className="p-0.5"><ChevronUp size={12} className="text-tg-text-secondary" /></button>
        <span className="text-[10px] text-tg-text-secondary">{idx + 1}/{chat.announcements.length}</span>
        <button onClick={() => dispatch({ type: 'SET_ANNOUNCEMENT_INDEX', index: (idx + 1) % chat.announcements!.length })} className="p-0.5"><ChevronDown size={12} className="text-tg-text-secondary" /></button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Feature 18: Print / Export to PDF
   ═══════════════════════════════════════════════════════════════ */
export function usePrintChat() {
  const { state, getChatMessages, getUser, getChat } = useApp();
  return useCallback(() => {
    const chat = getChat(state.activeChatId || '');
    const messages = getChatMessages(state.activeChatId || '');
    if (!chat) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${chat.name} - Chat Export</title><style>body{font-family:sans-serif;max-width:700px;margin:0 auto;padding:20px;background:#fff;color:#000} .msg{margin:8px 0;padding:8px 12px;border-radius:8px} .me{background:#e3f2fd;text-align:right;margin-left:40%} .them{background:#f5f5f5;margin-right:40%} .sender{font-size:11px;color:#1976d2;font-weight:600} .text{font-size:14px;margin:4px 0} .time{font-size:10px;color:#999} h1{font-size:18px;border-bottom:2px solid #1976d2;padding-bottom:8px} @media print{body{padding:10px}}</style></head><body>`);
    w.document.write(`<h1>${chat.name}</h1><p style="color:#666;font-size:12px">${messages.length} messages • Exported ${new Date().toLocaleString()}</p>`);
    messages.forEach(m => {
      const isMe = m.senderId === 'user_me';
      const sender = getUser(m.senderId)?.name || 'Unknown';
      const time = new Date(m.timestamp).toLocaleString();
      w.document.write(`<div class="msg ${isMe ? 'me' : 'them'}"><div class="sender">${sender}</div><div class="text">${m.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div><div class="time">${time}</div></div>`);
    });
    w.document.write('</body></html>');
    w.document.close();
    w.print();
  }, [state.activeChatId, getChatMessages, getUser, getChat]);
}

export function PrintChatButton() {
  const printChat = usePrintChat();
  return (
    <button onClick={printChat} className="flex items-center gap-2 px-3 py-2 text-sm text-tg-text hover:bg-tg-hover rounded-lg transition-colors w-full">
      <Printer size={16} className="text-tg-text-secondary" /> Print Chat / Export PDF
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Feature 13: Media Send Confirmation Modal
   ═══════════════════════════════════════════════════════════════ */
export function MediaConfirmModal() {
  const { state, dispatch, deliver } = useApp();
  const [sending, setSending] = useState(false);
  if (!state.showMediaConfirm) return null;
  const chatId = state.activeChatId || '';
  const send = async () => {
    setSending(true);
    for (const media of state.pendingMediaFiles) {
      const message = messageFromPendingMedia(media, chatId, 'user_me');
      // Measure real duration/waveform for audio so the player can seek properly
      if (message.type === 'music' && media.dataUrl) {
        try {
          const buffer = await decodeAudioUrl(media.dataUrl);
          message.audioDuration = Math.max(1, Math.round(buffer.duration));
          message.audioWaveform = waveformFromBuffer(buffer, 40);
        } catch { /* keep the file as-is */ }
      }
      // Goes to the other person's device as well, not only into this chat.
      deliver(message);
    }
    setSending(false);
    dispatch({ type: 'CONFIRM_SEND_MEDIA' });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => dispatch({ type: 'CANCEL_SEND_MEDIA' })}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()} className="bg-tg-sidebar rounded-2xl shadow-2xl p-4 w-full max-w-sm max-h-[80vh] overflow-y-auto">
        <h3 className="text-base font-medium text-tg-text mb-3">Confirm Send</h3>
        <div className="space-y-2 mb-4">
          {state.pendingMediaFiles.map((f, i) => (
            <div key={i} className="bg-tg-bg/50 rounded-lg p-2">
              <div className="flex items-center gap-3">
                {f.preview ? <img src={f.preview} className="w-12 h-12 rounded object-cover" alt="" /> : <div className="w-12 h-12 rounded bg-tg-input flex items-center justify-center"><Film size={20} className="text-tg-text-secondary" /></div>}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-tg-text truncate">{f.name}</div>
                  <div className="text-[10px] text-tg-text-secondary">{f.type || 'file'} • {formatBytes(f.size)}{f.tooLarge ? ' • too large to send — name only' : ''}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2">
                {f.preview && f.dataUrl && (
                  <button onClick={() => dispatch({ type: 'SET_PHOTO_EDITOR_SOURCE', source: f.dataUrl! })} className="text-[11px] text-tg-accent hover:underline">✏️ Edit photo</button>
                )}
                {f.type.startsWith('image/') && (
                  <button onClick={() => dispatch({ type: 'SET_PENDING_MEDIA_VIEW_ONCE', index: i, viewOnce: !f.viewOnce })} className={`text-[11px] ${f.viewOnce ? 'text-amber-400' : 'text-tg-text-secondary hover:underline'}`}>
                    🔥 View once {f.viewOnce ? 'on' : 'off'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => dispatch({ type: 'CANCEL_SEND_MEDIA' })} className="flex-1 py-2 bg-tg-input text-tg-text text-sm rounded-lg">Cancel</button>
          <button onClick={send} disabled={sending} className="flex-1 py-2 bg-tg-accent text-white text-sm rounded-lg disabled:opacity-60">{sending ? 'Sending…' : `Send (${state.pendingMediaFiles.length})`}</button>
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Feature 3: Ghost Mode Toggle (used in Settings)
   ═══════════════════════════════════════════════════════════════ */
export function GhostModeToggle() {
  const { state, dispatch } = useApp();
  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-tg-hover">
      <div className="flex items-center gap-3">
        <Shield size={20} className="text-tg-text-secondary" />
        <div>
          <div className="text-sm text-tg-text">Ghost / Stealth Mode</div>
          <div className="text-xs text-tg-text-secondary">Hides typing indicators & read receipts</div>
        </div>
      </div>
      <button onClick={() => dispatch({ type: 'TOGGLE_GHOST_MODE' })} className={`w-11 h-6 rounded-full transition-colors ${state.currentUser.ghostMode ? 'bg-tg-accent' : 'bg-tg-text-secondary/30'}`}>
        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${state.currentUser.ghostMode ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Feature 5: Group Permissions Panel
   ═══════════════════════════════════════════════════════════════ */
export function GroupPermissionsPanel({ chatId }: { chatId: string }) {
  const { state, dispatch } = useApp();
  const chat = state.chats.find(c => c.id === chatId);
  if (!chat || chat.type !== 'group') return null;
  const perms = chat.permissions || { canSendMedia: true, canSendStickers: true, canEmbedLinks: true, canSendPolls: true };
  const toggle = (key: keyof typeof perms) => dispatch({ type: 'SET_GROUP_PERMISSIONS', chatId, permissions: { ...perms, [key]: !perms[key] } });
  return (
    <div className="py-2">
      <div className="px-4 py-2 text-xs text-tg-text-secondary flex items-center gap-1"><Settings size={12} /> Member Permissions</div>
      {([
        ['canSendMedia', 'Send Media', '📷'],
        ['canSendStickers', 'Send Stickers', '🎭'],
        ['canEmbedLinks', 'Embed Links', '🔗'],
        ['canSendPolls', 'Send Polls', '📊'],
      ] as [keyof typeof perms, string, string][]).map(([key, label, icon]) => (
        <button key={key} onClick={() => toggle(key)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-tg-hover text-left">
          <span>{icon}</span>
          <span className="flex-1 text-sm text-tg-text">{label}</span>
          <div className={`w-9 h-5 rounded-full transition-colors ${perms[key] ? 'bg-tg-accent' : 'bg-tg-text-secondary/30'}`}>
            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mt-0.5 ${perms[key] ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
          </div>
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Feature 6: Welcome Message Editor
   ═══════════════════════════════════════════════════════════════ */
export function WelcomeMessageEditor({ chatId }: { chatId: string }) {
  const { state, dispatch } = useApp();
  const chat = state.chats.find(c => c.id === chatId);
  const [text, setText] = useState(chat?.welcomeMessage || '');
  if (!chat || chat.type !== 'group') return null;
  return (
    <div className="px-4 py-2">
      <div className="text-xs text-tg-text-secondary mb-1 flex items-center gap-1"><MessageSquare size={12} /> Auto Welcome Message</div>
      <textarea value={text} onChange={e => setText(e.target.value)} onBlur={() => dispatch({ type: 'SET_WELCOME_MESSAGE', chatId, text })} placeholder="Welcome to the group! 👋" className="w-full bg-tg-input rounded-lg px-3 py-2 text-xs text-tg-text outline-none resize-none" rows={2} />
    </div>
  );
}
