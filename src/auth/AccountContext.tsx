import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useApp } from '../store/AppContext';
import { network } from '../net/network';
import { clearSession, saveSession, type Session } from './session';
import { isValidUserId, normalizeUserId } from '../utils/identity';

interface AccountContextType {
  /** Signs in for real: loads this account's own workspace and connects it. */
  signIn: (session: Session) => void;
  /** Leaves the account and returns to the sign-in screen. */
  signOut: () => void;
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

  const addPeer = useCallback(async (rawId: string, name?: string, username?: string): Promise<boolean> => {
    const userId = normalizeUserId(rawId);
    if (!isValidUserId(userId)) {
      throw new Error('That is not a valid ID. Ask your friend for their 6-digit Teleflow ID.');
    }
    dispatch({ type: 'ADD_PEER', userId, name: name || '', username: username || '' });
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
    <AccountContext.Provider value={{ signIn, signOut, addPeer, isPeerOnline }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used within AccountProvider');
  return ctx;
}
