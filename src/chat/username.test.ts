import { describe, expect, it, vi } from "vitest";

import { MAX_USERNAME_LENGTH } from "../shared";
import {
	getStoredUsername,
	isValidUsername,
	normaliseUsername,
	saveUsername,
	STORAGE_KEY,
	type UsernameStorage,
} from "./username";

function createMemoryStorage(initial: Record<string, string> = {}): UsernameStorage {
	const data = { ...initial };
	return {
		get: vi.fn(async (key) => data[key] ?? null),
		set: vi.fn(async (key, value) => {
			data[key] = value;
		}),
	};
}

describe("normaliseUsername", () => {
	it("trims surrounding whitespace", () => {
		expect(normaliseUsername("  Alex  ")).toBe("Alex");
	});
});

describe("isValidUsername", () => {
	it("accepts a trimmed name within the length limit", () => {
		expect(isValidUsername("Alex")).toBe(true);
		expect(isValidUsername("  Alex  ")).toBe(true);
	});

	it("rejects empty or oversized names", () => {
		expect(isValidUsername("")).toBe(false);
		expect(isValidUsername("   ")).toBe(false);
		expect(isValidUsername("a".repeat(MAX_USERNAME_LENGTH + 1))).toBe(false);
	});
});

describe("getStoredUsername", () => {
	it("returns an existing stored username", async () => {
		const storage = createMemoryStorage({ [STORAGE_KEY]: "Sachin" });

		await expect(getStoredUsername(storage)).resolves.toBe("Sachin");
	});

	it("returns null when nothing is stored", async () => {
		const storage = createMemoryStorage();

		await expect(getStoredUsername(storage)).resolves.toBeNull();
		expect(storage.set).not.toHaveBeenCalled();
	});

	it("returns null for a stored blank username", async () => {
		const storage = createMemoryStorage({ [STORAGE_KEY]: "   " });

		await expect(getStoredUsername(storage)).resolves.toBeNull();
	});

	it("uses localStorage when no custom storage is provided", async () => {
		const getItem = vi.fn().mockReturnValue("Dhoni");
		const setItem = vi.fn();
		vi.stubGlobal("localStorage", { getItem, setItem });

		await expect(getStoredUsername()).resolves.toBe("Dhoni");
		expect(getItem).toHaveBeenCalledWith(STORAGE_KEY);
		expect(setItem).not.toHaveBeenCalled();
	});
});

describe("saveUsername", () => {
	it("persists a normalised username", async () => {
		const storage = createMemoryStorage();

		await expect(saveUsername("  Alex  ", storage)).resolves.toBe("Alex");
		expect(storage.set).toHaveBeenCalledWith(STORAGE_KEY, "Alex");
	});

	it("rejects invalid usernames", async () => {
		const storage = createMemoryStorage();

		await expect(saveUsername("   ", storage)).rejects.toThrow(/username/i);
		expect(storage.set).not.toHaveBeenCalled();
	});

	it("persists to localStorage by default", async () => {
		const getItem = vi.fn().mockReturnValue(null);
		const setItem = vi.fn();
		vi.stubGlobal("localStorage", { getItem, setItem });

		await expect(saveUsername("Alex")).resolves.toBe("Alex");
		expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, "Alex");
	});
});
