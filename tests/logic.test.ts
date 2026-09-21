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

const { deriveUserId, peerIdFor, userIdFromPeerId, isValidUserId, shortId } = await import('../src/utils/identity');
const { authenticate, knownAccounts, loadSession, clearSession } = await import('../src/auth/session');
const { buildAccountWorkspace } = await import('../src/auth/workspace');

// ── 1. An address is a real, reproducible identity ────────────────────────────
const deviceA = await deriveUserId('aziza', 'secret123');
const deviceB = await deriveUserId('aziza', 'secret123');
const wrongPassword = await deriveUserId('aziza', 'secret124');
const otherUser = await deriveUserId('bekzod', 'secret123');

check('same credentials produce the same address on any device', deviceA === deviceB);
check('a different password is a different identity', deviceA !== wrongPassword);
check('a different username is a different identity', deviceA !== otherUser);
check('address is a valid 32-hex id', isValidUserId(deviceA), deviceA);
check('username is normalised (@Aziza vs aziza)', (await deriveUserId('@Aziza ', 'secret123')) === deviceA);

// ── 2. Peer addressing round-trips ────────────────────────────────────────────
check('peer address derives from the account address', peerIdFor(deviceA) === `tgweb-${deviceA}`);
check('peer address is parsed back to the account address', userIdFromPeerId(peerIdFor(deviceA)) === deviceA);
check('foreign peer ids are rejected', userIdFromPeerId('somebody-else') === null);
check('short form is readable', shortId(deviceA).includes('…'));

// ── 3. Real sign up / sign in ─────────────────────────────────────────────────
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

// ── 4. The workspace is real, not a demo ──────────────────────────────────────
const workspace = buildAccountWorkspace({ userId: deviceA, username: 'aziza', name: 'Aziza Karimova', createdAt: Date.now() });
check('workspace starts with Saved Messages', workspace.chats.some(c => c.id === 'chat_saved'));
check('workspace includes the local helper bot only', workspace.chats.length === 2);
check('no fake people are created', workspace.contacts.length === 0);
check('no fake messages are created', workspace.messages.length === 0);
check('you appear under your own address', workspace.users[deviceA] !== undefined);
check('the alias user_me points at the same person', workspace.users.user_me?.id === deviceA);

console.log(failures === 0 ? '\n🎉 all logic checks passed' : `\n❌ ${failures} logic check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
