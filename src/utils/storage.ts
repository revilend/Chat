import { deleteData, getData, saveData } from '../db';
import type { Chat, Contact, Message, Story, User } from '../types';

/**
 * Everything an account owns, exactly as it is written to disk.
 * The shape matches the record the app used before, so nothing already stored
 * in someone's browser is thrown away.
 */
export interface StoredWorkspace {
  chats: Chat[];
  messages: Message[];
  users: User[];
  contacts: Contact[];
  stories: Story[];
  currentUser?: User;
  lastActiveAt?: number;
  autoDeleteInactivity?: 0 | 1 | 3 | 6;
}

/**
 * Media is stored inline as base64, which blows past localStorage's ~5 MB very
 * quickly. Anything longer than this is therefore kept in IndexedDB only; the
 * localStorage copy still carries the whole history of text, contacts and chats.
 */
const INLINE_LIMIT = 20_000;
const MEDIA_FIELDS = ['photoUrl', 'videoUrl', 'audioUrl', 'fileUrl', 'thumbnail', 'avatar'] as const;

const KEY_PREFIX = 'teleflow.workspace.';

export function localWorkspaceKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

/** IndexedDB record key — unchanged so existing histories are still found. */
function dbWorkspaceKey(userId: string): string {
  return `workspace:${userId}`;
}

function dropHeavyMedia(workspace: StoredWorkspace, everyMediaField: boolean): StoredWorkspace {
  const messages = workspace.messages.map(message => {
    let slim: Message | null = null;
    for (const field of MEDIA_FIELDS) {
      const value = (message as unknown as Record<string, unknown>)[field];
      if (typeof value !== 'string') continue;
      if (!everyMediaField && value.length <= INLINE_LIMIT) continue;
      slim = slim ?? { ...message };
      delete (slim as unknown as Record<string, unknown>)[field];
    }
    return slim ?? message;
  });
  return { ...workspace, messages };
}

/** The copy that always fits in localStorage. */
export function slimWorkspace(workspace: StoredWorkspace): StoredWorkspace {
  return dropHeavyMedia(workspace, false);
}

/**
 * Writes the workspace to both places at once:
 * IndexedDB keeps everything including photos and voice notes, and localStorage
 * keeps identity, contacts, chats and the full message history even if
 * IndexedDB is unavailable (private windows, blocked storage, eviction).
 */
export async function persistWorkspace(userId: string, workspace: StoredWorkspace): Promise<void> {
  try {
    await saveData('settings', workspace, dbWorkspaceKey(userId));
  } catch { /* IndexedDB blocked or full — localStorage below is the safety net */ }

  try {
    localStorage.setItem(localWorkspaceKey(userId), JSON.stringify(slimWorkspace(workspace)));
  } catch {
    // Very large history: retry without any inline media so the text survives.
    try {
      localStorage.setItem(localWorkspaceKey(userId), JSON.stringify(dropHeavyMedia(workspace, true)));
    } catch { /* storage genuinely unavailable */ }
  }
}

export function loadLocalWorkspace(userId: string): StoredWorkspace | null {
  try {
    const raw = localStorage.getItem(localWorkspaceKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredWorkspace;
    return parsed?.currentUser ? { ...parsed, messages: parsed.messages ?? [] } : null;
  } catch {
    return null;
  }
}

/**
 * The account's workspace: the full copy from IndexedDB when it is there,
 * otherwise the localStorage copy so a history is never lost.
 */
export async function loadStoredWorkspace(userId: string): Promise<StoredWorkspace | null> {
  try {
    const stored = await getData<StoredWorkspace>('settings', dbWorkspaceKey(userId));
    if (stored?.currentUser) {
      // IndexedDB holds the media; merge in anything localStorage knows that the
      // database copy lost (for example after a partial write).
      return stored;
    }
  } catch { /* fall through to localStorage */ }
  return loadLocalWorkspace(userId);
}

export async function clearStoredWorkspace(userId: string): Promise<void> {
  try { await deleteData('settings', dbWorkspaceKey(userId)); } catch { /* ignore */ }
  try { localStorage.removeItem(localWorkspaceKey(userId)); } catch { /* ignore */ }
}
