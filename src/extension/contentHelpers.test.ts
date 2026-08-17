import { describe, expect, it, vi } from "vitest";

import {
	buildPanelUrl,
	isInjectablePage,
	wrapHistoryMethod,
} from "./contentHelpers";

describe("isInjectablePage", () => {
	it("allows http and https pages", () => {
		expect(isInjectablePage("http:")).toBe(true);
		expect(isInjectablePage("https:")).toBe(true);
	});

	it("blocks extension and chrome pages", () => {
		expect(isInjectablePage("chrome:")).toBe(false);
		expect(isInjectablePage("chrome-extension:")).toBe(false);
	});
});

describe("buildPanelUrl", () => {
	it("builds an extension panel url with room and host params", () => {
		const url = buildPanelUrl(
			"github.com/user/repo",
			"chat.example.dev",
			(path) => `chrome-extension://abc/${path}`,
		);

		expect(url).toBe(
			"chrome-extension://abc/dist/panel.html?room=github.com%2Fuser%2Frepo&host=chat.example.dev",
		);
	});
});

describe("wrapHistoryMethod", () => {
	it("calls the navigate callback after history updates", () => {
		let navigations = 0;
		const original = vi.fn(() => undefined);
		const wrapped = wrapHistoryMethod(original, () => {
			navigations += 1;
		});

		wrapped(null, "", "/next");

		expect(original).toHaveBeenCalledOnce();
		expect(navigations).toBe(1);
	});
});
