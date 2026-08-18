export type ChatMessage = {
	id: string;
	content: string;
	user: string;
	role: "user" | "assistant";
	/** client/server timestamp (ms since epoch) */
	ts?: number;
};

/** Maximum number of characters allowed in a single message */
export const MAX_MESSAGE_LENGTH = 4000;

/** Maximum number of messages stored per room */
export const MAX_MESSAGES = 200;

/** Party name matching the Durable Object binding (lowercase). */
export const CHAT_PARTY = "chat";

/** Maximum room id length before hashing (Durable Object name safety). */
export const MAX_ROOM_ID_LENGTH = 200;

/** Normalise long room ids to a stable, bounded value. */
export function normalizeRoomId(room: string): string {
	if (room.length <= MAX_ROOM_ID_LENGTH) return room;
	let hash = 0;
	for (let i = 0; i < room.length; i++) {
		hash = (Math.imul(31, hash) + room.charCodeAt(i)) | 0;
	}
	const prefix = room.slice(0, MAX_ROOM_ID_LENGTH - 9);
	return `${prefix}:${(hash >>> 0).toString(36)}`;
}

export type Message =
	| {
			type: "add";
			id: string;
			content: string;
			user: string;
			role: "user" | "assistant";
			ts?: number;
	  }
	| {
			type: "update";
			id: string;
			content: string;
			user: string;
			role: "user" | "assistant";
			ts?: number;
	  }
	| { type: "delete"; id: string; user: string }
	| { type: "typing"; user: string }
	| { type: "join"; user: string }
	| { type: "presence"; users: string[] }
	| { type: "all"; messages: ChatMessage[] };

export const names = [
	// Women cricketers
	"Harmanpreet", "Smriti", "Jhulan", "Mithali", "Deepti",
	"Poonam", "Shafali", "Rajeshwari", "Sneh", "Shikha",
	"Punam", "Taniya", "Richa", "Jemimah", "Radha",
	// Men cricketers
	"Kapil", "Sachin", "Dhoni", "Yuvraj", "Virender",
	"Gautam", "Zaheer", "Harbhajan", "Virat", "Suresh",
	"Munaf", "Ashish", "Sreesanth", "Rohit", "Ravindra"
];
