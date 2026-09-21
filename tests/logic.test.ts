/* Logic test for the real account system: addresses must be reproducible on any
   device from the same credentials, and a wrong password must never open an account. */

const g = globalThis as Record<string, any>;
const store = new Map<string, string>();
g.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  length: 0,
  key: () => null,
};

let failures = 0;
function check(label: string, ok: boolean, extra = '') {
  if (ok) console.log(`✅ ${label}`);
  else { failures++; console.log(`❌ ${label} ${extra}`); }
}

const { deriveAccountId, peerIdFor, userIdFromPeerId, isValidUserId, normalizeUserId, shortId, formatUserId } = await import('../src/utils/identity');
const { authenticate, knownAccounts, loadSession, clearSession } = await import('../src/auth/session');
const { buildAccountWorkspace } = await import('../src/auth/workspace');
const { persistWorkspace, loadLocalWorkspace, loadStoredWorkspace, clearStoredWorkspace } = await import('../src/utils/storage');

// ── 1. The ID is a real, reproducible identity ────────────────────────────────
const deviceA = await deriveAccountId('aziza', 'secret123');
const deviceB = await deriveAccountId('aziza', 'secret123');
const wrongPassword = await deriveAccountId('aziza', 'secret124');
const otherUser = await deriveAccountId('bekzod', 'secret123');

check('same credentials produce the same ID on any device', deviceA === deviceB);
check('a different password is a different identity', deviceA !== wrongPassword);
check('a different username is a different identity', deviceA !== otherUser);
check('the ID is exactly six digits', /^\d{6}$/.test(deviceA), deviceA);
check('the ID is a valid address', isValidUserId(deviceA), deviceA);
check('username is normalised (@Aziza vs aziza)', (await deriveAccountId('@Aziza ', 'secret123')) === deviceA);
check('ID spaces are added for reading', /^\d{3} \d{3}$/.test(formatUserId(deviceA)), formatUserId(deviceA));

// ── 2. What a person may paste is understood ─────────────────────────────────
check('a bare six-digit ID is accepted', normalizeUserId('784219') === '784219');
check('an ID with spaces is accepted', normalizeUserId('784 219') === '784219');
check('an @-prefixed ID is accepted', normalizeUserId('@784219') === '784219');
check('the internal peer prefix is accepted', normalizeUserId('teleflow-784219') === '784219');
check('a five-digit number is not an ID', !isValidUserId('12345'));
check('letters are not an ID', !isValidUserId('abcdef'));
check('the old 32-hex address is not an ID', !isValidUserId('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'));

// ── 3. Peer addressing round-trips ────────────────────────────────────────────
check('peer address is prefixed with teleflow-', peerIdFor(deviceA) === `teleflow-${deviceA}`, peerIdFor(deviceA));
check('peer address is parsed back to the ID', userIdFromPeerId(peerIdFor(deviceA)) === deviceA);
check('foreign peer ids are rejected', userIdFromPeerId('somebody-else') === null);
check('the ID is shown as it is', shortId(deviceA) === deviceA);

// ── 4. Real sign up / sign in ─────────────────────────────────────────────────
const created = await authenticate('signup', 'aziza', 'secret123', 'Aziza Karimova');
check('signup creates the account', created.userId === deviceA);
check('signup keeps the display name', created.name === 'Aziza Karimova');
check('session is stored for the next launch', loadSession()?.userId === deviceA);
check('account is remembered on this device', knownAccounts().some(a => a.userId === deviceA));

const signedIn = await authenticate('signin', 'aziza', 'secret123', '');
check('sign in returns the same address', signedIn.userId === deviceA);
check('sign in keeps the original name', signedIn.name === 'Aziza Karimova');

let wrongPasswordRejected = false;
try { await authenticate('signin', 'aziza', 'nope-not-it', ''); } catch { wrongPasswordRejected = true; }
check('a wrong password cannot open the account', wrongPasswordRejected);

// Signing in on a device that has never seen the account must work: the address
// comes from the credentials, so the same password opens the same account.
store.clear();
const onNewDevice = await authenticate('signin', 'aziza', 'secret123', '');
check('sign in works on a device with no stored account', onNewDevice.userId === deviceA);
check('the new device reuses the same address', onNewDevice.userId === deviceA);
check('the account is remembered after that sign in', knownAccounts().some(a => a.userId === deviceA));

// A brand new username simply becomes a new account instead of failing.
const fresh = await authenticate('signin', 'bekzod', 'secret123', '');
check('a never-seen username signs in as its own account', fresh.userId === otherUser);

let shortRejected = false;
try { await authenticate('signup', 'ab', 'secret123', ''); } catch { shortRejected = true; }
check('signup refuses a too-short username', shortRejected);

let weakRejected = false;
try { await authenticate('signup', 'someone', '123', ''); } catch { weakRejected = true; }
check('signup refuses a too-short password', weakRejected);

clearSession();
check('sign out clears the session', loadSession() === null);

// ── 5. The workspace is real, not a demo ──────────────────────────────────────
const workspace = buildAccountWorkspace({ userId: deviceA, username: 'aziza', name: 'Aziza Karimova', createdAt: Date.now() });
check('workspace starts with Saved Messages', workspace.chats.some(c => c.id === 'chat_saved'));
check('workspace includes the local helper bot only', workspace.chats.length === 2);
check('no fake people are created', workspace.contacts.length === 0);
check('no fake messages are created', workspace.messages.length === 0);
check('you appear under your own address', workspace.users[deviceA] !== undefined);
check('the alias user_me points at the same person', workspace.users.user_me?.id === deviceA);

// ── 6. Storage keeps the ID, contacts and the whole history ──────────────────
const mediaPhoto = 'data:image/jpeg;base64,' + 'A'.repeat(30_000);
const storedWorkspace = {
  currentUser: workspace.currentUser,
  users: Object.values(workspace.users),
  chats: workspace.chats,
  messages: [
    { id: 'k1', chatId: 'chat_peer_310554', senderId: '310554', text: 'Salom', timestamp: 1, type: 'text' as const, readBy: ['310554'] },
    { id: 'k2', chatId: 'chat_peer_310554', senderId: '310554', text: 'photo', timestamp: 2, type: 'photo' as const, photoUrl: mediaPhoto, readBy: ['310554'] },
  ],
  contacts: [{ userId: '310554', isContact: true, isBlocked: false, privateNote: 'friend' }],
  stories: [],
  lastActiveAt: Date.now(),
  autoDeleteInactivity: 0 as const,
};

await persistWorkspace(deviceA, storedWorkspace);
const localCopy = loadLocalWorkspace(deviceA);
check('the workspace is written to localStorage', localCopy !== null);
check('localStorage keeps every message', localCopy?.messages.length === 2, String(localCopy?.messages.length));
check('localStorage keeps the contacts', localCopy?.contacts[0]?.userId === '310554');
check('localStorage keeps the account itself', localCopy?.currentUser?.id === deviceA);
check('heavy media stays out of the tiny localStorage quota', localCopy?.messages[1].photoUrl === undefined);
check('the message text survives', localCopy?.messages[0].text === 'Salom');

const reloaded = await loadStoredWorkspace(deviceA);
check('the history is found again after a reload', reloaded?.messages.length === 2);
// IndexedDB is not available in this runtime, so the read falls back to the
// localStorage copy — exactly what happens in a private window on a real device.
check('a reload still finds the history without IndexedDB', reloaded?.messages[1].text === 'photo');

await clearStoredWorkspace(deviceA);
check('removing an account really removes its stored workspace', loadLocalWorkspace(deviceA) === null);

console.log(failures === 0 ? '\n🎉 all logic checks passed' : `\n❌ ${failures} logic check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
