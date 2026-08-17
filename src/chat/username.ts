import { names } from "../shared";

export const STORAGE_KEY = "chat-username";

export function pickRandomName(random = Math.random): string {
	return names[Math.floor(random() * names.length)];
}

/** Load or create a persistent username (localStorage or extension storage). */
export async function getOrCreateUsername(
	storage: UsernameStorage = createDefaultStorage(),
	random = Math.random,
): Promise<string> {
	const stored = await storage.get(STORAGE_KEY);
	if (stored) return stored;

	const name = pickRandomName(random);
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
