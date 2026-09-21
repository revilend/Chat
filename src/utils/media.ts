import type { Message, PendingMedia } from '../types';

/** Files above this size are sent as a name-only file message (IndexedDB/state stay healthy). */
export const MAX_INLINE_MEDIA_BYTES = 4 * 1024 * 1024;

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return fileToDataUrl(blob);
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

/** Turns a picked file into a pending-media record with its real contents attached. */
export async function describeFile(file: File): Promise<PendingMedia> {
  const type = file.type || 'application/octet-stream';
  const tooLarge = file.size > MAX_INLINE_MEDIA_BYTES;
  const dataUrl = tooLarge ? undefined : await fileToDataUrl(file);
  return {
    name: file.name,
    type,
    size: file.size,
    dataUrl,
    preview: type.startsWith('image/') ? dataUrl : undefined,
    tooLarge,
  };
}

/** Picks the message type that matches a MIME type. */
export function messageTypeForMime(mime: string): Message['type'] {
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'music';
  return 'file';
}

/** Builds the real message for a confirmed attachment. */
export function messageFromPendingMedia(media: PendingMedia, chatId: string, senderId: string): Message {
  const base: Message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    chatId,
    senderId,
    text: '',
    timestamp: Date.now(),
    type: 'file',
    readBy: [senderId],
  };
  if (!media.dataUrl) {
    return { ...base, type: 'file', text: `📎 ${media.name}`, fileName: media.name, fileSize: media.size };
  }
  const type = messageTypeForMime(media.type);
  if (type === 'photo') return { ...base, type: 'photo', photoUrl: media.dataUrl, text: '', viewOnce: media.viewOnce };
  if (type === 'video') return { ...base, type: 'video', videoUrl: media.dataUrl };
  if (type === 'music') return { ...base, type: 'music', audioUrl: media.dataUrl, musicTitle: media.name.replace(/\.[^.]+$/, '') };
  return { ...base, type: 'file', fileName: media.name, fileUrl: media.dataUrl, fileSize: media.size };
}

/** Encodes raw mono float samples into a 16-bit PCM WAV buffer. */
export function wavArrayBufferFromSamples(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataSize = samples.length * 2;
  const view = new DataView(new ArrayBuffer(44 + dataSize));
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return view.buffer;
}

/** Encodes raw mono float samples into a WAV blob. */
export function encodeWavFromSamples(samples: Float32Array, sampleRate: number): Blob {
  return new Blob([wavArrayBufferFromSamples(samples, sampleRate)], { type: 'audio/wav' });
}

/** Synchronous WAV data URL, used for generated demo audio. */
export function wavDataUrlFromSamples(samples: Float32Array, sampleRate: number): string {
  const view = new Uint8Array(wavArrayBufferFromSamples(samples, sampleRate));
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode(...Array.from(view.subarray(i, i + chunk)));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

/** Builds a short musical tone sequence as a playable WAV data URL (demo audio, no assets needed). */
export function generateToneWavDataUrl(seconds: number, pattern: number[] = [440, 554, 659, 880], sampleRate = 8000): { dataUrl: string; waveform: number[] } {
  const total = Math.floor(seconds * sampleRate);
  const samples = new Float32Array(total);
  const segment = Math.max(1, Math.floor(total / pattern.length));
  for (let i = 0; i < total; i++) {
    const freq = pattern[Math.min(pattern.length - 1, Math.floor(i / segment))];
    const posInSegment = (i % segment) / segment;
    const envelope = Math.min(1, posInSegment / 0.08) * Math.max(0, 1 - posInSegment);
    samples[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.35 * envelope;
  }
  const bars = 40;
  const block = Math.max(1, Math.floor(total / bars));
  const waveform: number[] = [];
  for (let i = 0; i < bars; i++) {
    let max = 0;
    for (let j = 0; j < block && i * block + j < total; j++) max = Math.max(max, Math.abs(samples[i * block + j]));
    waveform.push(Math.max(0.1, max * 3));
  }
  return { dataUrl: wavDataUrlFromSamples(samples, sampleRate), waveform };
}

/** Inline SVG image data URL — used for demo photos. */
export function svgImageDataUrl(title: string, from: string, to: string, emoji: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="480" height="320" fill="url(#g)"/><text x="40" y="150" font-family="sans-serif" font-size="64">${emoji}</text><text x="40" y="220" font-family="sans-serif" font-size="30" fill="#ffffff">${title}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Decodes a data URL / blob URL into an ArrayBuffer for audio processing. */
export async function urlToArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  return response.arrayBuffer();
}
