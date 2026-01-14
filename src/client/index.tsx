import React, { useEffect, useMemo, useRef, startTransition, useState } from "react";
import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import {
	BrowserRouter,
	Routes,
	Route,
	Navigate,
	useParams,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message } from "../shared";

function App() {
	const name = useMemo(() => names[Math.floor(Math.random() * names.length)], []);
	const avatarColors = ["#34D399","#60A5FA","#A78BFA","#F472B6","#F59E0B","#F87171","#FBBF24"];
	const colorFor = (u: string) => avatarColors[u.charCodeAt(0) % avatarColors.length];
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [input, setInput] = useState("");
	const [isSending, setIsSending] = useState(false);
	const { room } = useParams();

	useEffect(() => {
		inputRef.current?.focus();
	}, [room]);

	useEffect(() => {
		// Auto-scroll to the newest message
		containerRef.current?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "end" });
	}, [messages]);

	const socket = usePartySocket({
		party: "chat",
		room,
		onMessage: (evt) => {
			const message = JSON.parse(evt.data as string) as Message;
			if (message.type === "add") {
				setMessages((prev) => {
					const foundIndex = prev.findIndex((m) => m.id === message.id);
					const newMsg = {
						id: message.id,
						content: message.content,
						user: message.user,
						role: message.role,
						ts: message.ts ?? Date.now(),
					};
					if (foundIndex === -1) return [...prev, newMsg];
					return prev.slice(0, foundIndex).concat(newMsg).concat(prev.slice(foundIndex + 1));
				});
			} else if (message.type === "update") {
				setMessages((prev) =>
					prev.map((m) =>
						m.id === message.id
							? {
								id: message.id,
								content: message.content,
								user: message.user,
								role: message.role,
								ts: message.ts ?? Date.now(),
							}
						: m,
					),
				);
			} else {
				setMessages(message.messages.map((m) => ({ ...m, ts: m.ts ?? Date.now() })));
			}
		},
	});

	return (
		<div className="chat-wrap">
			<header className="chat-header">
			<div className="header-left">
					<div className="header-meta">
						<div className="header-title">Chat</div>
						<div className="header-sub">{room}</div>						</div>
					</div>
				</header>
			<main className="messages" id="messages" ref={containerRef} role="list">
				{messages.map((message, i) => {
					const prev = messages[i - 1];
					const isContinuation = !!prev && prev.user === message.user;
					return (
						<div key={message.id} className={`message ${message.user === name ? "mine" : ""} ${isContinuation ? "grouped" : ""}`} role="listitem">
						<div className="bubble">
							<div className="meta">
								{!isContinuation && <span className="meta-name">{message.user}</span>}
								<span className="meta-time">{new Date(message.ts ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
							</div>
							<div className="content">{message.content}</div>
						</div>
						</div>
					);
				})}
			</main>

			<form
				className="composer"
				onSubmit={(e) => {
					e.preventDefault();
					const content = input.trim();
					if (!content) return;
					const chatMessage: ChatMessage = {
						ts: Date.now(),
						id: nanoid(8),
						content,
						user: name,
						role: "user",
					};
					// Use a non-urgent update to keep the UI responsive
					startTransition(() => {
						setMessages((prev) => [...prev, chatMessage]);
					});
					socket.send(
						JSON.stringify({
							type: "add",
							...chatMessage,
						} satisfies Message),
					);
					// micro send animation
				setIsSending(true);
				setTimeout(() => setIsSending(false), 380);
				setInput("");
					inputRef.current?.focus();
				}}
			>
				<input
					ref={inputRef}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					type="text"
					name="content"
					className="input"
					placeholder={`Message as ${name}`}
					autoComplete="off"
				/>
				<button
					type="submit"
					className={`btn ${input.trim() ? "active" : "disabled"}`}
					aria-label="Send message"
					disabled={!input.trim()}
				>
					<svg className={`icon-plane ${isSending ? "sending" : ""}`} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
						<path fill="currentColor" d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
					</svg>
				</button>
			</form>
		</div>
	);
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
				<Route path="/:room" element={<App />} />
				<Route path="*" element={<Navigate to="/" />} />
			</Routes>
		</BrowserRouter>
	</React.StrictMode>,
);
