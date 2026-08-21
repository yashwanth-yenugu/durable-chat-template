import { describe, expect, it } from "vitest";

import { MAX_MESSAGE_LENGTH, MAX_USERNAME_LENGTH } from "../shared";
import {
	isAuthorisedUser,
	serialiseHistory,
	serialisePresence,
	toChatMessage,
} from "./chatLogic";
import { ROOM_TTL_MS } from "./constants";
import { getConnectionUser, uniqueOnlineUsers } from "./presence";
import { parseInboundMessage, validateInboundMessage } from "./validate";

describe("validateInboundMessage", () => {
	it("accepts valid add messages", () => {
		expect(
			validateInboundMessage({
				type: "add",
				id: "abc",
				user: "Sachin",
				role: "user",
				content: "hello",
			}),
		).toEqual({
			type: "add",
			id: "abc",
			user: "Sachin",
			role: "user",
			content: "hello",
		});
	});

	it("rejects invalid payloads", () => {
		expect(validateInboundMessage(null)).toBeNull();
		expect(validateInboundMessage({ type: "add" })).toBeNull();
		expect(
			validateInboundMessage({
				type: "add",
				id: "",
				user: "Sachin",
				role: "user",
				content: "hello",
			}),
		).toBeNull();
		expect(
			validateInboundMessage({
				type: "delete",
				id: "abc",
				user: "",
			}),
		).toBeNull();
		expect(validateInboundMessage({ type: "join", user: "" })).toBeNull();
		expect(
			validateInboundMessage({
				type: "join",
				user: "x".repeat(MAX_USERNAME_LENGTH + 1),
			}),
		).toBeNull();
		expect(
			validateInboundMessage({
				type: "add",
				id: "abc",
				user: "Sachin",
				role: "bot",
				content: "hello",
			}),
		).toBeNull();
		expect(
			validateInboundMessage({
				type: "add",
				id: "abc",
				user: "Sachin",
				role: "user",
				content: "x".repeat(MAX_MESSAGE_LENGTH + 1),
			}),
		).toBeNull();
	});

	it("accepts join, typing, delete, and update messages", () => {
		expect(validateInboundMessage({ type: "join", user: "Sachin" })).toEqual({
			type: "join",
			user: "Sachin",
		});
		expect(validateInboundMessage({ type: "typing", user: "Sachin" })).toEqual({
			type: "typing",
			user: "Sachin",
		});
		expect(
			validateInboundMessage({
				type: "delete",
				id: "abc",
				user: "Sachin",
			}),
		).toEqual({
			type: "delete",
			id: "abc",
			user: "Sachin",
		});
		expect(
			validateInboundMessage({
				type: "update",
				id: "abc",
				user: "Sachin",
				role: "assistant",
				content: "updated",
				ts: 10,
			}),
		).toEqual({
			type: "update",
			id: "abc",
			user: "Sachin",
			role: "assistant",
			content: "updated",
			ts: 10,
		});
	});
});

describe("parseInboundMessage", () => {
	it("parses json strings and rejects malformed input", () => {
		expect(
			parseInboundMessage(
				JSON.stringify({ type: "join", user: "Sachin" }),
			),
		).toEqual({ type: "join", user: "Sachin" });
		expect(parseInboundMessage("{bad json")).toBeNull();
	});
});

describe("presence helpers", () => {
	it("deduplicates online users and ignores blanks", () => {
		expect(uniqueOnlineUsers(["Sachin", "Virat", "Sachin", "", undefined])).toEqual(
			["Sachin", "Virat"],
		);
	});

	it("reads connection usernames from state", () => {
		expect(getConnectionUser({ user: "Sachin" })).toBe("Sachin");
		expect(getConnectionUser({ user: "" })).toBeNull();
		expect(getConnectionUser(null)).toBeNull();
	});
});

describe("chatLogic helpers", () => {
	it("checks authorisation and normalises chat messages", () => {
		expect(isAuthorisedUser("Sachin", "Sachin")).toBe(true);
		expect(isAuthorisedUser("Sachin", "Virat")).toBe(false);
		expect(isAuthorisedUser(null, "Sachin")).toBe(false);

		expect(
			toChatMessage(
				{
					type: "add",
					id: "1",
					user: "Sachin",
					role: "user",
					content: "hello",
				},
				"Sachin",
				42,
			),
		).toEqual({
			id: "1",
			user: "Sachin",
			role: "user",
			content: "hello",
			ts: 42,
		});
	});

	it("serialises presence and history payloads", () => {
		expect(serialisePresence(["Sachin"])).toBe(
			'{"type":"presence","users":["Sachin"]}',
		);
		expect(
			serialiseHistory([
				{
					id: "1",
					user: "Sachin",
					role: "user",
					content: "hello",
					ts: 1,
				},
			]),
		).toBe(
			'{"type":"all","messages":[{"id":"1","user":"Sachin","role":"user","content":"hello","ts":1}]}',
		);
	});
});

describe("constants", () => {
	it("defines a 30 day room ttl", () => {
		expect(ROOM_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
	});
});
