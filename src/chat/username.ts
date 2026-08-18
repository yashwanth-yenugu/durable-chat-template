import { names } from "../shared";

const STORAGE_KEY = "chat-username";

function randomName(): string {
	return names[Math.floor(Math.random() * names.length)];
}

/** Load or create a persistent username (localStorage or extension storage). */
export async function getOrCreateUsername(): Promise<string> {
	if (typeof chrome !== "undefined" && chrome.storage?.local) {
		try {
			const stored = await chrome.storage.local.get(STORAGE_KEY);
			if (typeof stored[STORAGE_KEY] === "string") return stored[STORAGE_KEY];
			const name = randomName();
			await chrome.storage.local.set({ [STORAGE_KEY]: name });
			return name;
		} catch {
			// fall through to localStorage
		}
	}

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) return stored;
		const name = randomName();
		localStorage.setItem(STORAGE_KEY, name);
		return name;
	} catch {
		return randomName();
	}
}
