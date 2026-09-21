import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import type { Chat } from '../../types';
import { ArrowLeft, Search, Phone, Video, MoreVertical, Users, Volume2, Pin, PinOff, VolumeX, Volume2Icon, Archive, Trash2, Bookmark, Trophy, UserPlus, Calendar, Printer } from 'lucide-react';
import { getInitials, getAvatarColor } from '../layout/ChatListItem';
import { SearchNavigator, usePrintChat } from '../features/AdvancedFeatures';
import { BoostModal } from '../modals/FeatureModals';

export function ChatHeader({ chat }: { chat: Chat }) {
  const { dispatch, getUser, t } = useApp();
  const printChat = usePrintChat();
  const [showBoost, setShowBoost] = useState(false);
  const isMember = chat.members.includes('user_me');
  const [showMenu, setShowMenu] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchText, setSearchText] = useState('');

  const otherUserId = chat.members.find(m => m !== 'user_me');
  const otherUser = otherUserId ? getUser(otherUserId) : undefined;
  const isBot = chat.name === 'Helper Bot';

  const getStatusText = () => {
    if (chat.isTyping) return t('typing');
    if (chat.type === 'saved') return 'cloud storage';
    if (chat.type === 'group') return `${chat.members.length} ${t('members')}`;
    if (chat.type === 'channel') return `${chat.subscribers || 0} ${t('subscribers')}`;
    if (isBot) return '🤖 bot';
    if (otherUser?.isOnline) return t('online');
    if (otherUser?.lastSeen) { const diff = Date.now() - otherUser.lastSeen; if (diff < 300000) return t('recently'); return `${t('lastSeen')} ${new Date(otherUser.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`; }
    return '';
  };

  return (
    <div className="flex items-center gap-1 h-[56px] px-1.5 sm:px-2 bg-tg-header border-b border-black/25 flex-shrink-0 min-w-0">
      <button onClick={() => dispatch({ type: 'SET_ACTIVE_CHAT', chatId: null })} className="icon-btn md:hidden" title="Back"><ArrowLeft size={20} /></button>
      <button onClick={() => dispatch({ type: 'TOGGLE_PROFILE' })} className="flex items-center gap-2.5 px-1.5 py-1 hover:bg-tg-hover rounded-xl transition-colors min-w-0">
        <div className="relative shrink-0">
          <div
            style={{ background: chat.type === 'saved' ? 'linear-gradient(135deg, #52b6ff, #3390ec)' : getAvatarColor(chat.id) }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
          >
            {chat.type === 'saved' ? '🔖' : chat.type === 'group' ? <Users size={18} /> : chat.type === 'channel' ? <Volume2 size={18} /> : getInitials(chat.name)}
          </div>
          {otherUser?.isOnline && !isBot && chat.type === 'private' && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-tg-online rounded-full border-2 border-tg-header" />}
        </div>
        <div className="text-left min-w-0">
          <div className="text-sm font-medium text-tg-text flex items-center gap-1 truncate">{chat.name}{isBot && <span className="text-tg-accent text-xs">🤖</span>}</div>
          <div className={`text-xs truncate ${otherUser?.isOnline ? 'text-tg-accent' : 'text-tg-text-secondary'}`}>{getStatusText()}</div>
        </div>
      </button>

      <div className="flex-1 min-w-2" />

      {searchMode ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-tg-input rounded-full px-3 h-8">
            <Search size={14} className="text-tg-text-secondary mr-2" />
            <input type="text" value={searchText} onChange={e => { setSearchText(e.target.value); dispatch({ type: 'SET_SEARCH', query: e.target.value }); }} placeholder="Search..." autoFocus className="bg-transparent outline-none text-tg-text text-xs w-32 placeholder:text-tg-text-secondary" />
            <button onClick={() => { setSearchMode(false); setSearchText(''); dispatch({ type: 'SET_SEARCH', query: '' }); dispatch({ type: 'SET_SEARCH_HITS', hits: [], index: -1 }); }}><span className="text-tg-text-secondary text-xs ml-2">✕</span></button>
          </div>
          <SearchNavigator />
        </div>
      ) : (
        <>
          <button onClick={() => setSearchMode(true)} className="icon-btn" title="Search in chat"><Search size={20} /></button>
          {/* Feature 11: Calendar */}
          {chat.type === 'channel' && <button onClick={() => dispatch({ type: 'TOGGLE_CALENDAR_VIEWER' })} className="icon-btn hidden sm:inline-flex" title="Browse by date"><Calendar size={20} /></button>}
          {chat.type === 'private' && <>
            <button onClick={() => dispatch({ type: 'START_CALL', chatId: chat.id, callType: 'voice' })} className="icon-btn" title="Voice call"><Phone size={20} /></button>
            <button onClick={() => dispatch({ type: 'START_CALL', chatId: chat.id, callType: 'video' })} className="icon-btn hidden sm:inline-flex" title="Video call"><Video size={20} /></button>
          </>}
          {/* Group live voice chat */}
          {chat.type === 'group' && <button onClick={() => dispatch({ type: 'START_VOICE_CHAT', chatId: chat.id })} title="Start Voice Chat" className="icon-btn"><Volume2 size={20} /></button>}
          {/* Private channel: apply to join */}
          {chat.type === 'channel' && !isMember && (
            (chat.pendingJoinRequests || []).includes('user_me')
              ? <span className="px-3 py-1 text-xs text-amber-400">Request pending…</span>
              : <button onClick={() => dispatch({ type: 'REQUEST_TO_JOIN', chatId: chat.id, userId: 'user_me' })} className="px-3 py-1.5 bg-tg-accent text-white text-xs rounded-full hover:bg-tg-accent-hover transition-colors">Apply to Join</button>
          )}
        </>
      )}

      {/* Feature 8: Bookmarks button */}
      <button onClick={() => dispatch({ type: 'TOGGLE_BOOKMARKS_VIEW' })} className="icon-btn hidden sm:inline-flex" title="Bookmarks"><Bookmark size={20} /></button>

      <div className="relative shrink-0">
        <button onClick={() => setShowMenu(!showMenu)} className="icon-btn" title="More"><MoreVertical size={20} /></button>
        {showMenu && <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 w-60 card z-50 py-1.5">
            {chat.type === 'group' && <MenuItem icon={<Users size={16} />} label={`${chat.members.length} ${t('members')}`} onClick={() => setShowMenu(false)} />}
            <MenuItem icon={chat.isPinned ? <PinOff size={16} /> : <Pin size={16} />} label={chat.isPinned ? t('unpinChat') : t('pinChat')} onClick={() => { dispatch({ type: 'PIN_CHAT', chatId: chat.id }); setShowMenu(false); }} />
            <MenuItem icon={chat.isMuted ? <Volume2Icon size={16} /> : <VolumeX size={16} />} label={chat.isMuted ? t('unmuteChat') : t('muteChat')} onClick={() => { dispatch({ type: 'MUTE_CHAT', chatId: chat.id }); setShowMenu(false); }} />
            <MenuItem icon={<Archive size={16} />} label={chat.isArchived ? t('unarchiveChat') : t('archiveChat')} onClick={() => { dispatch({ type: 'ARCHIVE_CHAT', chatId: chat.id }); setShowMenu(false); }} />
            {chat.type === 'channel' && <MenuItem icon={<UserPlus size={16} />} label={`Join Requests (${(chat.pendingJoinRequests || []).length})`} onClick={() => { dispatch({ type: 'TOGGLE_JOIN_APPROVAL' }); setShowMenu(false); }} />}
            {chat.type === 'channel' && <MenuItem icon={<Users size={16} />} label={`Boost Channel (Lv ${chat.boostLevel || 0})`} onClick={() => setShowBoost(b => !b)} />}
            {(chat.type === 'group' || chat.type === 'channel') && <MenuItem icon={<Trophy size={16} />} label="Leaderboard" onClick={() => { dispatch({ type: 'TOGGLE_LEADERBOARD' }); setShowMenu(false); }} />}
            <MenuItem icon={<Printer size={16} />} label="Print Chat" onClick={() => { printChat(); setShowMenu(false); }} />
            {(chat.type === 'group' || chat.type === 'channel') && <>
              <div className="px-3 py-1 text-[10px] text-tg-text-secondary">Slow Mode</div>
              {showBoost && chat.type === 'channel' && <div className="px-3"><BoostModal chatId={chat.id} onClose={() => setShowBoost(false)} /></div>}
              {[0, 10, 30, 60].map(s => <button key={s} onClick={() => { dispatch({ type: 'SET_SLOW_MODE', chatId: chat.id, seconds: s as 0 | 10 | 30 | 60 }); setShowMenu(false); }} className={`w-full text-left px-4 py-1.5 text-xs hover:bg-tg-hover ${chat.slowMode === s ? 'text-tg-accent' : 'text-tg-text'}`}>{s === 0 ? 'Off' : `${s}s`}</button>)}
            </>}
            <div className="my-1 border-b border-black/20" />
            <MenuItem icon={<Trash2 size={16} className="text-tg-red" />} label={t('deleteChat')} onClick={() => { dispatch({ type: 'DELETE_CHAT', chatId: chat.id }); setShowMenu(false); }} danger />
          </div>
        </>}
      </div>
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-tg-hover transition-colors text-left ${danger ? 'text-tg-red' : 'text-tg-text'}`}><span className={danger ? 'text-tg-red' : 'text-tg-text-secondary'}>{icon}</span>{label}</button>;
}
