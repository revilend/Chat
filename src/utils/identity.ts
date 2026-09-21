const encoder = new TextEncoder();

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Every account listens under this prefix, so no other app can take the address. */
export const PEER_PREFIX = 'teleflow-';

/**
 * The account ID: six digits, easy to read out loud and to type by hand.
 *
 * It is derived from the login credentials, so the same username + password
 * always produces the same ID on any device — that ID is the address other
 * people add you by, and only that exact password can ever reproduce it.
 */
export async function deriveAccountId(username: string, password: string): Promise<string> {
  const hash = await sha256Hex(`teleflow:v2:${normalizeUsername(username)}:${password}`);
  const value = parseInt(hash.slice(0, 12), 16) % 1_000_000;
  return value.toString().padStart(6, '0');
}

/**
 * Accepts anything a person may paste — `784219`, `784 219`, `@784219`,
 * `teleflow-784219` — and returns the bare six digits.
 */
export function normalizeUserId(value: string): string {
  return value
    .trim()
    .replace(/^@/, '')
    .replace(new RegExp(`^${PEER_PREFIX}`, 'i'), '')
    .replace(/[\s-]/g, '');
}

/** A real account address: exactly six digits. */
export function isValidUserId(value: string): boolean {
  return /^\d{6}$/.test(normalizeUserId(value));
}

/** PeerJS address for a user ID — internal only, users never see this form. */
export function peerIdFor(userId: string): string {
  return `${PEER_PREFIX}${normalizeUserId(userId)}`;
}

/** Extracts the user ID from a peer address (returns null when it is not ours). */
export function userIdFromPeerId(peerId: string): string | null {
  return peerId.startsWith(PEER_PREFIX) ? peerId.slice(PEER_PREFIX.length) : null;
}

/** Human-readable safety number both sides can compare out of band. */
export async function safetyNumber(userA: string, userB: string): Promise<string> {
  const hash = await sha256Hex([userA, userB].sort().join('|'));
  return (hash.slice(0, 16).match(/.{4}/g) ?? []).join(' ');
}

/**
 * The ID as it is shown to the user — six digits, nothing else.
 * An address left over from the older 32-character version is never printed raw.
 */
export function shortId(userId: string): string {
  const id = normalizeUserId(userId);
  return /^\d{6}$/.test(id) ? id : 'unknown';
}

/** True for an address from the older 32-character version. */
export function isLegacyAddress(value: string): boolean {
  return /^[0-9a-f]{32}$/i.test(value.trim());
}

/**
 * A name that is always safe to show: a leftover long address is replaced by the
 * person's ID (or a plain "Unknown contact") so no raw hash ever reaches the UI.
 */
export function displayNameFor(name: string | undefined, fallbackId = ''): string {
  const value = (name ?? '').trim();
  if (value && !isLegacyAddress(value)) return value;
  const id = normalizeUserId(fallbackId);
  return /^\d{6}$/.test(id) ? `ID ${formatUserId(id)}` : 'Unknown contact';
}

/** Display form used everywhere: `461-182`. */
export function formatUserId(userId: string): string {
  const id = normalizeUserId(userId);
  return id.length === 6 ? `${id.slice(0, 3)}-${id.slice(3)}` : id;
}
