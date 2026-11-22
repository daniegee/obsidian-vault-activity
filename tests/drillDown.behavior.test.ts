import { describe, expect, it } from "vitest";

import { buildDashboardData } from "../src/indexer/aggregates";
import type { ActivityRecord, FilterState } from "../src/types";
import { renderDrillDownPanel } from "../src/ui/components/DrillDownPanel";
import { MockElement } from "./mocks/dom";

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

describe("drill-down behavior", () => {
	it("[Test-401] uses daily buckets for weekly and monthly windows", () => {
		const created = note(
			"Projects/New.md",
			"2026-03-10",
			"Projects",
			"note-created",
		);

		const weekly = buildDashboardData(
			[created],
			filters({
				trendWindow: "weekly",
				trendMetric: "new-notes",
				selectedDay: "2026-03-10",
			}),
		);
		const monthly = buildDashboardData(
			[created],
			filters({
				trendWindow: "monthly",
				trendMetric: "new-notes",
				selectedDay: "2026-03-10",
			}),
		);

		expect(weekly.selectedDayNotes).toHaveLength(1);
		expect(monthly.selectedDayNotes).toHaveLength(1);
	});

	it("[Test-402] uses aggregated buckets for yearly and all-time windows", () => {
		const created = note(
			"Projects/New.md",
			"2026-03-10",
			"Projects",
			"note-created",
		);
		const modified = note(
			"Projects/Edit.md",
			"2026-03-11",
			"Projects",
			"body-edit",
		);

		const yearlyBase = buildDashboardData(
			[created, modified],
			filters({ trendWindow: "yearly", trendMetric: "modified-notes" }),
		);
		const yearlyAnchor = yearlyBase.trendWeeklyModifiedNotes.find(
			(point) => point.count > 0,
		)?.day;
		expect(yearlyAnchor).toBeTruthy();

		const yearlySelected = buildDashboardData(
			[created, modified],
			filters({
				trendWindow: "yearly",
				trendMetric: "modified-notes",
				selectedDay: yearlyAnchor ?? null,
			}),
		);
		expect(yearlySelected.selectedDayNotes.length).toBeGreaterThan(0);

		const allTimeBase = buildDashboardData(
			[created, modified],
			filters({ trendWindow: "all-time", trendMetric: "new-notes" }),
		);
		const allTimeAnchor = allTimeBase.trendMonthlyNewNotes[0]?.day;
		expect(allTimeAnchor).toBeTruthy();

		const allTimeSelected = buildDashboardData(
			[created, modified],
			filters({
				trendWindow: "all-time",
				trendMetric: "new-notes",
				selectedDay: allTimeAnchor ?? null,
			}),
		);
		expect(allTimeSelected.selectedDayNotes.length).toBeGreaterThan(0);
	});

	it("[Test-210] shows each listed note's tags from the lookup it is given", () => {
		const data = buildDashboardData(
			[note("Projects/New.md", "2026-03-10", "Projects", "note-created")],
			filters({ selectedDay: "2026-03-10" }),
		);
		const container = new MockElement("div");

		renderDrillDownPanel(container as unknown as HTMLElement, {
			data,
			onOpenNote: async () => {},
			getTags: (path) => (path === "Projects/New.md" ? ["#alpha"] : []),
		});

		expect(
			container
				.findByClass("vault-activity-note-tag")
				.map((tag) => tag.textContent),
		).toEqual(["#alpha"]);
	});
});
