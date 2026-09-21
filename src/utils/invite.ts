/** Parses an invite hash (`#join/<chatId>`) into a chat id, or null. */
export function parseInviteHash(hash: string): string | null {
  if (!hash) return null;
  const match = hash.match(/^#join\/(.+)$/);
  if (!match) return null;
  const chatId = decodeURIComponent(match[1]).trim();
  return chatId.length > 0 ? chatId : null;
}

/** Builds a shareable invite link for a chat. */
export function buildInviteLink(chatId: string): string {
  return `#join/${encodeURIComponent(chatId)}`;
}
