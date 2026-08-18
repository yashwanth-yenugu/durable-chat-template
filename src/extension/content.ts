import { DEFAULT_CHAT_HOST } from "./config";
import { roomIdFromLocation } from "./roomId";

const ROOT_ID = "domain-chat-extension-root";
const STORAGE_KEY = "domain-chat-open";

function isInjectablePage(): boolean {
	return location.protocol === "http:" || location.protocol === "https:";
}

function panelUrl(room: string): string {
	const params = new URLSearchParams({
		room,
		host: DEFAULT_CHAT_HOST,
	});
	return chrome.runtime.getURL(`dist/panel.html?${params}`);
}

function init() {
	if (!isInjectablePage() || document.getElementById(ROOT_ID)) return;

	let currentRoom = roomIdFromLocation(location);

	const root = document.createElement("div");
	root.id = ROOT_ID;

	const panel = document.createElement("div");
	panel.className = "domain-chat-panel";
	panel.hidden = true;

	const iframe = document.createElement("iframe");
	iframe.className = "domain-chat-iframe";
	iframe.allow = "clipboard-write";

	const toggle = document.createElement("button");
	toggle.type = "button";
	toggle.className = "domain-chat-toggle";
	toggle.textContent = "💬";

	const updateRoom = (room: string) => {
		currentRoom = room;
		iframe.src = panelUrl(room);
		iframe.title = `Chat on ${room}`;
		toggle.title = `Chat with others on ${room}`;
		toggle.setAttribute("aria-label", `Open chat for ${room}`);
	};

	const setOpen = (open: boolean) => {
		panel.hidden = !open;
		toggle.classList.toggle("active", open);
		toggle.setAttribute("aria-expanded", String(open));
		void chrome.storage.local.set({ [STORAGE_KEY]: open });
	};

	updateRoom(currentRoom);

	toggle.addEventListener("click", () => {
		setOpen(panel.hidden);
	});

	const onNavigate = () => {
		const room = roomIdFromLocation(location);
		if (room !== currentRoom) updateRoom(room);
	};

	window.addEventListener("popstate", onNavigate);
	window.addEventListener("hashchange", onNavigate);

	const wrapHistory = <T extends History["pushState"]>(method: T): T => {
		return function (this: History, ...args: Parameters<T>) {
			const result = method.apply(this, args);
			onNavigate();
			return result;
		} as T;
	};

	history.pushState = wrapHistory(history.pushState);
	history.replaceState = wrapHistory(history.replaceState);

	panel.appendChild(iframe);
	root.appendChild(panel);
	root.appendChild(toggle);
	document.documentElement.appendChild(root);

	void chrome.storage.local.get(STORAGE_KEY).then((stored) => {
		if (stored[STORAGE_KEY] === true) setOpen(true);
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}
