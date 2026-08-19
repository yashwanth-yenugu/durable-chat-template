/**
 * Chrome MV3 `manifest.version` must be 1–4 integer parts, each 0–65535,
 * not all zeros, and no leading zeros (except a lone 0). GitHub tags like
 * `v1.2.3` are accepted; git SHAs are not.
 *
 * Used by the store/sideload packager only — not imported by the extension
 * runtime bundle.
 */
export function chromeExtensionVersion(
	raw: string | undefined,
	fallback = "1.0.0",
): string {
	if (!raw || !raw.trim()) {
		return fallback;
	}
	const stripped = raw.trim().replace(/^v/i, "");
	const parts = stripped.split(".");
	if (parts.length > 4) {
		throw invalidVersion(raw);
	}
	const nums: number[] = [];
	for (const part of parts) {
		if (!/^(0|[1-9]\d{0,4})$/.test(part)) {
			throw invalidVersion(raw);
		}
		const n = Number(part);
		if (n > 65535) {
			throw invalidVersion(raw);
		}
		nums.push(n);
	}
	if (nums.every((n) => n === 0)) {
		throw invalidVersion(raw);
	}
	return stripped;
}

function invalidVersion(raw: string): Error {
	return new Error(
		`Invalid Chrome extension version "${raw}". Use 1–4 numeric parts (e.g. 1.0.0 or v1.2.3).`,
	);
}

export function loadUnpackedInstructions(options: {
	chatHost: string;
	version: string;
}): string {
	const { chatHost, version } = options;
	return `Page Chat ${version} — try in Chrome (developer mode)
=====================================================

This folder is a ready-to-load Manifest V3 extension. Chrome cannot load
the .zip file itself — unzip first, then Load unpacked.

1. Unzip the downloaded ZIP (you may already be reading this from the unzipped folder).
2. Open chrome://extensions
3. Turn on Developer mode (top right).
4. Click Load unpacked and select this folder (it contains manifest.json).
5. Visit any http:// or https:// page and click the floating chat button.

Backend host baked into this build: ${chatHost}

Do not load the .zip in chrome://extensions. If chat does not connect, confirm
you selected the unzipped directory that contains manifest.json, dist/, and icons/.
`;
}
