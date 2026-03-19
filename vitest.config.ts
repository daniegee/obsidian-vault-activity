import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
	resolve: {
		alias: {
			obsidian: resolve(import.meta.dirname, "tests/mocks/mock.ts"),
		},
	},
	test: {
		environment: "node",
		include: ["tests/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "json-summary"],
			reportsDirectory: "coverage",
		},
	},
});
