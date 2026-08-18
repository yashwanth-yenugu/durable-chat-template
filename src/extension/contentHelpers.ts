export const ROOT_ID = "domain-chat-extension-root";
export const STORAGE_KEY = "domain-chat-open";

export function isInjectablePage(protocol: string): boolean {
	return protocol === "http:" || protocol === "https:";
}

export function buildPanelUrl(
	room: string,
	host: string,
	getExtensionUrl: (path: string) => string,
): string {
	const params = new URLSearchParams({ room, host });
	return getExtensionUrl(`dist/panel.html?${params}`);
}

export function wrapHistoryMethod<T extends History["pushState"]>(
	method: T,
	onNavigate: () => void,
): T {
	return function (this: History, ...args: Parameters<T>) {
		const result = method.apply(this, args);
		onNavigate();
		return result;
	} as T;
}
