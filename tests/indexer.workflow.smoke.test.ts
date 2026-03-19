import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../src/settings";
import {
	VaultActivityIndexer,
	filterByTrackedMarkdown,
} from "../src/indexer/vaultIndexer";

describe("vault indexer workflow smoke", () => {
	it("scans markdown files, produces sorted notes and snapshots, and tracks folders", async () => {
		const files = [
			{
				path: "Projects/Alpha.md",
				extension: "md",
				stat: {
					mtime: new Date("2026-03-12T10:00:00").getTime(),
					ctime: new Date("2026-03-01T09:00:00").getTime(),
				},
			},
			{
				path: "Daily/2026-03-11.md",
				extension: "md",
				stat: {
					mtime: new Date("2026-03-11T22:00:00").getTime(),
					ctime: new Date("2026-03-11T08:00:00").getTime(),
				},
			},
		];

		const contentByPath: Record<string, string> = {
			"Projects/Alpha.md": "# Alpha\n\nBody text with #tag.",
			"Daily/2026-03-11.md": "# Daily\n\n- reviewed notes",
		};

		const vault = {
			getMarkdownFiles: () => files,
			read: async (file: { path: string }) =>
				contentByPath[file.path] ?? "",
		};

		const indexer = new VaultActivityIndexer(
			vault as any,
			DEFAULT_SETTINGS,
			{},
		);
		const result = await indexer.fullScan();

		expect(result.notes).toHaveLength(2);
		expect(result.notes[0].effectiveMtime).toBeGreaterThanOrEqual(
			result.notes[1].effectiveMtime,
		);
		expect(result.folders).toEqual(["Daily", "Projects"]);
		expect(
			Object.keys(result.snapshots).sort((left, right) =>
				left.localeCompare(right),
			),
		).toEqual(["Daily/2026-03-11.md", "Projects/Alpha.md"]);
		expect(result.generatedAt).toBeTypeOf("number");
	});

	it("filters tracked markdown files by extension", () => {
		expect(
			filterByTrackedMarkdown({
				path: "Projects/Note.md",
				extension: "md",
			}),
		).toBe(true);
		expect(
			filterByTrackedMarkdown({
				path: "Projects/Note.txt",
				extension: "txt",
			}),
		).toBe(false);
		expect(filterByTrackedMarkdown(null)).toBe(false);
	});
});
