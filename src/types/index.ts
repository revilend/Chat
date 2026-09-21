export interface User {
  id: string;
  name: string;
  username: string;
  /** A photo data URL, or empty when the avatar is initials over a colour. */
  avatar: string;
  /** The chosen avatar gradient, when a photo is not used. */
  avatarColor?: string;
  bio: string;
  phone: string;
  lastSeen: number;
  isOnline: boolean;
  emojiStatus?: string;
  canSeeUserId: 'everyone' | 'contacts' | 'nobody';
  canSeeLastSeen: 'everyone' | 'contacts' | 'nobody';
  autoDeleteInactivity?: 0 | 1 | 3 | 6;
  lastActiveAt?: number;
  // Feature 3 new: Ghost/Stealth mode
  ghostMode?: boolean;
}

export interface Contact {
  userId: string;
  isContact: boolean;
  isBlocked: boolean;
  // Feature 10 new: Private contact notes
  privateNote?: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: number;
  type: 'text' | 'voice' | 'video' | 'photo' | 'sticker' | 'gif' | 'file' | 'poll' | 'location' | 'gift' | 'music';
  replyTo?: string;
  forwardedFrom?: string;
  editedAt?: number;
  deletedForEveryone?: boolean;
  readBy: string[];
  isPinned?: boolean;
  selfDestruct?: number;
  scheduledAt?: number;
  sentWithoutSound?: boolean;
  reactions?: Record<string, string[]>;
  poll?: Poll;
  location?: { lat: number; lng: number };
  audioUrl?: string;
  audioDuration?: number;
  audioWaveform?: number[];
  voiceEffect?: 'normal' | 'robot' | 'deep' | 'chipmunk';
  photoUrl?: string;
  videoUrl?: string;
  /** Circular "video message" (kruglyashok) */
  videoNote?: boolean;
  /** Music sent as a track — shows the sticky mini player */
  musicTitle?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  stickerUrl?: string;
  gift?: Gift;
  viewOnce?: boolean;
  viewOnceOpened?: boolean;
  postedAsGroup?: boolean;
  linkPreview?: LinkPreview;
  sendWhenOnline?: boolean;
  /** True while this device is still trying to hand the message to the other person. */
  deliveryPending?: boolean;
  priceStars?: number;
  paidBy?: string[];
  splitBill?: SplitBill;
  // Feature 8 new: Tags & bookmarks
  tags?: string[];
  isBookmarked?: boolean;
  /** Forum topic this message belongs to (groups with topics enabled) */
  topicId?: string;
}

export interface LinkPreview {
  title: string;
  description: string;
  domain: string;
  image?: string;
}

export interface SplitBill {
  title: string;
  totalAmount: number;
  participants: { userId: string; share: number; paid: boolean }[];
  createdBy: string;
}

export interface Poll {
  question: string;
  options: { text: string; votes: string[] }[];
  isAnonymous: boolean;
  isActive: boolean;
  createdBy: string;
}

export interface Gift {
  emoji: string;
  name: string;
}

export interface Chat {
  id: string;
  type: 'private' | 'group' | 'channel' | 'saved';
  name: string;
  avatar: string;
  members: string[];
  admins: string[];
  creatorId?: string;
  description?: string;
  lastMessage?: Message;
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
  isMuted: boolean;
  isTyping?: boolean;
  typingUserId?: string;
  draft?: string;
  folderId?: string;
  topics?: Topic[];
  isForum?: boolean;
  inviteLink?: string;
  subscribers?: number;
  postCount?: number;
  slowMode?: 0 | 10 | 30 | 60;
  lastMessageTime?: number;
  wallpaper?: string;
  joinRequestRequired?: boolean;
  pendingJoinRequests?: string[];
  wordBlacklist?: string[];
  boostCount?: number;
  boostLevel?: number;
  adminTitles?: Record<string, string>;
  // Feature 5 new: Group permissions
  permissions?: GroupPermissions;
  // Feature 6 new: Welcome message
  welcomeMessage?: string;
  // Feature 17 new: Announcement bulletin
  announcements?: string[];
}

export interface GroupPermissions {
  canSendMedia: boolean;
  canSendStickers: boolean;
  canEmbedLinks: boolean;
  canSendPolls: boolean;
}

export interface Topic {
  id: string;
  name: string;
  icon?: string;
  unreadCount: number;
  lastMessage?: Message;
}

export interface Story {
  id: string;
  userId: string;
  content: string;
  timestamp: number;
  viewedBy: string[];
  type: 'text' | 'photo';
  bgColor?: string;
}

export interface Account {
  id: string;
  user: User;
  isActive: boolean;
  /** Per-account workspace, so switching accounts keeps each chat list intact */
  snapshot?: AccountSnapshot;
}

export interface AccountSnapshot {
  chats?: Chat[];
  messages?: Message[];
  users?: Record<string, User>;
  contacts?: Contact[];
  stories?: Story[];
  currentUser?: User;
}

export interface VoiceChat {
  id: string;
  chatId: string;
  participants: string[];
  activeSpeaker?: string;
  isActive: boolean;
}

export type FolderType = 'all' | 'personal' | 'groups' | 'channels' | 'unread';

export interface CallRecord {
  id: string;
  chatId: string;
  type: 'voice' | 'video';
  timestamp: number;
  duration: number;
  isIncoming: boolean;
}

export interface NowPlaying {
  messageId: string;
  chatId: string;
  title: string;
  url: string;
  playing: boolean;
}

export type ThemeMode = 'dark' | 'night';
export type Language = 'en' | 'uz' | 'ru';

export interface Reminder {
  id: string;
  chatId: string;
  text: string;
  remindAt: number;
  triggered: boolean;
}

export interface StickerPack {
  id: string;
  name: string;
  stickers: StickerItem[];
  createdBy: string;
  createdAt: number;
}

export interface StickerItem {
  id: string;
  dataUrl: string;
  label?: string;
}

export interface DNDSchedule {
  enabled: boolean;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export interface Wallet {
  stars: number;
  transactions: WalletTransaction[];
}

export interface PendingMedia {
  name: string;
  type: string;
  size: number;
  /** Data URL of the file contents (kept in memory only while confirming) */
  dataUrl?: string;
  preview?: string;
  /** File was too large to inline — only its name is sent */
  tooLarge?: boolean;
  viewOnce?: boolean;
}

export interface WalletTransaction {
  id: string;
  type: 'purchase' | 'spend';
  amount: number;
  description: string;
  timestamp: number;
}
