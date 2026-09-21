import { useState, useMemo } from 'react';
import { useApp } from '../../store/AppContext';
import { Search, Menu, X, Users, Volume2, Archive, Pencil, UserPlus } from 'lucide-react';
import { ChatListItem } from './ChatListItem';
import { HamburgerMenu } from './HamburgerMenu';
import type { FolderType } from '../../types';

const folders: { id: FolderType; icon: React.ReactNode; label: string }[] = [
  { id: 'all', icon: null, label: 'allChats' },
  { id: 'personal', icon: <Users size={16} />, label: 'personal' },
  { id: 'groups', icon: <Users size={16} />, label: 'groups' },
  { id: 'channels', icon: <Volume2 size={16} />, label: 'channels' },
  { id: 'unread', icon: null, label: 'unread' },
];

export function Sidebar() {
  const { state, dispatch, t } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const archivedOpen = state.showArchivedFolder;

  const filteredChats = useMemo(() => {
    let chats = state.chats.filter(c => !c.isArchived || state.showArchivedFolder);
    const q = state.searchQuery.toLowerCase();

    // Folder filter
    switch (state.activeFolder) {
      case 'personal':
        chats = chats.filter(c => c.type === 'private');
        break;
      case 'groups':
        chats = chats.filter(c => c.type === 'group');
        break;
      case 'channels':
        chats = chats.filter(c => c.type === 'channel');
        break;
      case 'unread':
        chats = chats.filter(c => c.unreadCount > 0);
        break;
    }

    // Search filter
    if (q) {
      chats = chats.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.lastMessage?.text.toLowerCase().includes(q)
      );
    }

    // Sort: pinned first, then by last message time
    return chats.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const aTime = a.lastMessage?.timestamp || 0;
      const bTime = b.lastMessage?.timestamp || 0;
      return bTime - aTime;
    });
  }, [state.chats, state.activeFolder, state.searchQuery, state.showArchivedFolder]);

  const archivedCount = state.chats.filter(c => c.isArchived).length;
  const totalUnread = state.chats.reduce((sum, c) => sum + (c.isArchived ? 0 : c.unreadCount), 0);

  return (
    <div className="h-full flex flex-col bg-tg-sidebar sidebar-surface relative">
      {/* Header */}
      <div className="glass-bar flex items-center gap-2 px-2.5 py-2.5 h-[60px] flex-shrink-0">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="icon-btn"
          title="Menu"
        >
          {showMenu ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Adding somebody is one tap away; the address itself lives in the menu. */}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_CONTACTS' })}
          className="icon-btn"
          title="Add contact"
        >
          <UserPlus size={20} />
        </button>

        <div className={`flex-1 flex items-center bg-tg-input rounded-full px-4 h-10 transition-all ${searchFocused ? 'ring-2 ring-tg-accent/60' : 'ring-1 ring-white/5'}`}>
          <Search size={17} className="text-tg-text-secondary mr-2.5 flex-shrink-0" />
          <input
            type="text"
            placeholder={t('search')}
            value={state.searchQuery}
            onChange={(e) => dispatch({ type: 'SET_SEARCH', query: e.target.value })}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="bg-transparent outline-none text-tg-text text-[15px] w-full placeholder:text-tg-text-secondary"
          />
          {state.searchQuery && (
            <button onClick={() => dispatch({ type: 'SET_SEARCH', query: '' })} className="ml-1 p-1 rounded-full hover:bg-black/20" title="Clear">
              <X size={15} className="text-tg-text-secondary" />
            </button>
          )}
        </div>
      </div>

      {/* Folder Tabs */}
      <div className="flex gap-1 px-2.5 pb-2 overflow-x-auto">
        {folders.map(folder => {
          const count = folder.id === 'unread' ? totalUnread : 0;
          return (
            <button
              key={folder.id}
              onClick={() => dispatch({ type: 'SET_ACTIVE_FOLDER', folder: folder.id })}
              className={`flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[13px] font-medium whitespace-nowrap transition-all ${
                state.activeFolder === folder.id
                  ? 'bg-tg-accent text-white shadow-md shadow-tg-accent/30'
                  : 'text-tg-text-secondary hover:bg-tg-hover hover:text-tg-text'
              }`}
            >
              {folder.label === 'allChats' ? t('allChats') : t(folder.label)}
              {count > 0 && (
                <span className={`text-[10px] rounded-full px-1.5 min-w-[18px] text-center font-semibold ${
                  state.activeFolder === folder.id ? 'bg-white/25 text-white' : 'bg-tg-accent text-white'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-2 space-y-0.5">
        {/* Archived chats */}
        {archivedCount > 0 && (
          <button className="row" onClick={() => dispatch({ type: 'TOGGLE_ARCHIVED_FOLDER' })}>
            <div className="w-[46px] h-[46px] rounded-full bg-tg-accent/20 flex items-center justify-center shrink-0">
              <Archive size={20} className="text-tg-accent" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="text-[15px] font-medium text-tg-accent truncate">{t('archivedChats')}</div>
              <div className="text-[13px] text-tg-text-secondary">{archivedCount}</div>
            </div>
            <span className={`text-tg-text-secondary transition-transform ${archivedOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>
        )}

        {/* Chat items */}
        {filteredChats.map(chat => (
          <ChatListItem key={chat.id} chat={chat} />
        ))}

        {filteredChats.length === 0 && state.searchQuery && (
          <div className="flex flex-col items-center justify-center py-16 text-tg-text-secondary">
            <div className="w-14 h-14 rounded-full bg-tg-sidebar flex items-center justify-center mb-3">
              <Search size={24} className="opacity-60" />
            </div>
            <div className="text-sm">{t('noResults')}</div>
            <div className="text-[11px] mt-1 opacity-70">Try a different word or an @username</div>
          </div>
        )}

        {filteredChats.length === 0 && !state.searchQuery && (
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center text-tg-text-secondary">
            <div className="w-14 h-14 rounded-full bg-tg-sidebar flex items-center justify-center text-2xl mb-3">💬</div>
            <div className="text-sm">{state.activeFolder === 'all' ? 'No chats yet' : 'Nothing in this folder'}</div>
            <div className="text-[11px] mt-1 opacity-70 leading-relaxed">
              Add someone by the address they shared and the chat appears here.
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => dispatch({ type: 'TOGGLE_CONTACTS' })}
        title="New message"
        className="absolute bottom-6 right-6 w-14 h-14 rounded-2xl bg-tg-accent flex items-center justify-center shadow-xl shadow-tg-accent/35 hover:bg-tg-accent-hover hover:scale-105 active:scale-95"
      >
        <Pencil size={22} className="text-white" />
      </button>

      {/* Hamburger Menu */}
      {showMenu && (
        <HamburgerMenu onClose={() => setShowMenu(false)} />
      )}
    </div>
  );
}
