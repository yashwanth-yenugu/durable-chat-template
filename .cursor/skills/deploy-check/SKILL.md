---
name: deploy-check
description: Verify, test, and deploy the Cloudflare Worker. Use before production deploys or when CI/build fails.
paths: src/server/**, wrangler.json, package.json, vitest.config.ts
---

# Deploy & verify

## Pre-deploy checklist

```bash
bun install --frozen-lockfile
bun run check          # tsc + tests (80% coverage) + wrangler dry-run
```

## Deploy

```bash
bun run deploy
```

Privacy policy: `https://<your-worker>/privacy.html` (from `public/privacy.html`).

## Worker Builds (CI) issues

| Error | Fix |
|-------|-----|
| `lockfile had changes, but lockfile is frozen` | Run `bun install`, commit updated `bun.lock` |
| Build token deleted/rolled | Cloudflare dashboard → Worker → Settings → Builds → API token → create/select new token |
| Build command fails | Ensure `build.command` in wrangler.json succeeds; client builds to `public/dist/` |

## Post-deploy

```bash
bunx wrangler tail    # live logs
```

Test WebSocket chat at deployed URL and via extension if applicable.
