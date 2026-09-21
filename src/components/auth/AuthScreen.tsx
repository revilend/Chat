import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Eye, EyeOff, IdCard, KeyRound, Loader2, Lock, Radio, Shield, UserPlus } from 'lucide-react';
import { authenticate, hasLegacySession, knownAccounts, type Session } from '../../auth/session';
import { useAccount } from '../../auth/AccountContext';
import { formatUserId, shortId } from '../../utils/identity';

type Mode = 'signin' | 'signup';

export function AuthScreen() {
  const { signIn } = useAccount();
  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Session | null>(null);
  const [copied, setCopied] = useState(false);

  const accounts = knownAccounts();
  // Someone upgrading from the long-address version: their old address is gone and
  // they need to know why they are being asked to sign in again.
  const [upgraded] = useState(() => hasLegacySession());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'signup' && password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const session = await authenticate(mode, username, password, name);
      if (mode === 'signup') setCreated(session);
      else signIn(session);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  const copyAddress = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — select the ID and copy it manually.');
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-tg-bg tg-doodle relative">
      {/* Soft brand glow so the first screen does not look like a plain form */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_15%_0%,rgba(51,144,236,0.22),transparent_70%),radial-gradient(45%_45%_at_100%_100%,rgba(143,123,255,0.18),transparent_70%)]" />
      <div className="relative min-h-full flex flex-col lg:flex-row items-stretch">
        {/* Brand side */}
        <div className="lg:w-[46%] flex flex-col justify-center px-8 py-12 lg:px-16">
          <div className="flex items-center gap-3">
            <div
              style={{ background: 'linear-gradient(140deg, #52b6ff, #3390ec 55%, #2f7fe0)' }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl shadow-tg-accent/40 ring-1 ring-white/15"
            >
              <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
                <path d="M27 5L3 14.5l6.5 2.4L22 9.5l-9.4 9.1.6 6.9 4-4.6 5.4 4 4.4-19.9Z" fill="white" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-semibold text-tg-text tracking-tight">Teleflow</div>
              <div className="text-xs text-tg-text-secondary">Messages that go straight to the other device</div>
            </div>
          </div>

          <h1 className="mt-10 text-[32px] lg:text-[44px] font-semibold text-tg-text leading-[1.08] tracking-tight">
            Talk to real people,
            <br />
            <span className="bg-gradient-to-r from-[#52b6ff] to-[#8f7bff] bg-clip-text text-transparent">device to device.</span>
          </h1>
          <p className="mt-4 text-sm text-tg-text-secondary max-w-md leading-relaxed">
            Create an account and you get a short 6-digit ID. Give it to a friend, they add it, and your
            messages travel directly between your two browsers — no mailbox in the middle.
          </p>

          <div className="mt-10 space-y-4 max-w-md">
            <Bullet icon={<IdCard size={16} />} title="Your ID is just six digits">
              No long code to copy. Read it out loud, type it by hand — for example 784 219.
            </Bullet>
            <Bullet icon={<KeyRound size={16} />} title="One ID, any device">
              Your ID is derived from your username and password, so the same login works on your phone,
              your laptop and your friend's browser.
            </Bullet>
            <Bullet icon={<Radio size={16} />} title="Direct connection">
              Chats run over an encrypted WebRTC data channel between you and the other person, the way a
              phone call does.
            </Bullet>
            <Bullet icon={<Shield size={16} />} title="Nothing fake">
              Nobody else's messages, no simulated replies. If someone is online, it is because they are
              connected right now.
            </Bullet>
          </div>
        </div>

        {/* Form side */}
        <div className="lg:w-[54%] flex items-center justify-center px-6 py-12 lg:px-16">
          <div className="w-full max-w-[420px]">
            {upgraded && (
              <div className="mb-4 rounded-xl border border-tg-accent/30 bg-tg-accent/10 px-3.5 py-3 text-[12px] leading-relaxed text-tg-text">
                <span className="font-semibold">Your address became a 6-digit ID.</span>{' '}
                Sign in with the same username and password you used before — your ID and your chats come back.
              </div>
            )}
            <AnimatePresence mode="wait">
              {created ? (
                <motion.div
                  key="created"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card p-6 backdrop-blur-xl"
                >
                  <div className="w-12 h-12 rounded-full bg-tg-green/15 flex items-center justify-center">
                    <Check size={22} className="text-tg-green" />
                  </div>
                  <h2 className="mt-4 text-lg font-medium text-tg-text">Your account is ready</h2>
                  <p className="mt-1 text-sm text-tg-text-secondary">
                    This is your ID. Share it with the person you want to write to — they add it under Contacts
                    to reach you.
                  </p>

                  <div className="mt-4 rounded-xl bg-tg-input p-4 text-center">
                    <div className="text-[11px] uppercase tracking-wide text-tg-text-secondary">Your ID</div>
                    <div className="mt-1 font-mono text-[34px] leading-tight tracking-[0.18em] text-tg-text">
                      {formatUserId(created.userId)}
                    </div>
                  </div>

                  <button
                    onClick={copyAddress}
                    className="btn btn-primary mt-3 w-full h-12 rounded-xl"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied' : 'Copy my ID'}
                  </button>

                  <div className="mt-4 text-xs text-tg-text-secondary">
                    You are <span className="text-tg-text">@{created.username}</span> · ID{' '}
                    <span className="font-mono">{shortId(created.userId)}</span>
                  </div>

                  <button
                    onClick={() => signIn(created)}
                    className="mt-5 w-full h-11 rounded-lg bg-tg-hover text-tg-text text-sm font-medium hover:bg-tg-hover/80 transition-colors"
                  >
                    Start messaging
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={submit}
                  className="card p-6 backdrop-blur-xl"
                >
                  <div className="flex gap-1 p-1 rounded-2xl bg-tg-input">
                    {(['signup', 'signin'] as Mode[]).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setMode(m); setError(''); }}
                        className={`flex-1 h-10 rounded-xl text-sm font-medium transition-all ${mode === m ? 'bg-tg-accent text-white shadow-md shadow-tg-accent/30' : 'text-tg-text-secondary hover:text-tg-text'}`}
                      >
                        {m === 'signup' ? 'Create account' : 'Sign in'}
                      </button>
                    ))}
                  </div>

                  <h2 className="mt-6 text-lg font-medium text-tg-text">
                    {mode === 'signup' ? 'Create your account' : 'Welcome back'}
                  </h2>
                  <p className="mt-1 text-sm text-tg-text-secondary">
                    {mode === 'signup'
                      ? 'Pick a name and a password. They generate your 6-digit ID and are never stored anywhere.'
                      : 'Enter the same username and password you used before to get your ID and your chats back.'}
                  </p>

                  <div className="mt-5 space-y-3">
                    {mode === 'signup' && (
                      <Field label="Your name" value={name} onChange={setName} placeholder="Aziza Karimova" autoFocus />
                    )}
                    <Field
                      label="Username"
                      value={username}
                      onChange={v => setUsername(v.replace(/\s/g, ''))}
                      placeholder="aziza"
                      prefix="@"
                    />
                    <Field
                      label="Password"
                      value={password}
                      onChange={setPassword}
                      placeholder="At least 6 characters"
                      type={showPassword ? 'text' : 'password'}
                      trailing={
                        <button type="button" onClick={() => setShowPassword(s => !s)} className="text-tg-text-secondary hover:text-tg-text">
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      }
                    />
                    {mode === 'signup' && (
                      <Field
                        label="Repeat password"
                        value={confirm}
                        onChange={setConfirm}
                        placeholder="Same password again"
                        type={showPassword ? 'text' : 'password'}
                      />
                    )}
                  </div>

                  {error && (
                    <div className="mt-4 rounded-lg bg-tg-red/10 border border-tg-red/30 px-3 py-2 text-xs text-tg-red">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="btn btn-primary mt-5 w-full h-12 rounded-xl"
                  >
                    {busy && <Loader2 size={16} className="animate-spin" />}
                    {busy ? 'Creating your ID…' : mode === 'signup' ? 'Create account' : 'Sign in'}
                  </button>

                  {accounts.length > 0 && (
                    <div className="mt-6 border-t border-black/20 pt-4">
                      <div className="text-[11px] uppercase tracking-wide text-tg-text-secondary">
                        Accounts on this device
                      </div>
                      <div className="mt-2 space-y-1">
                        {accounts.map(acc => (
                          <button
                            key={acc.userId}
                            type="button"
                            onClick={() => { setUsername(acc.username); setMode('signin'); setError(''); }}
                            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-tg-hover transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-tg-accent/20 text-tg-accent flex items-center justify-center text-xs font-semibold">
                              {acc.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-tg-text truncate">@{acc.username}</div>
                              <div className="text-[11px] text-tg-text-secondary font-mono truncate">ID {shortId(acc.userId)}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-5 flex items-start gap-2 text-[11px] text-tg-text-secondary leading-relaxed">
                    <Lock size={13} className="mt-0.5 flex-shrink-0" />
                    <span>
                      Your password never leaves this device and is never uploaded. It only generates your ID
                      locally, so keep it safe — the same username and password always bring your ID back.
                    </span>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bullet({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-tg-accent/15 text-tg-accent flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium text-tg-text">{title}</div>
        <div className="text-xs text-tg-text-secondary leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', prefix, trailing, autoFocus }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  prefix?: string;
  trailing?: React.ReactNode;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wide text-tg-text-secondary">{label}</span>
      <div className="mt-1.5 flex items-center gap-2 bg-tg-input rounded-xl px-3.5 h-12 border border-transparent focus-within:border-tg-accent transition-colors">
        {prefix && <span className="text-tg-text-secondary text-sm">{prefix}</span>}
        <input
          type={type}
          value={value}
          autoFocus={autoFocus}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-[15px] text-tg-text placeholder:text-tg-text-secondary"
        />
        {trailing}
      </div>
    </label>
  );
}

/** Kept for the “already have an account” shortcut in empty states. */
export function SignInShortcut({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-2 text-sm text-tg-accent hover:underline">
      <UserPlus size={15} /> Sign in
    </button>
  );
}
