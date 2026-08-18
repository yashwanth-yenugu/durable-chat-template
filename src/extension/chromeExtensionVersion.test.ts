import { describe, expect, it } from "vitest";
import {
	chromeExtensionVersion,
	loadUnpackedInstructions,
} from "./chromeExtensionVersion";

describe("chromeExtensionVersion", () => {
	it("defaults to 1.0.0 when unset", () => {
		expect(chromeExtensionVersion(undefined)).toBe("1.0.0");
		expect(chromeExtensionVersion("")).toBe("1.0.0");
		expect(chromeExtensionVersion("   ")).toBe("1.0.0");
	});

	it("strips a leading v from git tags", () => {
		expect(chromeExtensionVersion("v1.2.3")).toBe("1.2.3");
		expect(chromeExtensionVersion("V2.0")).toBe("2.0");
	});

	it("accepts 1–4 numeric Chrome version parts", () => {
		expect(chromeExtensionVersion("1")).toBe("1");
		expect(chromeExtensionVersion("1.0.0.99")).toBe("1.0.0.99");
	});

	it("rejects git SHAs and other non-Chrome versions", () => {
		expect(() => chromeExtensionVersion("abc1234")).toThrow(/Invalid Chrome extension version/);
		expect(() => chromeExtensionVersion("1.0.0-beta")).toThrow(/Invalid Chrome extension version/);
	});
});

describe("loadUnpackedInstructions", () => {
	it("tells testers to unzip then Load unpacked, not to load the zip", () => {
		const text = loadUnpackedInstructions({
			chatHost: "durable-chat-template.templates.workers.dev",
			version: "1.2.3",
		});
		expect(text).toContain("Page Chat 1.2.3");
		expect(text).toContain("chrome://extensions");
		expect(text).toContain("Developer mode");
		expect(text).toContain("Load unpacked");
		expect(text).toContain("manifest.json");
		expect(text).toContain("durable-chat-template.templates.workers.dev");
		expect(text).toMatch(/do not load the \.zip/i);
	});
});
