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
	type SystemMessage,
} from "../shared";

type DisplayMessage = ChatMessage | SystemMessage;

const isSystemMessage = (m: DisplayMessage): m is SystemMessage => "type" in m && m.type === "system";
const isChatMessage = (m: DisplayMessage): m is ChatMessage => !isSystemMessage(m);

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

// Shared AudioContext ref so playNotificationSound can access it
const audioContextRef = { current: null as AudioContext | null };

function playNotificationSound() {
	try {
		const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		if (!AudioCtx) return;

		let ctx = audioContextRef.current;
		if (!ctx) {
			ctx = new AudioCtx();
			audioContextRef.current = ctx;
		}
		if (ctx.state === "suspended") {
			ctx.resume().catch(() => {});
		}

		const now = ctx.currentTime;

		const playTone = (freq: number, startTime: number, duration: number) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "sine";
			osc.frequency.value = freq;
			gain.gain.setValueAtTime(0.15, startTime);
			gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(startTime);
			osc.stop(startTime + duration);
		};

		playTone(880, now, 0.12);
		playTone(1100, now + 0.12, 0.12);
	} catch {
		// Ignore audio errors
	}
}

function App() {
	const [name] = useState(getOrCreateName);
	const [messages, setMessages] = useState<DisplayMessage[]>([]);
	const [typingUsers, setTypingUsers] = useState<string[]>([]);
	const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
	const [input, setInput] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [unreadCount, setUnreadCount] = useState(0);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
	const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
	const { room } = useParams();

	// Track external message count to detect new arrivals
	const previousExternalCountRef = useRef(0);

	// Resume AudioContext on first user interaction (browsers block autoplay)
	useEffect(() => {
		const resume = async () => {
			if (audioContextRef.current?.state === "suspended") {
				await audioContextRef.current.resume();
			}
		};
		document.addEventListener("click", resume, { once: true });
		document.addEventListener("keydown", resume, { once: true });
		return () => {
			document.removeEventListener("click", resume);
			document.removeEventListener("keydown", resume);
		};
	}, []);

	useEffect(() => {
		inputRef.current?.focus();
	}, [room]);

	useEffect(() => {
		containerRef.current?.lastElementChild?.scrollIntoView({
			behavior: "smooth",
			block: "end",
		});
	}, [messages]);

	// Clean up timers on unmount
	useEffect(() => {
		return () => {
			Object.values(typingTimers.current).forEach(clearTimeout);
			if (typingDebounce.current) clearTimeout(typingDebounce.current);
		};
	}, []);

	// Visibility change: clear unread badge when tab becomes visible
	useEffect(() => {
		const handleVisibility = () => {
			if (document.visibilityState === "visible") {
				setUnreadCount(0);
				document.title = "Chat!";
				previousExternalCountRef.current = 0;
			}
		};
		document.addEventListener("visibilitychange", handleVisibility);
		return () => document.removeEventListener("visibilitychange", handleVisibility);
	}, []);

	const socket = usePartySocket({
		party: "chat",
		room,
		onOpen() {
			// Announce our username for presence tracking (also re-sent on reconnect)
			socket.send(JSON.stringify({ type: "join", user: name } satisfies Message));
		},
		onMessage: (evt) => {
			const message = JSON.parse(evt.data as string) as Message;

			if (message.type === "add" || message.type === "update") {
				const newMsg: ChatMessage = {
					id: message.id,
					content: message.content,
					user: message.user,
					role: message.role,
					ts: message.ts ?? Date.now(),
				};
				setMessages((prev) => {
					const foundIndex = prev.findIndex((m) => m.id === message.id);
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
				// Auto-clear typing indicator after 2.5 s
				if (typingTimers.current[user]) clearTimeout(typingTimers.current[user]);
				typingTimers.current[user] = setTimeout(() => {
					setTypingUsers((prev) => prev.filter((u) => u !== user));
					delete typingTimers.current[user];
				}, 2500);
			} else if (message.type === "presence") {
				setOnlineUsers(message.users);
			} else if (message.type === "all") {
				// Seed full history on connect, including persisted system messages
				const history: DisplayMessage[] = [
					...message.messages.map((m) => ({ ...m, ts: m.ts || Date.now() })),
					...message.systemMessages.map((m) => ({ ...m })),
				];
				history.sort((a, b) => (a.ts || 0) - (b.ts || 0));
				setMessages(history);
				// Don't count history as unread notifications
				previousExternalCountRef.current = history.filter(
					(m) => isChatMessage(m) && m.user !== name,
				).length;
			} else if (message.type === "system") {
				const sysMsg: SystemMessage = {
					type: "system",
					id: message.id,
					content: message.content,
					ts: message.ts ?? Date.now(),
				};
				setMessages((prev) => [...prev, sysMsg]);
			}
		},
	});

	// Detect new chat messages from others while tab is hidden and trigger sound/badge
	useEffect(() => {
		if (document.visibilityState !== "hidden") {
			previousExternalCountRef.current = 0;
			return;
		}

		// Count only chat messages from other users
		const externalCount = messages.filter((m) => isChatMessage(m) && m.user !== name).length;
		const delta = externalCount - previousExternalCountRef.current;

		if (delta > 0) {
			setUnreadCount((prev) => {
				const next = prev + delta;
				document.title = `(${next}) Chat!`;
				return next;
			});
			for (let i = 0; i < delta; i++) {
				playNotificationSound();
			}
		}

		previousExternalCountRef.current = externalCount;
	}, [messages, name]);

	/** Send a typing notification, debounced to once every 2 s */
	const sendTyping = useCallback(() => {
		if (typingDebounce.current) return;
		socket.send(JSON.stringify({ type: "typing", user: name } satisfies Message));
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

	const typingLabel = useMemo(() => {
		const others = typingUsers.filter((u) => u !== name);
		if (others.length === 0) return null;
		if (others.length === 1) return `${others[0]} is typing…`;
		if (others.length === 2) return `${others[0]} and ${others[1]} are typing…`;
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
				if (isSystemMessage(message)) {
					return (
						<div
							key={message.id}
							className="system-message"
							role="listitem"
						>
							{message.content}
						</div>
					);
				}

				const prev = messages[i - 1];
				const isMine = message.user === name;
				const isContinuation = !!prev && isChatMessage(prev) && prev.user === message.user;
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
