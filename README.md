# Durable Chat App

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/durable-chat-template)
[![GitHub Release](https://img.shields.io/github/v/release/yashwanth-yenugu/durable-chat-template)](https://github.com/yashwanth-yenugu/durable-chat-template/releases)

![Template Preview](https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/da00d330-9a3b-40a2-e6df-b08813fb7200/public)

<!-- dash-content-start -->

A real-time multi-room chat application built on [Cloudflare Workers](https://developers.cloudflare.com/workers/) and [Durable Objects](https://developers.cloudflare.com/durable-objects/), using [PartyKit](https://www.partykit.io/) for WebSocket connection management. Visit the [live demo](https://asyncawait.fun) — you are dropped into a unique room and can invite others by sharing the URL.

## Features

- **Instant messaging** — messages are delivered in real-time to every user in the room via WebSocket
- **Persistent history** — up to 200 messages per room are stored in Durable Object SQL storage and replayed to new joiners
- **Typing indicators** — see when others are composing a message (debounced, auto-cleared)
- **Online presence** — a live count of users currently in the room
- **Message deletion** — users can delete their own messages; deletions are broadcast instantly
- **Chosen usernames** — first visit asks for a name; it is stored in `localStorage` (or extension storage) and reused
- **Shareable rooms** — each room has a unique URL; visiting `/` redirects to a fresh room ID
- **Page Chat extension** — optional browser extension that uses the current page URL (hostname + path) as the chat room, so visitors on the same page can chat with each other
- **Automatic cleanup** — rooms with no activity for 30 days are deleted via a Durable Object alarm

## How It Works

Users land on a unique room URL (e.g. `/abc123`). The browser opens a WebSocket connection to a [Durable Object](https://developers.cloudflare.com/durable-objects/) instance that owns that room. The Durable Object:

1. **Stores** messages with the [SQL Storage API](https://developers.cloudflare.com/durable-objects/api/sql-storage/) (table: `messages`, keyed by `id`, ordered by `ts`)
2. **Replays** history to every new connection (`type: "all"`)
3. **Broadcasts** new, updated, and deleted messages to all other connections in the room
4. **Tracks presence** — each connection stores the user's name in hibernation-safe state; the online list is recomputed on every join/leave

The server uses the [PartyKit Server API](https://docs.partykit.io/reference/partyserver-api/) (`partyserver` package) to simplify WebSocket lifecycle management, but the same logic could be written with the raw Durable Objects WebSocket API.

### Message Protocol (`src/shared.ts`)

All WebSocket frames carry JSON matching the `Message` discriminated union:

| `type`     | Direction        | Purpose |
|------------|------------------|---------|
| `join`     | client → server  | Announce username on connect / reconnect |
| `add`      | client ↔ server  | Send a new chat message |
| `update`   | client ↔ server  | Edit an existing message (same `id`) |
| `delete`   | client ↔ server  | Remove a message |
| `typing`   | client → server → others | Typing notification (never persisted) |
| `presence` | server → clients | Updated list of online usernames |
| `all`      | server → client  | Full message history on connect |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Cloudflare Workers](https://developers.cloudflare.com/workers/) |
| State / WebSockets | [Durable Objects](https://developers.cloudflare.com/durable-objects/) with SQLite storage |
| WebSocket framework | [PartyKit / partyserver](https://www.partykit.io/) |
| Client framework | [React 19](https://react.dev/) + [React Router v7](https://reactrouter.com/) (web app) |
| Browser extension | Manifest V3 content script + iframe panel |
| Client bundler | [esbuild](https://esbuild.github.io/) |
| Static assets | Served by Cloudflare Workers Assets |
| Language | TypeScript (strict, separate `tsconfig` per side) |
| Package manager | [Bun](https://bun.sh/) |

## Project Structure

```
durable-chat-template/
├── src/
│   ├── chat/
│   │   ├── ChatApp.tsx     # Shared React chat UI (web app + extension)
│   │   ├── styles.css
│   │   └── username.ts
│   ├── server/
│   │   └── index.ts        # Durable Object (Chat class) + Worker fetch handler
│   ├── client/
│   │   └── index.tsx       # Standalone web app router
│   ├── extension/
│   │   ├── content.ts      # Injects floating chat button on every page
│   │   ├── panel.tsx       # Extension iframe chat panel
│   │   └── config.ts       # Backend host for extension WebSocket
│   └── shared.ts           # Shared types (Message, ChatMessage) and constants
├── extension/
│   ├── manifest.json       # Browser extension manifest
│   └── dist/               # esbuild output (auto-generated, not committed)
├── public/
│   ├── dist/               # esbuild output (auto-generated, not committed)
│   └── index.html          # Single-page app shell
├── scripts/                 # Extension build scripts
├── vitest.config.ts
├── wrangler.jsonc           # Cloudflare deployment config
├── bun.lock
└── package.json
```

<!-- dash-content-end -->

## Getting Started

Outside of this repo, you can start a new project with this template using [C3](https://developers.cloudflare.com/pages/get-started/c3/) (the `create-cloudflare` CLI):

```bash
npm create cloudflare@latest -- --template=cloudflare/templates/durable-chat-template
```

A live public deployment of this template is available at [https://asyncawait.fun](https://asyncawait.fun)

For AI agent and contributor conventions, see [AGENTS.md](AGENTS.md).

## Local Development

1. Install [Bun](https://bun.sh/) and dependencies:
   ```bash
   bun install
   ```
2. Start the local dev server (Wrangler builds the client and starts a local Worker):
   ```bash
   bun run dev
   ```
   Open [http://localhost:8787](http://localhost:8787) in your browser. Open a second tab with the same URL to chat with yourself.

3. Run type checks and tests:
   ```bash
   bun run check
   ```
   This runs `tsc` for the client, server, and extension, unit tests with 80%+ coverage (`bun run test:coverage`), and a Wrangler dry-run deploy.

## Browser Extension (Page Chat)

The optional extension lets people on the same page chat with each other. The current page's **hostname + path** becomes the chat room (e.g. `github.com/user/repo` — users on that repo page share one room, not everyone on `github.com`).

### Manual installation (GitHub Releases)

Same sideload path as other Chrome extensions: download the ZIP from Releases, extract it, then Load unpacked. You do not need to clone the repo or run a build.

1. Go to [Releases](https://github.com/yashwanth-yenugu/durable-chat-template/releases)
2. Under **Assets**, download `page-chat-chrome.zip`
3. Extract the ZIP to a folder on your computer
4. Open `chrome://extensions`
   - Enable **Developer mode**
   - Click **Load unpacked** and select the folder you just extracted
5. Visit any `http://` or `https://` page and click the floating 💬 button

Release builds connect to `asyncawait.fun`. Chrome cannot load the `.zip` file itself.

Maintainers: push a `v*` tag (`git tag v1.0.1 && git push origin v1.0.1`) or run **Actions → Release Page Chat extension**. Tagged releases show as latest; manual workflow runs are pre-releases.

### Build from source

1. Deploy the Worker (or use the [live demo](https://asyncawait.fun)) so the WebSocket backend is available.
2. Build the extension:
   ```bash
   bun run build:extension
   ```
   For a local backend: `CHAT_HOST=localhost:8787 bun run build:extension` (while `bun run dev` is running).
3. Load it in Chrome/Edge:
   - Open `chrome://extensions`
   - Enable **Developer mode**
   - Click **Load unpacked** and select the `extension/` folder
4. Visit any `http://` or `https://` page and click the floating 💬 button.

By default the extension connects to `asyncawait.fun`. Override the backend host at build time with `CHAT_HOST=your-worker.workers.dev bun run build:extension`.

### Chrome Web Store

To create a production upload ZIP (icons included, no localhost permissions, privacy policy URL):

```bash
bun run build:extension:store
# Or: CHAT_HOST=your-worker.workers.dev bun run build:extension:store
```

Upload `page-chat-extension.zip` to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). See [extension/STORE.md](extension/STORE.md) for the full checklist. The privacy policy is served at `/privacy.html` on your deployed Worker.

The standalone web app and extension share the same `ChatApp` component and backend — only the room ID source differs (random URL slug vs. page hostname + path).

## Deployment

1. Deploy to Cloudflare Workers:
   ```bash
   bun run deploy
   ```
   Wrangler will bundle the client with esbuild, upload the Worker, and provision the Durable Object class automatically.

2. Monitor live logs:
   ```bash
   npx wrangler tail
   ```

## Configuration

Key settings in `wrangler.jsonc`:

| Setting | Value | Notes |
|---------|-------|-------|
| `compatibility_date` | `2026-08-18` | Current Workers runtime behavior |
| `compatibility_flags` | `nodejs_compat` | Node.js built-ins (default for this date; kept explicit) |
| `main` | `src/server/index.ts` | Worker entry point |
| `durable_objects.bindings` | `Chat` | Durable Object class |
| `exports.Chat` | SQLite Durable Object | Declarative class lifecycle (replaces `migrations`) |
| `assets.directory` | `./public` | Static files served via Workers Assets |
| `build.command` | esbuild … | Client bundle built before each deploy |
| `observability` | logs + traces | Workers Logs and tracing enabled |

The `Chat` Durable Object is declared in `exports` with `"storage": "sqlite"`. Existing Workers that previously used the `v1` `new_sqlite_classes` migration can switch to `exports` without a data migration.
