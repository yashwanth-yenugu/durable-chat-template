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

		default:
			return null;
	}
}

export class Chat extends Server<Env> {
	static options = { hibernate: true };

	onStart() {
		// Create the messages table with timestamp support
		this.ctx.storage.sql.exec(
			`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user TEXT, role TEXT, content TEXT, ts INTEGER DEFAULT 0)`,
		);
		// Migrate existing tables that were created without the ts column
		try {
			this.ctx.storage.sql.exec(
				`ALTER TABLE messages ADD COLUMN ts INTEGER DEFAULT 0`,
			);
		} catch {
			// Column already exists — safe to ignore
		}
	}

	onConnect(connection: Connection) {
		// Send full message history to the newly connected client
		const messages = this.ctx.storage.sql
			.exec(
				`SELECT id, user, role, content, ts FROM messages ORDER BY ts ASC LIMIT ?`,
				MAX_MESSAGES,
			)
			.toArray() as ChatMessage[];

		connection.send(JSON.stringify({ type: "all", messages } satisfies Message));

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
		const users = [...new Set(
			[...this.getConnections<{ user: string }>()]
				.map((c) => c.state?.user)
				.filter((u): u is string => typeof u === "string" && u.length > 0),
		)];
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

	saveMessage(message: ChatMessage) {
		const ts = message.ts ?? Date.now();
		const result = this.ctx.storage.sql.exec(
			`INSERT INTO messages (id, user, role, content, ts) VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT (id) DO UPDATE SET content = ?, ts = ?
			 WHERE messages.user = ?`,
			message.id,
			message.user,
			message.role,
			message.content,
			ts,
			message.content,
			ts,
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

		if (msg.type === "add" || msg.type === "update") {
			const connectionUser = this.connectionUser(connection);
			if (!connectionUser || connectionUser !== msg.user) return;

			const chatMsg: ChatMessage = {
				id: msg.id,
				user: connectionUser,
				role: msg.role,
				content: msg.content,
				ts: msg.ts ?? Date.now(),
			};
			if (!this.saveMessage(chatMsg)) return;
			// Broadcast with normalised ts so all clients agree on the timestamp
			this.broadcast(
				JSON.stringify({ ...msg, user: connectionUser, ts: chatMsg.ts }),
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

export default {
	async fetch(request, env) {
		return (
			(await routePartykitRequest(request, { ...env })) ||
			env.ASSETS.fetch(request)
		);
	},
} satisfies ExportedHandler<Env>;
