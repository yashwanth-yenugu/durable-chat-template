# Plan: Notification Badge + Sound + System Messages

## Goal
Add browser notification badge (document title) with sound on new messages, and system messages for joins, leaves, and room TTL warnings.

## Files Changed
1. `src/shared.ts` — extend `Message` protocol with `system` type
2. `src/server/index.ts` — broadcast system messages; track TTL warning state
3. `src/client/index.tsx` — render system messages; implement sound + title badge
4. `public/styles.css` — add system-message styling

## Decisions
- **Sound**: Web Audio API synthesized two-tone chime (no external assets, bundle stays small).
- **System messages**: Ephemeral (not persisted in SQLite). They represent transient room state.
- **TTL warning**: 1-day threshold. Checked on connect and activity. Tracked via `room_meta` table to avoid spam.
- **Rendering**: Inline in the message flow, centered, muted, smaller text.
- **Badge behavior**: Increment unread count + play sound only for new chat messages from other users while tab is hidden. System messages do not trigger sound/badge.
<<<<<<< ours
<<<<<<< ours
=======
- **Sound trigger boundary**: System messages (joins, leaves, TTL warnings) are silent. Only user-authored chat messages trigger sound/badge.
>>>>>>> theirs
=======
- **Sound trigger boundary**: System messages (joins, leaves, TTL warnings) are silent. Only user-authored chat messages trigger sound/badge.
>>>>>>> theirs

## Detailed Changes

### `src/shared.ts`
- Add `SystemMessage` type: `{ type: "system"; content: string; ts?: number }`
- Add `"system"` variant to `Message` union

### `src/server/index.ts`
- In `onStart()`: create `room_meta` table:
  ```sql
  CREATE TABLE IF NOT EXISTS room_meta (key TEXT PRIMARY KEY, value TEXT)
  ```
- Initialize `room_expiry` on start/activity:
  ```ts
  this.ctx.storage.sql.exec(
    `INSERT OR IGNORE INTO room_meta (key, value) VALUES ('room_expiry', ?)`,
    String(Date.now() + ROOM_TTL_MS)
  );
  // Also UPDATE on each activity reset
  ```
- On `"join"` in `onMessage()`: broadcast system message `"${user} joined the chat"`
- In `onClose()`: broadcast system message `"${user} left the chat"` to remaining connections
- Add `maybeWarnTtl()` helper:
  - Read `room_expiry` from `room_meta`
  - If remaining < 24h and `ttl_warning_sent` flag not set, broadcast warning system message and set flag

### `src/client/index.tsx`
- Change messages state to union type:
  ```ts
  type DisplayMessage = ChatMessage | { type: 'system'; id: string; content: string; ts: number };
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  ```
- Add type guards:
  ```ts
  const isSystemMessage = (m: DisplayMessage): m is SystemMessage => m.type === 'system';
  const isChatMessage = (m: DisplayMessage): m is ChatMessage => !isSystemMessage(m);
  ```
- Add state: `unreadCount`, refs: `prevCountRef`, `loadedRef`
- Add `playNotificationSound()` using Web Audio API (two-tone chime, 880Hz + 1100Hz)
- Add `visibilitychange` listener: when tab becomes visible, clear `unreadCount` and reset `document.title` to `Chat!`
- In `onMessage`:
  - Handle `"system"`: append system message to `messages` state
  - After `"all"` loads, set `loadedRef.current = true`
- Add effect to detect new messages:
  - If tab hidden, count increased, and newest items include a chat message from another user → increment unread, update title, play sound
- Update render loop:
  - If `isSystemMessage(message)`: render centered muted `<div className="system-message">`
  - Else render existing chat bubble (use type guard so TypeScript knows `message.user` exists)

### `public/styles.css`
- Add `.system-message` styles:
  - `text-align: center`
  - `color: var(--muted)`
  - `font-size: 0.8rem`
  - `padding: 6px 0`
  - `font-style: italic`

## Validation
1. `npm run check` (tsc + wrangler dry-run)
2. Manual test:
   - Open two tabs, send message → other tab plays sound and title shows `(N) Chat!`
   - Switch back to tab → badge clears
   - Join/leave triggers system message in chat flow
   - Room near TTL shows warning system message

## Rollout
- No breaking protocol changes. Old clients will ignore unknown `"system"` type (fall through `default: return null` in `validate()`).
- New `room_meta` table created via `CREATE TABLE IF NOT EXISTS` in `onStart()` — safe migration.

## Open Question
- **Sound trigger boundary**: Should the TTL warning system message also play a sound (different from regular message chime), or stay silent?  
  Recommended: silent. Joins/leaves/warnings are informational; only user-authored chat messages should notify.
