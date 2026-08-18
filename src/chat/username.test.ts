import { describe, expect, it, vi } from "vitest";

import { names } from "../shared";
import {
	getOrCreateUsername,
	pickRandomName,
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

describe("pickRandomName", () => {
	it("returns a name from the shared list", () => {
		expect(names).toContain(pickRandomName(() => 0));
	});

	it("uses crypto.getRandomValues by default", () => {
		const getRandomValues = vi.spyOn(crypto, "getRandomValues");
		expect(names).toContain(pickRandomName());
		expect(getRandomValues).toHaveBeenCalled();
		getRandomValues.mockRestore();
	});
});

describe("getOrCreateUsername", () => {
	it("returns an existing stored username", async () => {
		const storage = createMemoryStorage({ [STORAGE_KEY]: "Sachin" });

		await expect(getOrCreateUsername(storage)).resolves.toBe("Sachin");
		expect(storage.set).not.toHaveBeenCalled();
	});

	it("creates and stores a new username when missing", async () => {
		const storage = createMemoryStorage();

		await expect(getOrCreateUsername(storage, () => 0)).resolves.toBe(names[0]);
		expect(storage.set).toHaveBeenCalledWith(STORAGE_KEY, names[0]);
	});

	it("uses localStorage when no custom storage is provided", async () => {
		const getItem = vi.fn().mockReturnValue("Dhoni");
		const setItem = vi.fn();
		vi.stubGlobal("localStorage", { getItem, setItem });

		await expect(getOrCreateUsername()).resolves.toBe("Dhoni");
		expect(getItem).toHaveBeenCalledWith(STORAGE_KEY);
		expect(setItem).not.toHaveBeenCalled();
	});

	it("persists a generated username to localStorage", async () => {
		const getItem = vi.fn().mockReturnValue(null);
		const setItem = vi.fn();
		vi.stubGlobal("localStorage", { getItem, setItem });

		await expect(getOrCreateUsername(undefined, () => 0)).resolves.toBe(names[0]);
		expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, names[0]);
	});
});
