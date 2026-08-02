import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	startTransition,
	useState,
} from "react";
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

import {
	MAX_MESSAGE_LENGTH,
	names,
	type ChatMessage,
	type Message,
} from "../shared";

const AVATAR_COLORS = [
	"#34D399", "#60A5FA", "#A78BFA",
	"#F472B6", "#F59E0B", "#F87171", "#FBBF24",
];
const colorFor = (u: string) =>
	AVATAR_COLORS[u.charCodeAt(0) % AVATAR_COLORS.length];
const initials = (u: string) => u.slice(0, 2).toUpperCase();

function getOrCreateName(): string {
	try {
		const stored = localStorage.getItem("chat-username");
		if (stored) return stored;
	} catch {}
	const random = names[Math.floor(Math.random() * names.length)];
	try {
		localStorage.setItem("chat-username", random);
	} catch {}
	return random;
}

/** Extract the first http/https URL from a string, or null. */
function extractFirstUrl(text: string): string | null {
	const m = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/);
	return m ? m[0] : null;
}

/** Replace bare URLs in text with clickable <a> elements. */
function MessageContent({ content }: { content: string }) {
	const urlRe = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
	const nodes: React.ReactNode[] = [];
	let last = 0;
	let m: RegExpExecArray | null;
	while ((m = urlRe.exec(content)) !== null) {
		if (m.index > last) nodes.push(content.slice(last, m.index));
		nodes.push(
			<a
				key={m.index}
				href={m[0]}
				target="_blank"
				rel="noopener noreferrer"
				className="msg-link"
			>
				{m[0]}
			</a>,
		);
		last = m.index + m[0].length;
	}
	if (last < content.length) nodes.push(content.slice(last));
	return <>{nodes}</>;
}

type UnfurlData = {
	title: string | null;
	description: string | null;
	image: string | null;
	url: string;
};

/** Fetch OG metadata from the server-side unfurl proxy and display a preview card. */
function UrlPreview({ url }: { url: string }) {
	const [data, setData] = useState<UnfurlData | null>(null);

	useEffect(() => {
		let active = true;
		fetch(`/api/unfurl?url=${encodeURIComponent(url)}`)
			.then((r) => (r.ok ? r.json() : Promise.reject()))
			.then((d: UnfurlData) => { if (active && d.title) setData(d); })
			.catch(() => {});
		return () => { active = false; };
	}, [url]);

	if (!data) return null;

	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className="url-preview"
		>
			{data.image && (
				<img src={data.image} alt="" className="url-preview-img" />
			)}
			<div className="url-preview-text">
				{data.title && <div className="url-preview-title">{data.title}</div>}
				{data.description && (
					<div className="url-preview-desc">{data.description}</div>
				)}
				<div className="url-preview-host">{new URL(url).hostname}</div>
			</div>
		</a>
	);
}

function App() {
	const [name] = useState(getOrCreateName);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [typingUsers, setTypingUsers] = useState<string[]>([]);
	const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
	const [input, setInput] = useState("");
	const [isSending, setIsSending] = useState(false);
	// Message editing
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editContent, setEditContent] = useState("");
	// Read receipts: user -> timestamp of last seen message
	const [receipts, setReceipts] = useState<Record<string, number>>({});
	// Scroll / unread
	const [isAtBottom, setIsAtBottom] = useState(true);
	const [unreadCount, setUnreadCount] = useState(0);

	const inputRef = useRef<HTMLInputElement | null>(null);
	const editInputRef = useRef<HTMLInputElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
	const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
	const prevMsgCountRef = useRef(0);
	const lastSeenTsRef = useRef(0);
	const { room } = useParams();

	// Request notification permission on mount
	useEffect(() => {
		if (
			typeof Notification !== "undefined" &&
			Notification.permission === "default"
		) {
			Notification.requestPermission().catch(() => {});
		}
	}, []);

	useEffect(() => {
		inputRef.current?.focus();
	}, [room]);

	// Scroll tracking
	const handleScroll = useCallback(() => {
		const el = containerRef.current;
		if (!el) return;
		const atBottom =
			el.scrollHeight - el.scrollTop - el.clientHeight < 100;
		setIsAtBottom(atBottom);
		if (atBottom) setUnreadCount(0);
	}, []);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		el.addEventListener("scroll", handleScroll, { passive: true });
		return () => el.removeEventListener("scroll", handleScroll);
	}, [handleScroll]);

	// Scroll to bottom / unread tracking when messages change
	useEffect(() => {
		const added = messages.length - prevMsgCountRef.current;
		prevMsgCountRef.current = messages.length;

		if (added <= 0) return; // edit or delete — no count change
		if (isAtBottom) {
			containerRef.current?.lastElementChild?.scrollIntoView({
				behavior: "smooth",
				block: "end",
			});
		} else {
			setUnreadCount((prev) => prev + added);
		}
	}, [messages, isAtBottom]);

	// Send read receipt when at bottom and messages change
	useEffect(() => {
		if (!isAtBottom || messages.length === 0) return;
		const lastMsg = messages[messages.length - 1];
		const ts = lastMsg.ts ?? Date.now();
		if (ts > lastSeenTsRef.current) {
			lastSeenTsRef.current = ts;
			// socket may not be ready yet on very first render — sent via socket ref below
		}
	}, [isAtBottom, messages]);

	// Clean up timers on unmount
	useEffect(() => {
		return () => {
			Object.values(typingTimers.current).forEach(clearTimeout);
			if (typingDebounce.current) clearTimeout(typingDebounce.current);
		};
	}, []);

	const socket = usePartySocket({
		party: "chat",
		room,
		onOpen() {
			socket.send(JSON.stringify({ type: "join", user: name } satisfies Message));
		},
		onMessage: (evt) => {
			const message = JSON.parse(evt.data as string) as Message;

			if (message.type === "add") {
				setMessages((prev) => {
					const foundIndex = prev.findIndex((m) => m.id === message.id);
					const newMsg: ChatMessage = {
						id: message.id,
						content: message.content,
						user: message.user,
						role: message.role,
						ts: message.ts ?? Date.now(),
					};
					if (foundIndex === -1) {
						// Fire desktop notification for messages from others
						if (
							message.user !== name &&
							typeof Notification !== "undefined" &&
							Notification.permission === "granted" &&
							document.hidden
						) {
							const n = new Notification(message.user, {
								body: message.content.slice(0, 100),
								tag: "chat-message",
							});
							n.onclick = () => window.focus();
						}
						return [...prev, newMsg];
					}
					return prev
						.slice(0, foundIndex)
						.concat(newMsg)
						.concat(prev.slice(foundIndex + 1));
				});
			} else if (message.type === "update") {
				setMessages((prev) => {
					const foundIndex = prev.findIndex((m) => m.id === message.id);
					if (foundIndex === -1) return prev;
					const updated: ChatMessage = {
						...prev[foundIndex],
						content: message.content,
						ts: message.ts ?? prev[foundIndex].ts,
						edited: true,
					};
					return prev
						.slice(0, foundIndex)
						.concat(updated)
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
			} else if (message.type === "seen_update") {
				setReceipts(message.receipts);
			}
		},
	});

	// Send read receipt via socket when lastSeenTs advances
	useEffect(() => {
		if (!isAtBottom || messages.length === 0) return;
		const lastMsg = messages[messages.length - 1];
		const ts = lastMsg.ts ?? Date.now();
		if (ts <= lastSeenTsRef.current) return;
		lastSeenTsRef.current = ts;
		socket.send(
			JSON.stringify({ type: "seen", user: name, ts } satisfies Message),
		);
	}, [isAtBottom, messages, name, socket]);

	/** Send a typing notification, debounced to once every 2 s */
	const sendTyping = useCallback(() => {
		if (typingDebounce.current) return;
		socket.send(
			JSON.stringify({ type: "typing", user: name } satisfies Message),
		);
		typingDebounce.current = setTimeout(() => {
			typingDebounce.current = null;
		}, 2000);
	}, [socket, name]);

	const handleDelete = useCallback(
		(id: string) => {
			setMessages((prev) => prev.filter((m) => m.id !== id));
			socket.send(
				JSON.stringify({ type: "delete", id, user: name } satisfies Message),
			);
		},
		[socket, name],
	);

	const handleSaveEdit = useCallback(
		(id: string) => {
			const content = editContent.trim();
			if (!content || content.length > MAX_MESSAGE_LENGTH) return;
			const existing = messages.find((m) => m.id === id);
			if (!existing) return;

			// Optimistic update
			setMessages((prev) =>
				prev.map((m) =>
					m.id === id ? { ...m, content, edited: true } : m,
				),
			);
			socket.send(
				JSON.stringify({
					type: "update",
					id,
					content,
					user: name,
					role: existing.role,
					ts: existing.ts,
				} satisfies Message),
			);
			setEditingId(null);
		},
		[editContent, messages, name, socket],
	);

	const scrollToBottom = useCallback(() => {
		containerRef.current?.lastElementChild?.scrollIntoView({
			behavior: "smooth",
			block: "end",
		});
		setUnreadCount(0);
	}, []);

	const typingLabel = useMemo(() => {
		const others = typingUsers.filter((u) => u !== name);
		if (others.length === 0) return null;
		if (others.length === 1) return `${others[0]} is typing…`;
		if (others.length === 2)
			return `${others[0]} and ${others[1]} are typing…`;
		return "Several people are typing…";
	}, [typingUsers, name]);

	return (
		<div className="chat-wrap">
			<header className="chat-header">
				<div className="header-left">
					<div
						className="header-avatar"
						style={{ background: colorFor(room ?? "?") }}
						aria-hidden="true"
					>
						{(room ?? "?").slice(0, 2).toUpperCase()}
					</div>
					<div className="header-meta">
						<div className="header-title">Chat</div>
						<div className="header-sub">{room}</div>
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

			<div className="messages-wrap">
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
						const firstUrl = extractFirstUrl(message.content);
						// Users (other than self) who have seen at least this message
						const seenBy = isMine
							? Object.entries(receipts)
								.filter(
									([u, ts]) =>
										u !== name && ts >= (message.ts ?? 0),
								)
								.map(([u]) => u)
							: [];
						const isEditing = editingId === message.id;

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
											{new Date(
												message.ts ?? Date.now(),
											).toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</span>
										{message.edited && !isEditing && (
											<span className="edited-label">(edited)</span>
										)}
									</div>

									{isEditing ? (
										<div className="edit-mode">
											<input
												ref={editInputRef}
												className="edit-input"
												value={editContent}
												onChange={(e) => setEditContent(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Enter" && !e.shiftKey) {
														e.preventDefault();
														handleSaveEdit(message.id);
													}
													if (e.key === "Escape") setEditingId(null);
												}}
												maxLength={MAX_MESSAGE_LENGTH}
												autoFocus
											/>
											<div className="edit-actions">
												<button
													className="edit-save"
													onClick={() => handleSaveEdit(message.id)}
												>
													Save
												</button>
												<button
													className="edit-cancel"
													onClick={() => setEditingId(null)}
												>
													Cancel
												</button>
											</div>
										</div>
									) : (
										<>
											<div className="content">
												<MessageContent content={message.content} />
											</div>
											{firstUrl && <UrlPreview url={firstUrl} />}
										</>
									)}

									{isMine && !isEditing && (
										<div className="msg-actions">
											<button
												className="edit-btn"
												onClick={() => {
													setEditingId(message.id);
													setEditContent(message.content);
												}}
												aria-label="Edit message"
												title="Edit"
											>
												✎
											</button>
											<button
												className="delete-btn"
												onClick={() => handleDelete(message.id)}
												aria-label="Delete message"
												title="Delete"
											>
												✕
											</button>
										</div>
									)}

									{seenBy.length > 0 && (
										<div className="seen-receipt">
											{seenBy.map((u) => (
												<span
													key={u}
													className="seen-avatar"
													style={{ background: colorFor(u) }}
													title={`Seen by ${u}`}
												>
													{initials(u)}
												</span>
											))}
										</div>
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

				{/* Scroll-to-bottom button with unread badge */}
				{!isAtBottom && (
					<button
						className="scroll-to-bottom"
						onClick={scrollToBottom}
						aria-label="Scroll to latest messages"
					>
						↓{unreadCount > 0 && (
							<span className="unread-badge">{unreadCount}</span>
						)}
					</button>
				)}
			</div>

			<form
				className="composer"
				onSubmit={(e) => {
					e.preventDefault();
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
					placeholder={`Message as ${name}`}
					maxLength={MAX_MESSAGE_LENGTH}
					autoComplete="off"
				/>
				<button
					type="submit"
					className={`btn ${input.trim() && input.trim().length <= MAX_MESSAGE_LENGTH ? "active" : "disabled"}`}
					aria-label="Send message"
					disabled={!input.trim() || input.trim().length > MAX_MESSAGE_LENGTH}
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
