import { describe, expect, it } from "vitest";

import { roomIdFromLocation } from "./roomId";

describe("roomIdFromLocation", () => {
	it("uses hostname only for root paths", () => {
		expect(
			roomIdFromLocation({ hostname: "github.com", pathname: "/" }),
		).toBe("github.com");
		expect(
			roomIdFromLocation({ hostname: "github.com", pathname: "" }),
		).toBe("github.com");
	});

	it("includes pathname for nested routes", () => {
		expect(
			roomIdFromLocation({
				hostname: "github.com",
				pathname: "/user/repo",
			}),
		).toBe("github.com/user/repo");
	});

	it("strips trailing slashes from pathname", () => {
		expect(
			roomIdFromLocation({
				hostname: "example.com",
				pathname: "/docs/guide/",
			}),
		).toBe("example.com/docs/guide");
	});
});
