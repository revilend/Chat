import { useMemo, useRef, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { useAccount } from '../../auth/AccountContext';
import { X, Camera, Copy, Check, Trash2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { UserAvatar, AVATAR_COLORS } from '../shared/UserAvatar';
import { formatUserId } from '../../utils/identity';
import { compressImage, fileToDataUrl } from '../../utils/media';

const BIO_LIMIT = 120;

export function ProfileModal() {
  const { state, dispatch, t } = useApp();
  const { updateProfile } = useAccount();
  const user = state.currentUser;

  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [avatarColor, setAvatarColor] = useState(user.avatarColor || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handle = username.replace(/^@/, '').toLowerCase();
  const dirty = useMemo(() => (
    name.trim() !== user.name
    || handle !== user.username
    || bio !== (user.bio || '')
    || phone !== (user.phone || '')
    || avatar !== (user.avatar || '')
    || avatarColor !== (user.avatarColor || '')
  ), [name, handle, bio, phone, avatar, avatarColor, user]);

  // A real photo: picked, shrunk in the browser and stored with the account.
  const pickPhoto = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const raw = await fileToDataUrl(file);
      const compact = await compressImage(raw, 320, 0.82);
      setAvatar(compact);
      setAvatarColor('');
    } catch (err) {
      setError((err as Error).message || 'Could not read that image.');
    }
    setBusy(false);
  };

  const save = () => {
    setError('');
    if (name.trim().length < 1) { setError('Please enter a display name.'); return; }
    try {
      updateProfile({ name: name.trim(), username: handle, bio, phone, avatar, avatarColor });
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      setError((err as Error).message || 'Could not save.');
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(user.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => setError('Copy failed — select the ID and copy it manually.'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md h-full md:h-[90vh] md:max-h-[660px] card rounded-none md:rounded-2xl overflow-hidden flex flex-col"
      >
        {/* Header with the real save action */}
        <div className="flex items-center gap-2 px-3 h-[56px] border-b border-black/20 flex-shrink-0">
          <button onClick={() => dispatch({ type: 'TOGGLE_PROFILE' })} className="icon-btn" title="Close">
            <X size={20} className="text-tg-text-secondary" />
          </button>
          <h2 className="flex-1 text-base font-medium text-tg-text">{t('editProfile')}</h2>
          <button
            onClick={save}
            disabled={busy || (!dirty && !saved)}
            className={`flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-medium transition-all ${dirty || saved ? 'btn-primary' : 'bg-tg-input text-tg-text-secondary'}`}
            title="Save changes"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={16} />}
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          {/* Avatar */}
          <div className="flex flex-col items-center pt-6 pb-5 bg-tg-input/30">
            <div className="relative">
              <UserAvatar name={name || user.name} id={user.id} avatar={avatar} avatarColor={avatarColor} size={104} className="ring-4 ring-black/20" />
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full flex items-center justify-center text-white border-2 border-tg-sidebar"
                style={{ background: 'linear-gradient(160deg, #57bcff, #3390ec 55%, #1f7fd6)', boxShadow: '0 6px 18px rgba(51,144,236,0.45)' }}
                title="Upload a photo"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) void pickPhoto(f); e.target.value = ''; }}
              />
            </div>

            {/* Or pick a colour */}
            <div className="mt-4 flex items-center gap-2 flex-wrap justify-center px-4">
              {AVATAR_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => { setAvatarColor(color); setAvatar(''); }}
                  className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${avatarColor === color ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-tg-input' : 'ring-1 ring-white/15'}`}
                  style={{ background: color }}
                  title="Use this avatar colour"
                />
              ))}
            </div>
            {(avatar || avatarColor) && (
              <button
                onClick={() => { setAvatar(''); setAvatarColor(''); }}
                className="mt-3 flex items-center gap-1.5 text-xs text-tg-text-secondary hover:text-tg-text"
              >
                <Trash2 size={12} /> Use my initials instead
              </button>
            )}
          </div>

          <div className="px-4 space-y-4 mt-4">
            <div>
              <label className="field-label" htmlFor="profile-name">Display name</label>
              <input
                id="profile-name"
                value={name}
                onChange={e => setName(e.target.value.slice(0, 40))}
                placeholder="Murod Karimov"
                className="input-box"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="profile-username">Username</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-tg-text-secondary text-[15px]">@</span>
                <input
                  id="profile-username"
                  value={handle}
                  onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                  placeholder="murod"
                  className="input-box pl-9"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-tg-text-secondary">
                Letters, numbers and _ only. Your ID stays the same when you change it.
              </p>
            </div>

            <div>
              <label className="field-label" htmlFor="profile-bio">Bio</label>
              <textarea
                id="profile-bio"
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, BIO_LIMIT))}
                rows={3}
                placeholder="A brief bio about me"
                className="input-box resize-none leading-relaxed"
              />
              <div className="mt-1 text-right text-[11px] text-tg-text-secondary tabular-nums">{bio.length}/{BIO_LIMIT}</div>
            </div>

            <div>
              <label className="field-label">Your ID</label>
              <div className="input-box flex items-center justify-between font-mono tracking-[0.14em]">
                <span>{formatUserId(user.id)}</span>
                <button onClick={copyId} className="p-1 rounded-full hover:bg-tg-hover" title="Copy my ID">
                  {copied ? <Check size={16} className="text-tg-green" /> : <Copy size={16} className="text-tg-text-secondary" />}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-tg-text-secondary">
                Share this with a friend — they add it under Contacts to reach you.
              </p>
            </div>

            <div>
              <label className="field-label" htmlFor="profile-phone">Phone</label>
              <input
                id="profile-phone"
                value={phone}
                onChange={e => setPhone(e.target.value.slice(0, 24))}
                placeholder="+998 90 000 00 00"
                className="input-box"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-tg-red/30 bg-tg-red/10 px-3 py-2 text-xs text-tg-red">{error}</div>
            )}
            {saved && (
              <div className="rounded-xl border border-tg-green/30 bg-tg-green/10 px-3 py-2 text-xs text-tg-green">
                ✓ Profile saved. Your name and bio are stored on this device.
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
