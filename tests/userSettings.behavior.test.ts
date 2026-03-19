import { beforeEach, describe, expect, it, vi } from "vitest";

import VaultActivityPlugin from "../src/main";
import {
	applyFilters,
	sanitiseFolderFilters,
} from "../src/indexer/common/folderFilters";
import { evaluateNoteActivity } from "../src/indexer/noteActivityEvaluator";
import { parseNoteContent } from "../src/indexer/noteContentParser";
import { DEFAULT_SETTINGS } from "../src/settings";
import type {
	ActivityRecord,
	FilterState,
	VaultActivityPluginSettings,
} from "../src/types";
function note(path: string, day: string, folder: string): ActivityRecord {
	return {
		path,
		title: path.split("/").pop()!.replace(/\.md$/, ""),
		folder,
		tags: [],
		effectiveMtime: new Date(`${day}T12:00:00`).getTime(),
		lastModifiedPropertyMtime: null,
		lastContentEditMtime: new Date(`${day}T12:00:00`).getTime(),
		lastPropertyEditMtime: null,
		signal: "body-edit",
	};
}

function filters(overrides: Partial<FilterState> = {}): FilterState {
	return {
		includeFolders: [],
		excludeFolders: [],
		streakCalculationMode: "new-and-modified",
		trendWindow: "monthly",
		trendMetric: "new-notes",
		selectedDay: null,
		...overrides,
	};
}

function createPluginHarness(
	settingsOverrides: Partial<VaultActivityPluginSettings> = {},
): VaultActivityPlugin {
	const plugin = Object.create(
		VaultActivityPlugin.prototype,
	) as VaultActivityPlugin & {
		settings: VaultActivityPluginSettings;
		snapshots: Record<string, unknown>;
		refreshIndex: (reason: string) => Promise<void>;
	};

	plugin.settings = {
		...DEFAULT_SETTINGS,
		...settingsOverrides,
	};
	plugin.snapshots = {};
	(
		plugin as unknown as {
			refreshTimer: ReturnType<typeof globalThis.setTimeout> | null;
		}
	).refreshTimer = null;
	plugin.refreshIndex = vi.fn().mockResolvedValue(undefined);

	return plugin;
}

describe("user settings behavior", () => {
	beforeEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("[Test-101] uses default settings", () => {
		expect(DEFAULT_SETTINGS).toEqual({
			dashboardIncludeFolders: [],
			dashboardExcludeFolders: ["Templates"],
			streakCalculationMode: "new-and-modified",
			createdDateProperty: "Date",
			modifiedDateProperty: "Last modified",
			autoRefresh: true,
			refreshDebounceMs: 400,
		});
	});

	it("[Test-102] normalizes folder settings", () => {
		const normalized = sanitiseFolderFilters(
			" /Projects/ ,\nDaily/\n\n,  /Area/Ideas/ ",
		);
		expect(normalized).toEqual(["Projects", "Daily", "Area/Ideas"]);
	});

	it("[Test-103] keeps include folder priority over exclude", () => {
		const scoped = applyFilters(
			[note("Projects/A.md", "2026-03-10", "Projects")],
			filters({
				includeFolders: ["Projects"],
				excludeFolders: ["Projects"],
			}),
		);

		expect(scoped).toHaveLength(1);
	});

	it("[Test-104] uses configured created and modified date properties", () => {
		const created = evaluateNoteActivity(
			"Projects/Test.md",
			"---\ncreated_at: 2024-05-03\n---\nBody",
			5000,
			1000,
			undefined,
			{
				createdDateProperty: "created_at",
				modifiedDateProperty: "updated_at",
			},
		);

		const modified = parseNoteContent(
			"---\nupdated_at: '2026-03-14'\n---\nBody",
			{
				createdDateProperty: "created_at",
				modifiedDateProperty: "updated_at",
			},
		);

		expect(created.snapshot.lastMeaningfulMtime).toBe(
			new Date(2024, 4, 3).getTime(),
		);
		expect(modified.lastModifiedDateMs).toBe(
			new Date(2026, 2, 14).getTime(),
		);
	});

	it("[Test-105] respects auto-refresh and debounce settings", () => {
		vi.useFakeTimers();

		const disabled = createPluginHarness({
			autoRefresh: false,
			refreshDebounceMs: 40,
		}) as VaultActivityPlugin & {
			refreshIndex: ReturnType<typeof vi.fn>;
		};
		disabled.scheduleRefresh("modify");
		vi.advanceTimersByTime(100);
		expect(disabled.refreshIndex).not.toHaveBeenCalled();

		const enabled = createPluginHarness({
			autoRefresh: true,
			refreshDebounceMs: 50,
		}) as VaultActivityPlugin & {
			refreshIndex: ReturnType<typeof vi.fn>;
		};
		enabled.scheduleRefresh("modify");
		enabled.scheduleRefresh("rename");
		vi.advanceTimersByTime(50);

		expect(enabled.refreshIndex).toHaveBeenCalledTimes(1);
		expect(enabled.refreshIndex).toHaveBeenCalledWith("rename");
	});
});
