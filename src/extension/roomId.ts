/** Build a chat room id from hostname + pathname (e.g. github.com/user/repo). */
export function roomIdFromLocation(
	loc: Pick<Location, "hostname" | "pathname">,
): string {
	const path = loc.pathname.replace(/\/+$/, "");
	if (!path || path === "/") return loc.hostname;
	return `${loc.hostname}${path}`;
}
