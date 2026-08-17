import {
	type Connection,
	Server,
	type WSMessage,
	routePartykitRequest,
} from "partyserver";

import type { ChatMessage, Message } from "../shared";
import { MAX_MESSAGES } from "../shared";
import {
	isAuthorisedUser,
	serialiseHistory,
	serialisePresence,
	toChatMessage,
} from "./chatLogic";
import { ROOM_TTL_MS } from "./constants";
import { getConnectionUser, uniqueOnlineUsers } from "./presence";
import { parseInboundMessage } from "./validate";

export class Chat extends Server<Env> {
	static options = { hibernate: true };

	onStart() {
		this.ctx.storage.sql.exec(
			`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user TEXT, role TEXT, content TEXT, ts INTEGER DEFAULT 0)`,
		);
		try {
			this.ctx.storage.sql.exec(
				`ALTER TABLE messages ADD COLUMN ts INTEGER DEFAULT 0`,
			);
		} catch {
			// Column already exists — safe to ignore
		}
	}

	onConnect(connection: Connection) {
		const messages = this.ctx.storage.sql
			.exec(
				`SELECT id, user, role, content, ts FROM messages ORDER BY ts ASC LIMIT ?`,
				MAX_MESSAGES,
			)
			.toArray() as ChatMessage[];

		connection.send(serialiseHistory(messages));
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

	broadcastPresence(exclude?: string[]) {
		const users = uniqueOnlineUsers(
			[...this.getConnections<{ user: string }>()].map(
				(connection) => connection.state?.user,
			),
		);
		this.broadcast(serialisePresence(users), exclude);
	}

	private connectionUser(connection: Connection): string | null {
		return getConnectionUser(
			(connection as Connection<{ user: string }>).state,
		);
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
		this.ctx.storage.sql.exec(
			`DELETE FROM messages WHERE id NOT IN (
				SELECT id FROM messages ORDER BY ts DESC LIMIT ?
			)`,
			MAX_MESSAGES,
		);
		return result.rowsWritten > 0;
	}

	onMessage(connection: Connection, message: WSMessage) {
		const msg = parseInboundMessage(message as string);
		if (!msg) return;

		this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);

		if (msg.type === "join") {
			(connection as Connection<{ user: string }>).setState({ user: msg.user });
			this.broadcastPresence();
			return;
		}

		if (msg.type === "typing") {
			this.broadcast(JSON.stringify(msg), [connection.id]);
			return;
		}

		if (msg.type === "add" || msg.type === "update") {
			const connectionUser = this.connectionUser(connection);
			if (!isAuthorisedUser(connectionUser, msg.user)) return;

			const chatMsg = toChatMessage(msg, connectionUser!);
			if (!this.saveMessage(chatMsg)) return;
			this.broadcast(
				JSON.stringify({ ...msg, user: connectionUser, ts: chatMsg.ts }),
				[connection.id],
			);
			return;
		}

		if (msg.type === "delete") {
			const connectionUser = this.connectionUser(connection);
			if (!isAuthorisedUser(connectionUser, msg.user)) return;

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
