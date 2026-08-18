import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "jsdom",
		setupFiles: ["src/test/setup.ts"],
		include: ["src/**/*.test.{ts,tsx}"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"src/**/*.d.ts",
				"src/**/*.test.{ts,tsx}",
				"src/server/worker-configuration.d.ts",
				"src/extension/env.d.ts",
				"src/client/index.tsx",
				"src/extension/panel.tsx",
				"src/extension/content.ts",
				"src/extension/config.ts",
			],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 80,
				statements: 80,
			},
		},
	},
});
