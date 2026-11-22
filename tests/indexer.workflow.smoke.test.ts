import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "../src/settings";
import {
	VaultActivityIndexer,
	applyRenames,
	filterByTrackedMarkdown,
	removeSnapshots,
} from "../src/indexer/vaultIndexer";

function fakeVault(
	files: Array<{ path: string; mtime: number }>,
	contentByPath: Record<string, string>,
) {
	const read = vi.fn(
		async (file: { path: string }) => contentByPath[file.path] ?? "",
	);
	return {
		read,
		getMarkdownFiles: () =>
			files.map(({ path, mtime }) => ({
				path,
				extension: "md",
				stat: {
					mtime,
					ctime: 1000,
					size: (contentByPath[path] ?? "").length,
				},
			})),
	};
}

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
		expect(result.notes[0]!.effectiveMtime).toBeGreaterThanOrEqual(
			result.notes[1]!.effectiveMtime,
		);
		expect(result.folders).toEqual(["Daily", "Projects"]);
		expect(
			Object.keys(result.snapshots).sort((left, right) =>
				left.localeCompare(right),
			),
		).toEqual(["Daily/2026-03-11.md", "Projects/Alpha.md"]);
		expect(result.generatedAt).toBeTypeOf("number");
		// Only what can't be rebuilt from the vault is written to data.json.
		expect(
			Object.keys(result.snapshots["Projects/Alpha.md"]!).sort(),
		).toEqual([
			"bodyHash",
			"contentHash",
			"createdMtime",
			"editHistory",
			"fileMtime",
			"fileSize",
			"lastModifiedPropertyMtime",
		]);
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

	it("skips reading files whose mtime is unchanged when reuse is enabled", async () => {
		const vault = fakeVault([{ path: "A.md", mtime: 5000 }], {
			"A.md": "# A\n\nBody",
		});
		const first = await new VaultActivityIndexer(
			vault as any,
			DEFAULT_SETTINGS,
			{},
			true,
		).fullScan();
		expect(vault.read).toHaveBeenCalledTimes(1);
		expect(first.snapshots["A.md"]!.fileMtime).toBe(5000);

		await new VaultActivityIndexer(
			vault as any,
			DEFAULT_SETTINGS,
			first.snapshots,
			true,
		).fullScan();
		expect(vault.read).toHaveBeenCalledTimes(1);

		await new VaultActivityIndexer(
			vault as any,
			DEFAULT_SETTINGS,
			first.snapshots,
			false,
		).fullScan();
		expect(vault.read).toHaveBeenCalledTimes(2);
	});

	it("re-reads a file whose size changed even though its mtime did not", async () => {
		const first = await new VaultActivityIndexer(
			fakeVault([{ path: "A.md", mtime: 5000 }], { "A.md": "Body" }) as any,
			DEFAULT_SETTINGS,
			{},
			true,
		).fullScan();
		const vault = fakeVault([{ path: "A.md", mtime: 5000 }], {
			"A.md": "Body v2",
		});
		const second = await new VaultActivityIndexer(
			vault as any,
			DEFAULT_SETTINGS,
			first.snapshots,
			true,
		).fullScan();
		expect(vault.read).toHaveBeenCalledTimes(1);
		expect(second.snapshots["A.md"]!.bodyHash).not.toBe(
			first.snapshots["A.md"]!.bodyHash,
		);
	});

	it("keeps history for a note renamed while Obsidian was closed", async () => {
		const content = "# Note\n\nSame body";
		const before = await new VaultActivityIndexer(
			fakeVault([{ path: "Old.md", mtime: 5000 }], {
				"Old.md": content,
			}) as any,
			DEFAULT_SETTINGS,
			{},
		).fullScan();
		const history = [new Date("2026-03-10T12:00:00").getTime()];
		before.snapshots["Old.md"]!.editHistory = history;

		const after = await new VaultActivityIndexer(
			fakeVault([{ path: "Moved/New.md", mtime: 5000 }], {
				"Moved/New.md": content,
			}) as any,
			DEFAULT_SETTINGS,
			before.snapshots,
			true,
		).fullScan();

		expect(after.snapshots["Old.md"]).toBeUndefined();
		expect(after.notes[0]!.folder).toBe("Moved");
		expect(after.snapshots["Moved/New.md"]).toMatchObject({
			editHistory: history,
			createdMtime: before.snapshots["Old.md"]!.createdMtime,
		});
		// The rename itself is not recorded as an edit.
		expect(after.notes[0]!.effectiveMtime).toBe(history[0]);
	});

	it("moves renamed file snapshots without touching similarly named paths", () => {
		const moved = { editHistory: [1] };
		const snapshots: Record<string, any> = {
			"Inbox/A.md": moved,
			"Inbox/A.md.bak/B.md": {},
		};

		applyRenames(snapshots, [["Inbox/A.md", "Projects/Renamed.md"]]);

		expect(Object.keys(snapshots).sort()).toEqual([
			"Inbox/A.md.bak/B.md",
			"Projects/Renamed.md",
		]);
		expect(snapshots["Projects/Renamed.md"]).toBe(moved);
	});

	it("keeps snapshots for out-of-scope notes without reading or listing them", async () => {
		const files = [
			{ path: "Projects/A.md", mtime: 5000 },
			{ path: "Templates/T.md", mtime: 5000 },
			{ path: "Root.md", mtime: 5000 },
		];
		const kept = { editHistory: [1] } as any;
		const previous = { "Templates/T.md": kept };

		const excludedVault = fakeVault(files, {});
		const excluded = await new VaultActivityIndexer(
			excludedVault as any,
			{ ...DEFAULT_SETTINGS, dashboardExcludeFolders: ["Templates"] },
			previous,
		).fullScan();
		expect(excluded.snapshots["Templates/T.md"]).toBe(kept);
		expect(excluded.notes.map((note) => note.path).sort()).toEqual([
			"Projects/A.md",
			"Root.md",
		]);
		expect(excludedVault.read).toHaveBeenCalledTimes(2);

		const vault = fakeVault(files, {});
		const included = await new VaultActivityIndexer(
			vault as any,
			{ ...DEFAULT_SETTINGS, dashboardIncludeFolders: ["Projects"] },
			previous,
		).fullScan();
		// Root.md has no snapshot yet and is out of scope, so nothing is stored for it.
		expect(Object.keys(included.snapshots).sort()).toEqual([
			"Projects/A.md",
			"Templates/T.md",
		]);
		expect(included.notes.map((note) => note.path)).toEqual([
			"Projects/A.md",
		]);
		expect(included.folders).toEqual(["Projects"]);
		expect(vault.read).toHaveBeenCalledTimes(1);
	});

	it("keeps edit history while a narrow include filter is typed and cleared", async () => {
		const files = [
			{ path: "Projects/A.md", mtime: 5000 },
			{ path: "Notes/B.md", mtime: 5000 },
		];
		const contents = {
			"Projects/A.md": "# A\n\nBody A",
			"Notes/B.md": "# B\n\nBody B",
		};
		const first = await new VaultActivityIndexer(
			fakeVault(files, contents) as any,
			DEFAULT_SETTINGS,
			{},
		).fullScan();
		const history = [new Date("2026-03-10T12:00:00").getTime()];
		first.snapshots["Notes/B.md"]!.editHistory = history;
		const createdMtime = first.snapshots["Notes/B.md"]!.createdMtime;

		// Typing "P" on the way to "Projects".
		const narrowed = await new VaultActivityIndexer(
			fakeVault(files, contents) as any,
			{ ...DEFAULT_SETTINGS, dashboardIncludeFolders: ["P"] },
			first.snapshots,
			true,
		).fullScan();
		expect(narrowed.notes).toHaveLength(0);

		// Renames and deletes still apply to out-of-scope snapshots.
		applyRenames(narrowed.snapshots, [["Notes/B.md", "Notes/C.md"]]);
		removeSnapshots(narrowed.snapshots, "Projects/A.md");
		const renamedFiles = [
			{ path: "Projects/A.md", mtime: 5000 },
			{ path: "Notes/C.md", mtime: 5000 },
		];

		const cleared = await new VaultActivityIndexer(
			fakeVault(renamedFiles, {
				"Projects/A.md": contents["Projects/A.md"],
				"Notes/C.md": contents["Notes/B.md"],
			}) as any,
			DEFAULT_SETTINGS,
			narrowed.snapshots,
			true,
		).fullScan();
		expect(cleared.snapshots["Notes/C.md"]).toMatchObject({
			editHistory: history,
			createdMtime,
		});
		expect(cleared.snapshots["Notes/B.md"]).toBeUndefined();
		// The deleted snapshot is gone, so A comes back as a brand-new note.
		expect(cleared.snapshots["Projects/A.md"]!.editHistory).not.toBe(
			first.snapshots["Projects/A.md"]!.editHistory,
		);
	});

	it("keeps history when a note is renamed while the scan is running", async () => {
		const content = "# Z\n\nBody";
		const first = await new VaultActivityIndexer(
			fakeVault([{ path: "Z.md", mtime: 5000 }], {
				"Z.md": content,
			}) as any,
			DEFAULT_SETTINGS,
			{},
		).fullScan();
		first.snapshots["Z.md"]!.editHistory = [7];

		const files = ["A.md", "Z.md"].map((path) => ({
			path,
			extension: "md",
			stat: { mtime: 5000, ctime: 1000 },
		}));
		const vault = {
			getMarkdownFiles: () => files,
			read: async (file: { path: string }) => {
				if (file.path === "A.md") {
					// The user renames Z.md after it was listed but before it is read.
					files[1]!.path = "B.md";
				}
				return content;
			},
		};
		const result = await new VaultActivityIndexer(
			vault as any,
			DEFAULT_SETTINGS,
			first.snapshots,
		).fullScan();

		expect(result.snapshots["Z.md"]!.editHistory).toEqual([7]);
		expect(result.snapshots["B.md"]).toBeUndefined();
		applyRenames(result.snapshots, [["Z.md", "B.md"]]);
		expect(result.snapshots["B.md"]!.editHistory).toEqual([7]);
	});

	it("never lets an out-of-scope note be adopted as a renamed note", async () => {
		const content = "# Same\n\nSame body";
		const before = await new VaultActivityIndexer(
			fakeVault([{ path: "Old.md", mtime: 5000 }], {
				"Old.md": content,
			}) as any,
			DEFAULT_SETTINGS,
			{},
		).fullScan();
		const base = before.snapshots["Old.md"]!;
		const outOfScope = { ...base, editHistory: [9] };
		const orphan = { ...base, editHistory: [1, 2, 3] };

		const after = await new VaultActivityIndexer(
			fakeVault(
				[
					{ path: "Templates/T.md", mtime: 5000 },
					{ path: "New.md", mtime: 5000 },
				],
				{ "Templates/T.md": content, "New.md": content },
			) as any,
			{ ...DEFAULT_SETTINGS, dashboardExcludeFolders: ["Templates"] },
			// Out-of-scope first: if it were treated as an orphan it would win the hash match.
			{ "Templates/T.md": outOfScope, "Old.md": orphan },
		).fullScan();

		expect(after.snapshots["Templates/T.md"]).toBe(outOfScope);
		expect(after.snapshots["New.md"]!.editHistory).toEqual([1, 2, 3]);
		expect(after.snapshots["Old.md"]).toBeUndefined();
	});

	it("does not adopt an orphan whose content matches but whose mtime differs", async () => {
		const before = await new VaultActivityIndexer(
			fakeVault([{ path: "Untitled.md", mtime: 5000 }], {}) as any,
			DEFAULT_SETTINGS,
			{},
		).fullScan();
		const orphan = { ...before.snapshots["Untitled.md"]!, editHistory: [1] };

		const after = await new VaultActivityIndexer(
			fakeVault([{ path: "Untitled 1.md", mtime: 9000 }], {}) as any,
			DEFAULT_SETTINGS,
			{ "Untitled.md": orphan },
		).fullScan();

		expect(after.snapshots["Untitled 1.md"]!.editHistory).toEqual([]);
	});

	it("lets a note moved into an excluded folder while closed keep its history", async () => {
		const content = "# Same\n\nSame body";
		const before = await new VaultActivityIndexer(
			fakeVault([{ path: "Projects/a.md", mtime: 5000 }], {
				"Projects/a.md": content,
			}) as any,
			DEFAULT_SETTINGS,
			{},
		).fullScan();
		const orphan = {
			...before.snapshots["Projects/a.md"]!,
			editHistory: [1, 2],
		};

		const after = await new VaultActivityIndexer(
			fakeVault([{ path: "Templates/a.md", mtime: 5000 }], {
				"Templates/a.md": content,
			}) as any,
			{ ...DEFAULT_SETTINGS, dashboardExcludeFolders: ["Templates"] },
			{ "Projects/a.md": orphan },
		).fullScan();

		expect(after.snapshots["Templates/a.md"]!.editHistory).toEqual([1, 2]);
		expect(after.notes).toEqual([]);
		expect(after.snapshots["Projects/a.md"]).toBeUndefined();
	});

	it("seeds each note's modified property as one edit on a fresh install", async () => {
		const content = "---\nLast modified: 2026-03-10\n---\nBody";
		const result = await new VaultActivityIndexer(
			fakeVault([{ path: "a.md", mtime: 5000 }], { "a.md": content }) as any,
			DEFAULT_SETTINGS,
			{},
		).fullScan();

		expect(result.snapshots["a.md"]!.editHistory).toEqual([
			new Date(2026, 2, 10).getTime(),
		]);
	});

	it("does not seed notes created after the first index", async () => {
		const content = "---\nLast modified: 2026-03-10\n---\nBody";
		const other = (
			await new VaultActivityIndexer(
				fakeVault([{ path: "b.md", mtime: 7000 }], { "b.md": "Other" }) as any,
				DEFAULT_SETTINGS,
				{},
			).fullScan()
		).snapshots["b.md"]!;
		const result = await new VaultActivityIndexer(
			fakeVault(
				[
					{ path: "a.md", mtime: 5000 },
					{ path: "b.md", mtime: 7000 },
				],
				{ "a.md": content, "b.md": "Other" },
			) as any,
			DEFAULT_SETTINGS,
			{ "b.md": other },
		).fullScan();

		expect(result.snapshots["a.md"]!.editHistory).toEqual([]);
	});
});
