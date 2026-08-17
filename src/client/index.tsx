import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router";
import { nanoid } from "nanoid";

import { ChatApp } from "../chat/ChatApp";
import "../chat/styles.css";

function RoomChat() {
	const { room } = useParams();
	if (!room) return null;

	return (
		<ChatApp
			room={room}
			title="Chat"
			subtitle={room}
		/>
	);
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
				<Route path="/:room" element={<RoomChat />} />
				<Route path="*" element={<Navigate to="/" />} />
			</Routes>
		</BrowserRouter>
	</React.StrictMode>,
);
