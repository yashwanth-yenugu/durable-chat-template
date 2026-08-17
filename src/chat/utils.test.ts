import { describe, expect, it } from "vitest";

import type { ChatMessage } from "../shared";
import {
	colorFor,
	initials,
	isValidMessageContent,
	normaliseHistoryMessages,
	removeChatMessage,
	typingLabel,
	upsertChatMessage,
} from "./utils";

describe("chat utils", () => {
	it("derives stable avatar colors and initials", () => {
		expect(colorFor("Sachin")).toBe(colorFor("Sachin"));
		expect(initials("Sachin")).toBe("SA");
	});

	it("formats typing labels", () => {
		expect(typingLabel([], "Sachin")).toBeNull();
		expect(typingLabel(["Sachin"], "Sachin")).toBeNull();
		expect(typingLabel(["Virat"], "Sachin")).toBe("Virat is typing…");
		expect(typingLabel(["Virat", "Dhoni"], "Sachin")).toBe(
			"Virat and Dhoni are typing…",
		);
		expect(typingLabel(["A", "B", "C"], "Sachin")).toBe(
			"Several people are typing…",
		);
	});

	it("upserts and removes messages", () => {
		const first: ChatMessage = {
			id: "1",
			user: "Sachin",
			role: "user",
			content: "hello",
			ts: 1,
		};
		const updated: ChatMessage = { ...first, content: "updated" };

		const second: ChatMessage = {
			id: "2",
			user: "Virat",
			role: "user",
			content: "there",
			ts: 2,
		};

		expect(upsertChatMessage([], first)).toEqual([first]);
		expect(upsertChatMessage([first], updated)).toEqual([updated]);
		expect(removeChatMessage([first, second], first.id)).toEqual([second]);
	});

	it("normalises history timestamps", () => {
		const messages: ChatMessage[] = [
			{ id: "1", user: "Sachin", role: "user", content: "hi" },
		];

		expect(normaliseHistoryMessages(messages, 1234)).toEqual([
			{ ...messages[0], ts: 1234 },
		]);
	});

	it("validates message content", () => {
		expect(isValidMessageContent(" hello ", 10)).toBe(true);
		expect(isValidMessageContent("   ", 10)).toBe(false);
		expect(isValidMessageContent("x".repeat(11), 10)).toBe(false);
	});
});
