import { execFileSync, execSync } from "node:child_process";
import {
	copyFileSync,
	cpSync,
	mkdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	chromeExtensionVersion,
	loadUnpackedInstructions,
} from "../src/extension/chromeExtensionVersion.ts";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const chatHost =
	process.env.CHAT_HOST ?? "durable-chat-template.templates.workers.dev";
const privacyUrl =
	process.env.PRIVACY_URL ?? `https://${chatHost}/privacy.html`;
const version = chromeExtensionVersion(process.env.EXTENSION_VERSION);
const outDir = join(root, "extension-release");
const define = `--define:__CHAT_HOST__=${JSON.stringify(chatHost)}`;

function runEsbuild(args) {
	execFileSync("esbuild", args, { cwd: root, stdio: "inherit" });
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, "dist"), { recursive: true });
mkdirSync(join(outDir, "icons"), { recursive: true });

runEsbuild([
	"--platform=browser",
	"src/extension/panel.tsx",
	"--bundle",
	"--format=esm",
	"--loader:.css=css",
	`--outdir=${outDir}/dist`,
	define,
]);
runEsbuild([
	"--platform=browser",
	"src/extension/content.ts",
	"--bundle",
	"--format=iife",
	`--outfile=${outDir}/dist/content.js`,
	define,
]);

copyFileSync(
	join(root, "src/extension/panel.html"),
	join(outDir, "dist/panel.html"),
);
copyFileSync(
	join(root, "src/extension/content.css"),
	join(outDir, "dist/content.css"),
);
cpSync(join(root, "extension/icons"), join(outDir, "icons"), { recursive: true });

const manifest = {
	manifest_version: 3,
	name: "Page Chat",
	version,
	description:
		"Chat with others on the same page. Each hostname + path is its own chat room.",
	permissions: ["storage"],
	host_permissions: ["<all_urls>", `https://${chatHost}/*`],
	icons: {
		16: "icons/icon16.png",
		48: "icons/icon48.png",
		128: "icons/icon128.png",
	},
	content_scripts: [
		{
			matches: ["http://*/*", "https://*/*"],
			js: ["dist/content.js"],
			css: ["dist/content.css"],
			run_at: "document_idle",
		},
	],
	web_accessible_resources: [
		{
			resources: ["dist/panel.html", "dist/panel.js", "dist/panel.css"],
			matches: ["<all_urls>"],
		},
	],
	action: {
		default_title: "Page Chat",
		default_icon: {
			16: "icons/icon16.png",
			48: "icons/icon48.png",
			128: "icons/icon128.png",
		},
	},
	homepage_url: `https://${chatHost}/`,
};

writeFileSync(
	join(outDir, "manifest.json"),
	`${JSON.stringify(manifest, null, "\t")}\n`,
);
writeFileSync(
	join(outDir, "LOAD_UNPACKED.txt"),
	loadUnpackedInstructions({ chatHost, version }),
);

execSync(
	`zip -r ../page-chat-extension.zip manifest.json dist icons LOAD_UNPACKED.txt`,
	{
		cwd: outDir,
		stdio: "inherit",
	},
);

writeFileSync(
	join(outDir, "STORE_UPLOAD.txt"),
	`Page Chat — Chrome Web Store upload package
============================================

ZIP file: ${join(root, "page-chat-extension.zip")}
Version: ${version}
Backend host: ${chatHost}
Privacy policy URL (use in store listing): ${privacyUrl}

Upload page-chat-extension.zip at:
https://chrome.google.com/webstore/devconsole

See extension/STORE.md for the full publishing checklist.
`,
);

console.log("\nStore package ready:");
console.log(`  ZIP: ${join(root, "page-chat-extension.zip")}`);
console.log(`  Version: ${version}`);
console.log(`  Privacy policy URL: ${privacyUrl}`);
