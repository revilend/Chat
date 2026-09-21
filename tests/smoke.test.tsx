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
g.matchMedia = () => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
g.requestAnimationFrame = (cb: any) => setTimeout(() => cb(Date.now()), 16);
g.cancelAnimationFrame = (id: any) => clearTimeout(id);
g.Image = class { src = ''; onload: any = null; onerror: any = null; };
g.AudioContext = class { state = 'running'; currentTime = 0; createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, type: 'sine' }; } createGain() { return { connect() {}, gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} } }; } destination = {}; close() {} resume() {} };

import { renderToString } from 'react-dom/server';
import { createElement, Fragment } from 'react';
import App from '../src/App';
import { AppProvider, type AppState } from '../src/store/AppContext';
import { AccountProvider } from '../src/auth/AccountContext';
import { AuthScreen } from '../src/components/auth/AuthScreen';
import { ContactsModal } from '../src/components/modals/ContactsModal';
import { Sidebar } from '../src/components/layout/Sidebar';
import { ChatArea } from '../src/components/chat/ChatArea';
import { HamburgerMenu } from '../src/components/layout/HamburgerMenu';
import { WelcomeScreen } from '../src/components/shared/WelcomeScreen';

const ME = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const PEER = '11223344556677889900aabbccddeeff';

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
expect(signedOut, 'Create account', 'create-account tab is offered');
expect(signedOut, 'Sign in', 'sign-in tab is offered');
expect(signedOut, 'device to device', 'the screen explains how messages travel');
expect(signedOut, 'Your address', 'the address concept is explained before signup');
expect(signedOut, 'Username', 'the username field is present');
expect(signedOut, 'Password', 'the password field is present');

/** Wraps a surface in the same providers the real app uses. */
function surface(children: ReturnType<typeof createElement>, overrides?: Partial<AppState>) {
  return createElement(AppProvider, overrides ? { overrides } : null, createElement(AccountProvider, null, children));
}

const authAlone = render('auth screen component', surface(createElement(AuthScreen)));
expect(authAlone, 'Repeat password', 'signup asks for the password twice');

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
expect(welcome, 'Copy my address', 'home screen offers the real address to share');
expect(welcome, ME, 'the actual account address is displayed');
expect(welcome, 'Add a contact', 'home screen points at adding a real person');

const menu = render('main menu', surface(createElement(HamburgerMenu, { onClose: () => {} }), { session, currentUser: { id: ME, name: 'Aziza Karimova', username: 'aziza', avatar: '', bio: '', phone: '', lastSeen: Date.now(), isOnline: true, canSeeUserId: 'everyone', canSeeLastSeen: 'everyone' } }));
expect(menu, 'My address', 'menu exposes the account address');
expect(menu, 'Sign out', 'menu can sign out of the real account');
expect(menu, ME, 'menu shows the real address');

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

const peerList = render('sidebar with a real contact', surface(createElement(Sidebar), peerState));
expect(peerList, 'Bekzod', 'the real contact shows in the chat list');

const contacts = render('contacts with address book', surface(createElement(ContactsModal), { ...peerState, isContactsOpen: true }));
expect(contacts, 'My address', 'contacts screen shows my own address');
expect(contacts, 'Add by address', 'contacts screen can connect a new person');
expect(contacts, 'Bekzod', 'existing contact is listed');

// ═══ 4. Empty workspace must not crash ═══
render('signed in with an empty workspace', surface(
  createElement(Fragment, null, createElement(Sidebar), createElement(WelcomeScreen)),
  { session, currentUser: peerState.currentUser, users: {}, chats: [], messages: [], contacts: [], activeChatId: null },
));

console.log(failures === 0 ? '\n🎉 all smoke checks passed' : `\n❌ ${failures} smoke check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
