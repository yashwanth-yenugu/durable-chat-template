# Agent instructions

Real-time chat on Cloudflare Workers + Durable Objects, with a React web app and optional **Roomgist** browser extension (room = page hostname + path).

## Monorepo layout

| Path | Role |
|------|------|
| `src/server/` | Worker + `Chat` Durable Object (SQLite, WebSockets via partyserver) |
| `src/client/` | React SPA entry — shareable room URLs via React Router |
| `src/chat/` | Shared `ChatApp` UI (web app + extension iframe) |
| `src/extension/` | Extension source (content script, panel, helpers) |
| `extension/` | MV3 manifest, icons, built `dist/` (load unpacked from here) |
| `src/shared.ts` | Message protocol types and constants — **change this first** |
| `scripts/` | Extension build (`build-extension.mjs`, `build-extension-store.mjs`) |
| `public/` | Static shell + `privacy.html`; client bundle → `public/dist/` |

## Commands

**Package manager: Bun** (CI uses `bun install --frozen-lockfile`).

```bash
bun install                    # install deps
bun run dev                    # Wrangler dev → http://localhost:8787
bun run test                   # Vitest
bun run test:coverage          # Vitest + 80% coverage threshold
bun run check                  # tsc (client, server, extension) + tests + wrangler dry-run
bun run deploy                 # deploy Worker
bun run cf-typegen             # regenerate worker-configuration.d.ts after binding changes
bun run build:extension        # dev extension build → extension/dist/
bun run build:extension:store  # Chrome Web Store / GitHub Release ZIP (production host, no localhost)
```

Extension backend host is set at build time: `CHAT_HOST=your-worker.workers.dev bun run build:extension`.

## Conventions

- **Minimize scope** — smallest correct diff; match surrounding code style
- **Protocol changes** — update `src/shared.ts`, then server (`validate.ts`, `index.ts`) and clients (`ChatApp.tsx`, extension)
- **Room ids** — web app uses random URL slugs; extension uses `roomIdFromLocation()` (hostname + path); long ids use `normalizeRoomId()` in `src/shared.ts`
- **Do not edit generated output** — `public/dist/`, `extension/dist/`, `coverage/`, `src/server/worker-configuration.d.ts` (use `cf-typegen`)
- **Tests** — add/update Vitest tests for logic changes; run `bun run check` before claiming done
- **Branches** — use `cursor/<descriptive-name>-6eb8` for agent work

## Key reference files

- Server DO: `src/server/index.ts`, `validate.ts`, `chatLogic.ts`, `presence.ts`
- Shared UI: `src/chat/ChatApp.tsx`, `utils.ts`, `username.ts`
- Extension: `src/extension/content.ts`, `roomId.ts`, `config.ts`, `extension/manifest.json`
- Deploy: `wrangler.jsonc`, `package.json`
- Docs: `README.md`, `extension/STORE.md`

## Message protocol (`src/shared.ts`)

WebSocket JSON messages use the `Message` discriminated union: `join`, `add`, `update`, `delete`, `typing`, `presence`, `all`. Keep client and server compatible when changing shapes.

## Cursor Cloud specific instructions

- **Install:** `bun install --frozen-lockfile` (see `.cursor/environment.json`)
- **Verify before PR:** `bun run check`
- **Dev server:** `bun run dev` (port 8787)
- **Extension smoke test:** `bun run build:extension`, load unpacked from `extension/` in Chrome
- **Extension GitHub Releases:** tag `v*` or run `.github/workflows/release-extension.yml`; testers download `roomgist-chrome.zip` from Assets, extract, and Load unpacked
- **Deploy:** `bun run deploy`; privacy policy at `/privacy.html`
- **Worker Builds:** if CI fails on build token, update **Settings → Builds → API token** in the Cloudflare dashboard (not a code fix)
- **Secrets:** never commit `.env` / `.dev.vars`; use Cloudflare dashboard or Cursor Cloud secrets
