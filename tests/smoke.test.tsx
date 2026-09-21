/* Runtime smoke test: renders the real app tree with browser globals stubbed.
   Verifies the sign-in screen, the signed-in shell and a live peer chat render. */

const g = globalThis as Record<string, any>;

class FakeBroadcastChannel {
  onmessage: ((e: { data: any }) => void) | null = null;
  postMessage() {}
  close() {}
}

const fakeEl: any = {
  style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  setAttribute() {}, getAttribute: () => null, appendChild() {}, removeChild() {},
  addEventListener() {}, removeEventListener() {},
  getContext: () => null, toDataURL: () => '', play: () => Promise.resolve(), pause() {},
  querySelector: () => null, querySelectorAll: () => [], focus() {}, click() {},
};

g.window = g.window ?? {};
(g.window as any).window = g.window;
(g.window as any).addEventListener = () => {};
(g.window as any).removeEventListener = () => {};
(g.window as any).dispatchEvent = () => true;
(g.window as any).getComputedStyle = () => ({ getPropertyValue: () => '' });
g.addEventListener = () => {};
g.removeEventListener = () => {};
g.BroadcastChannel = FakeBroadcastChannel;
g.sessionStorage = g.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, clear() {}, length: 0, key: () => null };
g.navigator = { userAgent: 'node', language: 'en', languages: ['en'], clipboard: { writeText: () => Promise.resolve() }, mediaDevices: { getUserMedia: () => Promise.reject(new Error('no media')) }, onLine: true };
g.document = g.document ?? {
  createElement: () => ({ ...fakeEl }),
  createElementNS: () => ({ ...fakeEl }),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
  body: { appendChild() {}, removeChild() {}, style: {} },
  documentElement: { style: {}, classList: { add() {}, remove() {} } },
};
g.location = { hash: '', href: 'http://localhost/', search: '', pathname: '/' };

// Controllable viewport: the app asks for the `md` breakpoint to decide whether
// it may show the chat list and the open chat side by side.
let desktopViewport = true;
g.matchMedia = (query: string) => ({
  matches: desktopViewport && query.includes('768px'),
  media: query,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
});
(g.window as any).matchMedia = g.matchMedia;
g.requestAnimationFrame = (cb: any) => setTimeout(() => cb(Date.now()), 16);
g.cancelAnimationFrame = (id: any) => clearTimeout(id);
g.Image = class { src = ''; onload: any = null; onerror: any = null; };
g.AudioContext = class { state = 'running'; currentTime = 0; createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, type: 'sine' }; } createGain() { return { connect() {}, gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} } }; } destination = {}; close() {} resume() {} };

import { renderToString } from 'react-dom/server';
import { createElement, Fragment } from 'react';
import App, { AppInner } from '../src/App';
import { AppProvider, envelopeFor, messageFromEnvelope, type AppState } from '../src/store/AppContext';
import type { Message } from '../src/types';
import { AccountProvider } from '../src/auth/AccountContext';
import { AuthScreen } from '../src/components/auth/AuthScreen';
import { ContactsModal } from '../src/components/modals/ContactsModal';
import { Sidebar } from '../src/components/layout/Sidebar';
import { ChatArea } from '../src/components/chat/ChatArea';
import { HamburgerMenu } from '../src/components/layout/HamburgerMenu';
import { WelcomeScreen } from '../src/components/shared/WelcomeScreen';

const ME = '784219';
const PEER = '310554';
/** How the app shows an ID: six digits, split for reading. */
const ME_SHOWN = '784 219';
const PEER_SHOWN = '310 554';

let failures = 0;
const strip = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');

function expect(haystack: string, needle: string, label: string) {
  if (strip(haystack).includes(needle)) console.log(`✅ ${label}`);
  else { failures++; console.log(`❌ ${label} (missing: "${needle}")`); }
}

function render(label: string, node: ReturnType<typeof createElement>): string {
  try {
    const html = renderToString(node);
    if (!html || html.length < 40) { failures++; console.log(`❌ ${label}: rendered empty output`); return ''; }
    console.log(`✅ ${label}: rendered ${html.length} chars`);
    return html;
  } catch (err) {
    failures++;
    console.log(`❌ ${label}: THREW -> ${(err as Error).message}`);
    console.log((err as Error).stack?.split('\n').slice(1, 4).join('\n'));
    return '';
  }
}

// ═══ 1. Signed out: the real sign-in screen is what visitors see ═══
const signedOut = render('signed out → auth screen', createElement(App));
expect(signedOut, 'Teleflow', 'the sign-in screen carries the product name');
if (signedOut.includes('Telegram')) { failures++; console.log('❌ the old product name is still on the sign-in screen'); }
else console.log('✅ no leftovers of the old product name');
expect(signedOut, 'Create account', 'create-account tab is offered');
expect(signedOut, 'Sign in', 'sign-in tab is offered');
expect(signedOut, 'device to device', 'the screen explains how messages travel');
expect(signedOut, 'Your ID', 'the ID concept is explained before signup');
expect(signedOut, '6-digit ID', 'the sign-in screen promises a short ID');
expect(signedOut, 'Username', 'the username field is present');
expect(signedOut, 'Password', 'the password field is present');

/** Wraps a surface in the same providers the real app uses. */
function surface(children: ReturnType<typeof createElement>, overrides?: Partial<AppState>) {
  return createElement(AppProvider, overrides ? { overrides } : null, createElement(AccountProvider, null, children));
}

const authAlone = render('auth screen component', surface(createElement(AuthScreen)));
expect(authAlone, 'Repeat password', 'signup asks for the password twice');

// Somebody upgrading from the long-address version must be told why they have to
// sign in again — not dropped on a blank screen.
const legacyGet = g.localStorage.getItem;
g.localStorage.getItem = (key: string) => (key === 'tgw.session.v1'
  ? JSON.stringify({ userId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6', username: 'aziza', name: 'Aziza', createdAt: 1 })
  : null);
const afterUpgrade = render('old long-address session → sign-in screen', createElement(App));
expect(afterUpgrade, '6-digit ID', 'the ID upgrade is explained instead of failing silently');
expect(afterUpgrade, 'Create account', 'the app still offers the normal sign-in flow');
g.localStorage.getItem = legacyGet;

// ═══ 2. Signed in: a clean, real workspace ═══
const session = { userId: ME, username: 'aziza', name: 'Aziza Karimova', createdAt: Date.now() };
g.localStorage.getItem = (key: string) => (key === 'tgw.session.v1' ? JSON.stringify(session) : null);

const signedIn = render('signed in → app shell', createElement(App));
expect(signedIn, 'Saved Messages', 'signed-in workspace has Saved Messages');
expect(signedIn, 'Helper Bot', 'the local helper bot is present');
expect(signedIn, 'Aziza', 'the signed-in account is shown');
if (signedIn.includes('Alice Chen') || signedIn.includes('Dev Team')) {
  failures++; console.log('❌ demo contacts/groups are still in the workspace');
} else console.log('✅ no fake people or demo groups in the app');

const welcome = render('home screen', surface(createElement(WelcomeScreen)));
expect(welcome, 'Copy my ID', 'home screen offers the real ID to share');
expect(welcome, ME_SHOWN, 'the actual account ID is displayed');
expect(welcome, 'Add a contact', 'home screen points at adding a real person');

const menu = render('main menu', surface(createElement(HamburgerMenu, { onClose: () => {} }), { session, currentUser: { id: ME, name: 'Aziza Karimova', username: 'aziza', avatar: '', bio: '', phone: '', lastSeen: Date.now(), isOnline: true, canSeeUserId: 'everyone', canSeeLastSeen: 'everyone' } }));
expect(menu, 'My ID', 'menu exposes the account ID');
expect(menu, 'Sign out', 'menu can sign out of the real account');
expect(menu, ME_SHOWN, 'menu shows the real ID');

// ═══ 3. A real peer chat, overrides only (no store mutation) ═══
const peerState: Partial<AppState> = {
  session,
  currentUser: { id: ME, name: 'Aziza Karimova', username: 'aziza', avatar: '', bio: '', phone: '', lastSeen: Date.now(), isOnline: true, canSeeUserId: 'everyone', canSeeLastSeen: 'everyone' },
  users: {
    user_me: { id: ME, name: 'Aziza Karimova', username: 'aziza', avatar: '', bio: '', phone: '', lastSeen: Date.now(), isOnline: true, canSeeUserId: 'everyone', canSeeLastSeen: 'everyone' },
    [PEER]: { id: PEER, name: 'Bekzod', username: 'bekzod', avatar: '', bio: '', phone: '', lastSeen: Date.now(), isOnline: true, canSeeUserId: 'everyone', canSeeLastSeen: 'everyone' },
  },
  chats: [{ id: `chat_peer_${PEER}`, type: 'private', name: 'Bekzod', avatar: '', members: ['user_me', PEER], admins: [], unreadCount: 0, isPinned: false, isArchived: false, isMuted: false }],
  messages: [
    { id: 'p1', chatId: `chat_peer_${PEER}`, senderId: PEER, text: 'Salom! Welcome to the real client', timestamp: Date.now() - 60000, type: 'text', readBy: [PEER] },
    { id: 'p2', chatId: `chat_peer_${PEER}`, senderId: 'user_me', text: 'Great to write to you', timestamp: Date.now() - 30000, type: 'text', readBy: ['user_me', PEER] },
  ],
  contacts: [{ userId: PEER, isContact: true, isBlocked: false, privateNote: '' }],
  peerPresence: { [PEER]: true },
  netStatus: 'online',
  activeChatId: `chat_peer_${PEER}`,
};

const peerChat = render('peer chat surface', surface(createElement(ChatArea), peerState));
expect(peerChat, 'Salom! Welcome to the real client', 'messages from the other person render');
expect(peerChat, 'Bekzod', 'the peer is named in the header');
if (peerChat.includes('undefined')) { failures++; console.log('❌ peer chat markup contains "undefined"'); }
else console.log('✅ peer chat markup has no undefined values');
if (peerChat.includes('NaN')) { failures++; console.log('❌ peer chat markup contains "NaN"'); }
else console.log('✅ peer chat markup has no NaN values');

// ═══ 3b. The media players are real players ═══
const mediaState: Partial<AppState> = {
  ...peerState,
  messages: [
    ...(peerState.messages ?? []),
    { id: 'p3', chatId: `chat_peer_${PEER}`, senderId: PEER, text: '', timestamp: Date.now() - 20000, type: 'voice', readBy: [PEER], audioUrl: 'data:audio/wav;base64,AAAA', audioDuration: 9, audioWaveform: [0.2, 0.7, 0.4] },
    { id: 'p4', chatId: `chat_peer_${PEER}`, senderId: 'user_me', text: '', timestamp: Date.now() - 10000, type: 'video', videoNote: true, videoUrl: 'data:video/mp4;base64,BBBB', readBy: ['user_me'] },
    { id: 'p5', chatId: `chat_peer_${PEER}`, senderId: 'user_me', text: 'written while you were away', timestamp: Date.now() - 5000, type: 'text', readBy: ['user_me'], deliveryPending: true },
  ],
};
const mediaChat = render('peer chat with voice, video note and outbox', surface(createElement(ChatArea), mediaState));

// The circular video message is a real <video> that loops and can be tapped,
// not an empty circle.
if (/<video[^>]*loop/.test(mediaChat) && /<video[^>]*playsinline/i.test(mediaChat)) {
  console.log('✅ the circular video message is a real looping video element');
} else { failures++; console.log('❌ the circular video message is not a playable <video>'); }
if (/<audio[^>]*data:audio\/wav/.test(mediaChat)) console.log('✅ the voice message carries real audio');
else { failures++; console.log('❌ the voice message has no audio element'); }
for (const speed of ['1x', '1.5x', '2x']) expect(mediaChat, speed, `the voice player offers ${speed} playback`);

// The outbox mark: a message written while the other person was away is visibly
// still on its way instead of silently lost.
expect(mediaChat, 'pending', 'a queued message is marked as pending in the outbox');

// ═══ 3c. The redesign: glass chrome, gradient bubbles, floating composer ═══
expect(peerChat, 'tg-doodle', 'the chat sits on the doodle wallpaper, not flat black');
expect(peerChat, 'glass-header', 'the header is a translucent glass bar');
expect(peerChat, 'glass-composer', 'the composer bar is translucent too');
expect(peerChat, 'composer-pill', 'the composer is a floating capsule');
expect(peerChat, 'send-btn', 'the composer has its glossy round action button');
expect(peerChat, 'bubble-in', 'incoming messages use the dark incoming bubble');
expect(peerChat, 'bubble-out', 'outgoing messages use the blue gradient bubble');
expect(peerChat, 'bubble-tail-out', 'the last message of a run carries the tail corner');
expect(peerChat, 'avatar-sheen', 'avatars carry the Telegram gradient sheen');

// A per-chat wallpaper must not wipe out the doodle: the shorthand `background`
// would reset background-image, `backgroundColor` does not.
const wallpapered = render('chat with a custom wallpaper', surface(createElement(ChatArea), { ...peerState, chats: [{ ...peerState.chats![0], wallpaper: '#0f3460' }] }));
if (/tg-doodle[^>]*background-color|background-color[^>]*tg-doodle/.test(wallpapered) || (wallpapered.includes('tg-doodle') && wallpapered.includes('background-color:#0f3460'))) {
  console.log('✅ a custom wallpaper keeps the doodle pattern underneath it');
} else { failures++; console.log('❌ the wallpaper clobbers the doodle background'); }
if (peerChat.includes('tgweb-')) { failures++; console.log('❌ the old peer prefix is still in use'); }
else console.log('✅ the old peer prefix is gone from the app');

const peerList = render('sidebar with a real contact', surface(createElement(Sidebar), peerState));
expect(peerList, 'Bekzod', 'the real contact shows in the chat list');

const contacts = render('contacts with address book', surface(createElement(ContactsModal), { ...peerState, isContactsOpen: true }));
expect(contacts, 'My ID', 'contacts screen shows my own ID');
expect(contacts, ME_SHOWN, 'contacts screen shows the actual six digits');
expect(contacts, 'Add by ID', 'contacts screen can connect a new person');
expect(contacts, 'Bekzod', 'existing contact is listed');

// ═══ 4. Empty workspace must not crash ═══
render('signed in with an empty workspace', surface(
  createElement(Fragment, null, createElement(Sidebar), createElement(WelcomeScreen)),
  { session, currentUser: peerState.currentUser, users: {}, chats: [], messages: [], contacts: [], activeChatId: null },
));

// ═══ 5. Every message type survives the trip to the other person ═══
// The wire format is not text-only: photos, voice notes, files, locations,
// stickers and gifts all arrive on the other device as themselves.
const me = { userId: ME, username: 'aziza', name: 'Aziza', createdAt: Date.now() };
const outgoing: Array<[string, Message]> = [
  ['plain text', { id: 'm1', chatId: 'chat_peer_x', senderId: 'user_me', text: 'Salom', timestamp: 1000, type: 'text', readBy: ['user_me'] }],
  ['photo', { id: 'm2', chatId: 'chat_peer_x', senderId: 'user_me', text: 'screenshot', timestamp: 1000, type: 'photo', photoUrl: 'data:image/jpeg;base64,AAA', readBy: ['user_me'] }],
  ['voice note', { id: 'm3', chatId: 'chat_peer_x', senderId: 'user_me', text: '', timestamp: 1000, type: 'voice', audioUrl: 'data:audio/wav;base64,BBB', audioDuration: 7, audioWaveform: [0.2, 0.6], readBy: ['user_me'] }],
  ['video message', { id: 'm4', chatId: 'chat_peer_x', senderId: 'user_me', text: '', timestamp: 1000, type: 'video', videoNote: true, videoUrl: 'data:video/webm;base64,CCC', readBy: ['user_me'] }],
  ['document', { id: 'm5', chatId: 'chat_peer_x', senderId: 'user_me', text: '', timestamp: 1000, type: 'file', fileUrl: 'data:application/pdf;base64,DDD', fileName: 'report.pdf', fileSize: 2048, readBy: ['user_me'] }],
  ['music', { id: 'm6', chatId: 'chat_peer_x', senderId: 'user_me', text: '', timestamp: 1000, type: 'music', audioUrl: 'data:audio/mpeg;base64,EEE', musicTitle: 'Track', readBy: ['user_me'] }],
  ['location', { id: 'm7', chatId: 'chat_peer_x', senderId: 'user_me', text: '', timestamp: 1000, type: 'location', location: { lat: 41.31, lng: 69.24 }, readBy: ['user_me'] }],
  ['sticker', { id: 'm8', chatId: 'chat_peer_x', senderId: 'user_me', text: '🦄', timestamp: 1000, type: 'sticker', readBy: ['user_me'] }],
  ['gift', { id: 'm9', chatId: 'chat_peer_x', senderId: 'user_me', text: '', timestamp: 1000, type: 'gift', gift: { emoji: '🎁', name: 'Gift' }, readBy: ['user_me'] }],
  ['view-once photo', { id: 'm10', chatId: 'chat_peer_x', senderId: 'user_me', text: '', timestamp: 1000, type: 'photo', photoUrl: 'data:image/jpeg;base64,FFF', viewOnce: true, readBy: ['user_me'] }],
];

let wireFailures = 0;
for (const [label, message] of outgoing) {
  const arrived = messageFromEnvelope(PEER, envelopeFor(message, me));
  const sameKind = arrived.type === message.type;
  const sameBody = arrived.text === message.text
    && arrived.photoUrl === message.photoUrl
    && arrived.videoUrl === message.videoUrl
    && arrived.audioUrl === message.audioUrl
    && arrived.fileUrl === message.fileUrl
    && JSON.stringify(arrived.location) === JSON.stringify(message.location)
    && arrived.viewOnce === message.viewOnce;
  const wellAddressed = arrived.id === message.id && arrived.senderId === PEER && arrived.chatId === `chat_peer_${PEER}` && arrived.readBy.length === 1;
  if (sameKind && sameBody && wellAddressed) console.log(`✅ ${label} arrives complete`);
  else { wireFailures++; console.log(`❌ ${label} did not survive the wire (kind=${sameKind} body=${sameBody} addressed=${wellAddressed})`); }
}
if (wireFailures) failures += wireFailures;

const queued = messageFromEnvelope(PEER, envelopeFor(
  { id: 'm11', chatId: 'chat_peer_x', senderId: 'user_me', text: 'later', timestamp: 1, type: 'text', readBy: ['user_me'], scheduledAt: Date.now() + 60000, sendWhenOnline: true }, me,
));
if (queued.scheduledAt === undefined && queued.sendWhenOnline === undefined) console.log('✅ a message still waiting is never delivered early');
else { failures++; console.log('❌ queued fields leaked onto the wire'); }

// ═══ 6. A ringing call is a real incoming call, with accept and decline ═══
const ringing = render('incoming call', surface(createElement(AppInner), {
  ...peerState,
  incomingCall: {
    userId: PEER,
    video: true,
    connection: { peer: `teleflow-${PEER}`, metadata: { video: true }, open: true, on() {}, answer() {}, close() {} } as never,
  },
}));
expect(ringing, 'Bekzod', 'the caller is named on the incoming call screen');
expect(ringing, 'Incoming video call', 'the screen says a video call is ringing');
const callButtons = (ringing.match(/rounded-full bg-tg-(red|green)/g) || []).length;
if (callButtons >= 2) console.log('✅ the call offers decline and accept');
else { failures++; console.log(`❌ the incoming call has no accept/decline pair (${callButtons})`); }
if (ringing.includes('src="data:')) { failures++; console.log('❌ the call still fakes a connection'); }
else console.log('✅ nothing about the call is pre-rendered as connected');

// ═══ 7. Phone layout: one pane at a time, never two squeezed side by side ═══
// Hiding is done with classes, so the assertion reads the pane's own class list.
function paneVisible(html: string, testId: string) {
  const i = html.indexOf(`data-testid="${testId}"`);
  if (i < 0) return null;
  const c = html.indexOf('class="', i);
  if (c < 0) return null;
  return !html.slice(c + 7, html.indexOf('"', c + 7)).split(/\s+/).includes('hidden');
}
function checkPane(label: string, html: string, testId: string, visible: boolean) {
  const actual = paneVisible(html, testId);
  if (actual === visible) console.log(`✅ ${label}`);
  else { failures++; console.log(`❌ ${label} (${testId} visible=${actual ?? 'not rendered'})`); }
}

// Empty workspace on a phone: the chat list takes the whole width.
desktopViewport = false;
const phoneHome = render('phone → chat list fills the screen', surface(createElement(AppInner), { ...peerState, activeChatId: null, chats: [] }));
checkPane('phone shows the chat list when no chat is open', phoneHome, 'list-pane', true);
checkPane('phone hides the welcome pane (no squeezed panel)', phoneHome, 'chat-pane', false);
expect(phoneHome, 'Copy my ID', 'the phone home still offers the ID to share');
expect(phoneHome, 'Add contact', 'the phone home offers adding a person');

// Open chat on a phone: the chat replaces the list.
const phoneChat = render('phone → open chat replaces the list', surface(createElement(AppInner), peerState));
expect(phoneChat, 'Salom! Welcome to the real client', 'the open chat renders on a phone');
checkPane('phone hides the chat list while a chat is open', phoneChat, 'list-pane', false);
checkPane('phone shows the open chat full width', phoneChat, 'chat-pane', true);

// Desktop keeps both panes.
desktopViewport = true;
const desktopChat = render('desktop → list and chat side by side', surface(createElement(AppInner), peerState));
checkPane('desktop shows the chat list', desktopChat, 'list-pane', true);
checkPane('desktop shows the open chat', desktopChat, 'chat-pane', true);

console.log(failures === 0 ? '\n🎉 all smoke checks passed' : `\n❌ ${failures} smoke check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
