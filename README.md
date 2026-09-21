# Telegram Web — real accounts, real people, no server

A Telegram Web (K/Z) style client that runs entirely in the browser and is deployable as a static
site on GitHub Pages. This is **not a demo**: you create a real account, share your address, and
messages travel directly between two devices over an encrypted WebRTC data channel.

## How it works

1. **Create an account** — a username and a password are hashed locally into a 32-character
   *address*. The password never leaves the device and is never uploaded; the same username and
   password produce the same address on any device, so your account follows you around.
2. **Share your address** — it is shown on the home screen, in Contacts and in the main menu.
3. **Add a friend** — paste their address under *Contacts → Add by address*. The client tries to
   reach them right away: if they are online you are connected instantly, and if they are offline
   the chat is kept and connects the moment they open the app.
4. **Write** — messages, edits, reactions, typing indicators and read receipts are sent straight to
   the other person's browser. Presence (`online` / `offline`) is real: it reflects a live
   connection, never a simulated status.

The only shared infrastructure is the public PeerJS signalling broker, which just helps the two
browsers find each other. Message contents never pass through it.

## What is included

- Private chats with real people, plus Saved Messages and a local Helper Bot (`/help`)
- Voice notes: real recording, waveform, trimming, 1x/1.5x/2x playback and pitch effects
  (robot, deep bass, chipmunk) rendered with the Web Audio API
- Photos with a canvas editor (filters, rotate, crop, draw), video messages, files, music with a
  sticky mini player, view-once media and real link previews
- Groups and channels: admins with custom titles, granular member permissions, slow mode, welcome
  messages, anti-spam word lists, announcements, join requests, boosts, activity leaderboard
- Extras: polls, split bills, reminders, scheduled and "send when online" messages, a wallet with
  Stars, paid posts, a sticker pack maker, bookmarks and tags, Do Not Disturb, ghost mode, a
  calendar history view, print/PDF export and offline install as a PWA

## Development

```bash
bun install
bun run dev       # dev server
bun run build     # type-check + production build into dist/
bun run test      # account identity checks + UI smoke test
```

## Deploying to GitHub Pages

The build emits relative asset paths (`base: './'`), a web manifest and a service worker, so `dist/`
can be served from the root of a Pages domain and from a project path alike.

`.github/workflows/deploy-pages.yml` does the whole job: every push to `main` installs, type-checks,
builds and publishes `dist/` to Pages with the official Pages actions. Nothing is committed by hand
and no build output lives in the repository.

1. Open **Settings → Pages** once and set **Source** to **GitHub Actions**. This cannot be done by the
   workflow itself: the automatically provided token is not allowed to create the Pages site.
2. Push to `main` — or run the *Deploy to GitHub Pages* workflow manually from the Actions tab.
   Re-run the failed first run after step 1; every later push deploys on its own.

Where the site ends up:

| Repository | URL |
| --- | --- |
| `<user>.github.io` | `https://<user>.github.io/` — the **root** of the Pages domain |
| anything else, e.g. `Chat` | `https://<user>.github.io/Chat/` — a project path |

A repository's Pages site is always published under its own path, so serving this app at the
**root** of the domain means the repository itself has to be the user site (`<user>.github.io`), or a
custom domain has to be attached by adding a `public/CNAME` file with the domain in it.

## Security notes

- The password is only ever used locally to derive the account address; it is not stored.
- There is no password recovery: whoever knows the username and password can reproduce the address.
- Messages are peer-to-peer and are stored in the browser (IndexedDB) of each participant only.
