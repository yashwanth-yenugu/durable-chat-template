/**
 * Chrome MV3 `manifest.version` must be 1–4 numeric parts (each 0–65535).
 * GitHub tags like `v1.2.3` are accepted; git SHAs are not.
 */
export function chromeExtensionVersion(
	raw: string | undefined,
	fallback = "1.0.0",
): string {
	if (!raw || !raw.trim()) {
		return fallback;
	}
	const stripped = raw.trim().replace(/^v/i, "");
	if (!/^\d{1,5}(\.\d{1,5}){0,3}$/.test(stripped)) {
		throw new Error(
			`Invalid Chrome extension version "${raw}". Use 1–4 numeric parts (e.g. 1.0.0 or v1.2.3).`,
		);
	}
	return stripped;
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

1. Unzip page-chat-extension.zip (you may already be reading this from the unzipped folder).
2. Open chrome://extensions
3. Turn on Developer mode (top right).
4. Click Load unpacked and select this folder (it contains manifest.json).
5. Visit any http:// or https:// page and click the floating chat button.

Backend host baked into this build: ${chatHost}

Do not load the .zip in chrome://extensions. If chat does not connect, confirm
you selected the unzipped directory that contains manifest.json, dist/, and icons/.
`;
}
