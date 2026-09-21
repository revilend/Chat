import { useApp } from '../../store/AppContext';
import type { Chat } from '../../types';
import { Pin, Volume2, Users, VolumeX, Check, CheckCheck, Bookmark } from 'lucide-react';
import { UserAvatar } from '../shared/UserAvatar';
import { displayNameFor } from '../../utils/identity';

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// Telegram's own avatar gradients — red, orange, violet, sky, green, pink, lime,
// amber. The pick is derived from the name, so one person keeps one colour.
const avatarPalette = [
  'linear-gradient(135deg, #ff885e, #ff516a)',
  'linear-gradient(135deg, #ffcd6a, #ffa85c)',
  'linear-gradient(135deg, #a695ff, #8f7bff)',
  'linear-gradient(135deg, #6fd8ff, #52b6ff)',
  'linear-gradient(135deg, #62c5a8, #3eb489)',
  'linear-gradient(135deg, #ff9ecb, #ff6fa5)',
  'linear-gradient(135deg, #7fd1f7, #4aa8f0)',
  'linear-gradient(135deg, #b7c0cd, #8b98a8)',
  'linear-gradient(135deg, #ffb26b, #ff8a3d)',
  'linear-gradient(135deg, #9be36b, #5fc23a)',
];

function getAvatarColor(seed: string): string {
  let hash = 0;
  for (const c of seed) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
  return avatarPalette[Math.abs(hash) % avatarPalette.length];
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 86400000 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 172800000) return 'Yesterday';
  if (diff < 604800000) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ChatListItem({ chat }: { chat: Chat }) {
  const { state, dispatch, getUser } = useApp();
  const isActive = state.activeChatId === chat.id;
  const otherUser = chat.type === 'private' ? getUser(chat.members.find(m => m !== 'user_me') || '') : undefined;
  const isOnline = otherUser?.isOnline;
  const isBot = chat.name === 'Helper Bot';

  // A leftover 32-character address never reaches the screen as a name.
  const peerId = chat.members.find(m => m !== 'user_me' && m !== 'user_helper_bot');
  const displayName = chat.type === 'saved' ? 'Saved Messages' : displayNameFor(chat.name, peerId);

  return (
    <button
      onClick={() => dispatch({ type: 'SET_ACTIVE_CHAT', chatId: chat.id })}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
      className={`w-full flex items-center gap-3 px-2.5 py-2.5 text-left rounded-2xl transition-all ${
        isActive
          ? 'text-white shadow-lg'
          : 'hover:bg-tg-hover active:bg-tg-hover'
      }`}
      style={isActive ? { background: 'linear-gradient(150deg, #3a9bea 0%, #2b86d6 60%, #2478c4 100%)', boxShadow: '0 8px 22px rgba(36, 129, 204, 0.32)' } : undefined}
    >
      {/* Avatar — the person's own photo when they have one */}
      <div className="relative flex-shrink-0">
        <UserAvatar
          name={otherUser?.name || displayName}
          id={otherUser?.id || chat.id}
          avatar={otherUser?.avatar}
          avatarColor={chat.type === 'saved' ? 'linear-gradient(135deg, #52b6ff, #3390ec)' : otherUser?.avatarColor}
          size={54}
          className={isActive ? 'ring-1 ring-white/25' : ''}
        >
          {chat.type === 'saved' ? <Bookmark size={24} fill="white" />
            : chat.type === 'group' ? <Users size={24} />
              : chat.type === 'channel' ? <Volume2 size={24} />
                : undefined}
        </UserAvatar>
        {isOnline && !isBot && (
          <div className="online-dot absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {chat.type === 'channel' && <Volume2 size={14} className="text-tg-text-secondary flex-shrink-0" />}
            {isBot && <span className="text-tg-accent text-xs">🤖</span>}
            <span className={`text-[15px] font-medium truncate ${chat.draft ? 'text-tg-red' : ''}`}>
              {displayName}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-1">
            {chat.lastMessage?.senderId === 'user_me' && !chat.isTyping && (
              chat.lastMessage.readBy.length > 1 ? (
                <CheckCheck size={16} className="text-tg-accent" />
              ) : (
                <Check size={16} className="text-tg-text-secondary" />
              )
            )}
            <span className={`text-[11px] shrink-0 ${chat.unreadCount > 0 && !isActive ? 'text-tg-accent' : isActive ? 'text-white/70' : 'text-tg-text-secondary'}`}>
              {formatTime(chat.lastMessage?.timestamp)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-0.5">
          <div className="flex-1 min-w-0">
            {chat.isTyping ? (
              <span className={`text-[13px] ${isActive ? 'text-white' : 'text-tg-accent'}`}>{chat.typingUserId === 'user_helper_bot' ? '🤖 typing…' : 'typing…'}</span>
            ) : chat.draft ? (
              <span className="text-[13px] text-tg-red">Draft: {chat.draft}</span>
            ) : chat.lastMessage ? (
              <p className={`text-[13px] truncate ${isActive ? 'text-white/80' : 'text-tg-text-secondary'}`}>
                {chat.lastMessage.senderId === 'user_me' && <span>You: </span>}
                {chat.type === 'group' && chat.lastMessage.senderId !== 'user_me' && (
                  <span className={isActive ? 'text-white' : 'text-tg-accent'}>{getUser(chat.lastMessage.senderId)?.name?.split(' ')[0]}: </span>
                )}
                {chat.lastMessage.type === 'voice' ? '🎤 Voice message' :
                 chat.lastMessage.type === 'photo' ? '📷 Photo' :
                 chat.lastMessage.type === 'poll' ? `📊 ${chat.lastMessage.poll?.question}` :
                 chat.lastMessage.text.slice(0, 50)}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            {chat.isPinned && !chat.unreadCount && (
              <Pin size={14} className="text-tg-text-secondary" />
            )}
            {chat.isMuted && (
              <VolumeX size={14} className="text-tg-text-secondary" />
            )}
            {chat.unreadCount > 0 && (
              <span className={`min-w-[22px] h-[22px] rounded-full text-[12px] font-semibold flex items-center justify-center px-1.5 ${
                chat.isMuted ? 'bg-tg-text-secondary/30 text-tg-text-secondary' : isActive ? 'bg-white text-tg-accent' : 'bg-tg-accent text-white'
              }`}>
                {chat.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export { getInitials, getAvatarColor, formatTime };
