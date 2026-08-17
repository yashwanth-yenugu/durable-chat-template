# Publishing Page Chat to the Chrome Web Store

## 1. Build the store package

Deploy your Worker first (or use the demo host), then run:

```bash
npm install --legacy-peer-deps

# Default: durable-chat-template.templates.workers.dev
npm run build:extension:store

# Or use your own Worker hostname:
CHAT_HOST=your-worker.your-subdomain.workers.dev npm run build:extension:store
```

This creates:

| Output | Purpose |
|--------|---------|
| `page-chat-extension.zip` | Upload this to the Chrome Web Store |
| `extension-release/` | Unpacked copy for local verification |
| `extension-release/STORE_UPLOAD.txt` | Host + privacy URL reminder |

The store build:

- Bakes in your production `CHAT_HOST`
- Omits `localhost` permissions
- Includes required icons (16, 48, 128)

## 2. Verify locally

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `extension-release/` folder
4. Visit a few sites and confirm chat works

## 3. Create a developer account

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay the one-time **$5 USD** registration fee
3. Complete verification if prompted

## 4. Upload

1. Click **New item**
2. Upload `page-chat-extension.zip`
3. Fix any validation errors

## 5. Store listing

Fill in:

- **Name:** Page Chat
- **Summary:** Chat in real time with others on the same page.
- **Description:** Explain hostname + path rooms (e.g. `github.com/user/repo`)
- **Category:** Social & Communication
- **Screenshots:** At least one (1280×800 or 640×400) showing the 💬 button and chat panel
- **Icon:** Use `extension/icons/icon128.png`

### Privacy policy URL

After deploying the Worker, use:

```
https://<your-worker-host>/privacy.html
```

The policy is served from `public/privacy.html`. For the demo:

https://durable-chat-template.templates.workers.dev/privacy.html

### Permission justification

Google may ask why you need `<all_urls>`:

> The extension injects a chat button on web pages so users can open a panel and message others viewing the same page (same hostname and path).

## 6. Submit

1. Set visibility (Public or Unlisted)
2. **Submit for review** (typically 1–3 business days; broad host permissions may take longer)

## 7. Updates

1. Bump `"version"` in `scripts/build-extension-store.mjs` (manifest template)
2. Rebuild: `npm run build:extension:store`
3. Upload the new ZIP in the dashboard

## Dev vs store builds

| Command | Use case |
|---------|----------|
| `npm run build:extension` | Local development (may include localhost backend) |
| `npm run build:extension:store` | Chrome Web Store upload (production host only) |

For local backend testing:

```bash
CHAT_HOST=localhost:8787 npm run build:extension
```

Load unpacked from `extension/` (not the store package).
