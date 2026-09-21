import { deriveAccountId, isValidUserId, normalizeUserId, normalizeUsername } from '../utils/identity';

export interface Session {
  /** Six-digit public ID — the address other people add you by. */
  userId: string;
  username: string;
  name: string;
  createdAt: number;
}

interface AccountRecord {
  userId: string;
  /** The handle shown to people right now (it can be changed in the profile). */
  username: string;
  /**
   * The handle the account ID was derived from. Kept so the password can still be
   * checked after a rename: the ID is a hash of this handle plus the password.
   */
  credentialUsername?: string;
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
    // A session from an older version points at an address nobody can reach any
    // more (32 hex characters). Signing in again creates a real 6-digit ID.
    if (!parsed?.userId || !isValidUserId(parsed.userId)) return null;
    return { ...parsed, userId: normalizeUserId(parsed.userId) };
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
    const parsed = raw ? (JSON.parse(raw) as AccountRecord[]) : [];
    return parsed.filter(a => a?.username && isValidUserId(a.userId));
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
 * The account ID (six digits) is derived from the credentials, so the *same*
 * username and password always produce the same ID on every device — that ID
 * is what other people add to reach you, and the only thing that can ever
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

  const accounts = readAccounts();
  const userId = await deriveAccountId(handle, password);

  // An account is found by its current handle *or* by the handle its ID was
  // originally derived from, so renaming a handle never locks anyone out.
  const registered = accounts.find(a => a.username === handle || a.credentialUsername === handle);

  if (registered) {
    const seed = registered.credentialUsername ?? registered.username;
    const expected = await deriveAccountId(seed, password);
    if (expected !== registered.userId) {
      throw new Error(mode === 'signin'
        ? 'That password does not match this username.'
        : 'That username is already used here with a different password.');
    }
    const session: Session = {
      userId: registered.userId,
      username: registered.username,
      name: (displayName.trim() || registered.name).slice(0, 40),
      createdAt: registered.createdAt,
    };
    if (displayName.trim() && displayName.trim() !== registered.name) {
      writeAccounts(accounts.map(a => (a.userId === registered.userId ? { ...a, name: session.name } : a)));
    }
    saveSession(session);
    return session;
  }

  // Signing in with no local record is allowed on purpose: the ID is derived from
  // the credentials, so the same username and password open the same account on a
  // new device, after clearing the browser, or in a private window. The password
  // still has to be the original one — a wrong one derives a different ID, which
  // is exactly what keeps accounts apart.
  const name = (displayName.trim() || handle).slice(0, 40);
  const session: Session = {
    userId,
    username: handle,
    name,
    createdAt: Date.now(),
  };
  writeAccounts([...accounts, { userId, username: handle, credentialUsername: handle, name, createdAt: session.createdAt }]);
  saveSession(session);
  return session;
}

/**
 * Saves a profile change (display name, handle, avatar…) so it survives a reload
 * and the next sign-in. The account ID never changes.
 */
export function updateAccountProfile(patch: { name?: string; username?: string }): Session | null {
  const session = loadSession();
  if (!session) return null;
  const handle = patch.username ? normalizeUsername(patch.username) : undefined;
  if (handle !== undefined) {
    if (handle.length < 3) throw new Error('Username must be at least 3 characters.');
    if (!/^[a-z0-9_]+$/.test(handle)) throw new Error('Username can only use letters, numbers and _');
  }
  const next: Session = {
    ...session,
    name: patch.name?.trim() ? patch.name.trim().slice(0, 40) : session.name,
    username: handle ?? session.username,
  };
  const accounts = readAccounts().map(a => (a.userId === session.userId
    ? { ...a, name: next.name, username: next.username }
    : a));
  // A handle that belongs to somebody else on this device must not be stolen.
  if (accounts.some(a => a.userId !== session.userId && a.username === next.username)) {
    throw new Error('That username is already used on this device.');
  }
  writeAccounts(accounts);
  saveSession(next);
  return next;
}

/**
 * True when this browser still holds a session from the version that used long
 * 32-character addresses. Those addresses cannot be reached any more, so the
 * sign-in screen tells the person why they have to sign in again.
 */
export function hasLegacySession(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Session;
    return Boolean(parsed?.userId) && !isValidUserId(parsed.userId);
  } catch {
    return false;
  }
}

/** Whether this browser has seen the account before (used for a friendly hint). */
export function isKnownAccount(username: string): boolean {
  const handle = normalizeUsername(username);
  return readAccounts().some(a => a.username === handle);
}
