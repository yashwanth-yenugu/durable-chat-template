import React from "react";
import { createRoot } from "react-dom/client";

import { ChatApp } from "../chat/ChatApp";
import { DEFAULT_CHAT_HOST } from "./config";
import "../chat/styles.css";

const params = new URLSearchParams(window.location.search);
const room = params.get("room") ?? "unknown";
const host = params.get("host") ?? DEFAULT_CHAT_HOST;

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<ChatApp
			room={room}
			host={host}
			title="Page Chat"
			subtitle={room}
			embedded
		/>
	</React.StrictMode>,
);
