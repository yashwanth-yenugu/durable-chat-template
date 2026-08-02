export type ChatMessage = {
	id: string;
	content: string;
	user: string;
	role: "user" | "assistant";
	/** client/server timestamp (ms since epoch) */
	ts?: number;
	/** true when the message has been edited after initial send */
	edited?: boolean;
};

/** Maximum number of characters allowed in a single message */
export const MAX_MESSAGE_LENGTH = 4000;

/** Maximum number of messages stored per room */
export const MAX_MESSAGES = 200;

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
	| { type: "all"; messages: ChatMessage[] }
	/** Client → server: mark all messages up to `ts` as seen */
	| { type: "seen"; user: string; ts: number }
	/** Server → clients: full map of user → last-seen timestamp */
	| { type: "seen_update"; receipts: Record<string, number> };

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
