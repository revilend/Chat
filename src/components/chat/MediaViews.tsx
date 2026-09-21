import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { Play, Pause, Download, FileText, X, Music, ExternalLink } from 'lucide-react';
import { formatBytes } from '../../utils/media';

/* ═══════════════════════════════════════════════════════════════
   Photo — real image with a full-screen lightbox
   ═══════════════════════════════════════════════════════════════ */
export function PhotoView({ url, isMe }: { url: string; isMe: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); setOpen(true); }} className="block rounded-lg overflow-hidden bg-black/20 mb-1">
        <img src={url} alt="" className="max-h-[280px] max-w-full object-cover" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center" onClick={() => setOpen(false)}>
          <img src={url} alt="" className="max-h-[90vh] max-w-[92vw] object-contain" />
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10" onClick={() => setOpen(false)}>
            <X size={20} className="text-white" />
          </button>
          <a
            href={url}
            download
            onClick={e => e.stopPropagation()}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/15 text-white text-sm flex items-center gap-2"
          >
            <Download size={16} /> {isMe ? 'Download' : 'Save'}
          </a>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Video + circular video message (kruglyashok)
   ═══════════════════════════════════════════════════════════════ */
export function VideoView({ url }: { url: string }) {
  return (
    <video src={url} controls playsInline className="rounded-lg max-h-[300px] w-full bg-black/30 mb-1" />
  );
}

export function VideoNoteView({ url }: { url?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasFrame, setHasFrame] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const onTime = () => setProgress(video.duration ? video.currentTime / video.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [url]);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setPlaying(false));
    else video.pause();
  };

  // Logical size for the progress ring; CSS keeps the circle inside a phone screen.
  const size = 190;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  if (!url) {
    return (
      <div className="w-[min(190px,62vw)] h-[min(190px,62vw)] rounded-full bg-black/40 flex items-center justify-center text-center px-6 text-[11px] text-tg-text-secondary">
        Video message not stored on this device
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggle(); }}
      className="relative mb-1 block rounded-full overflow-hidden bg-black shrink-0"
      style={{ width: 'min(190px, 62vw)', height: 'min(190px, 62vw)' }}
      title={playing ? 'Pause video message' : 'Play video message'}
    >
      <video
        ref={ref}
        src={url}
        playsInline
        loop
        preload="auto"
        className="w-full h-full object-cover rounded-full"
        // Draw the recorded first frame immediately, so the circle is never empty.
        onLoadedData={(e) => {
          const video = e.currentTarget;
          setHasFrame(true);
          try { if (video.currentTime === 0) video.currentTime = 0.05; } catch { /* seek not ready yet */ }
        }}
      />
      <svg className="absolute inset-0 -rotate-90 pointer-events-none" viewBox={`0 0 ${size} ${size}`} width="100%" height="100%">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#2481cc" strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} strokeLinecap="round"
        />
      </svg>
      {!playing && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/25">
          <span className="w-12 h-12 rounded-full bg-black/55 flex items-center justify-center">
            <Play size={22} className="text-white ml-0.5" />
          </span>
        </span>
      )}
      {!hasFrame && !playing && (
        <span className="absolute inset-x-0 bottom-3 text-center text-[10px] text-white/70">tap to play</span>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   File — real download
   ═══════════════════════════════════════════════════════════════ */
export function FileView({ url, name, size, isMe }: { url?: string; name: string; size?: number; isMe: boolean }) {
  const content = (
    <>
      <span className={`w-9 h-9 rounded-full flex items-center justify-center ${isMe ? 'bg-white/20' : 'bg-tg-accent/20'}`}>
        <FileText size={18} className={isMe ? 'text-white' : 'text-tg-accent'} />
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-sm truncate">{name}</span>
        <span className={`block text-[10px] ${isMe ? 'text-white/60' : 'text-tg-text-secondary'}`}>
          {size ? formatBytes(size) : 'file'}{url ? ' • tap to download' : ' • not stored'}
        </span>
      </span>
    </>
  );
  if (!url) return <div className="flex items-center gap-2 py-1 min-w-[200px]">{content}</div>;
  return (
    <a href={url} download={name} onClick={e => e.stopPropagation()} className="flex items-center gap-2 py-1 min-w-[200px] hover:opacity-90">
      {content}
      <Download size={16} className={isMe ? 'text-white/70' : 'text-tg-text-secondary'} />
    </a>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Voice message — real audio element + real speed switching
   ═══════════════════════════════════════════════════════════════ */
function clockTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}

export function VoiceView({ messageId }: { messageId: string }) {
  const { state } = useApp();
  const message = state.messages.find(m => m.id === messageId);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [played, setPlayed] = useState(0);
  const [measured, setMeasured] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);

  const isMe = message?.senderId === 'user_me';
  const url = message?.audioUrl;
  const hasAudio = !!url;
  const waveform = message?.audioWaveform && message.audioWaveform.length ? message.audioWaveform : Array.from({ length: 32 }, (_, i) => 0.3 + Math.abs(Math.sin(i / 2)) * 0.6);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setPlayed(audio.currentTime);
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    };
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setMeasured(audio.duration);
    };
    const onPlay = () => { setPlaying(true); setFailed(false); };
    const onPause = () => setPlaying(false);
    const onEnd = () => { setPlaying(false); setProgress(0); setPlayed(0); };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnd);
    if (audio.readyState >= 1) onMeta();
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnd);
    };
  }, [url]);

  // The chosen speed is applied whenever the clip (re)loads, so it survives
  // seeking, pausing and switching chats.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = speed;
  }, [speed, url]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!hasAudio || !audio) return;
    if (audio.paused) {
      audio.playbackRate = speed;
      void audio.play().catch(() => setFailed(true));
    } else {
      audio.pause();
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * audio.duration;
  };

  // 1x / 1.5x / 2x really change the playback rate, and it keeps playing while it changes.
  const changeSpeed = (value: number) => {
    setSpeed(value);
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = value;
    if (audio.paused) return;
    void audio.play().catch(() => setFailed(true));
  };

  const duration = message?.audioDuration || measured || 0;
  const shown = playing || played > 0
    ? `${clockTime(played)} / ${clockTime(duration)}`
    : clockTime(duration);

  return (
    <div className="flex items-center gap-2 py-1 min-w-[210px] max-w-full">
      {url && <audio ref={audioRef} src={url} preload="metadata" />}
      <button onClick={toggle} disabled={!hasAudio} className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50 ${isMe ? 'bg-white/20' : 'bg-tg-accent'}`} title={playing ? 'Pause' : 'Play voice message'}>
        {playing ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-end gap-[2px] h-6 cursor-pointer" onClick={seek}>
          {waveform.slice(0, 32).map((v, i) => (
            <div
              key={i}
              className={`w-[3px] rounded-full ${isMe ? 'bg-white/40' : 'bg-tg-accent/40'} ${i / 32 <= progress ? (isMe ? 'bg-white' : 'bg-tg-accent') : ''}`}
              style={{ height: `${Math.max(3, v * 24)}px` }}
            />
          ))}
        </div>
        <div className={`text-[10px] mt-0.5 flex items-center gap-1 ${isMe ? 'text-white/60' : 'text-tg-text-secondary'}`}>
          <span className="tabular-nums">{shown}</span>
          {message?.voiceEffect && message.voiceEffect !== 'normal' && <span>• {message.voiceEffect}</span>}
          {!hasAudio && <span>• audio not stored</span>}
          {failed && <span className="text-tg-red">• cannot play here</span>}
        </div>
      </div>
      <div className="flex gap-0.5 flex-shrink-0">
        {[1, 1.5, 2].map(value => (
          <button
            key={value}
            onClick={(e) => { e.stopPropagation(); changeSpeed(value); }}
            className={`text-[10px] px-1.5 py-0.5 rounded tabular-nums ${speed === value ? 'bg-tg-accent text-white' : (isMe ? 'bg-white/10 text-white/60' : 'bg-black/10 text-tg-text-secondary')}`}
            title={`Play at ${value}x`}
          >
            {value}x
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Music — starts the sticky mini player that keeps playing
   ═══════════════════════════════════════════════════════════════ */
export function MusicView({ messageId }: { messageId: string }) {
  const { state, dispatch } = useApp();
  const message = state.messages.find(m => m.id === messageId);
  const isMe = message?.senderId === 'user_me';
  const isCurrent = state.nowPlaying?.messageId === messageId;
  const title = message?.musicTitle || message?.fileName || 'Audio';
  const duration = message?.audioDuration || 0;

  return (
    <div className="flex items-center gap-2 py-1 min-w-[210px]">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!message?.audioUrl) return;
          dispatch({
            type: 'SET_NOW_PLAYING',
            nowPlaying: { messageId, chatId: message.chatId, title, url: message.audioUrl, playing: isCurrent ? !state.nowPlaying?.playing : true },
          });
        }}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isMe ? 'bg-white/20' : 'bg-tg-accent'}`}
      >
        {isCurrent && state.nowPlaying?.playing ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate flex items-center gap-1"><Music size={12} /> {title}</div>
        <div className={`text-[10px] ${isMe ? 'text-white/60' : 'text-tg-text-secondary'}`}>{duration ? `${duration}s` : 'audio track'}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sticky mini player — keeps playing while browsing other chats
   ═══════════════════════════════════════════════════════════════ */
export function MusicPlayer() {
  const { state, dispatch, getChat } = useApp();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const playing = state.nowPlaying?.playing ?? false;
  const url = state.nowPlaying?.url;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
    if (playing) void audio.play().catch(() => {});
    else audio.pause();
  }, [playing, url, speed]);

  if (!state.nowPlaying) return null;

  const chat = getChat(state.nowPlaying.chatId);
  const cycleSpeed = () => setSpeed(current => (current >= 2 ? 1 : current === 1 ? 1.5 : 2));

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-tg-header border-b border-black/20 flex-shrink-0">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={e => { const a = e.currentTarget; setProgress(a.duration ? a.currentTime / a.duration : 0); setDuration(a.duration || 0); }}
        onEnded={() => dispatch({ type: 'SET_NOW_PLAYING', nowPlaying: null })}
      />
      <button onClick={() => dispatch({ type: 'TOGGLE_NOW_PLAYING' })} className="w-8 h-8 rounded-full bg-tg-accent flex items-center justify-center flex-shrink-0">
        {playing ? <Pause size={15} className="text-white" /> : <Play size={15} className="text-white ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-tg-text truncate">{state.nowPlaying.title}{chat ? ` — ${chat.name}` : ''}</div>
        <div
          className="h-1 bg-tg-input rounded-full mt-1 cursor-pointer"
          onClick={(e) => {
            const audio = audioRef.current;
            if (!audio || !audio.duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            audio.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * audio.duration;
          }}
        >
          <div className="h-1 bg-tg-accent rounded-full" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <span className="text-[10px] text-tg-text-secondary">{Math.floor(progress * duration)}s</span>
      <button onClick={cycleSpeed} className="text-[10px] px-1.5 py-0.5 rounded bg-tg-input text-tg-text-secondary tabular-nums" title="Playback speed">
        {speed}x
      </button>
      <button onClick={() => dispatch({ type: 'SET_NOW_PLAYING', nowPlaying: null })} className="p-1"><X size={14} className="text-tg-text-secondary" /></button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Link preview — fetch the page and show its real OpenGraph card
   ═══════════════════════════════════════════════════════════════ */
interface Preview { title: string; description: string; image?: string; domain: string; live: boolean }

const previewCache = new Map<string, Preview>();

function parseMeta(html: string, url: string): Omit<Preview, 'live'> {
  const pick = (patterns: RegExp[]): string | undefined => {
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeHtml(match[1].trim());
    }
    return undefined;
  };
  const title = pick([
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
    /<title[^>]*>([^<]+)<\/title>/i,
  ]);
  const description = pick([
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
  ]);
  const image = pick([
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ]);
  let domain = url;
  try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep url */ }
  return { title: title || domain, description: description || '', image: image ? absolutize(image, url) : undefined, domain };
}

function absolutize(src: string, base: string): string {
  try { return new URL(src, base).href; } catch { return src; }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

export function LinkPreviewCard({ url }: { url: string }) {
  const [preview, setPreview] = useState<Preview | null>(previewCache.get(url) ?? null);

  useEffect(() => {
    let cancelled = false;
    if (previewCache.has(url)) { setPreview(previewCache.get(url)!); return; }
    const load = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'text/html' } });
        clearTimeout(timeout);
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !contentType.includes('html')) throw new Error('not html');
        const html = (await response.text()).slice(0, 200_000);
        const parsed: Preview = { ...parseMeta(html, url), live: true };
        previewCache.set(url, parsed);
        if (!cancelled) setPreview(parsed);
      } catch {
        // CORS-blocked or offline: fall back to a domain card instead of a broken preview
        let domain = url;
        try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep url */ }
        const fallback: Preview = { title: domain, description: 'Preview unavailable offline', domain, live: false };
        previewCache.set(url, fallback);
        if (!cancelled) setPreview(fallback);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [url]);

  if (!preview) {
    return <div className="bg-tg-bg/50 rounded-lg mt-1 border border-black/10 p-2 text-[11px] text-tg-text-secondary">Loading preview…</div>;
  }

  return (
    <a href={url} target="_blank" rel="noreferrer noopener" onClick={e => e.stopPropagation()} className="block bg-tg-bg/50 rounded-lg overflow-hidden mt-1 border border-black/10 hover:bg-tg-bg/70 transition-colors">
      {preview.image ? (
        <img src={preview.image} alt="" className="w-full h-28 object-cover bg-tg-input" />
      ) : (
        <div className="h-16 bg-tg-input flex items-center justify-center"><ExternalLink size={22} className="text-tg-text-secondary" /></div>
      )}
      <div className="p-2">
        <div className="text-[10px] text-tg-accent uppercase flex items-center gap-1">
          <ExternalLink size={10} /> {preview.domain}{preview.live ? '' : ' • offline'}
        </div>
        <div className="text-xs text-tg-text font-medium line-clamp-2">{preview.title}</div>
        {preview.description && <div className="text-[11px] text-tg-text-secondary line-clamp-2 mt-0.5">{preview.description}</div>}
      </div>
    </a>
  );
}
