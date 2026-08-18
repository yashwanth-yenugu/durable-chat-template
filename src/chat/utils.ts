import type { ChatMessage } from "../shared";

export const AVATAR_COLORS = [
	"#34D399",
	"#60A5FA",
	"#A78BFA",
	"#F472B6",
	"#F59E0B",
	"#F87171",
	"#FBBF24",
] as const;

export function colorFor(user: string): string {
	return AVATAR_COLORS[user.charCodeAt(0) % AVATAR_COLORS.length];
}

export function initials(user: string): string {
	return user.slice(0, 2).toUpperCase();
}

export function typingLabel(
	typingUsers: string[],
	currentUser: string,
): string | null {
	const others = typingUsers.filter((user) => user !== currentUser);
	if (others.length === 0) return null;
	if (others.length === 1) return `${others[0]} is typing…`;
	if (others.length === 2) return `${others[0]} and ${others[1]} are typing…`;
	return "Several people are typing…";
}

export function upsertChatMessage(
	messages: ChatMessage[],
	incoming: ChatMessage,
): ChatMessage[] {
	const index = messages.findIndex((message) => message.id === incoming.id);
	if (index === -1) return [...messages, incoming];
	return messages
		.slice(0, index)
		.concat(incoming)
		.concat(messages.slice(index + 1));
}

export function removeChatMessage(
	messages: ChatMessage[],
	id: string,
): ChatMessage[] {
	return messages.filter((message) => message.id !== id);
}

export function normaliseHistoryMessages(
	messages: ChatMessage[],
	now = Date.now(),
): ChatMessage[] {
	return messages.map((message) => ({
		...message,
		ts: message.ts || now,
	}));
}

export function isValidMessageContent(
	content: string,
	maxLength: number,
): boolean {
	const trimmed = content.trim();
	return trimmed.length > 0 && trimmed.length <= maxLength;
}
