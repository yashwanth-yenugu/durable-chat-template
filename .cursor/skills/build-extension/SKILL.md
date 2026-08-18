---
name: build-extension
description: Build and verify the Page Chat browser extension. Use when changing extension source, manifest, icons, or build scripts.
paths: src/extension/**, extension/**, scripts/build-extension*.mjs
---

# Build extension

## Dev build (local testing)

```bash
bun install --frozen-lockfile
CHAT_HOST=localhost:8787 bun run build:extension   # while `bun run dev` is running
# or default demo host:
bun run build:extension
```

Outputs to `extension/dist/`. Load unpacked from `extension/` in `chrome://extensions`.

## Store build (production)

```bash
CHAT_HOST=your-worker.workers.dev bun run build:extension:store
```

Upload `page-chat-extension.zip`. See `extension/STORE.md` for the full checklist.

## Verify

1. `extension/dist/content.js`, `panel.html`, `panel.js`, `panel.css` exist
2. Toggle appears on an `https://` page
3. Chat connects (check room id in panel header matches hostname + path)

## Common pitfalls

- Page CSP blocks WebSockets from content scripts — panel runs in extension iframe (by design)
- Rebuild after changing `CHAT_HOST` or `config.ts`
- Store build omits `localhost` host permissions
