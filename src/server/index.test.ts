import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("partyserver", () => ({
	Server: class Server {},
	routePartykitRequest: vi.fn(),
}));

import type { ChatMessage } from "../shared";
import { Chat } from "./index";

type MockConnection = {
	id: string;
	state?: { user: string };
	send: ReturnType<typeof vi.fn>;
	setState: ReturnType<typeof vi.fn>;
};

type TestChat = Chat & {
	ctx: {
		storage: {
			sql: { exec: ReturnType<typeof vi.fn> };
			setAlarm: ReturnType<typeof vi.fn>;
			deleteAll: ReturnType<typeof vi.fn>;
		};
	};
	broadcast: ReturnType<typeof vi.fn>;
};

function createChatHarness() {
	const connections = new Map<string, MockConnection>();
	const sqlResults: Array<{ toArray?: () => ChatMessage[]; rowsWritten?: number }> =
		[];
	const sqlExec = vi.fn(() => {
		const result = sqlResults.shift() ?? { rowsWritten: 1 };
		return {
			toArray: () => result.toArray?.() ?? [],
			rowsWritten: result.rowsWritten ?? 0,
		};
	});

	const chat = Object.create(Chat.prototype) as TestChat;
	chat.ctx = {
		storage: {
			sql: { exec: sqlExec },
			setAlarm: vi.fn(),
			deleteAll: vi.fn(),
		},
	};
	chat.getConnections = vi.fn(() => [...connections.values()]) as TestChat["getConnections"];
	chat.broadcast = vi.fn();
	chat.broadcastPresence = Chat.prototype.broadcastPresence.bind(chat);

	return {
		chat,
		connections,
		sqlExec,
		sqlResults,
		addConnection(id: string) {
			const connection: MockConnection = {
				id,
				send: vi.fn(),
				setState: vi.fn(function (this: MockConnection, state: { user: string }) {
					this.state = state;
				}),
			};
			connections.set(id, connection);
			return connection;
		},
	};
}

describe("Chat durable object", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("initialises storage on start", () => {
		const { chat, sqlExec } = createChatHarness();

		chat.onStart();

		expect(sqlExec).toHaveBeenCalledWith(
			expect.stringContaining("CREATE TABLE IF NOT EXISTS messages"),
		);
	});

	it("sends history to new connections", () => {
		const { chat, sqlResults, addConnection } = createChatHarness();
		const history: ChatMessage[] = [
			{
				id: "1",
				user: "Sachin",
				role: "user",
				content: "hello",
				ts: 1,
			},
		];
		sqlResults.push({ toArray: () => history });
		const connection = addConnection("c1");

		chat.onConnect(connection as never);

		expect(connection.send).toHaveBeenCalledWith(
			JSON.stringify({ type: "all", messages: history }),
		);
	});

	it("handles join, typing, add, and delete messages", () => {
		const { chat, addConnection } = createChatHarness();
		const connection = addConnection("c1");

		chat.onMessage(
			connection as never,
			JSON.stringify({ type: "join", user: "Sachin" }),
		);
		expect(connection.setState).toHaveBeenCalledWith({ user: "Sachin" });
		expect(chat.broadcast).toHaveBeenCalledWith(
			JSON.stringify({ type: "presence", users: ["Sachin"] }),
			undefined,
		);

		chat.broadcast.mockClear();
		chat.onMessage(
			connection as never,
			JSON.stringify({ type: "typing", user: "Sachin" }),
		);
		expect(chat.broadcast).toHaveBeenCalledWith(
			JSON.stringify({ type: "typing", user: "Sachin" }),
			["c1"],
		);

		chat.broadcast.mockClear();
		chat.onMessage(
			connection as never,
			JSON.stringify({
				type: "add",
				id: "m1",
				user: "Sachin",
				role: "user",
				content: "hello",
			}),
		);
		expect(chat.broadcast).toHaveBeenCalledWith(
			expect.stringContaining('"type":"add"'),
			["c1"],
		);

		chat.broadcast.mockClear();
		chat.onMessage(
			connection as never,
			JSON.stringify({ type: "delete", id: "m1", user: "Sachin" }),
		);
		expect(chat.broadcast).toHaveBeenCalledWith(
			JSON.stringify({ type: "delete", id: "m1", user: "Sachin" }),
			["c1"],
		);
	});

	it("rejects unauthorised mutations and malformed messages", () => {
		const { chat, addConnection } = createChatHarness();
		const connection = addConnection("c1");
		connection.state = { user: "Sachin" };

		chat.onMessage(connection as never, "{bad");
		chat.onMessage(
			connection as never,
			JSON.stringify({
				type: "add",
				id: "m1",
				user: "Virat",
				role: "user",
				content: "hello",
			}),
		);

		expect(chat.broadcast).not.toHaveBeenCalled();
	});

	it("broadcasts presence on close and clears storage on alarm", async () => {
		const { chat, addConnection } = createChatHarness();
		const broadcastPresence = vi.spyOn(chat, "broadcastPresence");
		const connection = addConnection("c1");

		chat.onClose(connection as never, 1000, "bye", true);
		expect(broadcastPresence).toHaveBeenCalledWith(["c1"]);

		await chat.onAlarm();
		expect(chat.ctx.storage.deleteAll).toHaveBeenCalled();
	});
});
