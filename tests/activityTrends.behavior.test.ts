import { describe, expect, it } from "vitest";

import { buildDashboardData } from "../src/indexer/aggregates";
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
		tags: [],
		effectiveMtime: new Date(`${day}T12:00:00`).getTime(),
		lastModifiedPropertyMtime: null,
		lastContentEditMtime:
			signal === "note-created"
				? null
				: new Date(`${day}T12:00:00`).getTime(),
		lastPropertyEditMtime: null,
		signal,
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
	it("[Test-301] uses modified timestamp priority for trend projection", () => {
		const byProperty = note(
			"P.md",
			"2026-02-01",
			"Projects",
			"note-created",
		);
		byProperty.lastModifiedPropertyMtime = new Date(
			"2026-03-10T10:00:00",
		).getTime();
		byProperty.lastContentEditMtime = new Date(
			"2026-03-12T10:00:00",
		).getTime();
		byProperty.lastPropertyEditMtime = new Date(
			"2026-03-14T10:00:00",
		).getTime();

		const byContent = note(
			"C.md",
			"2026-02-01",
			"Projects",
			"note-created",
		);
		byContent.lastModifiedPropertyMtime = null;
		byContent.lastContentEditMtime = new Date(
			"2026-03-11T10:00:00",
		).getTime();
		byContent.lastPropertyEditMtime = new Date(
			"2026-03-14T10:00:00",
		).getTime();

		const byPropertyEdit = note(
			"E.md",
			"2026-02-01",
			"Projects",
			"note-created",
		);
		byPropertyEdit.lastModifiedPropertyMtime = null;
		byPropertyEdit.lastContentEditMtime = null;
		byPropertyEdit.lastPropertyEditMtime = new Date(
			"2026-03-13T10:00:00",
		).getTime();

		const data = buildDashboardData(
			[byProperty, byContent, byPropertyEdit],
			filters({ trendMetric: "modified-notes" }),
		);

		expect(
			data.dailyModifiedNotes.find((day) => day.day === "2026-03-10")
				?.count,
		).toBe(1);
		expect(
			data.dailyModifiedNotes.find((day) => day.day === "2026-03-11")
				?.count,
		).toBe(1);
		expect(
			data.dailyModifiedNotes.find((day) => day.day === "2026-03-13")
				?.count,
		).toBe(1);
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
