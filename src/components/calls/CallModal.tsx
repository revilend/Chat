import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getInitials, getAvatarColor } from '../layout/ChatListItem';
import { playCallRingtone } from '../../utils/audio';

export function CallModal() {
  const { state, dispatch, getUser } = useApp();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const chat = state.chats.find(c => c.id === state.callChatId);
  const otherUserId = chat?.members.find(m => m !== 'user_me');
  const otherUser = otherUserId ? getUser(otherUserId) : undefined;

  // Real camera preview for video calls, and a real mic track that mute controls
  useEffect(() => {
    const stopStream = () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    if (state.callType !== 'video' || isVideoOff) { stopStream(); return; }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 640 }, audio: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraError('');
      } catch (err) {
        setCameraError((err as Error).message || 'Camera unavailable');
      }
    })();
    return () => { cancelled = true; stopStream(); };
  }, [state.callType, isVideoOff]);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach(track => { track.enabled = !isMuted; });
  }, [isMuted, isVideoOff]);

  useEffect(() => {
    playCallRingtone();
    const connectTimer = setTimeout(() => setIsConnected(true), 2000);
    return () => clearTimeout(connectTimer);
  }, []);

  useEffect(() => {
    if (!isConnected) return;
    const timer = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(timer);
  }, [isConnected]);

  const formatDuration = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-tg-sidebar rounded-2xl shadow-2xl overflow-hidden text-center"
      >
        {/* Video area (if video call) */}
        {state.callType === 'video' && (
          <div className="h-64 bg-tg-bg flex items-center justify-center relative">
            {!isVideoOff ? (
              <>
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/50 text-[10px] text-white">Your camera{cameraError ? ' • unavailable' : ''}</span>
              </>
            ) : (
              <div className={`w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-semibold ${getAvatarColor(chat?.id || '')}`}>
                {getInitials(otherUser?.name || 'Unknown')}
              </div>
            )}
            <div className="absolute top-3 right-3">
              <button className="p-2 bg-black/30 rounded-full">
                <Maximize2 size={16} className="text-white" />
              </button>
            </div>
          </div>
        )}

        {/* Call info */}
        <div className="py-8 px-4">
          {state.callType !== 'video' && (
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-semibold mx-auto mb-4 ${getAvatarColor(chat?.id || '')} ${isConnected ? '' : 'animate-pulse'}`}>
              {getInitials(otherUser?.name || 'Unknown')}
            </div>
          )}
          <div className="text-lg font-medium text-tg-text">{otherUser?.name || 'Unknown'}</div>
          <div className="text-sm text-tg-text-secondary mt-1">
            {!isConnected ? (state.callType === 'voice' ? '🔊 Ringing...' : '📹 Ringing...') :
             formatDuration(duration)}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 pb-8">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isMuted ? 'bg-tg-red' : 'bg-tg-input hover:bg-tg-hover'
            }`}
          >
            {isMuted ? <MicOff size={22} className="text-white" /> : <Mic size={22} className="text-tg-text" />}
          </button>

          {state.callType === 'video' && (
            <button
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                !isVideoOff ? 'bg-tg-red' : 'bg-tg-input hover:bg-tg-hover'
              }`}
            >
              {isVideoOff ? <VideoOff size={22} className="text-tg-text" /> : <Video size={22} className="text-white" />}
            </button>
          )}

          <button
            onClick={() => setIsSpeaker(!isSpeaker)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isSpeaker ? 'bg-tg-accent' : 'bg-tg-input hover:bg-tg-hover'
            }`}
          >
            {isSpeaker ? <Volume2 size={22} className="text-white" /> : <VolumeX size={22} className="text-tg-text" />}
          </button>

          <button
            onClick={() => dispatch({ type: 'END_CALL' })}
            className="w-14 h-14 rounded-full bg-tg-red flex items-center justify-center hover:bg-tg-red/80 transition-colors"
          >
            <PhoneOff size={22} className="text-white" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
