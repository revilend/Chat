import { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { Plus, X, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getInitials, getAvatarColor } from '../layout/ChatListItem';

const STORY_COLORS = ['#2b5278', '#1a472a', '#4a1942', '#7a3b2e', '#1e3a8a', '#0f5132'];
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function StoriesStrip() {
  const { state, dispatch, getUser } = useApp();
  const [viewingStory, setViewingStory] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [storyColor, setStoryColor] = useState(STORY_COLORS[0]);

  // Stories really expire after 24 hours
  const stories = state.stories.filter(s => Date.now() - s.timestamp < STORY_LIFETIME_MS);
  const viewingStoryData = stories.find(s => s.id === viewingStory);

  // Auto-advance through the story the way Telegram does
  useEffect(() => {
    if (!viewingStoryData) return;
    const timer = setTimeout(() => {
      const idx = stories.findIndex(s => s.id === viewingStoryData.id);
      dispatch({ type: 'MARK_STORY_VIEWED', storyId: viewingStoryData.id });
      setViewingStory(idx >= 0 && idx < stories.length - 1 ? stories[idx + 1].id : null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [viewingStoryData, stories, dispatch]);

  const postStory = () => {
    const content = storyText.trim();
    if (!content) return;
    dispatch({
      type: 'ADD_STORY',
      story: {
        id: `story_${Date.now()}`, userId: 'user_me', content, timestamp: Date.now(),
        viewedBy: ['user_me'], type: 'text', bgColor: storyColor,
      },
    });
    setStoryText('');
    setComposing(false);
  };

  if (stories.length === 0 && !state.searchQuery && !composing) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 border-b border-black/20 flex-shrink-0 bg-tg-sidebar">
        <button onClick={() => setComposing(true)} className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-tg-accent/20 flex items-center justify-center"><Plus size={20} className="text-tg-accent" /></div>
          <span className="text-[10px] text-tg-text-secondary">My Story</span>
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Stories strip */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-black/20 overflow-x-auto flex-shrink-0 bg-tg-sidebar">
        {/* My story / compose */}
        <button onClick={() => setComposing(c => !c)} className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="relative">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${state.stories.some(s => s.userId === 'user_me') ? 'bg-tg-accent' : 'bg-tg-accent/20'}`}>
              <Plus size={20} className={state.stories.some(s => s.userId === 'user_me') ? 'text-white' : 'text-tg-accent'} />
            </div>
          </div>
          <span className="text-[10px] text-tg-text-secondary">My Story</span>
        </button>

        {/* Other stories */}
        {stories.map(story => {
          const user = getUser(story.userId);
          const isViewed = story.viewedBy.includes('user_me');
          return (
            <button
              key={story.id}
              onClick={() => setViewingStory(story.id)}
              className="flex flex-col items-center gap-1 flex-shrink-0"
            >
              <div className={`w-12 h-12 rounded-full p-[2px] ${isViewed ? 'bg-tg-text-secondary/30' : 'bg-tg-accent'}`}>
                <div style={{ background: getAvatarColor(story.userId) }} className="w-full h-full rounded-full flex items-center justify-center text-white text-sm font-semibold">
                  {getInitials(user?.name || '?')}
                </div>
              </div>
              <span className="text-[10px] text-tg-text-secondary truncate max-w-[50px]">
                {user?.name?.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Story viewer */}
      <AnimatePresence>
        {viewingStoryData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
            onClick={() => setViewingStory(null)}
          >
            <button className="absolute top-4 right-4 z-10 p-2" onClick={(e) => { e.stopPropagation(); setViewingStory(null); }}>
              <X size={24} className="text-white" />
            </button>

            <div className="relative w-full h-full max-w-lg mx-auto">
              {/* Progress bars */}
              <div className="absolute top-2 left-2 right-2 flex gap-1 z-10">
                {stories.map((s, i) => {
                  const currentIndex = stories.findIndex(x => x.id === viewingStoryData.id);
                  return (
                    <div key={s.id} className="flex-1 h-[2px] bg-white/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full"
                        style={{
                          width: i < currentIndex ? '100%' : '0%',
                          animation: s.id === viewingStoryData.id ? 'story-progress 5s linear forwards' : 'none',
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* User info */}
              <div className="absolute top-6 left-4 right-4 flex items-center gap-2 z-10">
                <div style={{ background: getAvatarColor(viewingStoryData.userId) }} className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                  {getInitials(getUser(viewingStoryData.userId)?.name || '?')}
                </div>
                <div>
                  <div className="text-sm text-white font-medium">{getUser(viewingStoryData.userId)?.name || 'You'}</div>
                  <div className="text-[10px] text-white/60">
                    {new Date(viewingStoryData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* Story content */}
              <div
                className="absolute inset-0 flex items-center justify-center px-8 pt-16"
                style={{ background: viewingStoryData.bgColor || '#2b5278' }}
              >
                <p className="text-white text-lg text-center leading-relaxed">
                  {viewingStoryData.content}
                </p>
              </div>

              {/* Navigation */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = stories.findIndex(s => s.id === viewingStoryData.id);
                  if (idx > 0) {
                    dispatch({ type: 'MARK_STORY_VIEWED', storyId: viewingStoryData.id });
                    setViewingStory(stories[idx - 1].id);
                  } else {
                    setViewingStory(null);
                  }
                }}
                className="absolute left-0 top-0 bottom-0 w-1/3"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = stories.findIndex(s => s.id === viewingStoryData.id);
                  dispatch({ type: 'MARK_STORY_VIEWED', storyId: viewingStoryData.id });
                  if (idx < stories.length - 1) {
                    setViewingStory(stories[idx + 1].id);
                  } else {
                    setViewingStory(null);
                  }
                }}
                className="absolute right-0 top-0 bottom-0 w-1/3"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Story composer */}
      <AnimatePresence>
        {composing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="px-3 py-2 border-b border-black/20 bg-tg-sidebar flex items-center gap-2 flex-shrink-0"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: storyColor }}>
              <span className="text-xs text-white">{storyText.trim() ? storyText.trim().slice(0, 2) : '📷'}</span>
            </div>
            <input
              value={storyText}
              onChange={e => setStoryText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') postStory(); }}
              placeholder="Share a story…"
              className="flex-1 min-w-0 bg-tg-input rounded-lg px-3 py-2 text-sm text-tg-text outline-none"
            />
            <div className="flex gap-1">
              {STORY_COLORS.map(c => (
                <button key={c} onClick={() => setStoryColor(c)} className={`w-5 h-5 rounded-full border-2 ${storyColor === c ? 'border-tg-accent' : 'border-transparent'}`} style={{ background: c }} />
              ))}
            </div>
            <button onClick={postStory} disabled={!storyText.trim()} className="p-2 rounded-full bg-tg-accent disabled:opacity-40"><Send size={16} className="text-white" /></button>
            <button onClick={() => { setComposing(false); setStoryText(''); }} className="p-1"><X size={16} className="text-tg-text-secondary" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
