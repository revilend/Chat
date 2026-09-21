const encoder = new TextEncoder();

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * A real account identity derived from the login credentials:
 * the same username + password always produces the same user ID on any device,
 * while a different password produces a completely different one.
 * The full ID doubles as the peer address, so only people you share it with can reach you.
 */
export async function deriveUserId(username: string, password: string): Promise<string> {
  return (await sha256Hex(`tgw1:${normalizeUsername(username)}:${password}`)).slice(0, 32);
}

/** PeerJS address for a user ID. */
export function peerIdFor(userId: string): string {
  return `tgweb-${userId}`;
}

/** Extracts the user ID from a peer address (returns null when it is not ours). */
export function userIdFromPeerId(peerId: string): string | null {
  return peerId.startsWith('tgweb-') ? peerId.slice('tgweb-'.length) : null;
}

/** Human-readable safety number both sides can compare out of band. */
export async function safetyNumber(userA: string, userB: string): Promise<string> {
  const hash = await sha256Hex([userA, userB].sort().join('|'));
  return (hash.slice(0, 16).match(/.{4}/g) ?? []).join(' ');
}

export function shortId(userId: string): string {
  return `${userId.slice(0, 6)}…${userId.slice(-4)}`;
}

export function isValidUserId(value: string): boolean {
  return /^[0-9a-f]{32}$/.test(value.trim());
}
