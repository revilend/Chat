import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { X, Camera } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Chat } from '../../types';

export function CreateGroupModal() {
  const { state, dispatch, t } = useApp();
  const [name, setName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const create = () => {
    if (!name.trim()) return;
    const chat: Chat = {
      id: `chat_group_${Date.now()}`,
      type: 'group',
      name: name.trim(),
      avatar: '',
      members: ['user_me', ...selectedMembers],
      admins: ['user_me'],
      creatorId: 'user_me',
      unreadCount: 0,
      isPinned: false,
      isArchived: false,
      isMuted: false,
      inviteLink: `#join/chat_group_${Date.now()}`,
    };
    dispatch({ type: 'ADD_CHAT', chat });
    dispatch({ type: 'TOGGLE_CREATE_GROUP' });
  };

  const contacts = state.contacts
    .filter(c => c.isContact)
    .map(c => ({ ...c, user: state.users[c.userId] }))
    .filter(c => c.user);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-tg-sidebar rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 h-[56px] border-b border-black/20">
          <button onClick={() => dispatch({ type: 'TOGGLE_CREATE_GROUP' })}><X size={20} className="text-tg-text-secondary" /></button>
          <h2 className="text-base font-medium text-tg-text">{t('createGroup')}</h2>
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
              placeholder="Group name..."
              className="flex-1 bg-tg-input rounded-lg px-3 py-2 text-sm text-tg-text outline-none"
              autoFocus
            />
          </div>

          <div className="max-h-[250px] overflow-y-auto">
            {contacts.map(({ user, userId }) => (
              <button
                key={userId}
                onClick={() => toggleMember(userId)}
                className="w-full flex items-center gap-3 px-2 py-2 hover:bg-tg-hover rounded-lg transition-colors"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold bg-tg-accent/50`}>
                  {user!.name[0]}
                </div>
                <span className="flex-1 text-sm text-tg-text text-left">{user!.name}</span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedMembers.includes(userId) ? 'bg-tg-accent border-tg-accent' : 'border-tg-text-secondary'
                }`}>
                  {selectedMembers.includes(userId) && <span className="text-white text-xs">✓</span>}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={create}
            disabled={!name.trim()}
            className="w-full mt-4 py-2.5 rounded-lg bg-tg-accent text-white text-sm font-medium disabled:opacity-50 hover:bg-tg-accent-hover transition-colors"
          >
            {t('createGroup')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
