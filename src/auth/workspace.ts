import type { Chat, Contact, Message, Story, User } from '../types';
import type { Session } from './session';

/** A local assistant bot — it runs entirely in this browser, there is no server behind it. */
export const helperBot: User = {
  id: 'user_helper_bot',
  name: 'Helper Bot',
  username: 'helperbot',
  avatar: '',
  bio: 'Local assistant. Send /help for the command list.',
  phone: '',
  lastSeen: Date.now(),
  isOnline: true,
  canSeeUserId: 'everyone',
  canSeeLastSeen: 'everyone',
};

export function accountUser(session: Session): User {
  return {
    id: session.userId,
    name: session.name,
    username: session.username,
    avatar: '',
    bio: '',
    phone: '',
    lastSeen: Date.now(),
    isOnline: true,
    canSeeUserId: 'everyone',
    canSeeLastSeen: 'everyone',
    autoDeleteInactivity: 0,
    lastActiveAt: Date.now(),
    ghostMode: false,
  };
}

export interface AccountWorkspace {
  currentUser: User;
  users: Record<string, User>;
  chats: Chat[];
  messages: Message[];
  contacts: Contact[];
  stories: Story[];
}

/**
 * The workspace a fresh account starts with: your own saved messages and a bot,
 * and nothing else. Every other chat is a real person you added by address.
 */
export function buildAccountWorkspace(session: Session): AccountWorkspace {
  const user = accountUser(session);
  return {
    currentUser: user,
    users: { user_me: user, [session.userId]: user, user_helper_bot: helperBot },
    chats: [
      { id: 'chat_saved', type: 'saved', name: 'Saved Messages', avatar: '', members: ['user_me'], admins: [], unreadCount: 0, isPinned: true, isArchived: false, isMuted: false },
      { id: 'chat_bot', type: 'private', name: 'Helper Bot', avatar: '', members: ['user_me', 'user_helper_bot'], admins: ['user_helper_bot'], unreadCount: 0, isPinned: false, isArchived: false, isMuted: false },
    ],
    messages: [],
    contacts: [],
    stories: [],
  };
}
