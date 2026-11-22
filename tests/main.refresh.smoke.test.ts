import { beforeEach, describe, expect, it, vi } from "vitest";

const { fullScanMock, trackedMarkdownMock, indexerArgsMock } = vi.hoisted(
	() => ({
		fullScanMock: vi.fn(),
		trackedMarkdownMock: vi.fn(),
		indexerArgsMock: vi.fn(),
	}),
);

vi.mock("../src/indexer/vaultIndexer", async (importOriginal) => ({
	...(await importOriginal<object>()),
	VaultActivityIndexer: class {
		constructor(...args: unknown[]) {
			indexerArgsMock(...args);
		}
		async fullScan() {
			return await fullScanMock();
		}
	},
	filterByTrackedMarkdown: (file: unknown) => trackedMarkdownMock(file),
}));

import VaultActivityPlugin from "../src/main";
import { DEFAULT_SETTINGS } from "../src/settings";

describe("main refresh orchestration smoke", () => {
	beforeEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		fullScanMock.mockReset();
		trackedMarkdownMock.mockReset();
		indexerArgsMock.mockReset();
	});

	it("rescans once when refreshes arrive mid-scan, then saves and updates views once", async () => {
		const plugin = Object.create(
			VaultActivityPlugin.prototype,
		) as VaultActivityPlugin & {
			saveData: ReturnType<typeof vi.fn>;
			app: {
				vault: object;
				workspace: {
					detachLeavesOfType: (type: string) => void;
				};
			};
		};

		const nextIndex = {
			notes: [],
			snapshots: {
				"Projects/A.md": {
					path: "Projects/A.md",
				},
			},
			folders: ["Projects"],
			generatedAt: 123,
		};

		plugin.settings = { ...DEFAULT_SETTINGS };
		plugin.snapshots = {};
		(plugin as any).views = new Set();
		(plugin as any).latestIndex = null;
		(plugin as any).refreshInFlight = null;
		(plugin as any).pendingRenames = [];
		(plugin as any).deletedDuringScan = [];
		plugin.saveData = vi.fn().mockResolvedValue(undefined);
		plugin.app = {
			vault: {},
			workspace: {
				detachLeavesOfType: () => undefined,
			},
		} as any;

		const setIndexResult = vi.fn();
		plugin.registerDashboardView({ setIndexResult } as any);

		fullScanMock.mockResolvedValue(nextIndex);

		const first = plugin.refreshIndex("command", true);
		const second = plugin.refreshIndex("modify", true);
		const third = plugin.refreshIndex("modify", true);
		await Promise.all([first, second, third]);

		// The second and third requests land mid-scan and share one follow-up scan.
		expect(fullScanMock).toHaveBeenCalledTimes(2);
		expect(plugin.saveData).toHaveBeenCalledTimes(1);
		expect(plugin.snapshots).toEqual(nextIndex.snapshots);
		expect(setIndexResult).toHaveBeenCalledTimes(1);
		expect(setIndexResult).toHaveBeenCalledWith(nextIndex);
	});

	it("does not restore a note deleted while a scan is running", async () => {
		const plugin = Object.create(
			VaultActivityPlugin.prototype,
		) as VaultActivityPlugin;
		plugin.settings = { ...DEFAULT_SETTINGS };
		plugin.snapshots = {};
		(plugin as any).views = new Set();
		(plugin as any).refreshInFlight = null;
		(plugin as any).pendingRenames = [];
		(plugin as any).deletedDuringScan = [];
		(plugin as any).scheduleRefresh = vi.fn();
		(plugin as any).saveData = vi.fn().mockResolvedValue(undefined);
		(plugin as any).app = { vault: {} };
		const changes = plugin as unknown as {
			handleVaultChange: (reason: string, file: unknown) => void;
		};

		const scanResult = () => ({
			snapshots: {
				"X.md": { path: "X.md" },
				"Y.md": { path: "Y.md" },
			},
			notes: [],
			folders: [],
			generatedAt: 1,
		});
		fullScanMock
			.mockImplementationOnce(async () => {
				// refreshInFlight is only assigned after fullScan's first synchronous run.
				await Promise.resolve();
				changes.handleVaultChange("delete", {
					path: "X.md",
					extension: "md",
				});
				return scanResult();
			})
			.mockImplementation(async () => scanResult());

		await plugin.refreshIndex("command", true);

		expect(plugin.snapshots["X.md"]).toBeUndefined();
		expect(plugin.snapshots["Y.md"]).toBeDefined();

		// A delete with no scan in flight is not remembered.
		changes.handleVaultChange("delete", { path: "Y.md" });
		expect((plugin as any).deletedDuringScan).toEqual([]);
	});

	it("removes deleted markdown snapshots and schedules immediate refresh", () => {
		vi.useFakeTimers();

		const plugin = Object.create(
			VaultActivityPlugin.prototype,
		) as VaultActivityPlugin & {
			refreshIndex: ReturnType<typeof vi.fn>;
		};

		plugin.settings = {
			...DEFAULT_SETTINGS,
			autoRefresh: true,
			refreshDebounceMs: 100,
		};
		plugin.snapshots = {
			"Projects/Old.md": {
				path: "Projects/Old.md",
			} as any,
		};
		plugin.refreshIndex = vi.fn().mockResolvedValue(undefined);

		trackedMarkdownMock.mockReturnValue(true);

		(
			plugin as unknown as {
				handleVaultChange: (reason: string, file: unknown) => void;
			}
		).handleVaultChange("delete", {
			path: "Projects/Old.md",
			extension: "md",
		});

		expect(plugin.snapshots["Projects/Old.md"]).toBeUndefined();
		vi.runOnlyPendingTimers();
		expect(plugin.refreshIndex).toHaveBeenCalledWith("delete");
	});

	it("applies queued renames before scanning and re-reads all files only when date properties change", async () => {
		const plugin = Object.create(
			VaultActivityPlugin.prototype,
		) as VaultActivityPlugin;
		const history = [new Date("2026-03-10T12:00:00").getTime()];

		plugin.settings = { ...DEFAULT_SETTINGS };
		plugin.snapshots = {
			"Old/A.md": { editHistory: history } as any,
		};
		(plugin as any).views = new Set();
		(plugin as any).refreshInFlight = null;
		(plugin as any).pendingRenames = [["Old", "New"]];
		(plugin as any).deletedDuringScan = [];
		(plugin as any).saveData = vi.fn().mockResolvedValue(undefined);
		(plugin as any).app = { vault: {} };
		fullScanMock.mockImplementation(async () => ({
			notes: [],
			snapshots: indexerArgsMock.mock.lastCall![2],
			folders: [],
			generatedAt: 1,
		}));

		await plugin.refreshIndex("rename", true);

		const [, , snapshotsSeen, reuseFirst] = indexerArgsMock.mock.calls[0]!;
		expect(snapshotsSeen["Old/A.md"]).toBeUndefined();
		expect(snapshotsSeen["New/A.md"]).toMatchObject({
			editHistory: history,
		});
		expect(reuseFirst).toBe(false);

		await plugin.refreshIndex("modify", true);
		expect(indexerArgsMock.mock.calls[1]![3]).toBe(true);

		plugin.settings = {
			...plugin.settings,
			modifiedDateProperty: "updated",
		};
		await plugin.refreshIndex("settings", true);
		expect(indexerArgsMock.mock.calls[2]![3]).toBe(false);
	});

	it("removes every snapshot under a deleted folder and refreshes immediately", () => {
		vi.useFakeTimers();
		const plugin = Object.create(
			VaultActivityPlugin.prototype,
		) as VaultActivityPlugin & { refreshIndex: ReturnType<typeof vi.fn> };
		plugin.settings = { ...DEFAULT_SETTINGS, autoRefresh: false };
		plugin.snapshots = {
			"Archive/A.md": { path: "Archive/A.md" } as any,
			"Archive/Deep/B.md": { path: "Archive/Deep/B.md" } as any,
			"Archive2/C.md": { path: "Archive2/C.md" } as any,
		};
		plugin.refreshIndex = vi.fn().mockResolvedValue(undefined);

		(
			plugin as unknown as {
				handleVaultChange: (reason: string, file: unknown) => void;
			}
		).handleVaultChange("delete", { path: "Archive" });

		expect(Object.keys(plugin.snapshots)).toEqual(["Archive2/C.md"]);
		vi.runOnlyPendingTimers();
		expect(plugin.refreshIndex).toHaveBeenCalledWith("delete");
	});
});
