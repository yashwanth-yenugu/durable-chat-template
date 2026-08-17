import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	startTransition,
	useState,
} from "react";
import { usePartySocket } from "partysocket/react";
import { nanoid } from "nanoid";

import {
	MAX_MESSAGE_LENGTH,
	type ChatMessage,
	type Message,
} from "../shared";
import { getOrCreateUsername } from "./username";

const AVATAR_COLORS = [
	"#34D399",
	"#60A5FA",
	"#A78BFA",
	"#F472B6",
	"#F59E0B",
	"#F87171",
	"#FBBF24",
];
const colorFor = (u: string) =>
	AVATAR_COLORS[u.charCodeAt(0) % AVATAR_COLORS.length];
const initials = (u: string) => u.slice(0, 2).toUpperCase();

export type ChatAppProps = {
	room: string;
	/** WebSocket host (defaults to current page origin). */
	host?: string;
	title?: string;
	subtitle?: string;
	/** Use 100% height instead of 100vh (for extension iframe). */
	embedded?: boolean;
};

export function ChatApp({
	room,
	host,
	title = "Chat",
	subtitle,
	embedded = false,
}: ChatAppProps) {
	const [name, setName] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [typingUsers, setTypingUsers] = useState<string[]>([]);
	const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
	const [input, setInput] = useState("");
	const [isSending, setIsSending] = useState(false);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
		{},
	);
	const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		let cancelled = false;
		getOrCreateUsername().then((username) => {
			if (!cancelled) setName(username);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		inputRef.current?.focus();
	}, [room, name]);

	useEffect(() => {
		containerRef.current?.lastElementChild?.scrollIntoView({
			behavior: "smooth",
			block: "end",
		});
	}, [messages]);

	useEffect(() => {
		return () => {
			Object.values(typingTimers.current).forEach(clearTimeout);
			if (typingDebounce.current) clearTimeout(typingDebounce.current);
		};
	}, []);

	const socket = usePartySocket({
		party: "chat",
		room,
		host: host ?? window.location.host,
		onOpen() {
			if (!name) return;
			socket.send(
				JSON.stringify({ type: "join", user: name } satisfies Message),
			);
		},
		onMessage: (evt) => {
			const message = JSON.parse(evt.data as string) as Message;

			if (message.type === "add" || message.type === "update") {
				setMessages((prev) => {
					const foundIndex = prev.findIndex((m) => m.id === message.id);
					const newMsg: ChatMessage = {
						id: message.id,
						content: message.content,
						user: message.user,
						role: message.role,
						ts: message.ts ?? Date.now(),
					};
					if (foundIndex === -1) return [...prev, newMsg];
					return prev
						.slice(0, foundIndex)
						.concat(newMsg)
						.concat(prev.slice(foundIndex + 1));
				});
			} else if (message.type === "delete") {
				setMessages((prev) => prev.filter((m) => m.id !== message.id));
			} else if (message.type === "typing") {
				const user = message.user;
				setTypingUsers((prev) =>
					prev.includes(user) ? prev : [...prev, user],
				);
				if (typingTimers.current[user])
					clearTimeout(typingTimers.current[user]);
				typingTimers.current[user] = setTimeout(() => {
					setTypingUsers((prev) => prev.filter((u) => u !== user));
					delete typingTimers.current[user];
				}, 2500);
			} else if (message.type === "presence") {
				setOnlineUsers(message.users);
			} else if (message.type === "all") {
				setMessages(
					message.messages.map((m) => ({ ...m, ts: m.ts || Date.now() })),
				);
			}
		},
	});

	useEffect(() => {
		if (!name) return;
		socket.send(JSON.stringify({ type: "join", user: name } satisfies Message));
		// Re-announce username when it loads after the socket is already open.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [name]);

	const sendTyping = useCallback(() => {
		if (!name || typingDebounce.current) return;
		socket.send(
			JSON.stringify({ type: "typing", user: name } satisfies Message),
		);
		typingDebounce.current = setTimeout(() => {
			typingDebounce.current = null;
		}, 2000);
	}, [socket, name]);

	const handleDelete = useCallback(
		(id: string) => {
			if (!name) return;
			setMessages((prev) => prev.filter((m) => m.id !== id));
			socket.send(
				JSON.stringify({ type: "delete", id, user: name } satisfies Message),
			);
		},
		[socket, name],
	);

	const typingLabel = useMemo(() => {
		const others = typingUsers.filter((u) => u !== name);
		if (others.length === 0) return null;
		if (others.length === 1) return `${others[0]} is typing…`;
		if (others.length === 2) return `${others[0]} and ${others[1]} are typing…`;
		return "Several people are typing…";
	}, [typingUsers, name]);

	const displaySubtitle = subtitle ?? room;
	const avatarLabel = displaySubtitle || room;

	return (
		<div className={`chat-wrap${embedded ? " embedded" : ""}`}>
			<header className="chat-header">
				<div className="header-left">
					<div
						className="header-avatar"
						style={{ background: colorFor(avatarLabel) }}
						aria-hidden="true"
					>
						{avatarLabel.slice(0, 2).toUpperCase()}
					</div>
					<div className="header-meta">
						<div className="header-title">{title}</div>
						<div className="header-sub">{displaySubtitle}</div>
					</div>
				</div>
				{onlineUsers.length > 0 && (
					<div
						className="online-badge"
						title={`Online: ${onlineUsers.join(", ")}`}
					>
						<span className="online-dot" />
						{onlineUsers.length} online
					</div>
				)}
			</header>

			<main
				className="messages"
				id="messages"
				ref={containerRef}
				role="list"
			>
				{messages.length === 0 && (
					<div className="empty-state">
						<div className="empty-icon">💬</div>
						<div className="empty-title">No messages yet</div>
						<div className="empty-sub">
							Send a message to start the conversation!
						</div>
					</div>
				)}
				{messages.map((message, i) => {
					const prev = messages[i - 1];
					const isMine = message.user === name;
					const isContinuation = !!prev && prev.user === message.user;
					return (
						<div
							key={message.id}
							className={`message ${isMine ? "mine" : ""} ${isContinuation ? "grouped" : ""}`}
							role="listitem"
						>
							<div
								className={`avatar ${isMine ? "mine" : ""} ${isContinuation ? "hidden" : ""}`}
								style={
									isContinuation
										? undefined
										: { background: colorFor(message.user) }
								}
								aria-hidden="true"
							>
								{!isContinuation && initials(message.user)}
							</div>
							<div className="bubble">
								<div className="meta">
									{!isContinuation && (
										<span className="meta-name">{message.user}</span>
									)}
									<span className="meta-time">
										{new Date(message.ts ?? Date.now()).toLocaleTimeString([], {
											hour: "2-digit",
											minute: "2-digit",
										})}
									</span>
								</div>
								<div className="content">{message.content}</div>
								{isMine && (
									<button
										className="delete-btn"
										onClick={() => handleDelete(message.id)}
										aria-label="Delete message"
										title="Delete"
									>
										✕
									</button>
								)}
							</div>
						</div>
					);
				})}
				{typingLabel && (
					<div className="typing-indicator" aria-live="polite">
						<span className="typing-dots">
							<span />
							<span />
							<span />
						</span>
						{typingLabel}
					</div>
				)}
			</main>

			<form
				className="composer"
				onSubmit={(e) => {
					e.preventDefault();
					if (!name) return;
					const content = input.trim();
					if (!content || content.length > MAX_MESSAGE_LENGTH) return;
					const chatMessage: ChatMessage = {
						ts: Date.now(),
						id: nanoid(8),
						content,
						user: name,
						role: "user",
					};
					startTransition(() => {
						setMessages((prev) => [...prev, chatMessage]);
					});
					socket.send(
						JSON.stringify({
							type: "add",
							...chatMessage,
						} satisfies Message),
					);
					setIsSending(true);
					setTimeout(() => setIsSending(false), 380);
					setInput("");
					inputRef.current?.focus();
				}}
			>
				<input
					ref={inputRef}
					value={input}
					onChange={(e) => {
						setInput(e.target.value);
						if (e.target.value) sendTyping();
					}}
					type="text"
					name="content"
					className="input"
					placeholder={name ? `Message as ${name}` : "Loading…"}
					maxLength={MAX_MESSAGE_LENGTH}
					autoComplete="off"
					disabled={!name}
				/>
				<button
					type="submit"
					className={`btn ${input.trim() && input.trim().length <= MAX_MESSAGE_LENGTH && name ? "active" : "disabled"}`}
					aria-label="Send message"
					disabled={
						!name || !input.trim() || input.trim().length > MAX_MESSAGE_LENGTH
					}
				>
					<svg
						className={`icon-plane ${isSending ? "sending" : ""}`}
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
						aria-hidden="true"
					>
						<path fill="currentColor" d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
					</svg>
				</button>
			</form>
		</div>
	);
}
