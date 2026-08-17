export function uniqueOnlineUsers(users: Iterable<string | undefined>): string[] {
	return [
		...new Set(
			[...users].filter(
				(user): user is string => typeof user === "string" && user.length > 0,
			),
		),
	];
}

export function getConnectionUser(
	state: { user?: string } | null | undefined,
): string | null {
	return typeof state?.user === "string" && state.user.length > 0
		? state.user
		: null;
}
