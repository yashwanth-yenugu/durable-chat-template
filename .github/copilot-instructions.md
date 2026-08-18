This repository is a Cloudflare Workers + Durable Objects real-time chat app with an optional browser extension.

## Architecture

- **Worker** (`src/server/`) — `Chat` Durable Object (SQLite storage) + static asset handler
- **Web app** (`src/client/`) — React SPA with shareable room URLs
- **Extension** (`src/extension/`, `extension/`) — Page Chat overlay; room = hostname + path
- **Shared UI** (`src/chat/`) — `ChatApp` used by web app and extension
- **Protocol** (`src/shared.ts`) — `Message` types and constants

PartyKit `partyserver` / `partysocket` handle WebSocket routing (`CHAT_PARTY = "chat"`).

## Where to make changes

| Area | Files |
|------|-------|
| Message protocol | `src/shared.ts` first, then client + server |
| Server logic | `src/server/index.ts`, `validate.ts`, `chatLogic.ts`, `presence.ts` |
| Chat UI | `src/chat/ChatApp.tsx`, `utils.ts`, `username.ts` |
| Extension | `src/extension/content.ts`, `roomId.ts`, `config.ts` |
| Build / deploy | `wrangler.json`, `package.json`, `scripts/` |

## Commands (Bun)

```bash
bun install              # install dependencies
bun run dev              # local Worker + web app
bun run check            # tsc + tests + wrangler dry-run
bun run test:coverage    # unit tests (80%+ coverage enforced)
bun run deploy           # deploy to Cloudflare
bun run build:extension  # build browser extension
```

## Conventions

- Messages are JSON `Message` unions over WebSocket; see `src/shared.ts`
- Durable Object SQL schema changes go in `Chat.onStart()` or `wrangler.json` migrations
- Room ids longer than 200 chars are normalised via `normalizeRoomId()`
- Extension backend host is baked at build time via `CHAT_HOST` (see `scripts/build-extension.mjs`)
- TypeScript projects: `src/client`, `src/server`, `src/extension` (tests excluded from app tsconfigs)

## Testing

- Vitest + Testing Library; config in `vitest.config.ts`
- Server DO tests mock `partyserver` and use harness in `src/server/index.test.ts`

If changing WebSocket semantics or message shapes, update `src/shared.ts` and keep client/server/extension in sync.
