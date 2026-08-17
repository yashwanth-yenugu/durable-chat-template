import { DEFAULT_CHAT_HOST } from "./config";

const ROOT_ID = "domain-chat-extension-root";
const STORAGE_KEY = "domain-chat-open";

function isInjectablePage(): boolean {
	return (
		location.protocol === "http:" ||
		location.protocol === "https:"
	);
}

function init() {
	if (!isInjectablePage() || document.getElementById(ROOT_ID)) return;

	const room = location.hostname;
	const params = new URLSearchParams({
		room,
		host: DEFAULT_CHAT_HOST,
	});

	const root = document.createElement("div");
	root.id = ROOT_ID;

	const panel = document.createElement("div");
	panel.className = "domain-chat-panel";
	panel.hidden = true;

	const iframe = document.createElement("iframe");
	iframe.className = "domain-chat-iframe";
	iframe.src = chrome.runtime.getURL(`dist/panel.html?${params}`);
	iframe.title = `Chat on ${room}`;
	iframe.allow = "clipboard-write";

	const toggle = document.createElement("button");
	toggle.type = "button";
	toggle.className = "domain-chat-toggle";
	toggle.title = `Chat with others on ${room}`;
	toggle.setAttribute("aria-label", `Open chat for ${room}`);
	toggle.textContent = "💬";

	const setOpen = (open: boolean) => {
		panel.hidden = !open;
		toggle.classList.toggle("active", open);
		toggle.setAttribute("aria-expanded", String(open));
		void chrome.storage.local.set({ [STORAGE_KEY]: open });
	};

	toggle.addEventListener("click", () => {
		setOpen(panel.hidden);
	});

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
