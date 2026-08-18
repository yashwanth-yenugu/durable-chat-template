import { describe, expect, it } from "vitest";

import { MAX_MESSAGE_LENGTH, MAX_MESSAGES, names } from "./shared";

describe("shared constants", () => {
	it("exports chat limits and username pool", () => {
		expect(MAX_MESSAGE_LENGTH).toBe(4000);
		expect(MAX_MESSAGES).toBe(200);
		expect(names.length).toBeGreaterThan(10);
		expect(names).toContain("Sachin");
	});
});
