import { normalizeUserId, normalizeUsername } from './identity';

/**
 * A small local address book of `@username → 6-digit ID`.
 *
 * The ID is derived from the login credentials, so a handle alone cannot be
 * turned into an address mathematically. What can be done without a server is to
 * remember the mapping every time two people really meet: each profile that
 * arrives over a live connection (and every account used on this device) is
 * written down here, so the next time a handle is enough.
 */

const KEY = 'teleflow.directory.v1';
const MAX_ENTRIES = 500;

type Directory = Record<string, string>;

function read(): Directory {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Directory) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function write(directory: Directory) {
  try {
    const entries = Object.entries(directory);
    // Keep the newest entries only, so the map can never grow without bound.
    const trimmed = entries.length > MAX_ENTRIES ? Object.fromEntries(entries.slice(-MAX_ENTRIES)) : directory;
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch { /* storage blocked */ }
}

/** Remembers that this handle belongs to this ID. */
export function rememberHandle(username: string, userId: string) {
  const handle = normalizeUsername(username);
  const id = normalizeUserId(userId);
  if (!handle || !/^\d{6}$/.test(id)) return;
  const directory = read();
  if (directory[handle] === id) return;
  write({ ...directory, [handle]: id });
}

/** The ID behind a handle, when this device has met them. */
export function lookupHandle(username: string): string | null {
  const handle = normalizeUsername(username);
  if (!handle) return null;
  return read()[handle] ?? null;
}

/** The whole directory, for resolving a whole address book at once. */
export function knownHandles(): Directory {
  return read();
}
