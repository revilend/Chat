import { urlToArrayBuffer, encodeWavFromSamples } from './media';

export type VoiceEffect = 'normal' | 'robot' | 'deep' | 'chipmunk';

export const VOICE_EFFECTS: { id: VoiceEffect; label: string; icon: string }[] = [
  { id: 'normal', label: 'Normal', icon: '🎤' },
  { id: 'robot', label: 'Robot', icon: '🤖' },
  { id: 'deep', label: 'Deep Bass', icon: '🎸' },
  { id: 'chipmunk', label: 'Chipmunk', icon: '🐿️' },
];

function getAudioContextCtor(): typeof AudioContext | null {
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext || w.webkitAudioContext || null;
}

export async function decodeAudioUrl(url: string): Promise<AudioBuffer> {
  const Ctor = getAudioContextCtor();
  if (!Ctor) throw new Error('Web Audio API is not available');
  const ctx = new Ctor();
  const buffer = await ctx.decodeAudioData(await urlToArrayBuffer(url));
  await ctx.close();
  return buffer;
}

/** Peak data (0..1) used to draw a real waveform for the recorded audio. */
export function waveformFromBuffer(buffer: AudioBuffer, bars = 40): number[] {
  const channel = buffer.getChannelData(0);
  const block = Math.max(1, Math.floor(channel.length / bars));
  const peaks: number[] = [];
  for (let i = 0; i < bars; i++) {
    let max = 0;
    const start = i * block;
    for (let j = 0; j < block && start + j < channel.length; j++) {
      const v = Math.abs(channel[start + j]);
      if (v > max) max = v;
    }
    peaks.push(max);
  }
  const loudest = Math.max(...peaks, 0.001);
  return peaks.map(p => Math.max(0.08, Math.min(1, p / loudest)));
}

/** 16-bit PCM mono WAV encoder so processed audio can be stored and replayed. */
export function encodeWav(buffer: AudioBuffer): Blob {
  return encodeWavFromSamples(buffer.getChannelData(0), buffer.sampleRate);
}

export interface ProcessOptions {
  effect: VoiceEffect;
  /** Trim window in seconds (defaults to the whole clip) */
  start?: number;
  end?: number;
}

/**
 * Really applies the selected voice effect and trim by re-rendering the clip
 * offline: pitch/speed via playbackRate, bass via a low-shelf boost and
 * robot via ring modulation.
 */
export async function processVoiceClip(url: string, { effect, start = 0, end }: ProcessOptions): Promise<{ dataUrl: string; duration: number; waveform: number[] }> {
  const decoded = await decodeAudioUrl(url);
  const sourceDuration = decoded.duration;
  const from = Math.max(0, Math.min(start, sourceDuration));
  const to = Math.max(from + 0.05, Math.min(end ?? sourceDuration, sourceDuration));
  const clipLength = to - from;
  const rate = effect === 'chipmunk' ? 1.45 : effect === 'deep' ? 0.75 : 1;
  const Ctor = getAudioContextCtor();
  if (!Ctor) throw new Error('Web Audio API is not available');

  const ctx = new OfflineAudioContext(1, Math.ceil(clipLength / rate * decoded.sampleRate), decoded.sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = decoded;
  source.playbackRate.value = rate;

  let node: AudioNode = source;
  if (effect === 'deep') {
    const shelf = ctx.createBiquadFilter();
    shelf.type = 'lowshelf';
    shelf.frequency.value = 320;
    shelf.gain.value = 9;
    node.connect(shelf);
    node = shelf;
  }
  if (effect === 'robot') {
    const ring = ctx.createGain();
    ring.gain.value = 1;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 45;
    const depth = ctx.createGain();
    depth.gain.value = 0.6;
    osc.connect(depth);
    depth.connect(ring.gain);
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1200;
    bandpass.Q.value = 0.8;
    osc.start(0);
    node.connect(ring);
    ring.connect(bandpass);
    node = bandpass;
  }
  node.connect(ctx.destination);
  source.start(0, from, clipLength);

  const rendered = await ctx.startRendering();
  const wav = encodeWav(rendered);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(wav);
  });
  return { dataUrl, duration: Math.round(rendered.duration), waveform: waveformFromBuffer(rendered, 40) };
}

/** Records microphone audio with MediaRecorder and exposes a live level meter. */
export class VoiceCapture {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private ctx: AudioContext | null = null;

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone is not available in this browser');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''].find(t => !t || MediaRecorder.isTypeSupported(t));
    this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.recorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
    this.recorder.start();

    const Ctor = getAudioContextCtor();
    if (Ctor) {
      this.ctx = new Ctor();
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 256;
      this.ctx.createMediaStreamSource(this.stream).connect(analyser);
      this.analyser = analyser;
    }
  }

  /** Current input loudness, 0..1 — drives the live recording bars. */
  level(): number {
    if (!this.analyser) return 0.3;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
    return Math.min(1, Math.max(0.08, avg / 120));
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const recorder = this.recorder;
      if (!recorder) { reject(new Error('Not recording')); return; }
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' });
        this.cleanup();
        if (blob.size === 0) reject(new Error('Nothing was recorded'));
        else resolve(blob);
      };
      recorder.stop();
    });
  }

  cancel() {
    try { this.recorder?.stop(); } catch { /* already stopped */ }
    this.cleanup();
  }

  private cleanup() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.analyser = null;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.recorder = null;
  }
}

/** Records a circular video message from the camera. */
export class VideoNoteCapture {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  getStream(): MediaStream | null { return this.stream; }

  async start(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera is not available in this browser');
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 480 }, audio: true });
    this.chunks = [];
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', ''].find(t => !t || MediaRecorder.isTypeSupported(t));
    this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.recorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
    this.recorder.start();
    return this.stream;
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const recorder = this.recorder;
      if (!recorder) { reject(new Error('Not recording')); return; }
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: recorder.mimeType || 'video/webm' });
        this.cleanup();
        if (blob.size === 0) reject(new Error('Nothing was recorded'));
        else resolve(blob);
      };
      recorder.stop();
    });
  }

  cancel() {
    try { this.recorder?.stop(); } catch { /* already stopped */ }
    this.cleanup();
  }

  private cleanup() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.recorder = null;
  }
}
