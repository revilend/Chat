import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { ChatHeader } from './ChatHeader';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { VoiceChatOverlay } from '../calls/VoiceChatOverlay';
import { AnnouncementBanner, CalendarViewer } from '../features/AdvancedFeatures';
import type { Message } from '../../types';

export function ChatArea() {
  const { state, getChatMessages, getChat, dispatch } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  /** True while the reader is sitting at the newest message. */
  const stickToBottomRef = useRef(true);
  /** Which message was last on screen, so we only react to genuinely new ones. */
  const lastMessageKeyRef = useRef('');
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const chat = getChat(state.activeChatId || '');
  const allMessages = getChatMessages(state.activeChatId || '');
  const messages = state.activeTopicId
    ? allMessages.filter(m => (m.topicId || 'topic_general') === state.activeTopicId)
    : allMessages;
  const pinnedMessages = messages.filter(m => m.isPinned && !m.deletedForEveryone);

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

  /** Jumps to the newest message. Never uses scrollIntoView: that scrolls every
   *  ancestor as well, which is what used to fight the reader on a phone. */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    stickToBottomRef.current = true;
    setShowJumpToBottom(false);
  }, []);

  // Track how far up the reader has scrolled. Reading old messages must never
  // snap back to the bottom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = distance < 120;
      setShowJumpToBottom(distance > 400);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [state.activeChatId]);

  // Opening a chat (or a topic) always lands on the newest message.
  useEffect(() => {
    lastMessageKeyRef.current = '';
    stickToBottomRef.current = true;
    setShowJumpToBottom(false);
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.activeChatId, state.activeTopicId]);

  // A new message only pulls the view down when it is ours or the reader is
  // already at the bottom. Keyed on the last message, not on the array, so
  // re-renders and typing updates can never yank the scroll position.
  const lastMessageKey = lastMessage ? `${lastMessage.id}:${lastMessage.senderId}` : '';
  useEffect(() => {
    if (!lastMessageKey || lastMessageKey === lastMessageKeyRef.current) return;
    const isFirstPaint = lastMessageKeyRef.current === '';
    lastMessageKeyRef.current = lastMessageKey;
    const isMine = lastMessage?.senderId === 'user_me';
    if (!isFirstPaint && !isMine && !stickToBottomRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      stickToBottomRef.current = true;
      setShowJumpToBottom(false);
    });
  }, [lastMessageKey, lastMessage]);

  // Search hit tracking. Only dispatches when the hit list really changed, so a
  // re-render can never turn into a dispatch loop.
  useEffect(() => {
    if (!state.searchQuery || state.searchQuery.length < 2) {
      if (state.searchHits.length > 0) dispatch({ type: 'SET_SEARCH_HITS', hits: [], index: -1 });
      return;
    }
    const q = state.searchQuery.toLowerCase();
    const hits = messages.filter(m => m.text.toLowerCase().includes(q)).map(m => m.id);
    const unchanged = hits.length === state.searchHits.length && hits.every((id, i) => id === state.searchHits[i]);
    if (unchanged) return;
    dispatch({ type: 'SET_SEARCH_HITS', hits, index: hits.length > 0 ? 0 : -1 });
  }, [state.searchQuery, state.searchHits, messages, dispatch]);

  if (!chat) return null;

  // `backgroundColor` (not the `background` shorthand) so the doodle pattern of
  // `.tg-doodle` survives underneath a per-chat wallpaper.
  return (
    <div className="h-full flex flex-col tg-doodle" style={{ backgroundColor: chat.wallpaper || undefined }}>
      <ChatHeader chat={chat} />
      {/* Forum topics */}
      {chat.isForum && chat.topics && chat.topics.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1.5 bg-tg-header border-b border-black/20 overflow-x-auto flex-shrink-0">
          <button onClick={() => dispatch({ type: 'SET_ACTIVE_TOPIC', topicId: null })} className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors ${!state.activeTopicId ? 'bg-tg-accent text-white' : 'text-tg-text-secondary hover:bg-tg-hover'}`}>All topics</button>
          {chat.topics.map(topic => (
            <button key={topic.id} onClick={() => dispatch({ type: 'SET_ACTIVE_TOPIC', topicId: topic.id })} className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors flex items-center gap-1 ${state.activeTopicId === topic.id ? 'bg-tg-accent text-white' : 'text-tg-text-secondary hover:bg-tg-hover'}`}>
              #{topic.name}
              {topic.unreadCount > 0 && <span className="bg-tg-accent/60 text-white text-[10px] rounded-full px-1.5">{topic.unreadCount}</span>}
            </button>
          ))}
        </div>
      )}
      {/* Feature 17: Announcement banner */}
      <AnnouncementBanner />
      {pinnedMessages.length > 0 && (
        <div className="bg-tg-reply-bar border-b border-black/25 px-3 py-2 flex items-center gap-2">
          <span className="text-tg-accent text-sm">📌</span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium text-tg-accent">Pinned message</div>
            <div className="text-xs text-tg-text-secondary truncate">{pinnedMessages[pinnedMessages.length - 1].text}</div>
          </div>
        </div>
      )}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-2.5 sm:px-4 md:px-[10%] lg:px-[16%] py-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-tg-text-secondary">
            <div className="w-16 h-16 rounded-full bg-tg-sidebar/70 backdrop-blur-sm border border-white/5 flex items-center justify-center text-3xl mb-3 shadow-lg">💬</div>
            <div className="text-sm text-tg-text">No messages yet</div>
            <div className="text-xs mt-1 opacity-70">Say hello to start the history</div>
          </div>
        )}
        <MessageList messages={messages} />
        {/* Breathing room so the last bubble is never glued to the composer */}
        <div className="h-2" />
      </div>
      {showJumpToBottom && (
        <div className="relative">
          <button
            onClick={() => scrollToBottom('smooth')}
            title="Jump to the newest message"
            className="absolute -top-14 right-4 w-11 h-11 rounded-full bg-tg-elevated border border-white/10 shadow-xl flex items-center justify-center hover:bg-tg-hover transition-colors"
          >
            <ChevronDown size={20} className="text-tg-text" />
          </button>
        </div>
      )}
      {state.voiceChatActive && state.voiceChatChatId === state.activeChatId && <VoiceChatOverlay />}
      <MessageInput chat={chat} />
      <CalendarViewer />
    </div>
  );
}

function MessageList({ messages }: { messages: Message[] }) {
  const { state } = useApp();
  const selectedSet = new Set(state.selectedMessages);
  let lastDate = '';
  const elements: React.ReactNode[] = [];
  messages.forEach((msg, i) => {
    const date = new Date(msg.timestamp).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
    if (date !== lastDate) { lastDate = date;      elements.push(            <div key={`date-${date}`} className="flex justify-center my-3"><span className="bg-black/35 text-tg-text-secondary text-[11px] font-medium px-3 py-1 rounded-full backdrop-blur-md border border-white/5">{isToday(new Date(msg.timestamp)) ? 'Today' : isYesterday(new Date(msg.timestamp)) ? 'Yesterday' : date}</span></div>); }
    const previous = messages[i - 1];
    const next = messages[i + 1];
    const isGroup = i > 0 && previous.senderId === msg.senderId && msg.timestamp - previous.timestamp < 60000;
    const sameRunAfter = !!next && next.senderId === msg.senderId && next.timestamp - msg.timestamp < 60000;
    elements.push(<MessageBubble key={msg.id} message={msg} isGrouped={!!isGroup} isLast={!sameRunAfter} isSelected={selectedSet.has(msg.id)} />);
  });
  return <>{elements}</>;
}

function isToday(d: Date) { const t = new Date(); return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear(); }
function isYesterday(d: Date) { const y = new Date(); y.setDate(y.getDate() - 1); return d.getDate() === y.getDate() && d.getMonth() === y.getMonth() && d.getFullYear() === y.getFullYear(); }
