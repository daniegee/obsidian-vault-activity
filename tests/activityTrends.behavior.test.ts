import { describe, expect, it } from "vitest";

import { buildDashboardData } from "../src/indexer/aggregates";
import { evaluateNoteActivity } from "../src/indexer/noteActivityEvaluator";
import type { ActivityRecord, FilterState } from "../src/types";

function note(
	path: string,
	day: string,
	folder: string,
	signal: ActivityRecord["signal"] = "body-edit",
): ActivityRecord {
	return {
		path,
		title: path.split("/").pop()!.replace(/\.md$/, ""),
		folder,
		effectiveMtime: new Date(`${day}T12:00:00`).getTime(),
		signal,
		// Edited fixtures were created long before any dashboard window.
		createdMtime:
			signal === "note-created"
				? new Date(`${day}T12:00:00`).getTime()
				: 0,
		editHistory:
			signal === "note-created"
				? []
				: [new Date(`${day}T12:00:00`).getTime()],
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

describe("activity trends behavior", () => {
	it("[Test-301] dates an edit by a modified property bumped with it, else by file mtime", () => {
		const base = evaluateNoteActivity(
			"Body",
			1000,
			500,
			undefined,
		).snapshot;
		const mtime = new Date("2026-03-12T10:00:00").getTime();

		const byProperty = evaluateNoteActivity(
			"---\nLast modified: 2026-03-10\n---\nBody v2",
			mtime,
			500,
			base,
		).snapshot;
		const byMtime = evaluateNoteActivity(
			"Body v2",
			mtime,
			500,
			base,
		).snapshot;

		expect(byProperty.editHistory).toEqual([
			new Date(2026, 2, 10).getTime(),
		]);
		expect(byMtime.editHistory).toEqual([mtime]);
	});

	it("[Test-302] switches selected records when trend metric changes", () => {
		const notes = [
			note("Projects/New.md", "2026-03-10", "Projects", "note-created"),
			note("Projects/Refine.md", "2026-03-10", "Projects", "body-edit"),
		];

		const newMetric = buildDashboardData(
			notes,
			filters({ selectedDay: "2026-03-10", trendMetric: "new-notes" }),
		);
		const modifiedMetric = buildDashboardData(
			notes,
			filters({
				selectedDay: "2026-03-10",
				trendMetric: "modified-notes",
			}),
		);

		expect(newMetric.selectedDayNotes).toHaveLength(1);
		expect(newMetric.selectedDayNotes[0]!.signal).toBe("note-created");
		expect(modifiedMetric.selectedDayNotes).toHaveLength(1);
		expect(modifiedMetric.selectedDayNotes[0]!.signal).toBe("body-edit");
	});
});
