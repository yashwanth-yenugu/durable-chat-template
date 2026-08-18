import type { ChatMessage, Message } from "../shared";

export function isAuthorisedUser(
	connectionUser: string | null,
	messageUser: string,
): boolean {
	return connectionUser !== null && connectionUser === messageUser;
}

export function toChatMessage(
	message: Extract<Message, { type: "add" | "update" }>,
	connectionUser: string,
	now = Date.now(),
): ChatMessage {
	return {
		id: message.id,
		user: connectionUser,
		role: message.role,
		content: message.content,
		ts: message.ts ?? now,
	};
}

export function serialisePresence(users: string[]): string {
	return JSON.stringify({ type: "presence", users } satisfies Message);
}

export function serialiseHistory(messages: ChatMessage[]): string {
	return JSON.stringify({ type: "all", messages } satisfies Message);
}
