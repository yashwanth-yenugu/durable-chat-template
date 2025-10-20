This repository is a small Cloudflare Workers + Durable Objects template for a real-time chat app using PartyKit.

Key points for editing and generating code here:

- Big picture
  - The project uses Cloudflare Workers (server) and a static React client built with esbuild into `public/dist`.
  - Durable Objects are used to store chat room state (see `src/server/index.ts` — the `Chat` class).
  - PartyKit `Server` and `partysocket` handle WebSocket connections and message routing.

- Where to make changes
  - Server logic: `src/server/index.ts` (Durable Object class and request handler). Durable Object SQL storage is available via `this.ctx.storage.sql`.
  - Client UI: `src/client/index.tsx`. Client connects to a party with `usePartySocket({ party: 'chat', room })`.
  - Shared types and message formats: `src/shared.ts`.

- Build & dev
  - Build client: `npm run build` uses esbuild via `wrangler build` (see `wrangler.json` build command). The repo exposes scripts: `npm run cf-typegen`, `npm run check`, `npm run deploy`, `npm run dev`.
  - Run locally: `npm run dev` launches `wrangler dev` to run the Worker with Assets mounted.
  - Deploy: `npm run deploy` -> `wrangler deploy`.

- Conventions & patterns
  - Messages are shuttle objects described in `src/shared.ts` (type `Message`) and are serialized via JSON over WebSocket.
  - Server uses SQL storage helpers in Durable Objects (see `this.ctx.storage.sql.exec(...)`) and uses `ON CONFLICT` upserts for messages.
  - The server broadcasts raw incoming WebSocket messages to all connections; it *also* persists messages when receiving `add` or `update` message types.

- Testing and Type Safety
  - TypeScript projects are split into `src/client` and `src/server` with their own `tsconfig.json`. Use `npm run check` to run both projects' type checks plus a Wrangler dry-run deploy.

- Common tasks for the agent
  - When adding features that change message shapes, update `src/shared.ts` first and then update both client and server.
  - Keep Durable Object SQL schema updates in `onStart` or migrations in `wrangler.json`.
  - Avoid changing WebSocket semantics; ensure `Message.type` remains compatible for broadcast and persistence.

- Important files to reference in PRs
  - `src/server/index.ts` — Durable Object implementation and request handler
  - `src/client/index.tsx` — UI and socket logic
  - `src/shared.ts` — canonical types and helper names
  - `wrangler.json` — deployment and build settings
  - `README.md` — quick start and docs

If something is unclear (dev workflow, a shape, or runtime detail), ask for the specific file or the expected behavior before making breaking changes.
