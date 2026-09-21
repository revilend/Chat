import { deriveUserId, normalizeUsername } from '../utils/identity';

export interface Session {
  /** 32-hex public address — also the peer address other people add you by. */
  userId: string;
  username: string;
  name: string;
  createdAt: number;
}

interface AccountRecord {
  userId: string;
  username: string;
  name: string;
  createdAt: number;
}

const SESSION_KEY = 'tgw.session.v1';
const ACCOUNTS_KEY = 'tgw.accounts.v1';

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return parsed?.userId ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* private mode */ }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

function readAccounts(): AccountRecord[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as AccountRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: AccountRecord[]) {
  try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)); } catch { /* ignore */ }
}

/** Accounts that have been used in this browser before. */
export function knownAccounts(): AccountRecord[] {
  return readAccounts();
}

/**
 * Turns a username + password into a real account.
 *
 * The account ID is derived from the credentials, so the *same* username and
 * password always produce the same address on every device — that address is
 * what other people add to reach you, and the only thing that can ever
 * reproduce it is that exact password.
 */
export async function authenticate(
  mode: 'signin' | 'signup',
  username: string,
  password: string,
  displayName: string,
): Promise<Session> {
  const handle = normalizeUsername(username);

  if (handle.length < 3) throw new Error('Username must be at least 3 characters.');
  if (!/^[a-z0-9_]+$/.test(handle)) throw new Error('Username can only use letters, numbers and _');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');

  const userId = await deriveUserId(handle, password);
  const accounts = readAccounts();
  const registered = accounts.find(a => a.username === handle);

  // A username already used here with another password is a typo or a different
  // person — either way it must not silently open a different account.
  if (registered && registered.userId !== userId) {
    throw new Error(mode === 'signin'
      ? 'That password does not match this username.'
      : 'That username is already used here with a different password.');
  }

  // Signing in with no local record is allowed on purpose: the address is derived
  // from the credentials, so the same username and password open the same account
  // on a new device, after clearing the browser, or in a private window. The
  // password still has to be the original one — a wrong one derives a different
  // address, which is exactly what keeps accounts apart.

  const name = (displayName.trim() || registered?.name || handle).slice(0, 40);
  const session: Session = {
    userId,
    username: handle,
    name,
    createdAt: registered?.createdAt ?? Date.now(),
  };

  const next = registered
    ? accounts.map(a => (a.username === handle ? { ...a, name } : a))
    : [...accounts, { userId, username: handle, name, createdAt: session.createdAt }];
  writeAccounts(next);
  saveSession(session);
  return session;
}

/** Whether this browser has seen the account before (used for a friendly hint). */
export function isKnownAccount(username: string): boolean {
  const handle = normalizeUsername(username);
  return readAccounts().some(a => a.username === handle);
}
