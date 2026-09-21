import { useApp } from '../../store/AppContext';
import type { Chat } from '../../types';
import { Pin, Volume2, Users, VolumeX, Check, CheckCheck, Bookmark } from 'lucide-react';

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function getAvatarColor(id: string): string {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
    'bg-pink-500', 'bg-orange-500',
  ];
  let hash = 0;
  for (const c of id) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length];
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

  const displayName = chat.type === 'saved' ? 'Saved Messages' : chat.name;

  return (
    <button
      onClick={() => dispatch({ type: 'SET_ACTIVE_CHAT', chatId: chat.id })}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
      className={`w-full flex items-center gap-3 px-3 py-1.5 transition-colors text-left ${
        isActive ? 'bg-tg-accent/30' : 'hover:bg-tg-hover'
      }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className={`w-[54px] h-[54px] rounded-full flex items-center justify-center text-white font-semibold text-lg ${
          chat.type === 'saved' ? 'bg-tg-accent' : getAvatarColor(chat.id)
        }`}>
          {chat.type === 'saved' ? (
            <Bookmark size={24} fill="white" />
          ) : chat.type === 'group' ? (
            <Users size={24} />
          ) : chat.type === 'channel' ? (
            <Volume2 size={24} />
          ) : (
            getInitials(chat.name)
          )}
        </div>
        {isOnline && !isBot && (
          <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-tg-online rounded-full border-2 border-tg-sidebar" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {chat.type === 'channel' && <Volume2 size={14} className="text-tg-text-secondary flex-shrink-0" />}
            {isBot && <span className="text-tg-accent text-xs">🤖</span>}
            <span className={`text-sm font-medium truncate ${chat.draft ? 'text-tg-red' : 'text-tg-text'}`}>
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
            <span className={`text-xs ${chat.unreadCount > 0 ? 'text-tg-accent' : 'text-tg-text-secondary'}`}>
              {formatTime(chat.lastMessage?.timestamp)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-0.5">
          <div className="flex-1 min-w-0">
            {chat.isTyping ? (
              <span className="text-sm text-tg-accent">{chat.typingUserId === 'user_helper_bot' ? '🤖 typing...' : 'typing...'}</span>
            ) : chat.draft ? (
              <span className="text-sm text-tg-red">Draft: {chat.draft}</span>
            ) : chat.lastMessage ? (
              <p className="text-xs text-tg-text-secondary truncate">
                {chat.lastMessage.senderId === 'user_me' && <span className="text-tg-text-secondary">You: </span>}
                {chat.type === 'group' && chat.lastMessage.senderId !== 'user_me' && (
                  <span className="text-tg-accent">{getUser(chat.lastMessage.senderId)?.name?.split(' ')[0]}: </span>
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
              <span className={`min-w-[20px] h-[20px] rounded-full text-[11px] font-medium flex items-center justify-center px-1.5 ${
                chat.isMuted ? 'bg-tg-text-secondary/30 text-tg-text-secondary' : 'bg-tg-accent text-white'
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
