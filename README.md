# Durable Chat App

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/durable-chat-template)

![Template Preview](https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/da00d330-9a3b-40a2-e6df-b08813fb7200/public)

<!-- dash-content-start -->

A real-time multi-room chat application built on [Cloudflare Workers](https://developers.cloudflare.com/workers/) and [Durable Objects](https://developers.cloudflare.com/durable-objects/), using [PartyKit](https://www.partykit.io/) for WebSocket connection management. Visit the [live demo](https://durable-chat-template.templates.workers.dev) — you are dropped into a unique room and can invite others by sharing the URL.

## Features

- **Instant messaging** — messages are delivered in real-time to every user in the room via WebSocket
- **Persistent history** — up to 200 messages per room are stored in Durable Object SQL storage and replayed to new joiners
- **Message editing** — users can edit their own messages inline; edits are persisted and broadcast with an *(edited)* label
- **Message deletion** — users can delete their own messages; deletions are broadcast instantly
- **Link previews (unfurl)** — the first URL in a message is fetched server-side via `/api/unfurl` and rendered as an Open Graph preview card beneath the bubble, with SSRF protection
- **Desktop notifications** — browser notifications fire for incoming messages when the tab is hidden (requires permission)
- **Unread count & scroll-to-bottom** — a floating button shows the number of unread messages when scrolled away from the bottom; clicking it scrolls to the latest message
- **Read receipts** — coloured initials of users who have seen a message are shown beneath each of your own bubbles; receipt state is persisted in the Durable Object and broadcast to all connections
- **Typing indicators** — see when others are composing a message (debounced, auto-cleared)
- **Online presence** — a live count of users currently in the room
- **Auto-generated usernames** — random names drawn from a curated list (Indian cricketers 🏏) stored in `localStorage`
- **Shareable rooms** — each room has a unique URL; visiting `/` redirects to a fresh room ID
- **Automatic cleanup** — rooms with no activity for 30 days are deleted via a Durable Object alarm

## How It Works

Users land on a unique room URL (e.g. `/abc123`). The browser opens a WebSocket connection to a [Durable Object](https://developers.cloudflare.com/durable-objects/) instance that owns that room. The Durable Object:

1. **Stores** messages with the [SQL Storage API](https://developers.cloudflare.com/durable-objects/api/sql-storage/) (table: `messages`, keyed by `id`, ordered by `ts`; includes an `edited` flag)
2. **Replays** history to every new connection (`type: "all"`) along with the current read-receipt state (`type: "seen_update"`)
3. **Broadcasts** new, updated, and deleted messages to all other connections in the room
4. **Tracks presence** — each connection stores the user's name in hibernation-safe state; the online list is recomputed on every join/leave
5. **Persists read receipts** — a `seen_receipts` table stores the last-seen timestamp per user; the server upserts on every `seen` heartbeat and broadcasts the full receipt map
6. **Proxies link metadata** — `GET /api/unfurl?url=` fetches the target page server-side (avoiding CORS), extracts Open Graph tags, and returns JSON; private/loopback addresses are blocked

The server uses the [PartyKit Server API](https://docs.partykit.io/reference/partyserver-api/) (`partyserver` package) to simplify WebSocket lifecycle management, but the same logic could be written with the raw Durable Objects WebSocket API.

### Message Protocol (`src/shared.ts`)

All WebSocket frames carry JSON matching the `Message` discriminated union:

| `type`        | Direction                  | Purpose |
|---------------|----------------------------|---------|
| `join`        | client → server            | Announce username on connect / reconnect |
| `add`         | client ↔ server            | Send a new chat message |
| `update`      | client ↔ server            | Edit an existing message (same `id`); server sets `edited: true` |
| `delete`      | client ↔ server            | Remove a message |
| `typing`      | client → server → others   | Typing notification (never persisted) |
| `presence`    | server → clients           | Updated list of online usernames |
| `all`         | server → client            | Full message history on connect |
| `seen`        | client → server            | Last-seen timestamp heartbeat (`{ user, ts }`) |
| `seen_update` | server → clients           | Full read-receipt map (`{ receipts: Record<string, number> }`) |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Cloudflare Workers](https://developers.cloudflare.com/workers/) |
| State / WebSockets | [Durable Objects](https://developers.cloudflare.com/durable-objects/) with SQLite storage |
| WebSocket framework | [PartyKit / partyserver](https://www.partykit.io/) |
| Client framework | [React 19](https://react.dev/) + [React Router v7](https://reactrouter.com/) |
| Client bundler | [esbuild](https://esbuild.github.io/) |
| Static assets | Served by Cloudflare Workers Assets |
| Language | TypeScript (strict, separate `tsconfig` per side) |

## Project Structure

```
durable-chat-template/
├── src/
│   ├── server/
│   │   └── index.ts        # Durable Object (Chat class) + Worker fetch handler
│   ├── client/
│   │   └── index.tsx       # React UI — socket, messages, editing, unfurl, notifications, unread, receipts
│   └── shared.ts           # Shared types (Message, ChatMessage) and constants
├── public/
│   ├── dist/               # esbuild output (auto-generated, not committed)
│   └── index.html          # Single-page app shell
├── wrangler.json            # Cloudflare deployment config
└── package.json
```

<!-- dash-content-end -->

## Getting Started

Outside of this repo, you can start a new project with this template using [C3](https://developers.cloudflare.com/pages/get-started/c3/) (the `create-cloudflare` CLI):

```bash
npm create cloudflare@latest -- --template=cloudflare/templates/durable-chat-template
```

A live public deployment of this template is available at [https://durable-chat-template.templates.workers.dev](https://durable-chat-template.templates.workers.dev)

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local dev server (Wrangler builds the client and starts a local Worker):
   ```bash
   npm run dev
   ```
   Open [http://localhost:8787](http://localhost:8787) in your browser. Open a second tab with the same URL to chat with yourself.

3. Run type checks:
   ```bash
   npm run check
   ```
   This runs `tsc` for both `src/client` and `src/server`, then performs a Wrangler dry-run deploy to catch any configuration issues.

## Deployment

1. Deploy to Cloudflare Workers:
   ```bash
   npm run deploy
   ```
   Wrangler will bundle the client with esbuild, upload the Worker, and provision the Durable Object class automatically.

2. Monitor live logs:
   ```bash
   npx wrangler tail
   ```

## Configuration

Key settings in `wrangler.json`:

| Setting | Value | Notes |
|---------|-------|-------|
| `main` | `src/server/index.ts` | Worker entry point |
| `durable_objects.bindings` | `Chat` | Durable Object class |
| `assets.directory` | `./public` | Static files served via Workers Assets |
| `build.command` | esbuild … | Client bundle built before each deploy |
| `observability.enabled` | `true` | Workers Logs enabled by default |

The `Chat` Durable Object uses the `new_sqlite_classes` migration tag (`v1` in `wrangler.json`) to opt-in to SQLite-backed storage.
