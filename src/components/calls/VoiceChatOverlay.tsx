import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { Phone, Hand, Mic, MicOff, X } from 'lucide-react';
import { getInitials, getAvatarColor } from '../layout/ChatListItem';

export function VoiceChatOverlay() {
  const { state, dispatch, getUser, getChat } = useApp();
  const [muted, setMuted] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  const chat = getChat(state.voiceChatChatId || '');
  const participants = chat ? chat.members : ['user_me'];
  // Rotate the speaking highlight through the people in the room
  const speakers = participants.filter(id => id !== 'user_me');
  const activeSpeaker = speakers[Math.floor(Date.now() / 4000) % Math.max(1, speakers.length)] || 'user_me';

  return (
    <div className="bg-tg-sidebar/95 backdrop-blur-sm border-t border-black/20 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 bg-tg-green rounded-full animate-pulse" />
        <span className="text-xs text-tg-accent font-medium">🔴 Live Voice Chat{chat ? ` — ${chat.name}` : ''}</span>
        <span className="text-[10px] text-tg-text-secondary">{participants.length} in room</span>
        <div className="flex-1" />
        <button
          onClick={() => dispatch({ type: 'END_VOICE_CHAT' })}
          className="p-1 rounded-full hover:bg-tg-hover"
        >
          <X size={16} className="text-tg-text-secondary" />
        </button>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {participants.map(userId => {
          const user = getUser(userId);
          const isActive = activeSpeaker === userId;
          return (
            <div key={userId} className="flex flex-col items-center gap-1 flex-shrink-0">
              <div
                style={{ background: getAvatarColor(userId) }}
                className={`relative w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-semibold ${isActive ? 'glow-ring ring-2 ring-tg-green' : ''}`}>
                {getInitials(user?.name || '?')}
                {isActive && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-tg-green rounded-full border-2 border-tg-sidebar" />
                )}
              </div>
              <span className="text-[10px] text-tg-text-secondary truncate max-w-[50px]">
                {user?.name?.split(' ')[0] || '?'}{userId === 'user_me' ? ' (you)' : ''}
              </span>
              {userId === 'user_me' && handRaised && <span className="text-xs">✋</span>}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-3 mt-2">
        <button onClick={() => setMuted(m => !m)} className={`p-2 rounded-full transition-colors ${muted ? 'bg-tg-red/80' : 'bg-tg-input hover:bg-tg-hover'}`} title={muted ? 'Unmute' : 'Mute'}>
          {muted ? <MicOff size={18} className="text-white" /> : <Mic size={18} className="text-tg-text" />}
        </button>
        <button onClick={() => setHandRaised(h => !h)} className={`p-2 rounded-full transition-colors ${handRaised ? 'bg-amber-500/80' : 'bg-tg-input hover:bg-tg-hover'}`} title="Raise hand">
          <Hand size={18} className={handRaised ? 'text-white' : 'text-tg-text'} />
        </button>
        <button
          onClick={() => dispatch({ type: 'END_VOICE_CHAT' })}
          className="p-2 rounded-full bg-tg-red hover:bg-tg-red/80"
        >
          <Phone size={18} className="text-white" />
        </button>
      </div>
    </div>
  );
}
