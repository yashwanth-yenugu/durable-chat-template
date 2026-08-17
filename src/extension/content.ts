import { DEFAULT_CHAT_HOST } from "./config";
import {
	ROOT_ID,
	STORAGE_KEY,
	buildPanelUrl,
	isInjectablePage,
	wrapHistoryMethod,
} from "./contentHelpers";
import { roomIdFromLocation } from "./roomId";

function init() {
	if (!isInjectablePage(location.protocol) || document.getElementById(ROOT_ID)) {
		return;
	}

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
		iframe.src = buildPanelUrl(room, DEFAULT_CHAT_HOST, chrome.runtime.getURL);
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

	history.pushState = wrapHistoryMethod(history.pushState, onNavigate);
	history.replaceState = wrapHistoryMethod(history.replaceState, onNavigate);

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
