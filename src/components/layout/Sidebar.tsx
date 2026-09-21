import { useState, useMemo } from 'react';
import { useApp } from '../../store/AppContext';
import { Search, Menu, X, Users, Volume2, Archive, Pencil } from 'lucide-react';
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
    <div className="h-full flex flex-col bg-tg-sidebar relative">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 h-[56px]">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 rounded-full hover:bg-tg-hover transition-colors"
        >
          {showMenu ? <X size={20} className="text-tg-text-secondary" /> : <Menu size={20} className="text-tg-text-secondary" />}
        </button>

        <div className={`flex-1 flex items-center bg-tg-input rounded-full px-3 h-10 transition-all ${searchFocused ? 'ring-1 ring-tg-accent' : ''}`}>
          <Search size={16} className="text-tg-text-secondary mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder={t('search')}
            value={state.searchQuery}
            onChange={(e) => dispatch({ type: 'SET_SEARCH', query: e.target.value })}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="bg-transparent outline-none text-tg-text text-sm w-full placeholder:text-tg-text-secondary"
          />
          {state.searchQuery && (
            <button onClick={() => dispatch({ type: 'SET_SEARCH', query: '' })} className="ml-1">
              <X size={14} className="text-tg-text-secondary" />
            </button>
          )}
        </div>
      </div>

      {/* Folder Tabs */}
      <div className="flex border-b border-black/20 overflow-x-auto">
        {folders.map(folder => {
          const count = folder.id === 'unread' ? totalUnread : 0;
          return (
            <button
              key={folder.id}
              onClick={() => dispatch({ type: 'SET_ACTIVE_FOLDER', folder: folder.id })}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                state.activeFolder === folder.id
                  ? 'text-tg-accent border-tg-accent'
                  : 'text-tg-text-secondary border-transparent hover:text-tg-text'
              }`}
            >
              {folder.label === 'allChats' ? t('allChats') : t(folder.label)}
              {count > 0 && (
                <span className="bg-tg-accent text-white text-[10px] rounded-full px-1.5 min-w-[18px] text-center">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {/* Archived chats */}
        {archivedCount > 0 && (
          <button
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-tg-hover transition-colors"
            onClick={() => dispatch({ type: 'TOGGLE_ARCHIVED_FOLDER' })}
          >
            <div className="w-[46px] h-[46px] rounded-full bg-tg-accent/20 flex items-center justify-center">
              <Archive size={20} className="text-tg-accent" />
            </div>
            <div className="text-left flex-1">
              <div className="text-sm text-tg-accent">{t('archivedChats')}</div>
              <div className="text-xs text-tg-text-secondary">{archivedCount}</div>
            </div>
            <span className="text-xs text-tg-text-secondary">{archivedOpen ? '▲' : '▼'}</span>
          </button>
        )}

        {/* Chat items */}
        {filteredChats.map(chat => (
          <ChatListItem key={chat.id} chat={chat} />
        ))}

        {filteredChats.length === 0 && state.searchQuery && (
          <div className="flex flex-col items-center justify-center py-16 text-tg-text-secondary">
            <Search size={40} className="mb-3 opacity-50" />
            <div className="text-sm">{t('noResults')}</div>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => dispatch({ type: 'TOGGLE_CONTACTS' })}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-tg-accent flex items-center justify-center shadow-lg hover:bg-tg-accent-hover transition-all hover:scale-105 active:scale-95"
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
