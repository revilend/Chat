import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { X, Camera, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { getInitials, getAvatarColor } from '../layout/ChatListItem';

export function ProfileModal() {
  const { state, dispatch, t } = useApp();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(state.currentUser.name);
  const [bio, setBio] = useState(state.currentUser.bio);
  const [copied, setCopied] = useState(false);

  const handleSave = () => {
    dispatch({ type: 'UPDATE_PROFILE', user: { name, bio } });
    setEditing(false);
  };

  const copyId = () => {
    navigator.clipboard.writeText(state.currentUser.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md h-full md:h-[90vh] md:max-h-[600px] bg-tg-sidebar rounded-none md:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 h-[56px] border-b border-black/20 flex-shrink-0">
          <button onClick={() => dispatch({ type: 'TOGGLE_PROFILE' })} className="p-1">
            <X size={20} className="text-tg-text-secondary" />
          </button>
          <h2 className="text-base font-medium text-tg-text">{t('editProfile')}</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Avatar */}
          <div className="flex flex-col items-center py-6 bg-tg-input/50">
            <div className="relative">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-semibold ${getAvatarColor(state.currentUser.id)}`}>
                {getInitials(state.currentUser.name)}
              </div>
              <button className="absolute bottom-0 right-0 w-8 h-8 bg-tg-accent rounded-full flex items-center justify-center border-2 border-tg-sidebar">
                <Camera size={14} className="text-white" />
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="py-2">
            {editing ? (
              <div className="px-4 space-y-3">
                <div>
                  <label className="text-xs text-tg-accent mb-1 block">{t('editProfile')}</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-tg-input rounded-lg px-3 py-2 text-sm text-tg-text outline-none" />
                </div>
                <div>
                  <label className="text-xs text-tg-accent mb-1 block">{t('bio')}</label>
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full bg-tg-input rounded-lg px-3 py-2 text-sm text-tg-text outline-none resize-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="flex-1 py-2 rounded-lg bg-tg-input text-sm text-tg-text">{t('cancel')}</button>
                  <button onClick={handleSave} className="flex-1 py-2 rounded-lg bg-tg-accent text-sm text-white">{t('save')}</button>
                </div>
              </div>
            ) : (
              <>
                <ProfileInfoRow label={t('editProfile')} value={state.currentUser.name} onClick={() => setEditing(true)} editable />
                <ProfileInfoRow label={`@${t('username')}`} value={`@${state.currentUser.username}`} />
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-xs text-tg-accent">{t('userId')}</div>
                    <div className="text-sm text-tg-text">{state.currentUser.id}</div>
                  </div>
                  <button onClick={copyId} className="p-2 rounded-full hover:bg-tg-hover">
                    {copied ? <Check size={16} className="text-tg-green" /> : <Copy size={16} className="text-tg-text-secondary" />}
                  </button>
                </div>
                <ProfileInfoRow label={t('bio')} value={state.currentUser.bio || 'Not set'} onClick={() => setEditing(true)} editable />
                <ProfileInfoRow label="Phone" value={state.currentUser.phone} />
                <ProfileInfoRow
                  label={t('lastSeenSettings')}
                  value={state.currentUser.canSeeLastSeen === 'everyone' ? t('everyone') : state.currentUser.canSeeLastSeen === 'contacts' ? t('myContacts') : t('nobody')}
                />
                <ProfileInfoRow
                  label={t('userIdSettings')}
                  value={state.currentUser.canSeeUserId === 'everyone' ? t('everyone') : state.currentUser.canSeeUserId === 'contacts' ? t('myContacts') : t('nobody')}
                />
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ProfileInfoRow({ label, value, onClick, editable }: { label: string; value: string; onClick?: () => void; editable?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full text-left px-4 py-3 ${editable ? 'hover:bg-tg-hover cursor-pointer' : ''}`}>
      <div className="text-xs text-tg-accent">{label}</div>
      <div className="text-sm text-tg-text">{value}</div>
    </button>
  );
}
