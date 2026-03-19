import { beforeEach, describe, expect, it, vi } from "vitest";

const { fullScanMock, trackedMarkdownMock } = vi.hoisted(() => ({
	fullScanMock: vi.fn(),
	trackedMarkdownMock: vi.fn(),
}));

vi.mock("../src/indexer/vaultIndexer", () => ({
	VaultActivityIndexer: class {
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
	});

	it("coalesces concurrent refresh calls into a single scan and updates views", async () => {
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
		await Promise.all([first, second]);

		expect(fullScanMock).toHaveBeenCalledTimes(1);
		expect(plugin.saveData).toHaveBeenCalledTimes(1);
		expect(plugin.snapshots).toEqual(nextIndex.snapshots);
		expect(setIndexResult).toHaveBeenCalledTimes(1);
		expect(setIndexResult).toHaveBeenCalledWith(nextIndex);
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
});
