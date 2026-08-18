import { describe, expect, it } from "vitest";

import {
	CHAT_PARTY,
	MAX_MESSAGE_LENGTH,
	MAX_MESSAGES,
	MAX_ROOM_ID_LENGTH,
	names,
	normalizeRoomId,
} from "./shared";

describe("shared constants", () => {
	it("exports chat limits and username pool", () => {
		expect(MAX_MESSAGE_LENGTH).toBe(4000);
		expect(MAX_MESSAGES).toBe(200);
		expect(CHAT_PARTY).toBe("chat");
		expect(MAX_ROOM_ID_LENGTH).toBe(200);
		expect(names.length).toBeGreaterThan(10);
		expect(names).toContain("Sachin");
	});
});

describe("normalizeRoomId", () => {
	it("returns short room ids unchanged", () => {
		expect(normalizeRoomId("github.com/user/repo")).toBe(
			"github.com/user/repo",
		);
	});

	it("hashes room ids that exceed the max length", () => {
		const longRoom = "a".repeat(MAX_ROOM_ID_LENGTH + 1);
		const normalised = normalizeRoomId(longRoom);
		expect(normalised.length).toBeLessThanOrEqual(MAX_ROOM_ID_LENGTH);
		expect(normalised).toContain(":");
		expect(normalizeRoomId(longRoom)).toBe(normalised);
	});
});
