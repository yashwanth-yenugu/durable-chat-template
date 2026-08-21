import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatApp } from "./ChatApp";

const socket = {
	send: vi.fn(),
};

vi.mock("partysocket/react", () => ({
	usePartySocket: (options: {
		onOpen?: () => void;
		onMessage?: (event: { data: string }) => void;
	}) => {
		queueMicrotask(() => options.onOpen?.());
		(
			globalThis as { __chatSocket?: typeof socket & { onMessage?: (event: { data: string }) => void } }
		).__chatSocket = {
			...socket,
			onMessage: options.onMessage,
		};
		return socket;
	},
}));

vi.mock("./username", async () => {
	const actual = await vi.importActual<typeof import("./username")>("./username");
	return {
		...actual,
		getOrCreateUsername: vi.fn(async () => "Sachin"),
	};
});

describe("ChatApp", () => {
	afterEach(() => {
		cleanup();
	});

	beforeEach(() => {
		socket.send.mockReset();
	});

	it("renders the room subtitle and sends join on load", async () => {
		render(<ChatApp room="github.com/user/repo" title="Roomgist" />);

		expect(await screen.findByText("Roomgist")).toBeTruthy();
		expect(screen.getByText("github.com/user/repo")).toBeTruthy();
		await waitFor(() =>
			expect(socket.send).toHaveBeenCalledWith(
				JSON.stringify({ type: "join", user: "Sachin" }),
			),
		);
	});

	it("shows incoming messages from the socket", async () => {
		render(<ChatApp room="room-1" />);

		const onMessage = (
			globalThis as { __chatSocket?: { onMessage?: (event: { data: string }) => void } }
		).__chatSocket?.onMessage;

		onMessage?.({
			data: JSON.stringify({
				type: "add",
				id: "m1",
				user: "Virat",
				role: "user",
				content: "Hello team",
				ts: 1,
			}),
		});

		expect(await screen.findByText("Hello team")).toBeTruthy();
		expect(screen.getByText("Virat")).toBeTruthy();
	});

	it("sends a new message when the form is submitted", async () => {
		const user = userEvent.setup();
		render(<ChatApp room="room-1" />);
		await screen.findByRole("textbox");

		await user.type(screen.getByRole("textbox"), "New message");
		await user.click(screen.getByRole("button", { name: "Send message" }));

		expect(socket.send).toHaveBeenCalledWith(
			expect.stringContaining('"type":"add"'),
		);
		expect(socket.send).toHaveBeenCalledWith(
			expect.stringContaining('"content":"New message"'),
		);
	});
});
