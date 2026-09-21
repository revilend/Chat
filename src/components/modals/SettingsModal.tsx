import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { X, ChevronRight, Shield, Globe, Moon, Sun, Lock, MessageSquare, ToggleLeft, ToggleRight, Clock, Trash2, Image, Star, Settings, Megaphone, Ban } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Language } from '../../types';
import { GhostModeToggle, GroupPermissionsPanel, PrintChatButton, WelcomeMessageEditor } from '../features/AdvancedFeatures';
import { AdminTitleSetter } from './FeatureModals';

export function SettingsModal() {
  const { state, dispatch, t } = useApp();
  const [section, setSection] = useState<'main' | 'privacy' | 'language' | 'passcode' | 'theme' | 'autodelete' | 'permissions' | 'announcements' | 'moderation'>('main');
  const [newPasscode, setNewPasscode] = useState('');
  const [newAnn, setNewAnn] = useState('');
  const [blacklistInput, setBlacklistInput] = useState('');
  const activeChat = state.chats.find(c => c.id === state.activeChatId);
  const canModerate = !!activeChat && (activeChat.type === 'group');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md h-full md:h-[90vh] md:max-h-[600px] card rounded-none md:rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-4 h-[56px] border-b border-black/20 flex-shrink-0">
          <button onClick={() => section === 'main' ? dispatch({ type: 'TOGGLE_SETTINGS' }) : setSection('main')} className="p-1"><X size={20} className="text-tg-text-secondary" /></button>
          <h2 className="text-base font-medium text-tg-text">{section === 'main' ? t('settings') : section === 'privacy' ? t('privacy') : section === 'language' ? t('language') : section === 'passcode' ? t('passcode') : section === 'theme' ? t('theme') : section === 'permissions' ? 'Group Permissions' : section === 'announcements' ? 'Announcements' : section === 'moderation' ? 'Auto-Moderation' : t('theme')}</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {section === 'main' && <div className="py-2">
            <SettingsItem icon={<Shield size={20} />} label={t('privacy')} onClick={() => setSection('privacy')} />
            <SettingsItem icon={<Globe size={20} />} label={t('language')} subtitle={state.language === 'en' ? 'English' : state.language === 'uz' ? "O'zbekcha" : 'Русский'} onClick={() => setSection('language')} />
            <SettingsItem icon={state.theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />} label={t('theme')} subtitle={state.theme} onClick={() => setSection('theme')} />
            <SettingsItem icon={<Lock size={20} />} label={t('passcode')} subtitle={state.passcode ? 'Enabled' : 'Disabled'} onClick={() => setSection('passcode')} />
            <SettingsItem icon={<MessageSquare size={20} />} label={t('autoResponder')} subtitle={state.awayMode ? t('awayMode') : 'Off'} toggle={state.awayMode} onClick={() => dispatch({ type: 'SET_AWAY_MODE', away: !state.awayMode })} />
            {state.awayMode && <div className="px-4 py-2"><input type="text" value={state.awayMessage} onChange={e => dispatch({ type: 'SET_AWAY_MESSAGE', msg: e.target.value })} className="w-full bg-tg-input rounded-lg px-3 py-2 text-sm text-tg-text outline-none" placeholder={t('awayMessage')} /></div>}
            <SettingsItem icon={<Clock size={20} />} label="Do Not Disturb" subtitle={state.dndSchedule.enabled ? `${state.dndSchedule.startHour}:${String(state.dndSchedule.startMinute).padStart(2, '0')} - ${state.dndSchedule.endHour}:${String(state.dndSchedule.endMinute).padStart(2, '0')}` : 'Off'} toggle={state.dndSchedule.enabled} onClick={() => dispatch({ type: 'SET_DND_SCHEDULE', schedule: { ...state.dndSchedule, enabled: !state.dndSchedule.enabled } })} />
            {state.dndSchedule.enabled && <div className="px-4 py-2 flex gap-2 items-center"><span className="text-xs text-tg-text-secondary">From</span><input type="number" min={0} max={23} value={state.dndSchedule.startHour} onChange={e => dispatch({ type: 'SET_DND_SCHEDULE', schedule: { ...state.dndSchedule, startHour: Number(e.target.value) } })} className="w-12 bg-tg-input rounded px-1 py-1 text-xs text-tg-text outline-none text-center" />:<input type="number" min={0} max={59} value={state.dndSchedule.startMinute} onChange={e => dispatch({ type: 'SET_DND_SCHEDULE', schedule: { ...state.dndSchedule, startMinute: Number(e.target.value) } })} className="w-12 bg-tg-input rounded px-1 py-1 text-xs text-tg-text outline-none text-center" /><span className="text-xs text-tg-text-secondary">to</span><input type="number" min={0} max={23} value={state.dndSchedule.endHour} onChange={e => dispatch({ type: 'SET_DND_SCHEDULE', schedule: { ...state.dndSchedule, endHour: Number(e.target.value) } })} className="w-12 bg-tg-input rounded px-1 py-1 text-xs text-tg-text outline-none text-center" />:<input type="number" min={0} max={59} value={state.dndSchedule.endMinute} onChange={e => dispatch({ type: 'SET_DND_SCHEDULE', schedule: { ...state.dndSchedule, endMinute: Number(e.target.value) } })} className="w-12 bg-tg-input rounded px-1 py-1 text-xs text-tg-text outline-none text-center" /></div>}
            <SettingsItem icon={<Trash2 size={20} />} label="Auto-Delete Inactive" subtitle={state.currentUser.autoDeleteInactivity ? `${state.currentUser.autoDeleteInactivity} months` : 'Off'} onClick={() => setSection('autodelete')} />
            <SettingsItem icon={<Image size={20} />} label="Sticker Packs" subtitle={`${state.stickerPacks.length} packs`} onClick={() => { dispatch({ type: 'TOGGLE_STICKER_CREATOR' }); dispatch({ type: 'TOGGLE_SETTINGS' }); }} />
            <SettingsItem icon={<Star size={20} />} label="Wallet" subtitle={`⭐ ${state.wallet.stars}`} onClick={() => { dispatch({ type: 'TOGGLE_WALLET' }); dispatch({ type: 'TOGGLE_SETTINGS' }); }} />
            {canModerate && <SettingsItem icon={<Settings size={20} />} label="Group Permissions" subtitle={activeChat?.name} onClick={() => setSection('permissions')} />}
            {canModerate && <SettingsItem icon={<Ban size={20} />} label="Auto-Moderation" subtitle={(activeChat?.wordBlacklist || []).length ? `${activeChat!.wordBlacklist!.length} blocked words` : 'Off'} onClick={() => setSection('moderation')} />}
            <SettingsItem icon={<Megaphone size={20} />} label="Announcements" onClick={() => setSection('announcements')} />
            {/* Feature 18: Print chat */}
            <div className="px-4 py-1"><PrintChatButton /></div>
          </div>}

          {section === 'privacy' && <div className="py-2">
            <div className="px-4 py-3 text-sm text-tg-text-secondary">{t('privacy')}</div>
            <PrivacyItem label={t('lastSeenSettings')} value={state.currentUser.canSeeLastSeen} options={['everyone', 'contacts', 'nobody']} onChange={v => dispatch({ type: 'UPDATE_PROFILE', user: { canSeeLastSeen: v as 'everyone' | 'contacts' | 'nobody' } })} />
            <PrivacyItem label={t('userIdSettings')} value={state.currentUser.canSeeUserId} options={['everyone', 'contacts', 'nobody']} onChange={v => dispatch({ type: 'UPDATE_PROFILE', user: { canSeeUserId: v as 'everyone' | 'contacts' | 'nobody' } })} />
            {/* Feature 3: Ghost Mode */}
            <GhostModeToggle />
          </div>}

          {section === 'permissions' && state.activeChatId && <div>
            <GroupPermissionsPanel chatId={state.activeChatId} />
            <WelcomeMessageEditor chatId={state.activeChatId} />
            <AdminTitleSetter chatId={state.activeChatId} />
          </div>}

          {section === 'moderation' && activeChat && (() => {
            const words = activeChat.wordBlacklist || [];
            const save = (next: string[]) => dispatch({ type: 'SET_WORD_BLACKLIST', chatId: activeChat.id, words: next });
            return <div className="py-2">
              <div className="px-4 py-2 text-xs text-tg-text-secondary">Messages containing these words are blocked before they are sent in <span className="text-tg-text">{activeChat.name}</span>.</div>
              <div className="px-4 mb-3 flex gap-2">
                <input
                  value={blacklistInput}
                  onChange={e => setBlacklistInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && blacklistInput.trim()) { save([...words, blacklistInput.trim().toLowerCase()]); setBlacklistInput(''); } }}
                  placeholder="word to block..."
                  className="flex-1 bg-tg-input rounded-lg px-3 py-2 text-sm text-tg-text outline-none"
                />
                <button onClick={() => { if (blacklistInput.trim()) { save([...words, blacklistInput.trim().toLowerCase()]); setBlacklistInput(''); } }} className="px-3 py-2 bg-tg-accent text-white text-sm rounded-lg">Add</button>
              </div>
              {words.length === 0 && <div className="px-4 py-4 text-center text-sm text-tg-text-secondary">No blocked words yet</div>}
              {words.map((w, i) => (
                <div key={`${w}-${i}`} className="flex items-center gap-2 px-4 py-2 hover:bg-tg-hover">
                  <Ban size={14} className="text-tg-red" />
                  <span className="flex-1 text-sm text-tg-text">{w}</span>
                  <button onClick={() => save(words.filter((_, idx) => idx !== i))}><Trash2 size={14} className="text-tg-red" /></button>
                </div>
              ))}
            </div>;
          })()}

          {section === 'announcements' && state.activeChatId && (() => {
            const chat = state.chats.find(c => c.id === state.activeChatId);
            if (!chat) return null;
            return <div className="py-2">
              <div className="px-4 py-2 text-xs text-tg-text-secondary">Group Announcements</div>
              <div className="px-4 mb-3 flex gap-2">
                <input type="text" value={newAnn} onChange={e => setNewAnn(e.target.value)} placeholder="New announcement..." className="flex-1 bg-tg-input rounded-lg px-3 py-2 text-sm text-tg-text outline-none" />
                <button onClick={() => { if (newAnn.trim()) { dispatch({ type: 'ADD_ANNOUNCEMENT', chatId: state.activeChatId!, text: newAnn.trim() }); setNewAnn(''); } }} className="px-3 py-2 bg-tg-accent text-white text-sm rounded-lg">Add</button>
              </div>
              {(chat.announcements || []).map((a, i) => <div key={i} className="flex items-center gap-2 px-4 py-2 hover:bg-tg-hover"><Megaphone size={14} className="text-tg-accent" /><span className="flex-1 text-sm text-tg-text truncate">{a}</span><button onClick={() => dispatch({ type: 'REMOVE_ANNOUNCEMENT', chatId: state.activeChatId!, index: i })}><Trash2 size={14} className="text-tg-red" /></button></div>)}
            </div>;
          })()}

          {section === 'language' && <div className="py-2">
            {(['en', 'uz', 'ru'] as Language[]).map(lang => <button key={lang} onClick={() => dispatch({ type: 'SET_LANGUAGE', lang })} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-tg-hover transition-colors text-left"><div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${state.language === lang ? 'border-tg-accent' : 'border-tg-text-secondary'}`}>{state.language === lang && <div className="w-3 h-3 bg-tg-accent rounded-full" />}</div><span className="text-sm text-tg-text">{lang === 'en' ? 'English 🇬🇧' : lang === 'uz' ? "O'zbekcha 🇺🇿" : 'Русский 🇷🇺'}</span></button>)}
          </div>}

          {section === 'passcode' && <PasscodeSection state={state} dispatch={dispatch} passcode={newPasscode} setPasscode={setNewPasscode} />}

          {section === 'theme' && <div className="py-2">
            <ThemeOption label="🌙 Dark" isActive={state.theme === 'dark'} onClick={() => dispatch({ type: 'SET_THEME', theme: 'dark' })} bg="#0e1621" />
            <ThemeOption label="🌃 Night" isActive={state.theme === 'night'} onClick={() => dispatch({ type: 'SET_THEME', theme: 'night' })} bg="#0a0e14" />
          </div>}

          {section === 'autodelete' && <div className="py-2">
            <div className="px-4 py-3 text-sm text-tg-text-secondary">Auto-delete account data after inactivity</div>
            {([0, 1, 3, 6] as const).map(months => <button key={months} onClick={() => dispatch({ type: 'SET_AUTO_DELETE', months })} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-tg-hover transition-colors text-left"><div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${state.currentUser.autoDeleteInactivity === months ? 'border-tg-accent' : 'border-tg-text-secondary'}`}>{state.currentUser.autoDeleteInactivity === months && <div className="w-3 h-3 bg-tg-accent rounded-full" />}</div><span className="text-sm text-tg-text">{months === 0 ? 'Off' : `${months} month${months > 1 ? 's' : ''}`}</span></button>)}
          </div>}
        </div>
      </motion.div>
    </div>
  );
}

function SettingsItem({ icon, label, subtitle, onClick, toggle }: { icon: React.ReactNode; label: string; subtitle?: string; onClick?: () => void; toggle?: boolean }) {
  return <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-tg-hover transition-colors text-left"><span className="text-tg-text-secondary">{icon}</span><div className="flex-1"><div className="text-sm text-tg-text">{label}</div>{subtitle && <div className="text-xs text-tg-text-secondary">{subtitle}</div>}</div>{toggle !== undefined ? (toggle ? <ToggleRight size={24} className="text-tg-accent" /> : <ToggleLeft size={24} className="text-tg-text-secondary" />) : <ChevronRight size={16} className="text-tg-text-secondary" />}</button>;
}

function PrivacyItem({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const labels: Record<string, string> = { everyone: 'Everyone', contacts: 'My Contacts', nobody: 'Nobody' };
  return <div className="px-4 py-3"><div className="text-sm text-tg-text mb-2">{label}</div>{options.map(opt => <button key={opt} onClick={() => onChange(opt)} className="w-full flex items-center gap-2 py-1.5 text-left"><div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${value === opt ? 'border-tg-accent' : 'border-tg-text-secondary'}`}>{value === opt && <div className="w-2 h-2 bg-tg-accent rounded-full" />}</div><span className="text-sm text-tg-text">{labels[opt]}</span></button>)}</div>;
}

function ThemeOption({ label, isActive, onClick, bg }: { label: string; isActive: boolean; onClick: () => void; bg: string }) {
  return <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-tg-hover transition-colors text-left"><div className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center ${isActive ? 'border-tg-accent' : 'border-transparent'}`} style={{ background: bg }}><span className="text-lg">💬</span></div><span className="text-sm text-tg-text">{label}</span>{isActive && <div className="ml-auto w-5 h-5 bg-tg-accent rounded-full flex items-center justify-center">✓</div>}</button>;
}

function PasscodeSection({ state, dispatch, passcode, setPasscode }: { state: { passcode: string | null }; dispatch: React.Dispatch<{ type: 'SET_PASSCODE'; code: string | null } | { type: 'SET_LOCKED'; locked: boolean }>; passcode: string; setPasscode: (v: string) => void }) {
  const handleNum = (num: string | number) => {
    if (num === '₦') { setPasscode(passcode.slice(0, -1)); return; }
    if (num === '' || passcode.length >= 4) return;
    const next = passcode + num;
    setPasscode(next);
    if (next.length === 4) {
      if (state.passcode) { dispatch({ type: 'SET_PASSCODE', code: null }); dispatch({ type: 'SET_LOCKED', locked: false }); }
      else dispatch({ type: 'SET_PASSCODE', code: next });
      setPasscode('');
    }
  };
  return (
    <div className="py-4 px-4">
      <p className="text-sm text-tg-text-secondary mb-4">{state.passcode ? 'Enter current passcode to disable.' : 'Set a 4-digit passcode.'}</p>
      <div className="flex justify-center gap-3 mb-6">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`w-4 h-4 rounded-full pin-dot ${i < passcode.length ? 'filled bg-tg-accent' : 'bg-tg-text-secondary/30'}`} />)}</div>
      <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">{[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((num, i) => <button key={i} onClick={() => handleNum(num)} className={`h-12 rounded-lg text-lg font-medium ${num === '' ? 'invisible' : 'bg-tg-input hover:bg-tg-hover text-tg-text'}`}>{num}</button>)}</div>
    </div>
  );
}
