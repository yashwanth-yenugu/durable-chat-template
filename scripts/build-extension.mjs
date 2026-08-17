import { execFileSync } from "node:child_process";
import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const chatHost =
	process.env.CHAT_HOST ?? "durable-chat-template.templates.workers.dev";

function run(args) {
	execFileSync("esbuild", args, { cwd: root, stdio: "inherit" });
}

const define = `--define:__CHAT_HOST__=${JSON.stringify(chatHost)}`;

run([
	"--platform=browser",
	"src/extension/panel.tsx",
	"--bundle",
	"--format=esm",
	"--loader:.css=css",
	"--outdir=extension/dist",
	define,
]);
run([
	"--platform=browser",
	"src/extension/content.ts",
	"--bundle",
	"--format=iife",
	"--outfile=extension/dist/content.js",
	define,
]);

copyFileSync(
	join(root, "src/extension/panel.html"),
	join(root, "extension/dist/panel.html"),
);
copyFileSync(
	join(root, "src/extension/content.css"),
	join(root, "extension/dist/content.css"),
);

console.log(`Extension built (CHAT_HOST=${chatHost})`);
