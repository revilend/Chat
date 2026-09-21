import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useApp } from '../store/AppContext';
import { network } from '../net/network';
import { clearSession, saveSession, updateAccountProfile, type Session } from './session';
import { isValidUserId, normalizeUserId, normalizeUsername } from '../utils/identity';
import { knownAccounts } from './session';
import { lookupHandle, rememberHandle } from '../utils/directory';

interface AccountContextType {
  /** Signs in for real: loads this account's own workspace and connects it. */
  signIn: (session: Session) => void;
  /** Leaves the account and returns to the sign-in screen. */
  signOut: () => void;
  /**
   * Saves an edited profile (name, handle, bio, avatar) to the account, the
   * session and the live connection. Throws when the handle is taken.
   */
  updateProfile: (patch: { name?: string; username?: string; bio?: string; phone?: string; avatar?: string; avatarColor?: string }) => void;
  /**
   * Turns a handle or a 6-digit ID into a real ID, using the accounts on this
   * device and everyone this device has already met.
   */
  resolveAddress: (input: string) => string | null;
  /**
   * Adds a real person by their address and waits a moment for them to answer.
   * Returns true when they are reachable right now — the chat is kept either way,
   * because they may simply be offline.
   */
  addPeer: (userId: string, name?: string, username?: string) => Promise<boolean>;
  /** Whether that person is connected right now. */
  isPeerOnline: (userId: string) => boolean;
}

const AccountContext = createContext<AccountContextType | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const { dispatch } = useApp();

  const signIn = useCallback((session: Session) => {
    saveSession(session);
    // Only the session is set here. The account's own chats, contacts and messages
    // are loaded from storage by AppProvider, so signing in never shows one person
    // the previous account's mailbox and never wipes what is already stored.
    dispatch({ type: 'SIGN_IN', session });
  }, [dispatch]);

  const signOut = useCallback(() => {
    network.stop();
    clearSession();
    dispatch({ type: 'SIGN_OUT' });
  }, [dispatch]);

  // Profile edits are written to the account record *and* kept in the session, so
  // a reload (or a later sign-in) shows the same name, handle and avatar.
  const updateProfile = useCallback((patch: { name?: string; username?: string; bio?: string; phone?: string; avatar?: string; avatarColor?: string }) => {
    const saved = updateAccountProfile({ name: patch.name, username: patch.username });
    if (saved) {
      // The connection introduces us by our new name/handle from now on.
      network.displayName = saved.name;
      network.username = saved.username;
      dispatch({ type: 'UPDATE_SESSION', patch: { name: saved.name, username: saved.username } });
    }
    const user: Record<string, unknown> = {};
    if (patch.name !== undefined) user.name = patch.name;
    if (patch.bio !== undefined) user.bio = patch.bio;
    if (patch.phone !== undefined) user.phone = patch.phone;
    if (patch.avatar !== undefined) user.avatar = patch.avatar;
    if (patch.avatarColor !== undefined) user.avatarColor = patch.avatarColor;
    if (Object.keys(user).length > 0) dispatch({ type: 'UPDATE_PROFILE', user });
  }, [dispatch]);

  const resolveAddress = useCallback((input: string): string | null => {
    const value = input.trim();
    if (!value) return null;
    // A plain 6-digit ID (written 461182 or 461-182) is an address on its own.
    if (isValidUserId(value)) return normalizeUserId(value);
    const handle = normalizeUsername(value);
    const fromDevice = knownAccounts().find(a => normalizeUsername(a.username) === handle);
    if (fromDevice) return fromDevice.userId;
    return lookupHandle(handle);
  }, []);

  const addPeer = useCallback(async (rawId: string, name?: string, username?: string): Promise<boolean> => {
    const userId = resolveAddress(rawId);
    if (!userId || !isValidUserId(userId)) {
      throw new Error(rawId.trim().startsWith('@')
        ? 'That @username is not known on this device yet. Ask your friend for their 6-digit ID instead.'
        : 'That is not a valid ID. Ask your friend for their 6-digit Teleflow ID.');
    }
    const handle = normalizeUsername(rawId);
    if (handle && /[a-z]/.test(handle)) rememberHandle(handle, userId);
    dispatch({ type: 'ADD_PEER', userId, name: name || '', username: username || (handle && /[a-z]/.test(handle) ? handle : '') });
    network.trackContacts([userId]);
    if (network.isOnline(userId)) return true;

    return await new Promise<boolean>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => finish(false), 8000);
      const off = network.on((event) => {
        if (event.type === 'peer' && event.userId === userId && event.state === 'online') finish(true);
      });
      function finish(online: boolean) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        off();
        resolve(online);
      }
    });
  }, [dispatch]);

  const isPeerOnline = useCallback((userId: string) => network.isOnline(userId), []);

  return (
    <AccountContext.Provider value={{ signIn, signOut, addPeer, isPeerOnline, updateProfile, resolveAddress }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used within AccountProvider');
  return ctx;
}
