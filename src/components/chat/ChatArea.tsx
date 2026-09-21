import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { ChatHeader } from './ChatHeader';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { VoiceChatOverlay } from '../calls/VoiceChatOverlay';
import { AnnouncementBanner, CalendarViewer } from '../features/AdvancedFeatures';
import type { Message } from '../../types';

export function ChatArea() {
  const { state, getChatMessages, getChat, dispatch } = useApp();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const chat = getChat(state.activeChatId || '');
  const allMessages = getChatMessages(state.activeChatId || '');
  const messages = state.activeTopicId
    ? allMessages.filter(m => (m.topicId || 'topic_general') === state.activeTopicId)
    : allMessages;
  const pinnedMessages = messages.filter(m => m.isPinned && !m.deletedForEveryone);

  useEffect(() => { if (isAutoScroll && messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [messages, isAutoScroll]);
  const handleScroll = useCallback(() => { if (!containerRef.current) return; const { scrollTop, scrollHeight, clientHeight } = containerRef.current; setIsAutoScroll(scrollHeight - scrollTop - clientHeight < 100); }, []);
  useEffect(() => { setTimeout(() => messagesEndRef.current?.scrollIntoView(), 50); }, [state.activeChatId]);

  // Search hit tracking
  useEffect(() => {
    if (!state.searchQuery || state.searchQuery.length < 2) { dispatch({ type: 'SET_SEARCH_HITS', hits: [], index: -1 }); return; }
    const q = state.searchQuery.toLowerCase();
    const hits = messages.filter(m => m.text.toLowerCase().includes(q)).map(m => m.id);
    dispatch({ type: 'SET_SEARCH_HITS', hits, index: hits.length > 0 ? 0 : -1 });
  }, [state.searchQuery, messages, dispatch]);

  if (!chat) return null;

  return (
    <div className="h-full flex flex-col tg-doodle" style={{ background: chat.wallpaper || '#0e1621' }}>
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
      {pinnedMessages.length > 0 && <div className="bg-tg-reply-bar border-b border-black/20 px-4 py-2 flex items-center gap-2"><span className="text-xs text-tg-accent font-medium">📌 Pinned Message</span><span className="text-xs text-tg-text-secondary truncate flex-1">{pinnedMessages[pinnedMessages.length - 1].text}</span></div>}
      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 md:px-[12%] lg:px-[18%] py-4">
        {messages.length === 0 && <div className="flex flex-col items-center justify-center h-full text-tg-text-secondary"><div className="text-4xl mb-3">💬</div><div className="text-sm">No messages yet</div></div>}
        <MessageList messages={messages} />
        <div ref={messagesEndRef} />
      </div>
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
    if (date !== lastDate) { lastDate = date; elements.push(<div key={`date-${date}`} className="flex justify-center my-3"><span className="bg-tg-sidebar/80 text-tg-text-secondary text-xs px-3 py-1 rounded-full backdrop-blur-sm">{isToday(new Date(msg.timestamp)) ? 'Today' : isYesterday(new Date(msg.timestamp)) ? 'Yesterday' : date}</span></div>); }
    const isGroup = i > 0 && messages[i - 1].senderId === msg.senderId && msg.timestamp - messages[i - 1].timestamp < 60000;
    elements.push(<MessageBubble key={msg.id} message={msg} isGrouped={!!isGroup} isSelected={selectedSet.has(msg.id)} />);
  });
  return <>{elements}</>;
}

function isToday(d: Date) { const t = new Date(); return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear(); }
function isYesterday(d: Date) { const y = new Date(); y.setDate(y.getDate() - 1); return d.getDate() === y.getDate() && d.getMonth() === y.getMonth() && d.getFullYear() === y.getFullYear(); }
