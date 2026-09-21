import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { User, Chat, Message, Story, Account, Contact, Language, ThemeMode, FolderType, Poll, Reminder, StickerPack, DNDSchedule, Wallet, GroupPermissions, PendingMedia, NowPlaying } from '../types';
import { translations } from '../i18n';
import { persistWorkspace, loadStoredWorkspace, clearStoredWorkspace, type StoredWorkspace } from '../utils/storage';
import { playIncomingMessage, playOutgoingMessage } from '../utils/audio';
import { parseInviteHash } from '../utils/invite';
import { network, type CloudStatus, type OutgoingEnvelope } from '../net/network';
import type { MediaConnection } from 'peerjs';
import { loadSession, type Session } from '../auth/session';
import { isValidUserId, shortId } from '../utils/identity';
import { buildAccountWorkspace } from '../auth/workspace';

export interface AppState {
  currentUser: User; users: Record<string, User>; chats: Chat[]; messages: Message[]; stories: Story[];
  accounts: Account[]; contacts: Contact[]; activeChatId: string | null; activeFolder: FolderType;
  activeTopicId: string | null; searchQuery: string; isSettingsOpen: boolean; isProfileOpen: boolean;
  isContactsOpen: boolean; isCreateGroupOpen: boolean; isCreateChannelOpen: boolean; isPollModalOpen: boolean;
  isQRCodeOpen: boolean; isPhotoEditorOpen: boolean; isGiftModalOpen: boolean; isCallActive: boolean;
  callType: 'voice' | 'video'; callChatId: string | null; language: Language; theme: ThemeMode;
  passcode: string | null; isLocked: boolean; awayMode: boolean; awayMessage: string;
  selectedMessages: string[]; replyTo: string | null; editingMessageId: string | null;
  forwardedMessageId: string | null; showScheduledPicker: boolean; showQuickReplies: boolean;
  miniApp: 'snake' | '2048' | null; voiceChatActive: boolean; voiceChatChatId: string | null; tabId: string;
  reminders: Reminder[]; showReminderModal: boolean; reminderChatId: string | null;
  showJoinApproval: boolean; wallet: Wallet; showWalletModal: boolean;
  showLeaderboard: boolean; showSplitBill: boolean; stickerPacks: StickerPack[]; showStickerCreator: boolean;
  dndSchedule: DNDSchedule; lastActiveAt: number;
  // Feature 8: Tags & bookmarks
  tagFilter: string | null; showBookmarks: boolean;
  // Feature 11: Calendar viewer
  showCalendarViewer: boolean; calendarDate: string;
  // Feature 13: Media send confirmation
  pendingMediaFiles: PendingMedia[]; showMediaConfirm: boolean;
  // Feature 15: Search hit navigator
  searchHits: string[]; currentSearchHitIndex: number;
  // Feature 17: Announcement banner index
  announcementIndex: number;
  // Archived chats folder toggle (from the main menu)
  showArchivedFolder: boolean;
  /** Music currently loaded into the sticky mini player */
  nowPlaying: NowPlaying | null;
  /** Image data URL opened in the photo editor */
  photoEditorSource: string | null;
  // --- Real accounts & real peer-to-peer connection ---
  /** Signed-in account. `null` shows the sign-in screen. */
  session: Session | null;
  /**
   * Which account's stored workspace has finished loading. Until this matches the
   * signed-in account the workspace must not be written back, or the empty state
   * the app boots with would overwrite the history on disk.
   */
  hydratedFor: string | null;
  /** Connection state of the peer-to-peer link service. */
  netStatus: CloudStatus;
  netDetail: string;
  /** People currently reachable right now. */
  peerPresence: Record<string, boolean>;
  // --- Real peer-to-peer calls ---
  /** A call ringing on this device, waiting to be answered. */
  incomingCall: { userId: string; connection: MediaConnection; video: boolean } | null;
}

type Action =
  | { type: 'SET_ACTIVE_CHAT'; chatId: string | null }
  | { type: 'SET_ACTIVE_FOLDER'; folder: FolderType }
  | { type: 'SET_ACTIVE_TOPIC'; topicId: string | null }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'TOGGLE_SETTINGS' } | { type: 'TOGGLE_PROFILE' } | { type: 'TOGGLE_CONTACTS' }
  | { type: 'TOGGLE_CREATE_GROUP' } | { type: 'TOGGLE_CREATE_CHANNEL' } | { type: 'TOGGLE_POLL_MODAL' }
  | { type: 'TOGGLE_QR_CODE' } | { type: 'TOGGLE_PHOTO_EDITOR' } | { type: 'TOGGLE_GIFT_MODAL' }
  | { type: 'START_CALL'; chatId: string; callType: 'voice' | 'video' } | { type: 'END_CALL' }
  | { type: 'INCOMING_CALL'; userId: string; connection: MediaConnection; video: boolean }
  | { type: 'CLEAR_INCOMING_CALL' }
  | { type: 'SET_LANGUAGE'; lang: Language } | { type: 'SET_THEME'; theme: ThemeMode }
  | { type: 'SET_PASSCODE'; code: string | null } | { type: 'SET_LOCKED'; locked: boolean }
  | { type: 'SET_AWAY_MODE'; away: boolean } | { type: 'SET_AWAY_MESSAGE'; msg: string }
  | { type: 'UPDATE_PROFILE'; user: Partial<User> }
  | { type: 'SEND_MESSAGE'; message: Message } | { type: 'RECEIVE_MESSAGE'; message: Message }
  | { type: 'DELETE_MESSAGE'; messageId: string } | { type: 'EDIT_MESSAGE'; messageId: string; newText: string }
  | { type: 'PIN_MESSAGE'; messageId: string }
  | { type: 'TOGGLE_REACTION'; messageId: string; emoji: string }
  | { type: 'SELECT_MESSAGE'; messageId: string } | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_REPLY_TO'; messageId: string | null } | { type: 'SET_EDITING'; messageId: string | null }
  | { type: 'SET_FORWARDING'; messageId: string | null }
  | { type: 'CREATE_POLL'; chatId: string; poll: Poll }
  | { type: 'VOTE_POLL'; messageId: string; optionIndex: number }
  | { type: 'PIN_CHAT'; chatId: string } | { type: 'ARCHIVE_CHAT'; chatId: string }
  | { type: 'MUTE_CHAT'; chatId: string } | { type: 'DELETE_CHAT'; chatId: string }
  | { type: 'SET_TYPING'; chatId: string; userId: string; isTyping: boolean }
  | { type: 'ADD_CONTACT'; userId: string } | { type: 'REMOVE_CONTACT'; userId: string }
  | { type: 'MARK_STORY_VIEWED'; storyId: string }
  | { type: 'ADD_STORY'; story: Story }
  | { type: 'SET_DRAFT'; chatId: string; draft: string } | { type: 'ADD_CHAT'; chat: Chat }
  | { type: 'JOIN_CHAT'; chatId: string }
  | { type: 'RELEASE_DUE_MESSAGES' }
  | { type: 'SET_CONTACT_NOTE'; userId: string; note: string }
  | { type: 'ADD_USER'; user: User }
  | { type: 'TOGGLE_ARCHIVED_FOLDER' }
  | { type: 'SET_NOW_PLAYING'; nowPlaying: NowPlaying | null }
  | { type: 'TOGGLE_NOW_PLAYING' }
  | { type: 'SET_PHOTO_EDITOR_SOURCE'; source: string | null }
  | { type: 'SET_PENDING_MEDIA_FILE'; index: number; media: PendingMedia }
  | { type: 'SET_PENDING_MEDIA_VIEW_ONCE'; index: number; viewOnce: boolean }
  | { type: 'SHOW_SCHEDULED_PICKER' } | { type: 'HIDE_SCHEDULED_PICKER' }
  | { type: 'SHOW_QUICK_REPLIES' } | { type: 'HIDE_QUICK_REPLIES' }
  | { type: 'SET_MINI_APP'; app: 'snake' | '2048' | null }
  | { type: 'START_VOICE_CHAT'; chatId: string } | { type: 'END_VOICE_CHAT' }
  | { type: 'LOAD_STATE'; state: Partial<AppState> }
  | { type: 'SET_SLOW_MODE'; chatId: string; seconds: 0 | 10 | 30 | 60 }
  | { type: 'POST_AS_ANONYMOUS'; chatId: string; text: string }
  | { type: 'SET_CHAT_WALLPAPER'; chatId: string; wallpaper: string | undefined }
  | { type: 'ADD_REMINDER'; reminder: Reminder } | { type: 'TRIGGER_REMINDER'; reminderId: string }
  | { type: 'DISMISS_REMINDER'; reminderId: string }
  | { type: 'TOGGLE_REMINDER_MODAL'; chatId?: string }
  | { type: 'SEND_WHEN_ONLINE'; messageId: string } | { type: 'USER_CAME_ONLINE'; userId: string }
  | { type: 'REQUEST_TO_JOIN'; chatId: string; userId: string }
  | { type: 'APPROVE_JOIN'; chatId: string; userId: string }
  | { type: 'DENY_JOIN'; chatId: string; userId: string } | { type: 'TOGGLE_JOIN_APPROVAL' }
  | { type: 'PURCHASE_STARS'; amount: number } | { type: 'UNLOCK_PAID_POST'; messageId: string }
  | { type: 'TOGGLE_WALLET' }
  | { type: 'SET_WORD_BLACKLIST'; chatId: string; words: string[] }
  | { type: 'TOGGLE_LEADERBOARD' }
  | { type: 'TOGGLE_SPLIT_BILL' }
  | { type: 'CREATE_SPLIT_BILL'; chatId: string; splitBill: NonNullable<Message['splitBill']> }
  | { type: 'MARK_SPLIT_PAID'; messageId: string; userId: string }
  | { type: 'BOOST_CHANNEL'; chatId: string }
  | { type: 'ADD_STICKER_PACK'; pack: StickerPack } | { type: 'DELETE_STICKER_PACK'; packId: string }
  | { type: 'TOGGLE_STICKER_CREATOR' }
  | { type: 'SET_DND_SCHEDULE'; schedule: DNDSchedule }
  | { type: 'SET_AUTO_DELETE'; months: 0 | 1 | 3 | 6 }
  | { type: 'SET_ADMIN_TITLE'; chatId: string; userId: string; title: string }
  // NEW 18 features
  | { type: 'TOGGLE_GHOST_MODE' }
  | { type: 'SET_GROUP_PERMISSIONS'; chatId: string; permissions: GroupPermissions }
  | { type: 'SET_WELCOME_MESSAGE'; chatId: string; text: string }
  | { type: 'ADD_TAG'; messageId: string; tag: string }
  | { type: 'REMOVE_TAG'; messageId: string; tag: string }
  | { type: 'TOGGLE_BOOKMARK'; messageId: string }
  | { type: 'SET_TAG_FILTER'; tag: string | null }
  | { type: 'TOGGLE_BOOKMARKS_VIEW' }
  | { type: 'TOGGLE_CALENDAR_VIEWER' }
  | { type: 'SET_CALENDAR_DATE'; date: string }
  | { type: 'SET_PENDING_MEDIA'; files: PendingMedia[] }
  | { type: 'CONFIRM_SEND_MEDIA' }
  | { type: 'CANCEL_SEND_MEDIA' }
  | { type: 'SET_SEARCH_HITS'; hits: string[]; index: number }
  | { type: 'CYCLE_SEARCH_HIT'; direction: 1 | -1 }
  | { type: 'SET_ANNOUNCEMENT_INDEX'; index: number }
  | { type: 'SET_VOICE_EFFECT'; effect: 'normal' | 'robot' | 'deep' | 'chipmunk' }
  | { type: 'ADD_ANNOUNCEMENT'; chatId: string; text: string }
  | { type: 'REMOVE_ANNOUNCEMENT'; chatId: string; index: number }
  // --- Real accounts & peer-to-peer messaging ---
  | { type: 'SIGN_IN'; session: Session }
  | { type: 'SIGN_OUT' }
  | { type: 'SET_HYDRATED'; userId: string }
  | { type: 'SET_NET_STATUS'; status: CloudStatus; detail: string }
  | { type: 'ADD_PEER'; userId: string; name: string; username: string }
  | { type: 'SET_PEER_PRESENCE'; userId: string; online: boolean }
  | { type: 'SET_DELIVERY'; messageId: string; pending: boolean }
  | { type: 'MARK_MESSAGES_READ'; messageIds: string[]; userId: string };

/** The signed-out placeholder — nothing is rendered until an account signs in. */
const placeholderUser: User = {
  id: '', name: '', username: '', avatar: '', bio: '', phone: '',
  lastSeen: 0, isOnline: false, canSeeUserId: 'everyone', canSeeLastSeen: 'everyone',
  autoDeleteInactivity: 0, lastActiveAt: Date.now(), ghostMode: false,
};


const initialState: AppState = {
  currentUser: placeholderUser,
  users: {}, chats: [], messages: [], stories: [],
  accounts: [], contacts: [],
  activeChatId: null, activeFolder: 'all', activeTopicId: null, searchQuery: '',
  isSettingsOpen: false, isProfileOpen: false, isContactsOpen: false,
  isCreateGroupOpen: false, isCreateChannelOpen: false, isPollModalOpen: false,
  isQRCodeOpen: false, isPhotoEditorOpen: false, isGiftModalOpen: false,
  isCallActive: false, callType: 'voice', callChatId: null, language: 'en', theme: 'dark',
  passcode: null, isLocked: false, awayMode: false, awayMessage: 'I will return soon',
  selectedMessages: [], replyTo: null, editingMessageId: null, forwardedMessageId: null,
  showScheduledPicker: false, showQuickReplies: false, miniApp: null,
  voiceChatActive: false, voiceChatChatId: null, tabId: Math.random().toString(36).slice(2, 10),
  reminders: [], showReminderModal: false, reminderChatId: null,
  showJoinApproval: false, wallet: { stars: 100, transactions: [] }, showWalletModal: false,
  showLeaderboard: false, showSplitBill: false, stickerPacks: [], showStickerCreator: false,
  dndSchedule: { enabled: false, startHour: 22, startMinute: 0, endHour: 7, endMinute: 0 },
  lastActiveAt: Date.now(),
  // New features
  tagFilter: null, showBookmarks: false,
  showCalendarViewer: false, calendarDate: '',
  pendingMediaFiles: [], showMediaConfirm: false,
  searchHits: [], currentSearchHitIndex: -1,
  announcementIndex: 0,
  showArchivedFolder: false,
  nowPlaying: null,
  photoEditorSource: null,
  session: null,
  hydratedFor: null,
  netStatus: 'off',
  netDetail: '',
  peerPresence: {},
  incomingCall: null,
};

/** The stored session decides which workspace the app opens with. */
function buildInitialState(): AppState {
  const session = loadSession();
  if (!session) return { ...initialState, session: null };
  return { ...initialState, ...buildAccountWorkspace(session), session };
}

/**
 * The envelope that travels over the data channel for a real message.
 *
 * Every field is passed through, so photos, video messages, voice notes, music,
 * files, locations, stickers, gifts and polls arrive complete — not just text.
 * The few fields the receiving device decides for itself are stripped first.
 */
export function envelopeFor(message: Message, me: Session): OutgoingEnvelope {
  const payload: Record<string, unknown> = { ...message };
  delete payload.chatId;        // the recipient's own chat id for us
  delete payload.senderId;      // always the sender on their side
  delete payload.readBy;        // their unread state starts empty
  delete payload.scheduledAt;   // it has already left the queue by now
  delete payload.sendWhenOnline;
  return {
    kind: 'message', id: message.id, timestamp: message.timestamp, payload,
    userId: me.userId, name: me.name, username: me.username,
  };
}

/** Rebuilds the message on the receiving side from its envelope. */
export function messageFromEnvelope(senderId: string, envelope: OutgoingEnvelope): Message {
  const payload = (envelope.payload ?? {}) as Partial<Message>;
  return {
    ...payload,
    id: envelope.id ?? `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    chatId: `chat_peer_${senderId}`,
    senderId,
    timestamp: envelope.timestamp ?? Date.now(),
    readBy: [senderId],
    type: payload.type ?? 'text',
    text: payload.text ?? '',
  };
}

export function peerIdOfChat(chat: Chat | undefined): string | null {
  if (!chat || chat.type !== 'private') return null;
  const peer = chat.members.find(id => id !== 'user_me' && id !== 'user_helper_bot');
  return peer && isValidUserId(peer) ? peer : null;
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_ACTIVE_CHAT': {
      const chat = state.chats.find(c => c.id === action.chatId);
      return { ...state, activeChatId: action.chatId, activeTopicId: null, lastActiveAt: Date.now(), chats: chat ? state.chats.map(c => c.id === action.chatId ? { ...c, unreadCount: 0 } : c) : state.chats };
    }
    case 'SET_ACTIVE_FOLDER': return { ...state, activeFolder: action.folder };
    case 'SET_CONTACT_NOTE': {
      const existing = state.contacts.find(c => c.userId === action.userId);
      const contacts = existing
        ? state.contacts.map(c => c.userId === action.userId ? { ...c, privateNote: action.note } : c)
        : [...state.contacts, { userId: action.userId, isContact: false, isBlocked: false, privateNote: action.note }];
      return { ...state, contacts };
    }
    case 'ADD_USER': return { ...state, users: { ...state.users, [action.user.id]: action.user } };
    case 'TOGGLE_ARCHIVED_FOLDER': return { ...state, showArchivedFolder: !state.showArchivedFolder };
    case 'SET_NOW_PLAYING': return { ...state, nowPlaying: action.nowPlaying };
    case 'TOGGLE_NOW_PLAYING': return { ...state, nowPlaying: state.nowPlaying ? { ...state.nowPlaying, playing: !state.nowPlaying.playing } : null };
    case 'SET_PHOTO_EDITOR_SOURCE': return { ...state, photoEditorSource: action.source, isPhotoEditorOpen: !!action.source };
    case 'SET_PENDING_MEDIA_FILE': return { ...state, pendingMediaFiles: state.pendingMediaFiles.map((m, i) => i === action.index ? action.media : m) };
    case 'SET_PENDING_MEDIA_VIEW_ONCE': return { ...state, pendingMediaFiles: state.pendingMediaFiles.map((m, i) => i === action.index ? { ...m, viewOnce: action.viewOnce } : m) };
    case 'SET_ACTIVE_TOPIC': return { ...state, activeTopicId: action.topicId };
    case 'SET_SEARCH': return { ...state, searchQuery: action.query };
    case 'TOGGLE_SETTINGS': return { ...state, isSettingsOpen: !state.isSettingsOpen, isProfileOpen: false };
    case 'TOGGLE_PROFILE': return { ...state, isProfileOpen: !state.isProfileOpen, isSettingsOpen: false };
    case 'TOGGLE_CONTACTS': return { ...state, isContactsOpen: !state.isContactsOpen };
    case 'TOGGLE_CREATE_GROUP': return { ...state, isCreateGroupOpen: !state.isCreateGroupOpen };
    case 'TOGGLE_CREATE_CHANNEL': return { ...state, isCreateChannelOpen: !state.isCreateChannelOpen };
    case 'TOGGLE_POLL_MODAL': return { ...state, isPollModalOpen: !state.isPollModalOpen };
    case 'TOGGLE_QR_CODE': return { ...state, isQRCodeOpen: !state.isQRCodeOpen };
    case 'TOGGLE_PHOTO_EDITOR': return { ...state, isPhotoEditorOpen: !state.isPhotoEditorOpen };
    case 'TOGGLE_GIFT_MODAL': return { ...state, isGiftModalOpen: !state.isGiftModalOpen };
    case 'START_CALL': return { ...state, isCallActive: true, callType: action.callType, callChatId: action.chatId };
    case 'END_CALL': return { ...state, isCallActive: false, callChatId: null, incomingCall: null };
    case 'INCOMING_CALL': return { ...state, incomingCall: { userId: action.userId, connection: action.connection, video: action.video } };
    case 'CLEAR_INCOMING_CALL': return { ...state, incomingCall: null };
    case 'SET_LANGUAGE': return { ...state, language: action.lang };
    case 'SET_THEME': return { ...state, theme: action.theme };
    case 'SET_PASSCODE': return { ...state, passcode: action.code };
    case 'SET_LOCKED': return { ...state, isLocked: action.locked };
    case 'SET_AWAY_MODE': return { ...state, awayMode: action.away };
    case 'SET_AWAY_MESSAGE': return { ...state, awayMessage: action.msg };
    case 'UPDATE_PROFILE': return { ...state, currentUser: { ...state.currentUser, ...action.user }, users: { ...state.users, user_me: { ...state.users.user_me, ...action.user } } };
    case 'SEND_MESSAGE': {
      // "Send without sound" really stays silent
      if (!action.message.sentWithoutSound) playOutgoingMessage();
      const updated = state.chats.map(c => c.id === action.message.chatId ? { ...c, lastMessage: action.message, draft: undefined, lastMessageTime: Date.now() } : c).sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
      return { ...state, messages: [...state.messages, action.message], chats: updated, replyTo: null, editingMessageId: null, lastActiveAt: Date.now() };
    }
    case 'RECEIVE_MESSAGE': {
      // The same message can arrive twice (retry, second tab): keep one copy.
      if (state.messages.some(m => m.id === action.message.id)) return state;
      // Respect Do Not Disturb, muted chats and silent messages
      const incomingChat = state.chats.find(c => c.id === action.message.chatId);
      const dndActive = (globalThis as Record<string, unknown>)._tgDND === true;
      if (!dndActive && !incomingChat?.isMuted && !action.message.sentWithoutSound) playIncomingMessage();
      const updated2 = state.chats.map(c => c.id === action.message.chatId ? { ...c, lastMessage: action.message, unreadCount: c.id === state.activeChatId ? 0 : c.unreadCount + 1 } : c).sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
      if (state.awayMode && action.message.senderId !== 'user_me') {
        const autoReply: Message = { id: `msg_auto_${Date.now()}`, chatId: action.message.chatId, senderId: 'user_me', text: state.awayMessage, timestamp: Date.now(), type: 'text', readBy: ['user_me'] };
        return { ...state, messages: [...state.messages, action.message, autoReply], chats: updated2 };
      }
      const queued = state.messages.filter(m => m.sendWhenOnline && m.chatId === action.message.chatId);
      if (queued.length > 0) { const sent = queued.map(m => ({ ...m, sendWhenOnline: false, timestamp: Date.now() })); return { ...state, messages: [...state.messages, action.message, ...sent], chats: updated2 }; }
      return { ...state, messages: [...state.messages, action.message], chats: updated2 };
    }
    case 'DELETE_MESSAGE': return { ...state, messages: state.messages.map(m => m.id === action.messageId ? { ...m, deletedForEveryone: true, text: 'This message was deleted' } : m), selectedMessages: state.selectedMessages.filter(id => id !== action.messageId) };
    case 'EDIT_MESSAGE': return { ...state, messages: state.messages.map(m => m.id === action.messageId ? { ...m, text: action.newText, editedAt: Date.now() } : m), editingMessageId: null };
    case 'PIN_MESSAGE': return { ...state, messages: state.messages.map(m => m.id === action.messageId ? { ...m, isPinned: !m.isPinned } : m) };
    case 'TOGGLE_REACTION': return { ...state, messages: state.messages.map(m => { if (m.id !== action.messageId) return m; const r = m.reactions ? { ...m.reactions } : {}; const u = r[action.emoji] || []; if (u.includes('user_me')) { r[action.emoji] = u.filter(x => x !== 'user_me'); if (r[action.emoji].length === 0) delete r[action.emoji]; } else { r[action.emoji] = [...u, 'user_me']; } return { ...m, reactions: r }; }) };
    case 'SELECT_MESSAGE': return { ...state, selectedMessages: state.selectedMessages.includes(action.messageId) ? state.selectedMessages.filter(id => id !== action.messageId) : [...state.selectedMessages, action.messageId] };
    case 'CLEAR_SELECTION': return { ...state, selectedMessages: [] };
    case 'SET_REPLY_TO': return { ...state, replyTo: action.messageId, editingMessageId: null, forwardedMessageId: null };
    case 'SET_EDITING': return { ...state, editingMessageId: action.messageId, replyTo: null, forwardedMessageId: null };
    case 'SET_FORWARDING': return { ...state, forwardedMessageId: action.messageId, replyTo: null, editingMessageId: null };
    case 'CREATE_POLL': { const pm: Message = { id: `msg_poll_${Date.now()}`, chatId: action.chatId, senderId: 'user_me', text: '', timestamp: Date.now(), type: 'poll', poll: action.poll, readBy: ['user_me'] }; return { ...state, messages: [...state.messages, pm], chats: state.chats.map(c => c.id === action.chatId ? { ...c, lastMessage: pm } : c), isPollModalOpen: false }; }
    case 'VOTE_POLL': return { ...state, messages: state.messages.map(m => { if (m.id !== action.messageId || !m.poll) return m; return { ...m, poll: { ...m.poll, options: m.poll.options.map((o, i) => i === action.optionIndex ? { ...o, votes: [...o.votes, 'user_me'] } : { ...o, votes: o.votes.filter(v => v !== 'user_me') }) } }; }) };
    case 'PIN_CHAT': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? { ...c, isPinned: !c.isPinned } : c) };
    case 'ARCHIVE_CHAT': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? { ...c, isArchived: !c.isArchived } : c) };
    case 'MUTE_CHAT': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? { ...c, isMuted: !c.isMuted } : c) };
    case 'DELETE_CHAT': return { ...state, chats: state.chats.filter(c => c.id !== action.chatId), messages: state.messages.filter(m => m.chatId !== action.chatId), activeChatId: state.activeChatId === action.chatId ? null : state.activeChatId };
    case 'SET_TYPING': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? { ...c, isTyping: action.isTyping, typingUserId: action.userId } : c) };
    case 'ADD_CONTACT': return { ...state, contacts: [...state.contacts, { userId: action.userId, isContact: true, isBlocked: false, privateNote: '' }] };
    case 'REMOVE_CONTACT': return { ...state, contacts: state.contacts.filter(c => c.userId !== action.userId) };
    case 'MARK_STORY_VIEWED': return { ...state, stories: state.stories.map(s => s.id === action.storyId ? { ...s, viewedBy: s.viewedBy.includes('user_me') ? s.viewedBy : [...s.viewedBy, 'user_me'] } : s) };
    case 'ADD_STORY': return { ...state, stories: [action.story, ...state.stories] };
    case 'SET_DRAFT': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? { ...c, draft: action.draft } : c) };
    case 'ADD_CHAT': return { ...state, chats: [action.chat, ...state.chats] };
    case 'JOIN_CHAT': {
      const target = state.chats.find(c => c.id === action.chatId);
      if (!target) return state;
      const isNew = !target.members.includes('user_me');
      const members = isNew ? [...target.members, 'user_me'] : target.members;
      const chats = state.chats.map(c => c.id === action.chatId ? { ...c, members, unreadCount: 0 } : c);
      // Joining a group through an invite link posts its welcome message
      if (isNew && target.type === 'group' && target.welcomeMessage) {
        const welcome: Message = {
          id: `msg_welcome_${Date.now()}`, chatId: action.chatId, senderId: 'user_me',
          text: target.welcomeMessage, timestamp: Date.now(), type: 'text', readBy: ['user_me'], postedAsGroup: true,
        };
        return { ...state, activeChatId: action.chatId, activeTopicId: null, chats: chats.map(c => c.id === action.chatId ? { ...c, lastMessage: welcome } : c), messages: [...state.messages, welcome] };
      }
      return { ...state, activeChatId: action.chatId, activeTopicId: null, chats };
    }
    case 'SHOW_SCHEDULED_PICKER': return { ...state, showScheduledPicker: true };
    case 'HIDE_SCHEDULED_PICKER': return { ...state, showScheduledPicker: false };
    case 'SHOW_QUICK_REPLIES': return { ...state, showQuickReplies: true };
    case 'HIDE_QUICK_REPLIES': return { ...state, showQuickReplies: false };
    case 'SET_MINI_APP': return { ...state, miniApp: action.app };
    case 'START_VOICE_CHAT': return { ...state, voiceChatActive: true, voiceChatChatId: action.chatId };
    case 'END_VOICE_CHAT': return { ...state, voiceChatActive: false, voiceChatChatId: null };
    case 'LOAD_STATE': return { ...state, ...action.state };
    case 'SET_SLOW_MODE': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? { ...c, slowMode: action.seconds } : c) };
    case 'POST_AS_ANONYMOUS': { const am: Message = { id: `msg_anon_${Date.now()}`, chatId: action.chatId, senderId: 'user_me', text: action.text, timestamp: Date.now(), type: 'text', readBy: ['user_me'], postedAsGroup: true }; return { ...state, messages: [...state.messages, am], chats: state.chats.map(c => c.id === action.chatId ? { ...c, lastMessage: am } : c) }; }
    case 'SET_CHAT_WALLPAPER': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? { ...c, wallpaper: action.wallpaper } : c) };
    case 'ADD_REMINDER': return { ...state, reminders: [...state.reminders, action.reminder], showReminderModal: false };
    case 'TRIGGER_REMINDER': return { ...state, reminders: state.reminders.map(r => r.id === action.reminderId ? { ...r, triggered: true } : r) };
    case 'DISMISS_REMINDER': return { ...state, reminders: state.reminders.filter(r => r.id !== action.reminderId) };
    case 'TOGGLE_REMINDER_MODAL': return { ...state, showReminderModal: !state.showReminderModal, reminderChatId: action.chatId || state.activeChatId };
    case 'SEND_WHEN_ONLINE': return { ...state, messages: state.messages.map(m => m.id === action.messageId ? { ...m, sendWhenOnline: true } : m) };
    case 'USER_CAME_ONLINE': {
      const online = { ...state.users, [action.userId]: { ...state.users[action.userId], isOnline: true, lastSeen: Date.now() } };
      // Messages queued with "send when online" go out now that the recipient is online
      const released = state.chats.filter(c => c.members.includes(action.userId));
      const messages = state.messages.map(m => m.sendWhenOnline && released.some(c => c.id === m.chatId) ? { ...m, sendWhenOnline: false, timestamp: Date.now() } : m);
      return { ...state, users: online, messages };
    }
    case 'RELEASE_DUE_MESSAGES': {
      const nowTs = Date.now();
      const onlinePeers = new Set(Object.values(state.users).filter(u => u.isOnline).map(u => u.id));
      let changed = false;
      const messages = state.messages.map(m => {
        if (m.scheduledAt && m.scheduledAt <= nowTs) {
          changed = true;
          return { ...m, scheduledAt: undefined, timestamp: nowTs };
        }
        if (m.sendWhenOnline) {
          const chat = state.chats.find(c => c.id === m.chatId);
          const peer = chat?.members.find(id => id !== 'user_me');
          if (peer && onlinePeers.has(peer)) { changed = true; return { ...m, sendWhenOnline: false, timestamp: nowTs }; }
        }
        return m;
      });
      return changed ? { ...state, messages } : state;
    }
    case 'REQUEST_TO_JOIN': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? { ...c, pendingJoinRequests: [...(c.pendingJoinRequests || []), action.userId] } : c) };
    case 'APPROVE_JOIN': {
      const target = state.chats.find(c => c.id === action.chatId);
      const chats = state.chats.map(c => c.id === action.chatId ? { ...c, members: c.members.includes(action.userId) ? c.members : [...c.members, action.userId], pendingJoinRequests: (c.pendingJoinRequests || []).filter(u => u !== action.userId) } : c);
      // Groups with an auto welcome message post it for the new member
      if (target?.type === 'group' && target.welcomeMessage) {
        const welcome: Message = {
          id: `msg_welcome_${Date.now()}`, chatId: action.chatId, senderId: 'user_me',
          text: target.welcomeMessage, timestamp: Date.now(), type: 'text', readBy: ['user_me'], postedAsGroup: true,
        };
        return { ...state, chats: chats.map(c => c.id === action.chatId ? { ...c, lastMessage: welcome } : c), messages: [...state.messages, welcome] };
      }
      return { ...state, chats };
    }
    case 'DENY_JOIN': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? { ...c, pendingJoinRequests: (c.pendingJoinRequests || []).filter(u => u !== action.userId) } : c) };
    case 'TOGGLE_JOIN_APPROVAL': return { ...state, showJoinApproval: !state.showJoinApproval };
    case 'PURCHASE_STARS': return { ...state, wallet: { ...state.wallet, stars: state.wallet.stars + action.amount, transactions: [{ id: `tx_${Date.now()}`, type: 'purchase', amount: action.amount, description: `Purchased ${action.amount} ⭐`, timestamp: Date.now() }, ...state.wallet.transactions] } };
    case 'UNLOCK_PAID_POST': return { ...state, messages: state.messages.map(m => m.id === action.messageId ? { ...m, paidBy: [...(m.paidBy || []), 'user_me'] } : m), wallet: { ...state.wallet, stars: state.wallet.stars - (state.messages.find(m => m.id === action.messageId)?.priceStars || 0), transactions: [{ id: `tx_${Date.now()}`, type: 'spend', amount: -(state.messages.find(m => m.id === action.messageId)?.priceStars || 0), description: 'Unlocked paid post', timestamp: Date.now() }, ...state.wallet.transactions] } };
    case 'TOGGLE_WALLET': return { ...state, showWalletModal: !state.showWalletModal };
    case 'SET_WORD_BLACKLIST': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? { ...c, wordBlacklist: action.words } : c) };
    case 'TOGGLE_LEADERBOARD': return { ...state, showLeaderboard: !state.showLeaderboard };
    case 'TOGGLE_SPLIT_BILL': return { ...state, showSplitBill: !state.showSplitBill };
    case 'CREATE_SPLIT_BILL': { const sb: Message = { id: `msg_sb_${Date.now()}`, chatId: action.chatId, senderId: 'user_me', text: `💰 Split Bill: ${action.splitBill.title}`, timestamp: Date.now(), type: 'text', readBy: ['user_me'], splitBill: action.splitBill }; return { ...state, messages: [...state.messages, sb], chats: state.chats.map(c => c.id === action.chatId ? { ...c, lastMessage: sb } : c), showSplitBill: false }; }
    case 'MARK_SPLIT_PAID': return { ...state, messages: state.messages.map(m => m.id === action.messageId && m.splitBill ? { ...m, splitBill: { ...m.splitBill, participants: m.splitBill.participants.map(p => p.userId === action.userId ? { ...p, paid: true } : p) } } : m) };
    case 'BOOST_CHANNEL': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? { ...c, boostCount: (c.boostCount || 0) + 1, boostLevel: Math.min(3, Math.floor(((c.boostCount || 0) + 1) / 10)) } : c) };
    case 'ADD_STICKER_PACK': return { ...state, stickerPacks: [...state.stickerPacks, action.pack], showStickerCreator: false };
    case 'DELETE_STICKER_PACK': return { ...state, stickerPacks: state.stickerPacks.filter(p => p.id !== action.packId) };
    case 'TOGGLE_STICKER_CREATOR': return { ...state, showStickerCreator: !state.showStickerCreator };
    case 'SET_DND_SCHEDULE': return { ...state, dndSchedule: action.schedule };
    case 'SET_AUTO_DELETE': return { ...state, currentUser: { ...state.currentUser, autoDeleteInactivity: action.months } };
    case 'SET_ADMIN_TITLE': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? { ...c, adminTitles: { ...c.adminTitles, [action.userId]: action.title } } : c) };
    // Feature 3: Ghost mode
    case 'TOGGLE_GHOST_MODE': return { ...state, currentUser: { ...state.currentUser, ghostMode: !state.currentUser.ghostMode } };
    // Feature 5: Group permissions
    case 'SET_GROUP_PERMISSIONS': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? { ...c, permissions: action.permissions } : c) };
    // Feature 6: Welcome message
    case 'SET_WELCOME_MESSAGE': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? { ...c, welcomeMessage: action.text } : c) };
    // Feature 8: Tags & bookmarks
    case 'ADD_TAG': return { ...state, messages: state.messages.map(m => m.id === action.messageId ? { ...m, tags: [...new Set([...(m.tags || []), action.tag])] } : m) };
    case 'REMOVE_TAG': return { ...state, messages: state.messages.map(m => m.id === action.messageId ? { ...m, tags: (m.tags || []).filter(t => t !== action.tag) } : m) };
    case 'TOGGLE_BOOKMARK': return { ...state, messages: state.messages.map(m => m.id === action.messageId ? { ...m, isBookmarked: !m.isBookmarked } : m) };
    case 'SET_TAG_FILTER': return { ...state, tagFilter: action.tag };
    case 'TOGGLE_BOOKMARKS_VIEW': return { ...state, showBookmarks: !state.showBookmarks, tagFilter: null };
    // Feature 11: Calendar viewer
    case 'TOGGLE_CALENDAR_VIEWER': return { ...state, showCalendarViewer: !state.showCalendarViewer };
    case 'SET_CALENDAR_DATE': return { ...state, calendarDate: action.date };
    // Feature 13: Media confirm
    case 'SET_PENDING_MEDIA': return { ...state, pendingMediaFiles: action.files, showMediaConfirm: true };
    case 'CONFIRM_SEND_MEDIA': return { ...state, showMediaConfirm: false, pendingMediaFiles: [] };
    case 'CANCEL_SEND_MEDIA': return { ...state, showMediaConfirm: false, pendingMediaFiles: [] };
    // Feature 15: Search hits
    case 'SET_SEARCH_HITS': return { ...state, searchHits: action.hits, currentSearchHitIndex: action.index };
    case 'CYCLE_SEARCH_HIT': { const len = state.searchHits.length; if (len === 0) return state; const next = (state.currentSearchHitIndex + action.direction + len) % len; return { ...state, currentSearchHitIndex: next }; }
    // Feature 17: Announcements
    case 'SET_ANNOUNCEMENT_INDEX': return { ...state, announcementIndex: action.index };
    case 'ADD_ANNOUNCEMENT': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? { ...c, announcements: [...(c.announcements || []), action.text] } : c) };
    case 'REMOVE_ANNOUNCEMENT': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? { ...c, announcements: (c.announcements || []).filter((_, i) => i !== action.index) } : c) };
    // --- Real accounts ---
    // Signing in only swaps the session: the chats on screen belong to the account
    // we are leaving, and the new account's own workspace is loaded right after.
    case 'SIGN_IN': return { ...state, session: action.session, hydratedFor: null, netStatus: 'connecting', netDetail: '', activeChatId: null };
    case 'SET_HYDRATED': return { ...state, hydratedFor: action.userId };
    case 'SIGN_OUT': return { ...initialState };
    case 'SET_NET_STATUS': return { ...state, netStatus: action.status, netDetail: action.detail };
    // --- Real people ---
    case 'ADD_PEER': {
      const known = state.users[action.userId];
      const peer: User = known
        ? { ...known, name: action.name || known.name, username: action.username || known.username }
        : {
            id: action.userId, name: action.name || shortId(action.userId), username: action.username,
            avatar: '', bio: '', phone: '', lastSeen: Date.now(), isOnline: false,
            canSeeUserId: 'everyone', canSeeLastSeen: 'everyone',
          };
      const chatId = `chat_peer_${action.userId}`;
      const existing = state.chats.find(c => c.id === chatId);
      const chats = existing
        ? state.chats.map(c => c.id === chatId ? { ...c, name: peer.name } : c)
        : [{ id: chatId, type: 'private' as const, name: peer.name, avatar: '', members: ['user_me', action.userId], admins: [], unreadCount: 0, isPinned: false, isArchived: false, isMuted: false }, ...state.chats];
      const contacts = state.contacts.some(c => c.userId === action.userId)
        ? state.contacts
        : [...state.contacts, { userId: action.userId, isContact: true, isBlocked: false, privateNote: '' }];
      return { ...state, users: { ...state.users, [action.userId]: peer }, chats, contacts };
    }
    case 'SET_PEER_PRESENCE': {
      const known = state.users[action.userId];
      if (!known && !action.online) return state;
      const peer: User = known
        ? { ...known, isOnline: action.online, lastSeen: Date.now() }
        : { id: action.userId, name: shortId(action.userId), username: '', avatar: '', bio: '', phone: '', lastSeen: Date.now(), isOnline: true, canSeeUserId: 'everyone', canSeeLastSeen: 'everyone' };
      // Messages queued with "send when online" leave the moment they are reachable
      const messages = action.online
        ? state.messages.map(m => (m.sendWhenOnline && state.chats.find(c => c.id === m.chatId)?.members.includes(action.userId)) ? { ...m, sendWhenOnline: false, timestamp: Date.now() } : m)
        : state.messages;
      return { ...state, users: { ...state.users, [action.userId]: peer }, peerPresence: { ...state.peerPresence, [action.userId]: action.online }, messages };
    }
    case 'MARK_MESSAGES_READ': return { ...state, messages: state.messages.map(m => (action.messageIds.includes(m.id) && !m.readBy.includes(action.userId)) ? { ...m, readBy: [...m.readBy, action.userId] } : m) };
    case 'SET_DELIVERY': return { ...state, messages: state.messages.map(m => m.id === action.messageId ? { ...m, deliveryPending: action.pending } : m) };
    default: return state;
  }
}

interface AppContextType {
  state: AppState; dispatch: React.Dispatch<Action>; t: (key: string) => string;
  getUser: (id: string) => User | undefined; getChat: (id: string) => Chat | undefined;
  getChatMessages: (chatId: string) => Message[]; sendMessage: (chatId: string, text: string, extras?: Partial<Message>) => void;
  findUser: (query: string) => User | undefined;
  notifyTyping: (chatId: string) => void;
  /** Sends any finished message (photo, voice, file, location, sticker…) to the other person too. */
  deliver: (message: Message) => void;
  /** Pushes an edit / a deletion to the other person's device. */
  deliverEdit: (messageId: string, text: string) => void;
  deliverDelete: (messageId: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children, overrides }: { children: ReactNode; overrides?: Partial<AppState> }) {
  const [state, dispatch] = useReducer(reducer, overrides ? { ...buildInitialState(), ...overrides } : buildInitialState());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const autoReplyTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    try {
      channelRef.current = new BroadcastChannel('teleflow');
      channelRef.current.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'NEW_MESSAGE' && payload.senderId !== 'user_me') dispatch({ type: 'RECEIVE_MESSAGE', message: payload });
        if (type === 'TYPING') dispatch({ type: 'SET_TYPING', chatId: payload.chatId, userId: payload.userId, isTyping: payload.isTyping });
      };
    } catch { /* */ }
    return () => { channelRef.current?.close(); };
  }, []);

  const sessionUserId = state.session?.userId ?? null;
  // Every account owns its own workspace, so two people never share a mailbox.
  const workspaceKey = sessionUserId ? `workspace:${sessionUserId}` : null;

  // The newest snapshot, kept in a ref so the page-hide flush below can write it
  // without waiting for a re-render.
  const liveWorkspaceRef = useRef<{ userId: string; workspace: StoredWorkspace } | null>(null);

  // Persist the workspace to IndexedDB *and* localStorage (survives reload,
  // closing the app, and reopening it days later). Skipped until the account's
  // own workspace has been read back: booting the app with an empty workspace
  // must never overwrite what is stored on disk.
  useEffect(() => {
    if (!workspaceKey || !sessionUserId || state.hydratedFor !== sessionUserId) return;
    const workspace: StoredWorkspace = {
      chats: state.chats, messages: state.messages, users: Object.values(state.users),
      contacts: state.contacts, stories: state.stories, currentUser: state.currentUser,
      lastActiveAt: Date.now(), autoDeleteInactivity: state.currentUser.autoDeleteInactivity ?? 0,
    };
    liveWorkspaceRef.current = { userId: sessionUserId, workspace };
    const timer = setTimeout(() => { void persistWorkspace(sessionUserId, workspace); }, 150);
    return () => clearTimeout(timer);
  }, [workspaceKey, sessionUserId, state.hydratedFor, state.chats, state.messages, state.users, state.contacts, state.stories, state.currentUser]);

  // Never lose the last thing written: when the page is hidden or closed (phone
  // back button, tab switch, app switcher) the newest snapshot is saved straight
  // away instead of waiting for the debounce.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const flush = () => {
      const live = liveWorkspaceRef.current;
      if (live) void persistWorkspace(live.userId, live.workspace);
    };
    const onHidden = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, []);

  // Outbox: the moment a contact comes online, everything that could not reach
  // them yet is handed to the network again — no waiting for the next retry tick.
  const onlinePeers = Object.entries(state.peerPresence)
    .filter(([, online]) => online)
    .map(([id]) => id)
    .sort()
    .join(',');
  useEffect(() => {
    const me = state.session;
    if (!me || !onlinePeers) return;
    const waiting = stateRef.current.messages.filter(
      message => message.senderId === 'user_me' && message.deliveryPending && !message.scheduledAt,
    );
    waiting.forEach(message => {
      const peer = peerIdOfChat(stateRef.current.chats.find(c => c.id === message.chatId));
      if (peer && network.send(peer, envelopeFor(message, me))) {
        dispatch({ type: 'SET_DELIVERY', messageId: message.id, pending: false });
      }
    });
  }, [onlinePeers, state.session, dispatch]);

  // Restore the signed-in account's workspace on launch, honouring inactivity auto-delete
  useEffect(() => {
    if (!workspaceKey || !sessionUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const stored = await loadStoredWorkspace(sessionUserId);
        if (cancelled) return;

        // Nothing stored yet (or the content is unusable): this account starts fresh.
        if (!stored?.currentUser) {
          dispatch({ type: 'SET_HYDRATED', userId: sessionUserId });
          return;
        }

        const months = stored.autoDeleteInactivity ?? 0;
        const idleMs = stored.lastActiveAt ? Date.now() - stored.lastActiveAt : 0;
        if (months > 0 && idleMs > months * 30 * 24 * 60 * 60 * 1000) {
          await clearStoredWorkspace(sessionUserId);
          dispatch({ type: 'SET_HYDRATED', userId: sessionUserId });
          return;
        }
        dispatch({
          type: 'LOAD_STATE',
          state: {
            chats: stored.chats ?? [], messages: stored.messages ?? [],
            users: { user_me: stored.currentUser, ...Object.fromEntries((stored.users ?? []).map(u => [u.id, u])) },
            contacts: stored.contacts ?? [], stories: stored.stories ?? [], lastActiveAt: Date.now(),
          },
        });
      } catch { /* first run for this account */ } finally {
        if (!cancelled) dispatch({ type: 'SET_HYDRATED', userId: sessionUserId });
      }
    })();
    return () => { cancelled = true; };
  }, [sessionUserId]);


  // Invite links: opening #join/<chatId> joins the group/channel and opens it
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleInvite = () => {
      const chatId = parseInviteHash(window.location.hash);
      if (!chatId || !state.chats.some(c => c.id === chatId)) return;
      dispatch({ type: 'JOIN_CHAT', chatId });
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    };
    handleInvite();
    window.addEventListener('hashchange', handleInvite);
    return () => window.removeEventListener('hashchange', handleInvite);
  }, [state.chats]);

  // Feature 7: Reminder checker
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      state.reminders.filter(r => !r.triggered && r.remindAt <= now).forEach(r => dispatch({ type: 'TRIGGER_REMINDER', reminderId: r.id }));
    }, 5000);
    return () => clearInterval(timer);
  }, [state.reminders]);

  // Feature 16: DND flag
  useEffect(() => {
    if (!state.dndSchedule.enabled) { (globalThis as Record<string, unknown>)._tgDND = false; return; }
    const check = () => { const now = new Date(); const cur = now.getHours() * 60 + now.getMinutes(); const s = state.dndSchedule.startHour * 60 + state.dndSchedule.startMinute; const e = state.dndSchedule.endHour * 60 + state.dndSchedule.endMinute; (globalThis as Record<string, unknown>)._tgDND = s > e ? cur >= s || cur < e : cur >= s && cur < e; };
    check(); const id = setInterval(check, 30000); return () => clearInterval(id);
  }, [state.dndSchedule]);

  // --- Real connection to real people ---
  const sessionUser = state.session;
  useEffect(() => {
    if (!sessionUser) { network.stop(); return; }
    const account = sessionUser;
    network.start(account.userId, account.username, account.name);

    const off = network.on((event) => {
      if (event.type === 'status') {
        dispatch({ type: 'SET_NET_STATUS', status: event.status, detail: event.detail ?? '' });
        return;
      }
      if (event.type === 'peer') {
        dispatch({ type: 'SET_PEER_PRESENCE', userId: event.userId, online: event.state === 'online' });
        return;
      }
      if (event.type === 'profile') {
        dispatch({ type: 'ADD_PEER', userId: event.userId, name: event.name || event.username, username: event.username });
        return;
      }
      if (event.type === 'call') {
        dispatch({ type: 'ADD_PEER', userId: event.userId, name: shortId(event.userId), username: '' });
        dispatch({ type: 'INCOMING_CALL', userId: event.userId, connection: event.connection, video: event.video });
        return;
      }
      if (event.type === 'call-closed') {
        dispatch({ type: 'CLEAR_INCOMING_CALL' });
        return;
      }

      const { userId, envelope } = event;
      const chatId = `chat_peer_${userId}`;
      if (envelope.kind === 'typing') {
        dispatch({ type: 'SET_TYPING', chatId, userId, isTyping: !!envelope.isTyping });
        return;
      }
      if (envelope.kind === 'read' && envelope.messageIds) {
        dispatch({ type: 'MARK_MESSAGES_READ', messageIds: envelope.messageIds, userId });
        return;
      }
      if (envelope.kind === 'react' && envelope.id && envelope.emoji) {
        dispatch({ type: 'TOGGLE_REACTION', messageId: envelope.id, emoji: envelope.emoji });
        return;
      }
      if (envelope.kind === 'edit' && envelope.id && typeof envelope.text === 'string') {
        dispatch({ type: 'EDIT_MESSAGE', messageId: envelope.id, newText: envelope.text });
        return;
      }
      if (envelope.kind === 'delete' && envelope.id) {
        dispatch({ type: 'DELETE_MESSAGE', messageId: envelope.id });
        return;
      }
      if (envelope.kind === 'message') {
        const message = messageFromEnvelope(userId, envelope);
        // The other person exists the moment their message arrives
        dispatch({ type: 'ADD_PEER', userId, name: envelope.name || envelope.username || shortId(userId), username: envelope.username || '' });
        dispatch({ type: 'RECEIVE_MESSAGE', message });
        if (!stateRef.current.currentUser.ghostMode) {
          network.send(userId, { kind: 'read', messageIds: [message.id], userId: account.userId });
        }
      }
    });

    return () => { off(); network.stop(); };
  }, [sessionUser]);

  // Everything we can reach: the people we have a chat with plus our contacts
  useEffect(() => {
    if (!sessionUser) return;
    const reachable = new Set<string>();
    state.chats.forEach(c => c.members.forEach(m => { if (isValidUserId(m)) reachable.add(m); }));
    state.contacts.forEach(c => { if (isValidUserId(c.userId)) reachable.add(c.userId); });
    if (reachable.size) network.trackContacts([...reachable]);
  }, [sessionUser, state.chats, state.contacts]);

  // Opening a chat with a real person tells them we have read their messages
  useEffect(() => {
    if (!sessionUser || !state.activeChatId) return;
    const peer = peerIdOfChat(state.chats.find(c => c.id === state.activeChatId));
    if (!peer || !network.isOnline(peer)) return;
    const unread = state.messages.filter(m => m.chatId === state.activeChatId && m.senderId === peer && !m.readBy.includes('user_me'));
    if (!unread.length) return;
    const ids = unread.map(m => m.id);
    dispatch({ type: 'MARK_MESSAGES_READ', messageIds: ids, userId: 'user_me' });
    network.send(peer, { kind: 'read', messageIds: ids, userId: sessionUser.userId });
  }, [sessionUser, state.activeChatId, state.messages, state.chats]);

  // The unread count lives in the tab title, so a glance at the browser is enough
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const unread = state.chats.reduce((sum, c) => sum + (c.isArchived ? 0 : c.unreadCount || 0), 0);
    document.title = unread > 0 ? `(${unread}) Teleflow` : 'Teleflow';
  }, [state.chats]);

  const t = useCallback((key: string): string => {
    const lang = translations[state.language] as Record<string, string>;
    return lang[key] || key;
  }, [state.language]);

  const getUser = useCallback((id: string) => state.users[id], [state.users]);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Broadcasts "typing…" to the other tabs and to the real person — silenced while Ghost Mode is on
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifyTyping = useCallback((chatId: string) => {
    const cur = stateRef.current;
    if (cur.currentUser.ghostMode) return;
    channelRef.current?.postMessage({ type: 'TYPING', payload: { chatId, userId: 'user_me', isTyping: true } });
    const peer = peerIdOfChat(cur.chats.find(c => c.id === chatId));
    const me = cur.session;
    if (peer && me) network.send(peer, { kind: 'typing', isTyping: true, userId: me.userId, name: me.name, username: me.username });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      channelRef.current?.postMessage({ type: 'TYPING', payload: { chatId, userId: 'user_me', isTyping: false } });
      if (peer) network.send(peer, { kind: 'typing', isTyping: false });
    }, 2500);
  }, []);

  // Signing in as a different account happens on the sign-in screen, so there is
  // no account switcher: one browser session belongs to one real account.

  // Global contact discovery by the person's address or @username
  const findUser = useCallback((query: string) => {
    const raw = query.trim();
    if (!raw) return undefined;
    const handle = raw.replace(/^@/, '').toLowerCase();
    return Object.values(state.users).find(u => u.id === raw) || Object.values(state.users).find(u => u.username.toLowerCase() === handle);
  }, [state.users]);
  const getChat = useCallback((id: string) => state.chats.find(c => c.id === id), [state.chats]);
  const getChatMessages = useCallback((chatId: string) => state.messages.filter(m => m.chatId === chatId).sort((a, b) => (a.scheduledAt ?? a.timestamp) - (b.scheduledAt ?? b.timestamp)), [state.messages]);

  /** Hands one finished message to the real person on the other side. */
  const transmit = useCallback((message: Message): boolean => {
    const me = stateRef.current.session;
    const chat = stateRef.current.chats.find(c => c.id === message.chatId);
    const peer = peerIdOfChat(chat);
    if (!peer || !me || message.senderId !== 'user_me') return false;
    return network.send(peer, envelopeFor(message, me));
  }, []);

  /**
   * The one way an outgoing message leaves the app: it is added to this device's
   * own history, mirrored to other tabs, and delivered to the other person.
   * Everything that can be written — text, photos, voice, files, locations,
   * stickers, gifts — goes through here, so nothing stays on one device only.
   */
  const deliver = useCallback((message: Message) => {
    dispatch({ type: 'SEND_MESSAGE', message });
    channelRef.current?.postMessage({ type: 'NEW_MESSAGE', payload: message });
    if (message.scheduledAt) return;
    // When the other person is not reachable right now the message is marked as
    // still on its way, and the retry loop below keeps trying until it lands.
    const sent = transmit(message);
    dispatch({ type: 'SET_DELIVERY', messageId: message.id, pending: !sent });
  }, [transmit]);

  // Edits and deletions reach the other person too
  const deliverEdit = useCallback((messageId: string, text: string) => {
    const me = stateRef.current.session;
    const message = stateRef.current.messages.find(m => m.id === messageId);
    const peer = message ? peerIdOfChat(stateRef.current.chats.find(c => c.id === message.chatId)) : null;
    if (peer && me) network.send(peer, { kind: 'edit', id: messageId, text, userId: me.userId });
  }, []);

  const deliverDelete = useCallback((messageId: string) => {
    const me = stateRef.current.session;
    const message = stateRef.current.messages.find(m => m.id === messageId);
    const peer = message ? peerIdOfChat(stateRef.current.chats.find(c => c.id === message.chatId)) : null;
    if (peer && me) network.send(peer, { kind: 'delete', id: messageId, userId: me.userId });
  }, []);

  // Scheduled messages are really transmitted at their due time — not just shown
  // as sent — and only then released into the chat on this device as well.
  const sentScheduledRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      stateRef.current.messages.forEach(message => {
        if (!message.scheduledAt || message.scheduledAt > now) return;
        if (sentScheduledRef.current.has(message.id)) return;
        sentScheduledRef.current.add(message.id);
        transmit(message);
      });
      dispatch({ type: 'RELEASE_DUE_MESSAGES' });
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [transmit]);

  // Anything that has not reached the other device yet is retried until it does.
  // The receiving side ignores a message id it already has, so a retry that races
  // the first copy never shows up twice.
  useEffect(() => {
    if (!sessionUser) return;
    const retry = () => {
      stateRef.current.messages.forEach(message => {
        if (message.senderId !== 'user_me' || !message.deliveryPending || message.scheduledAt) return;
        const peer = peerIdOfChat(stateRef.current.chats.find(c => c.id === message.chatId));
        if (peer && network.isOnline(peer) && transmit(message)) {
          dispatch({ type: 'SET_DELIVERY', messageId: message.id, pending: false });
        }
      });
    };
    retry();
    const id = setInterval(retry, 5000);
    return () => clearInterval(id);
  }, [sessionUser, transmit, state.messages]);

  // Messages still waiting to go out ("send when online", or something written
  // just before the app was closed) are handed to the network queue again on
  // launch: it keeps them and delivers the moment the other person is reachable.
  const requeuedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!sessionUser) return;
    state.messages.forEach(message => {
      if (message.senderId !== 'user_me' || !message.sendWhenOnline || message.scheduledAt) return;
      if (requeuedRef.current.has(message.id)) return;
      requeuedRef.current.add(message.id);
      transmit(message);
    });
  }, [sessionUser, state.messages, transmit]);

  const sendMessage = useCallback((chatId: string, text: string, extras: Partial<Message> = {}) => {
    const chat = state.chats.find(c => c.id === chatId);
    // Feature 11: Anti-spam check
    if (chat?.wordBlacklist && chat.wordBlacklist.length > 0) {
      const lower = text.toLowerCase();
      if (chat.wordBlacklist.some(w => lower.includes(w.toLowerCase()))) {
        dispatch({ type: 'RECEIVE_MESSAGE', message: { id: `msg_filter_${Date.now()}`, chatId, senderId: 'user_helper_bot', text: '⚠️ Your message was blocked by the group anti-spam filter.', timestamp: Date.now(), type: 'text', readBy: ['user_helper_bot'] } });
        return;
      }
    }
    // Feature 3: Slow mode
    if (chat?.slowMode && chat.slowMode > 0 && chat.lastMessageTime) {
      const elapsed = (Date.now() - chat.lastMessageTime) / 1000;
      if (elapsed < chat.slowMode) {
        const remaining = Math.ceil(chat.slowMode - elapsed);
        dispatch({ type: 'RECEIVE_MESSAGE', message: { id: `msg_slow_${Date.now()}`, chatId, senderId: 'user_helper_bot', text: `⏳ Slow mode: wait ${remaining}s before sending again.`, timestamp: Date.now(), type: 'text', readBy: ['user_helper_bot'] } });
        return;
      }
    }
    const message: Message = { id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, chatId, senderId: 'user_me', text, timestamp: Date.now(), type: 'text', readBy: ['user_me'], ...extras };
    // Everything leaves through one door: history here, other tabs, and the
    // other person's device over the peer-to-peer link.
    deliver(message);
    if (chat?.type === 'private' && chat.name === 'Helper Bot') {
      const botReply = getBotReply(text);
      if (botReply) {
        dispatch({ type: 'SET_TYPING', chatId, userId: 'user_helper_bot', isTyping: true });
        const timeout = setTimeout(() => { dispatch({ type: 'SET_TYPING', chatId, userId: 'user_helper_bot', isTyping: false }); dispatch({ type: 'RECEIVE_MESSAGE', message: { id: `msg_bot_${Date.now()}`, chatId, senderId: 'user_helper_bot', text: botReply, timestamp: Date.now(), type: 'text', readBy: ['user_helper_bot'] } }); }, 1000 + Math.random() * 1500);
        autoReplyTimeoutRef.current.set(chatId, timeout);
      }
    }
    // Every other chat belongs to a real person: nothing is answered on their behalf.
  }, [state.chats, deliver]);

  return (
    <AppContext.Provider value={{ state, dispatch, t, getUser, getChat, getChatMessages, sendMessage, findUser, notifyTyping, deliver, deliverEdit, deliverDelete }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

function getBotReply(text: string): string | null {
  const cmd = text.trim().toLowerCase();
  if (cmd === '/help' || cmd === 'help') return '🤖 **Helper Bot Commands:**\n\n/help - Show commands\n/calc [expr] - Calculator\n/dice - Roll a dice\n/game - Play Snake or 2048';
  if (cmd.startsWith('/calc')) { const expr = text.replace('/calc', '').trim(); if (!expr) return 'Usage: /calc [expression]'; try { return `🔢 ${expr} = **${Function(`"use strict"; return (${expr.replace(/[^0-9+\-*/().%\s]/g, '')})`)()}**`; } catch { return '❌ Invalid expression'; } }
  if (cmd === '/dice' || cmd === 'dice') { const r = Math.floor(Math.random() * 6) + 1; return `🎲 You rolled: **${r}** ${['⚀','⚁','⚂','⚃','⚄','⚅'][r - 1]}`; }
  if (cmd === '/game' || cmd === 'game') return '🎮 Reply with **snake** or **2048**!';
  if (cmd === 'snake') return '__START_GAME_SNAKE__';
  if (cmd === '2048') return '__START_GAME_2048__';
  if (cmd.startsWith('/')) return 'Unknown command. Type /help.';
  return null;
}
