import {
	type Connection,
	Server,
	type WSMessage,
	routePartykitRequest,
} from "partyserver";

import type { ChatMessage, Message } from "../shared";
import { MAX_MESSAGE_LENGTH, MAX_MESSAGES } from "../shared";

/** Rooms are deleted after 30 days of inactivity */
const ROOM_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Validate and parse an incoming WebSocket message; returns null if invalid */
function validate(raw: unknown): Message | null {
	if (typeof raw !== "object" || raw === null) return null;
	const m = raw as Record<string, unknown>;
	const str = (v: unknown, max: number) =>
		typeof v === "string" && v.length > 0 && v.length <= max;
	const validTs = (v: unknown) =>
		v === undefined || (typeof v === "number" && Number.isFinite(v) && v > 0);

	switch (m.type) {
		case "add":
		case "update":
			if (
				!str(m.id, 64) ||
				!str(m.content, MAX_MESSAGE_LENGTH) ||
				!str(m.user, 64) ||
				(m.role !== "user" && m.role !== "assistant") ||
				!validTs(m.ts)
			)
				return null;
			return m as unknown as Message;

		case "delete":
			if (!str(m.id, 64) || !str(m.user, 64)) return null;
			return m as unknown as Message;

		case "typing":
		case "join":
			if (!str(m.user, 64)) return null;
			return m as unknown as Message;

		case "seen":
			if (
				!str(m.user, 64) ||
				typeof m.ts !== "number" ||
				!Number.isFinite(m.ts) ||
				m.ts <= 0
			)
				return null;
			return m as unknown as Message;

		default:
			return null;
	}
}

export class Chat extends Server<Env> {
	static options = { hibernate: true };

	onStart() {
		// Create the messages table with timestamp support
		this.ctx.storage.sql.exec(
			`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user TEXT, role TEXT, content TEXT, ts INTEGER DEFAULT 0, edited INTEGER DEFAULT 0)`,
		);
		// Migrate existing tables that were created without the ts column
		try {
			this.ctx.storage.sql.exec(
				`ALTER TABLE messages ADD COLUMN ts INTEGER DEFAULT 0`,
			);
		} catch {
			// Column already exists — safe to ignore
		}
		// Migrate: add edited column if missing
		try {
			this.ctx.storage.sql.exec(
				`ALTER TABLE messages ADD COLUMN edited INTEGER DEFAULT 0`,
			);
		} catch {
			// Column already exists — safe to ignore
		}
		// Per-user read receipt: stores the timestamp of the last seen message
		this.ctx.storage.sql.exec(
			`CREATE TABLE IF NOT EXISTS seen_receipts (user TEXT PRIMARY KEY, ts INTEGER DEFAULT 0)`,
		);
	}

	onConnect(connection: Connection) {
		// Send full message history to the newly connected client
		type MsgRow = { id: string; user: string; role: string; content: string; ts: number; edited: number };
		const rows = this.ctx.storage.sql
			.exec(
				`SELECT id, user, role, content, ts, edited FROM messages ORDER BY ts ASC LIMIT ?`,
				MAX_MESSAGES,
			)
			.toArray() as MsgRow[];

		// Normalise the `edited` field to a boolean for the client
		const messages: ChatMessage[] = rows.map((m) => ({
			id: m.id,
			user: m.user,
			role: m.role as "user" | "assistant",
			content: m.content,
			ts: m.ts,
			edited: m.edited === 1,
		}));

		connection.send(
			JSON.stringify({ type: "all", messages } satisfies Message),
		);

		// Send current read-receipt state
		const receipts = this.loadReceipts();
		connection.send(
			JSON.stringify({ type: "seen_update", receipts } satisfies Message),
		);

		// Reset room expiry alarm on any connection
		this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
	}

	onClose(
		connection: Connection,
		_code: number,
		_reason: string,
		_wasClean: boolean,
	) {
		this.broadcastPresence([connection.id]);
	}

	/** Derive the online user list from live connection state (hibernation-safe). */
	broadcastPresence(exclude?: string[]) {
		const users = [
			...new Set(
				[...this.getConnections<{ user: string }>()]
					.map((c) => c.state?.user)
					.filter((u): u is string => typeof u === "string" && u.length > 0),
			),
		];
		this.broadcast(
			JSON.stringify({ type: "presence", users } satisfies Message),
			exclude,
		);
	}

	/** Return the authenticated username for a connection, or null. */
	private connectionUser(connection: Connection): string | null {
		const state = (connection as Connection<{ user: string }>).state;
		return typeof state?.user === "string" && state.user.length > 0
			? state.user
			: null;
	}

	/** Load all read receipts as a plain record. */
	private loadReceipts(): Record<string, number> {
		const rows = this.ctx.storage.sql
			.exec(`SELECT user, ts FROM seen_receipts`)
			.toArray() as { user: string; ts: number }[];
		const receipts: Record<string, number> = {};
		for (const row of rows) receipts[row.user] = row.ts;
		return receipts;
	}

	saveMessage(message: ChatMessage, isEdit = false) {
		const ts = message.ts ?? Date.now();
		const editedFlag = isEdit ? 1 : 0;
		const result = this.ctx.storage.sql.exec(
			`INSERT INTO messages (id, user, role, content, ts, edited) VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT (id) DO UPDATE SET content = ?, ts = ?, edited = ?
			 WHERE messages.user = ?`,
			message.id,
			message.user,
			message.role,
			message.content,
			ts,
			editedFlag,
			message.content,
			ts,
			editedFlag,
			message.user,
		);
		// Keep only the most recent MAX_MESSAGES entries
		this.ctx.storage.sql.exec(
			`DELETE FROM messages WHERE id NOT IN (
				SELECT id FROM messages ORDER BY ts DESC LIMIT ?
			)`,
			MAX_MESSAGES,
		);
		return result.rowsWritten > 0;
	}

	onMessage(connection: Connection, message: WSMessage) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(message as string);
		} catch {
			return;
		}

		const msg = validate(parsed);
		if (!msg) return;

		// Reset TTL on any activity
		this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);

		if (msg.type === "join") {
			// Persist the username in the connection's hibernation-safe state
			(connection as Connection<{ user: string }>).setState({ user: msg.user });
			this.broadcastPresence();
			return;
		}

		if (msg.type === "typing") {
			// Broadcast typing notification to others; never persist
			this.broadcast(JSON.stringify(msg), [connection.id]);
			return;
		}

		if (msg.type === "seen") {
			const connectionUser = this.connectionUser(connection);
			if (!connectionUser || connectionUser !== msg.user) return;

			this.ctx.storage.sql.exec(
				`INSERT INTO seen_receipts (user, ts) VALUES (?, ?)
				 ON CONFLICT (user) DO UPDATE SET ts = MAX(ts, ?)`,
				connectionUser,
				msg.ts,
				msg.ts,
			);

			const receipts = this.loadReceipts();
			this.broadcast(
				JSON.stringify({ type: "seen_update", receipts } satisfies Message),
			);
			return;
		}

		if (msg.type === "add" || msg.type === "update") {
			const connectionUser = this.connectionUser(connection);
			if (!connectionUser || connectionUser !== msg.user) return;

			const isEdit = msg.type === "update";
			const chatMsg: ChatMessage = {
				id: msg.id,
				user: connectionUser,
				role: msg.role,
				content: msg.content,
				ts: msg.ts ?? Date.now(),
			};
			if (!this.saveMessage(chatMsg, isEdit)) return;
			// Broadcast with normalised ts so all clients agree on the timestamp
			this.broadcast(
				JSON.stringify({
					...msg,
					user: connectionUser,
					ts: chatMsg.ts,
					edited: isEdit,
				}),
				[connection.id],
			);
			return;
		}

		if (msg.type === "delete") {
			const connectionUser = this.connectionUser(connection);
			if (!connectionUser || connectionUser !== msg.user) return;

			// Only delete if the message belongs to the requesting user
			const result = this.ctx.storage.sql.exec(
				`DELETE FROM messages WHERE id = ? AND user = ?`,
				msg.id,
				connectionUser,
			);
			if (result.rowsWritten === 0) return;
			this.broadcast(
				JSON.stringify({ ...msg, user: connectionUser }),
				[connection.id],
			);
		}
	}

	async onAlarm() {
		// Room has been inactive for 30 days — clean up all stored data
		await this.ctx.storage.deleteAll();
	}
}

/** Return true if the hostname should be blocked for SSRF protection */
function isBlockedHostname(h: string): boolean {
	const ipv4Mapped = h.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
	// Strip trailing dot (e.g. "localhost." -> "localhost")
	const stripped = (ipv4Mapped ? ipv4Mapped[1] : h).replace(/\.$/, "");
	const normalizedHost = stripped;
	return (
		normalizedHost === "localhost" ||
		normalizedHost.endsWith(".localhost") ||
		normalizedHost.endsWith(".local") ||
		// IPv6 loopback
		normalizedHost === "::1" ||
		// IPv6 link-local (fe80::/10)
		/^fe[89ab][0-9a-f]:/i.test(normalizedHost) ||
		// IPv6 ULA (fc00::/7)
		/^f[cd][0-9a-f]{2}:/i.test(normalizedHost) ||
		// IPv4 loopback 127.0.0.0/8
		/^127\./.test(normalizedHost) ||
		// IPv4 this-network 0.0.0.0/8
		/^0\./.test(normalizedHost) ||
		// RFC 1918 private ranges
		/^10\./.test(normalizedHost) ||
		/^192\.168\./.test(normalizedHost) ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(normalizedHost) ||
		// Link-local 169.254.0.0/16
		/^169\.254\./.test(normalizedHost) ||
		// CGNAT / shared address space 100.64.0.0/10
		/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(normalizedHost)
	);
}

/** Extract OG / meta tags from an HTML string */
function extractMeta(
	html: string,
	targetUrl: string,
): { title: string | null; description: string | null; image: string | null } {
	const attr = (tag: string, prop: string) => {
		const re = new RegExp(
			`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`,
			"i",
		);
		const re2 = new RegExp(
			`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`,
			"i",
		);
		const m = tag.match(re) ?? tag.match(re2);
		return m ? m[1] : null;
	};
	const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
	const rawImage = attr(html, "og:image");
	let image: string | null = null;
	if (rawImage) {
		try {
			image = new URL(rawImage, targetUrl).href;
		} catch {
			image = null;
		}
	}
	return {
		title: attr(html, "og:title") ?? (titleMatch ? titleMatch[1].trim() : null),
		description: attr(html, "og:description") ?? attr(html, "description"),
		image,
	};
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		// Proxy endpoint: fetch URL metadata for link unfurl previews
		if (url.pathname === "/api/unfurl") {
			const targetRaw = url.searchParams.get("url") ?? "";
			let target: URL;
			try {
				target = new URL(targetRaw);
			} catch {
				return new Response("Invalid URL", { status: 400 });
			}
			if (target.protocol !== "http:" && target.protocol !== "https:") {
				return new Response("Scheme not allowed", { status: 400 });
			}
			// Block private / loopback / non-routable addresses (IPv4 and IPv6)
			if (isBlockedHostname(target.hostname.toLowerCase())) {
				return new Response("Blocked", { status: 403 });
			}
			try {
				// Follow redirects manually so we can validate every hop's hostname.
				// String-only checks on the original URL can be bypassed via DNS
				// rebinding or wildcard-DNS services (e.g. nip.io, xip.io).
				let currentUrl = target.toString();
				let res!: Response;
				const MAX_REDIRECTS = 10;
				for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
					// biome-ignore lint/suspicious/noExplicitAny: CF-specific option
					res = await (fetch as any)(currentUrl, {
						headers: { "User-Agent": "Mozilla/5.0 (compatible; ChatBot/1.0)" },
						redirect: "manual",
						cf: { scrapeShield: false },
					});
					if (res.status >= 300 && res.status < 400) {
						const location = res.headers.get("location");
						if (!location) {
							return new Response("Fetch failed", { status: 502 });
						}
						let nextUrl: URL;
						try {
							nextUrl = new URL(location, currentUrl);
						} catch {
							return new Response("Fetch failed", { status: 502 });
						}
						if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") {
							return new Response("Scheme not allowed", { status: 400 });
						}
						if (isBlockedHostname(nextUrl.hostname.toLowerCase())) {
							return new Response("Blocked", { status: 403 });
						}
						currentUrl = nextUrl.toString();
						continue;
					}
					break;
				}
				// Guarded: final URL after all redirects
				{
					let finalUrl: URL;
					try {
						finalUrl = new URL(res.url || currentUrl);
					} catch {
						return new Response("Fetch failed", { status: 502 });
					}
					if (
						(finalUrl.protocol !== "http:" && finalUrl.protocol !== "https:") ||
						isBlockedHostname(finalUrl.hostname.toLowerCase())
					) {
						return new Response("Blocked", { status: 403 });
					}
				}
				// Status guard: only process successful HTML responses
				if (res.status !== 200) {
					return new Response("Fetch failed", { status: 502 });
				}
				const ct = res.headers.get("content-type") ?? "";
				if (!ct.includes("text/html")) {
					return new Response("Unsupported content type", { status: 422 });
				}
				// Size guard: read at most 512 KB to limit resource usage
				const MAX_HTML_BYTES = 512 * 1024;
				const reader = res.body?.getReader();
				if (!reader) {
					return new Response("Fetch failed", { status: 502 });
				}
				const parts: Uint8Array[] = [];
				let totalBytes = 0;
				try {
					while (totalBytes < MAX_HTML_BYTES) {
						const { done, value } = await reader.read();
						if (done) break;
						if (value) {
							const remaining = MAX_HTML_BYTES - totalBytes;
							const chunk =
								value.byteLength <= remaining ? value : value.slice(0, remaining);
							parts.push(chunk);
							totalBytes += chunk.byteLength;
						}
					}
				} finally {
					reader.cancel().catch(() => undefined);
				}
				const buf = new Uint8Array(totalBytes);
				let offset = 0;
				for (const part of parts) {
					buf.set(part, offset);
					offset += part.byteLength;
				}
				const html = new TextDecoder().decode(buf);
				const meta = extractMeta(html, target.toString());
				return Response.json({ ...meta, url: target.toString() });
			} catch {
				return new Response("Fetch failed", { status: 502 });
			}
		}

		return (
			(await routePartykitRequest(request, { ...env })) ||
			env.ASSETS.fetch(request)
		);
	},
} satisfies ExportedHandler<Env>;
