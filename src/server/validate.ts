import type { Message } from "../shared";
import { MAX_MESSAGE_LENGTH } from "../shared";

const isNonEmptyString = (value: unknown, max: number): value is string =>
	typeof value === "string" && value.length > 0 && value.length <= max;

const isValidTimestamp = (value: unknown): boolean =>
	value === undefined ||
	(typeof value === "number" && Number.isFinite(value) && value > 0);

/** Validate and parse an incoming WebSocket message; returns null if invalid */
export function validateInboundMessage(raw: unknown): Message | null {
	if (typeof raw !== "object" || raw === null) return null;
	const message = raw as Record<string, unknown>;

	switch (message.type) {
		case "add":
		case "update":
			if (
				!isNonEmptyString(message.id, 64) ||
				!isNonEmptyString(message.content, MAX_MESSAGE_LENGTH) ||
				!isNonEmptyString(message.user, 64) ||
				(message.role !== "user" && message.role !== "assistant") ||
				!isValidTimestamp(message.ts)
			) {
				return null;
			}
			return message as unknown as Message;

		case "delete":
			if (
				!isNonEmptyString(message.id, 64) ||
				!isNonEmptyString(message.user, 64)
			) {
				return null;
			}
			return message as unknown as Message;

		case "typing":
		case "join":
			if (!isNonEmptyString(message.user, 64)) return null;
			return message as unknown as Message;

		default:
			return null;
	}
}

export function parseInboundMessage(raw: string): Message | null {
	try {
		return validateInboundMessage(JSON.parse(raw));
	} catch {
		return null;
	}
}
