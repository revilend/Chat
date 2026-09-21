import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { X, Camera } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Chat } from '../../types';

export function CreateChannelModal() {
  const { dispatch, t } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const create = () => {
    if (!name.trim()) return;
    const chat: Chat = {
      id: `chat_channel_${Date.now()}`,
      type: 'channel',
      name: name.trim(),
      avatar: '',
      members: ['user_me'],
      admins: ['user_me'],
      creatorId: 'user_me',
      description,
      unreadCount: 0,
      isPinned: false,
      isArchived: false,
      isMuted: false,
      inviteLink: `#join/chat_channel_${Date.now()}`,
      subscribers: 1,
      postCount: 0,
    };
    dispatch({ type: 'ADD_CHAT', chat });
    dispatch({ type: 'TOGGLE_CREATE_CHANNEL' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-tg-sidebar rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 h-[56px] border-b border-black/20">
          <button onClick={() => dispatch({ type: 'TOGGLE_CREATE_CHANNEL' })}><X size={20} className="text-tg-text-secondary" /></button>
          <h2 className="text-base font-medium text-tg-text">{t('createChannel')}</h2>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-full bg-tg-input flex items-center justify-center">
              <Camera size={24} className="text-tg-text-secondary" />
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Channel name..."
              className="flex-1 bg-tg-input rounded-lg px-3 py-2 text-sm text-tg-text outline-none"
              autoFocus
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)..."
            rows={3}
            className="w-full bg-tg-input rounded-lg px-3 py-2 text-sm text-tg-text outline-none resize-none mb-4"
          />
          <button
            onClick={create}
            disabled={!name.trim()}
            className="w-full py-2.5 rounded-lg bg-tg-accent text-white text-sm font-medium disabled:opacity-50 hover:bg-tg-accent-hover transition-colors"
          >
            {t('createChannel')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
