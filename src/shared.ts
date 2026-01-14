export type ChatMessage = {
	id: string;
	content: string;
	user: string;
	role: "user" | "assistant";
	/** optional client/server timestamp (ms since epoch) */
	ts?: number;
};

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
	| {
			type: "all";
			messages: ChatMessage[];
	  };

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
