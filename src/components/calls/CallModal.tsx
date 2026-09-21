import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { PhoneOff, Phone, Mic, MicOff, Video, VideoOff, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { MediaConnection } from 'peerjs';
import { getInitials, getAvatarColor } from '../layout/ChatListItem';
import { network } from '../../net/network';
import { playCallRingtone } from '../../utils/audio';

/**
 * A real call between two devices.
 *
 * The microphone (and camera for a video call) is captured here and handed to the
 * peer-to-peer connection, and whatever the other person sends back is played in
 * the remote audio/video element. Nothing is simulated: when the other side is
 * not reachable, the call says so instead of pretending to connect.
 */
export function CallModal() {
  const { state, dispatch, getUser } = useApp();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [duration, setDuration] = useState(0);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState('');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const connectionRef = useRef<MediaConnection | null>(null);

  const incoming = state.incomingCall;
  const callChatId = incoming ? `chat_peer_${incoming.userId}` : state.callChatId;
  const chat = state.chats.find(c => c.id === callChatId);
  const otherUserId = incoming?.userId ?? chat?.members.find(m => m !== 'user_me');
  const otherUser = otherUserId ? getUser(otherUserId) : undefined;
  const callType: 'voice' | 'video' = incoming ? (incoming.video ? 'video' : 'voice') : state.callType;
  const ringing = !connected && !incoming;

  const stopLocalStream = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  }, []);

  /** Captures the microphone (and camera) — the same stream the other person gets. */
  const captureStream = useCallback(async (withVideo: boolean): Promise<MediaStream | null> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice('This browser cannot reach your microphone or camera.');
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        withVideo ? { video: { facingMode: 'user', width: 480, height: 640 }, audio: true } : { audio: true }
      );
      localStreamRef.current = stream;
      if (withVideo && localVideoRef.current) localVideoRef.current.srcObject = stream;
      stream.getAudioTracks().forEach(track => { track.enabled = !isMuted; });
      return stream;
    } catch (err) {
      const name = (err as DOMException).name;
      setNotice(name === 'NotAllowedError'
        ? 'Microphone access was blocked — allow it in your browser settings to talk.'
        : (err as Error).message || 'Could not open your microphone.');
      return null;
    }
  }, [isMuted]);

  /** Plays whatever arrives from the other device. */
  const attachRemote = useCallback((remote: MediaStream) => {
    if (!remote) return;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remote;
      remoteAudioRef.current.muted = !speaker;
      void remoteAudioRef.current.play().catch(() => { /* needs another tap */ });
    }
    if (remoteVideoRef.current && remote.getVideoTracks().length > 0) {
      remoteVideoRef.current.srcObject = remote;
      void remoteVideoRef.current.play().catch(() => { /* ignore */ });
    }
    setConnected(true);
    setNotice('');
  }, [speaker]);

  // ── Outgoing call: ring the other person for real ──────────────────────────
  useEffect(() => {
    if (incoming) return; // the other branch answers instead
    let cancelled = false;

    (async () => {
      if (!otherUserId) { setNotice('This chat has nobody to call.'); return; }
      if (!network.isOnline(otherUserId)) {
        setNotice('They are offline — the call needs both devices to be online.');
        return;
      }
      const stream = await captureStream(callType === 'video');
      if (cancelled || !stream) return;

      const connection = network.call(otherUserId, stream, callType === 'video');
      if (!connection) {
        setNotice('Could not reach them. Try again in a moment.');
        return;
      }
      connectionRef.current = connection;
      connection.on('stream', attachRemote);
      connection.on('close', () => { if (!cancelled) dispatch({ type: 'END_CALL' }); });
      connection.on('error', () => setNotice('The call dropped.'));

      // Nobody picked up
      const noAnswer = setTimeout(() => {
        if (!cancelled && !connectionRef.current?.open) {
          setNotice('No answer.');
          dispatch({ type: 'END_CALL' });
        }
      }, 30000);
      connection.on('close', () => clearTimeout(noAnswer));
    })();

    return () => {
      cancelled = true;
      stopLocalStream();
      network.hangUpCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUserId, callType, incoming !== null]);

  // The waiting side hears ringing until somebody picks up.
  useEffect(() => {
    if (!ringing) return;
    playCallRingtone();
  }, [ringing]);

  useEffect(() => {
    if (!connected) return;
    const timer = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(timer);
  }, [connected]);

  useEffect(() => {
    localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = !isMuted; });
  }, [isMuted]);

  useEffect(() => {
    if (remoteAudioRef.current) remoteAudioRef.current.muted = !speaker;
  }, [speaker]);

  const hangUp = () => {
    connectionRef.current?.close();
    network.hangUpCall();
    stopLocalStream();
    dispatch({ type: 'END_CALL' });
  };

  /** Answering a call that is ringing here. */
  const answer = async () => {
    if (!incoming) return;
    const stream = await captureStream(incoming.video);
    if (!stream) {
      network.hangUpCall();
      dispatch({ type: 'END_CALL' });
      return;
    }
    connectionRef.current = incoming.connection;
    const remote = incoming.connection.metadata as { video?: boolean } | undefined;
    network.answer(incoming.connection, stream);
    incoming.connection.on('stream', attachRemote);
    incoming.connection.on('close', () => dispatch({ type: 'END_CALL' }));
    // Video calls pull their own local preview straight away
    if (remote?.video && localVideoRef.current) localVideoRef.current.srcObject = stream;
    dispatch({ type: 'INCOMING_CALL', userId: incoming.userId, connection: incoming.connection, video: incoming.video });
    setNotice('');
  };

  const decline = () => {
    network.hangUpCall();
    dispatch({ type: 'END_CALL' });
  };

  const status = () => {
    if (notice) return notice;
    if (incoming && !connected) return callType === 'video' ? '📹 Incoming video call…' : '🔊 Incoming call…';
    if (ringing) return callType === 'video' ? '📹 Ringing…' : '🔊 Ringing…';
    return formatDuration(duration);
  };

  const formatDuration = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const audioOnly = callType === 'voice';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3">
      {/* Whatever the other person is sending is played here */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm card overflow-hidden text-center"
      >
        {callType === 'video' && (
          <div className="relative h-64 bg-tg-bg">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            {!connected && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div style={{ background: getAvatarColor(chat?.id || '') }} className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-semibold">
                  {getInitials(otherUser?.name || 'Unknown')}
                </div>
              </div>
            )}
            {/* Your own camera, small in the corner */}
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`absolute bottom-2 right-2 w-24 h-32 rounded-lg object-cover bg-black ${isVideoOff ? 'hidden' : ''}`}
            />
            <button
              onClick={() => { setIsVideoOff(v => !v); if (isVideoOff) void captureStream(true); }}
              className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/50 text-[10px] text-white"
            >
              {isVideoOff ? 'Camera off' : 'Your camera'}
            </button>
          </div>
        )}

        <div className="py-8 px-4">
          {audioOnly && (
            <div style={{ background: getAvatarColor(chat?.id || '') }} className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-semibold mx-auto mb-4 ${connected ? '' : 'animate-pulse'}`}>
              {getInitials(otherUser?.name || 'Unknown')}
            </div>
          )}
          <div className="text-lg font-medium text-tg-text">{otherUser?.name || 'Unknown'}</div>
          <div className={`text-sm mt-1 ${notice ? 'text-amber-400' : 'text-tg-text-secondary'}`}>{status()}</div>
        </div>

        {incoming && !connected && !notice ? (
          <div className="flex items-center justify-center gap-6 pb-8">
            <button onClick={decline} className="w-14 h-14 rounded-full bg-tg-red flex items-center justify-center hover:bg-tg-red/80 transition-colors" title="Decline">
              <PhoneOff size={22} className="text-white" />
            </button>
            <button onClick={answer} className="w-14 h-14 rounded-full bg-tg-green flex items-center justify-center hover:opacity-90 transition-colors" title="Accept">
              <Phone size={22} className="text-white" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4 pb-8">
            <button
              onClick={() => setIsMuted(m => !m)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-tg-red' : 'bg-tg-input hover:bg-tg-hover'}`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff size={22} className="text-white" /> : <Mic size={22} className="text-tg-text" />}
            </button>

            {callType === 'video' && (
              <button
                onClick={() => { const off = !isVideoOff; setIsVideoOff(off); if (!off) void captureStream(true); }}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isVideoOff ? 'bg-tg-red' : 'bg-tg-input hover:bg-tg-hover'}`}
                title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
              >
                {isVideoOff ? <VideoOff size={22} className="text-white" /> : <Video size={22} className="text-tg-text" />}
              </button>
            )}

            <button
              onClick={() => setSpeaker(s => !s)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${speaker ? 'bg-tg-accent' : 'bg-tg-input hover:bg-tg-hover'}`}
              title={speaker ? 'Mute the other side' : 'Hear the other side'}
            >
              {speaker ? <Volume2 size={22} className="text-white" /> : <VolumeX size={22} className="text-tg-text" />}
            </button>

            <button onClick={hangUp} className="w-14 h-14 rounded-full bg-tg-red flex items-center justify-center hover:bg-tg-red/80 transition-colors" title="Hang up">
              <PhoneOff size={22} className="text-white" />
            </button>
          </div>
        )}

        {notice && (
          <div className="px-4 pb-6 -mt-2">
            <button onClick={hangUp} className="text-xs text-tg-text-secondary hover:text-tg-text flex items-center gap-1 mx-auto">
              <Maximize2 size={12} /> Close
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
