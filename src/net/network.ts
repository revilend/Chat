import Peer, { type DataConnection } from 'peerjs';
import { peerIdFor, userIdFromPeerId, shortId } from '../utils/identity';

export type CloudStatus = 'off' | 'connecting' | 'online' | 'error';
export type PeerState = 'online' | 'offline' | 'connecting';

/**
 * Everything two people can send each other. A real message travels as its own
 * fields (`payload`), so photos, voice notes, locations, polls and gifts all
 * arrive exactly as they were written — not just the plain text ones.
 */
export interface OutgoingEnvelope {
  kind: 'message' | 'edit' | 'delete' | 'typing' | 'read' | 'profile' | 'react' | 'ping' | 'pong';
  id?: string;
  text?: string;
  timestamp?: number;
  username?: string;
  name?: string;
  userId?: string;
  messageIds?: string[];
  isTyping?: boolean;
  emoji?: string;
  /** The message being delivered, minus the fields the receiving side owns. */
  payload?: Record<string, unknown>;
}

export type NetEvent =
  | { type: 'status'; status: CloudStatus; detail?: string }
  | { type: 'peer'; userId: string; state: PeerState }
  | { type: 'message'; userId: string; envelope: OutgoingEnvelope }
  | { type: 'profile'; userId: string; username: string; name?: string };

interface Link {
  connection: DataConnection;
  /** true when this side accepted the connection instead of opening it */
  incoming: boolean;
  lastSeenAt: number;
}

/**
 * Real peer-to-peer messaging between two browsers on different devices.
 *
 * Messages travel directly between the two people over a WebRTC data channel;
 * the only shared piece is the public signalling broker that lets the two
 * browsers find each other, and it never sees message contents.
 */
class Network {
  private peer: Peer | null = null;
  private links = new Map<string, Link>();
  private handlers = new Set<(event: NetEvent) => void>();
  private knownContacts = new Set<string>();
  private queue = new Map<string, OutgoingEnvelope[]>();
  private dialTimers = new Map<string, ReturnType<typeof setInterval>>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private status: CloudStatus = 'off';

  userId: string | null = null;
  username = '';
  displayName = '';

  on(handler: (event: NetEvent) => void): () => void {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  private emit(event: NetEvent) {
    this.handlers.forEach(handler => { try { handler(event); } catch { /* ignore */ } });
  }

  getStatus(): CloudStatus { return this.status; }

  /** Starts listening for incoming connections under this account's address. */
  start(userId: string, username: string, displayName: string) {
    this.stop();
    this.userId = userId;
    this.username = username;
    this.displayName = displayName;
    this.setStatus('connecting');

    try {
      this.peer = new Peer(peerIdFor(userId), { debug: 0 });

      this.peer.on('open', () => {
        this.setStatus('online');
        this.knownContacts.forEach(id => this.dial(id));
        // Keep trying while contacts stay offline
        const retry = setInterval(() => {
          if (!this.peer?.open) return;
          this.knownContacts.forEach(id => {
            if (!this.links.get(id)?.connection.open) this.dial(id);
          });
        }, 15000);
        this.dialTimers.set('__retry__', retry);

        this.heartbeat = setInterval(() => this.ping(), 20000);
      });

      this.peer.on('connection', (connection) => this.accept(connection));

      this.peer.on('error', (err: Error & { type?: string }) => {
        const detail = err.type === 'unavailable-id'
          ? 'This account is already signed in somewhere else. Close the other tab to keep it here.'
          : err.type === 'network' || err.type === 'server-error'
            ? 'Could not reach the connection service — check your internet connection.'
            : err.message || String(err.type || err);
        this.setStatus('error', detail);
      });

      this.peer.on('disconnected', () => {
        if (this.peer) {
          try { this.peer.reconnect(); } catch { /* ignore */ }
          this.setStatus('connecting', 'Reconnecting to the connection service…');
        }
      });
    } catch (err) {
      this.setStatus('error', (err as Error).message);
    }
  }

  stop() {
    this.dialTimers.forEach(timer => clearInterval(timer));
    this.dialTimers.clear();
    if (this.heartbeat) { clearInterval(this.heartbeat); this.heartbeat = null; }
    this.links.forEach(link => { try { link.connection.close(); } catch { /* ignore */ } });
    this.links.clear();
    try { this.peer?.destroy(); } catch { /* ignore */ }
    this.peer = null;
    this.userId = null;
    this.setStatus('off');
  }

  /** Registers the people this account can reach, dialing the ones not yet connected. */
  trackContacts(userIds: string[]) {
    userIds.filter(id => id && id !== this.userId).forEach(id => {
      this.knownContacts.add(id);
      if (!this.links.get(id)?.connection.open) this.dial(id);
    });
  }

  isOnline(userId: string): boolean {
    return this.links.get(userId)?.connection.open === true;
  }

  onlineContacts(): string[] {
    return [...this.links.entries()].filter(([, l]) => l.connection.open).map(([id]) => id);
  }

  /** Queues when the other person is not connected yet — it is delivered on connect. */
  send(userId: string, envelope: OutgoingEnvelope): boolean {
    const link = this.links.get(userId);
    if (link?.connection.open) {
      try {
        link.connection.send(envelope);
        link.lastSeenAt = Date.now();
        return true;
      } catch { /* fall through to the queue */ }
    }
    const pending = this.queue.get(userId) ?? [];
    pending.push(envelope);
    this.queue.set(userId, pending);
    this.dial(userId);
    return false;
  }

  queuedCount(userId: string): number {
    return this.queue.get(userId)?.length ?? 0;
  }

  private ping() {
    const payload: OutgoingEnvelope = { kind: 'ping', timestamp: Date.now() };
    this.links.forEach((link, userId) => {
      if (!link.connection.open) return;
      try { link.connection.send(payload); } catch { /* ignore */ }
      // No reply for a while means the other side is gone
      if (Date.now() - link.lastSeenAt > 75000) {
        this.drop(userId);
      }
    });
  }

  private drop(userId: string) {
    const link = this.links.get(userId);
    if (!link) return;
    try { link.connection.close(); } catch { /* ignore */ }
    this.links.delete(userId);
    this.emit({ type: 'peer', userId, state: 'offline' });
  }

  private accept(connection: DataConnection) {
    const userId = userIdFromPeerId(connection.peer);
    if (!userId || userId === this.userId) return;
    connection.on('open', () => this.attach(userId, connection, true));
    connection.on('error', () => { /* surfaced by the close handler */ });
  }

  private dial(userId: string) {
    if (!this.peer?.open || !this.userId || userId === this.userId) return;
    const existing = this.links.get(userId);
    if (existing?.connection.open) return;
    if (existing && Date.now() - existing.lastSeenAt < 8000) return; // still connecting

    try {
      const connection = this.peer.connect(peerIdFor(userId), { reliable: true, serialization: 'json' });
      this.emit({ type: 'peer', userId, state: 'connecting' });
      connection.on('open', () => this.attach(userId, connection, false));
      connection.on('error', () => this.emit({ type: 'peer', userId, state: 'offline' }));
      connection.on('close', () => {
        if (this.links.get(userId)?.connection === connection) this.drop(userId);
      });
    } catch {
      this.emit({ type: 'peer', userId, state: 'offline' });
    }
  }

  /**
   * Both sides may open a channel at the same time. To make sure the two ends
   * always agree on *one* channel, the lower address keeps the connection it
   * opened and the higher address keeps the one it accepted.
   */
  private attach(userId: string, connection: DataConnection, incoming: boolean) {
    const existing = this.links.get(userId);
    if (existing) {
      const open = existing.connection.open;
      const keepIncoming = this.userId ? this.userId > userId : true;
      const newWins = incoming === keepIncoming;
      if (open && !newWins) { try { connection.close(); } catch { /* ignore */ } return; }
      if (!open || newWins) { try { existing.connection.close(); } catch { /* ignore */ } }
    }

    const link: Link = { connection, incoming, lastSeenAt: Date.now() };
    this.links.set(userId, link);
    this.knownContacts.add(userId);
    this.emit({ type: 'peer', userId, state: 'online' });

    connection.on('data', (data) => {
      link.lastSeenAt = Date.now();
      this.handleEnvelope(userId, data as OutgoingEnvelope);
    });
    connection.on('close', () => {
      if (this.links.get(userId) === link) this.drop(userId);
    });

    // Introduce ourselves so the other person learns our handle
    try {
      connection.send({ kind: 'profile', userId: this.userId ?? '', username: this.username, name: this.displayName });
    } catch { /* ignore */ }

    // Deliver everything that was written while they were offline
    const pending = this.queue.get(userId);
    if (pending?.length) {
      pending.forEach(envelope => { try { connection.send(envelope); } catch { /* ignore */ } });
      this.queue.delete(userId);
    }
  }

  private handleEnvelope(userId: string, envelope: OutgoingEnvelope) {
    if (!envelope || typeof envelope !== 'object') return;
    if (envelope.kind === 'ping') {
      const link = this.links.get(userId);
      if (link?.connection.open) { try { link.connection.send({ kind: 'pong', timestamp: Date.now() }); } catch { /* ignore */ } }
      return;
    }
    if (envelope.kind === 'pong') return;
    if (envelope.kind === 'profile') {
      if (envelope.userId && envelope.userId !== userId) return; // identity mismatch
      if (envelope.username) this.emit({ type: 'profile', userId, username: envelope.username, name: envelope.name });
      return;
    }
    this.emit({ type: 'message', userId, envelope });
  }

  private setStatus(status: CloudStatus, detail?: string) {
    this.status = status;
    this.emit({ type: 'status', status, detail });
  }

  describe(userId: string): string {
    return shortId(userId);
  }
}

export const network = new Network();
