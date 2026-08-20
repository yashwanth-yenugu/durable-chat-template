import { MAX_USERNAME_LENGTH } from "../shared";

export const STORAGE_KEY = "chat-username";

export function normaliseUsername(value: string): string {
	return value.trim();
}

export function isValidUsername(value: string): boolean {
	const name = normaliseUsername(value);
	return name.length > 0 && name.length <= MAX_USERNAME_LENGTH;
}

/** Load a previously chosen username (localStorage or extension storage). */
export async function getStoredUsername(
	storage: UsernameStorage = createDefaultStorage(),
): Promise<string | null> {
	const stored = await storage.get(STORAGE_KEY);
	if (!stored || !isValidUsername(stored)) return null;
	return normaliseUsername(stored);
}

/** Persist a user-provided username after validation. */
export async function saveUsername(
	value: string,
	storage: UsernameStorage = createDefaultStorage(),
): Promise<string> {
	const name = normaliseUsername(value);
	if (!isValidUsername(name)) {
		throw new Error("Enter a username between 1 and 64 characters.");
	}
	await storage.set(STORAGE_KEY, name);
	return name;
}

export type UsernameStorage = {
	get(key: string): Promise<string | null>;
	set(key: string, value: string): Promise<void>;
};

function createDefaultStorage(): UsernameStorage {
	if (typeof chrome !== "undefined" && chrome.storage?.local) {
		return {
			async get(key) {
				try {
					const stored = await chrome.storage.local.get(key);
					return typeof stored[key] === "string" ? stored[key] : null;
				} catch {
					return null;
				}
			},
			async set(key, value) {
				await chrome.storage.local.set({ [key]: value });
			},
		};
	}

	return {
		async get(key) {
			try {
				return localStorage.getItem(key);
			} catch {
				return null;
			}
		},
		async set(key, value) {
			try {
				localStorage.setItem(key, value);
			} catch {
				// ignore write failures in restricted contexts
			}
		},
	};
}
