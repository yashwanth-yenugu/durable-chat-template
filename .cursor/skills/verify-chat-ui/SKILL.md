---
name: verify-chat-ui
description: Manually verify shareable-link chat and the Page Chat browser extension with computerUse (two Chrome profiles, live messages, 💬 overlay). Use after any big UI, chat, WebSocket, username, or extension change; before claiming the product works; when the user asks to verify, smoke-test, demo, or record GIFs of chat/extension; and when updating README screenshots.
paths: src/chat/**, src/client/**, src/extension/**, extension/**, public/**
---

# Verify chat + Page Chat (computerUse)

After any big changes or when asked you should use computeruse and verify both chat mode using link and extension mode by installing the extension and verifying everything is working as expected.

Automated tests are not a substitute. Do not claim the web app or extension works until both modes below pass in a real browser.

## When this applies

Run the full checklist when any of these is true:

- Chat UI, composer, username gate, presence, typing, or message layout changed
- Extension content script, panel, room id, or build changed
- WebSocket / Durable Object protocol or join flow changed
- User asked to verify, smoke-test, demo, or capture README GIFs
- You are about to say the feature is done

If computerUse is unavailable, say so and still run `bun run check`. Do not invent screenshots.

## Setup (every run)

1. Dev server on port 8787: `bun run dev` (leave it running). Wait until Wrangler prints `Ready on http://localhost:8787`.
2. Rebuild the client if you just edited CSS/TSX; hard-refresh browsers (`Ctrl+Shift+R`) so `public/dist/` is not stale.
3. Dev extension (localhost backend):

```bash
CHAT_HOST=localhost:8787 bun run build:extension
```

Confirm `extension/dist/content.js`, `panel.html`, `panel.js`, `panel.css` exist. Store builds omit localhost — do not use them for this local check.

4. Two **separate Chrome profiles** (different `localStorage` / `chrome.storage`). Tile them; do not maximize.

```bash
google-chrome \
  --user-data-dir=/tmp/page-chat-a \
  --load-extension="$PWD/extension" \
  --disable-extensions-except="$PWD/extension" \
  --no-first-run --no-default-browser-check --password-store=basic \
  --window-size=950,1120 --window-position=0,40 \
  "http://localhost:8787/verify-demo" &

google-chrome \
  --user-data-dir=/tmp/page-chat-b \
  --load-extension="$PWD/extension" \
  --disable-extensions-except="$PWD/extension" \
  --no-first-run --no-default-browser-check --password-store=basic \
  --window-size=950,1120 --window-position=970,40 \
  "http://localhost:8787/verify-demo" &
```

If windows overlap, `xdotool windowmove` / `windowsize` them side by side. Kill leftover Chrome only by **PID**, never `pkill -f`.

5. Record the desktop (`RecordScreen`) around `computerUse`. Keep both windows visible in the frame.

## Mode A — shareable link chat

Same room URL in both windows (`http://localhost:8787/<slug>`).

Pass only if all of these are true:

- [ ] First visit can choose a username (compact card: short field + **Join chat** on one row, not a full-height pill)
- [ ] Two different names join (e.g. Maya / Jordan)
- [ ] Header shows **2 online** on both sides
- [ ] A message from A appears in B **without refresh** (other-user bubble, not “mine”)
- [ ] A reply from B appears in A the same way
- [ ] Typing indicator shows on the other side while composing
- [ ] Composer placeholder is `Message as <name>` and is not stretched full-page
- [ ] Layout: avatars, bubbles, composer height look like the existing WhatsApp-style UI

Fail and fix if the username field or composer uses column `flex: 1` (it becomes a giant pill). Inputs in a column flex parent need a fixed height; put field + button in a **row**.

## Mode B — extension on a real page

Keep the same two profiles (extension already loaded via `--load-extension`).

1. Navigate **both** windows to the same `https://` page (use `https://example.com`).
2. Confirm a round green **💬** toggle at bottom-right on the page (not only on localhost).
3. Open the panel in both windows. Room subtitle must match hostname + path (e.g. `example.com`), not the web-app slug.
4. Join as two names if the panel asks (extension storage is per profile, not page `localStorage`).
5. Exchange at least one message each way **inside the overlay**, with the host page still visible.

Pass only if all of these are true:

- [ ] 💬 appears on the https page
- [ ] Panel opens over the page (iframe, ~380×520, does not take the whole viewport)
- [ ] Both panels share one room; **2 online**
- [ ] Messages and typing sync between profiles
- [ ] Closing/reopening 💬 does not break the socket join
- [ ] Web app on `/verify-demo` and extension on `example.com` are **different rooms**

If 💬 is missing: rebuild with `CHAT_HOST=localhost:8787`, confirm the profile used `--load-extension` on `extension/` (the folder that contains `manifest.json`), and that the page is `http:`/`https:` (not `chrome:`).

## Evidence

Save artifacts that prove **both** modes (not username-form-only shots):

- Side-by-side still of link chat with two names and a synced thread
- Side-by-side still of example.com + open Page Chat panels
- Short recording or GIF of messages landing live

README product shots belong here: multi-user link chat and extension overlay. Do not lead the README with username-gate screenshots.

## Done

Report Mode A pass/fail, Mode B pass/fail, and artifact paths. If either mode fails, fix and re-run that mode before claiming done.
