export type ChatMessage = {
	id: string;
	content: string;
	user: string;
	role: "user" | "assistant";
};

export type Message =
	| {
			type: "add";
			id: string;
			content: string;
			user: string;
			role: "user" | "assistant";
	  }
	| {
			type: "update";
			id: string;
			content: string;
			user: string;
			role: "user" | "assistant";
	  }
	| {
			type: "all";
			messages: ChatMessage[];
	  };

export const names = [
	"Harmanpreet",
	"Smriti",
	"Jhulan",
	"Mithali",
	"Deepti",
	"Poonam",
	"Shafali",
	"Rajeshwari",
	"Sneh",
	"Shikha",
	"Punam",
	"Taniya",
	"Richa",
	"Jemimah",
	"Radha"
];
