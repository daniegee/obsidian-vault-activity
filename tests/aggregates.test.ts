import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDashboardData } from "../src/indexer/aggregates";
import type { ActivityRecord, FilterState } from "../src/types";
import { addDays, startOfDay, toDateKey } from "../src/utils/date";

function note(
	path: string,
	day: string,
	folder: string,
	signal: ActivityRecord["signal"] = "body-edit",
	tags: string[] = [],
): ActivityRecord {
	return {
		path,
		title: path.split("/").pop()!.replace(/\.md$/, ""),
		folder,
		tags,
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

describe("aggregate metrics", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("uses one scoped dataset for summary, trend, and drill-down", () => {
		const notes = [
			note("Projects/New.md", "2026-03-10", "Projects", "note-created"),
			note("Projects/Link.md", "2026-03-10", "Projects", "linking-edit"),
			note("Daily/Skip.md", "2026-03-10", "Daily", "body-edit"),
		];

		const data = buildDashboardData(
			notes,
			filters({
				includeFolders: ["Projects"],
				selectedDay: "2026-03-10",
			}),
		);

		expect(data.summary.currentStreak).toBeGreaterThanOrEqual(0);
		expect(
			data.dailyNewNotes.find((day) => day.day === "2026-03-10")?.count,
		).toBe(1);
		expect(
			data.dailyModifiedNotes.find((day) => day.day === "2026-03-10")
				?.count,
		).toBe(1);
		expect(data.selectedDayNotes).toHaveLength(1);
		expect(
			data.trendWeeklyNewNotes.reduce(
				(sum, point) => sum + point.count,
				0,
			),
		).toBe(1);
		expect(
			data.trendWeeklyModifiedNotes.reduce(
				(sum, point) => sum + point.count,
				0,
			),
		).toBe(1);
	});

	it("scopes streak calculations to include and exclude folder filters", () => {
		const notes = [
			note("Projects/Day1.md", "2026-03-01", "Projects"),
			note("Projects/Day2.md", "2026-03-02", "Projects"),
			note("Projects/Day3.md", "2026-03-03", "Projects"),
			note("Projects/Day4.md", "2026-03-04", "Projects"),
			note("Projects/Day5.md", "2026-03-05", "Projects"),
			note("Daily/Isolated.md", "2026-03-10", "Daily"),
		];

		const included = buildDashboardData(
			notes,
			filters({
				includeFolders: ["Daily"],
			}),
		);

		expect(included.summary.longestStreak).toBe(1);

		const excluded = buildDashboardData(
			notes,
			filters({
				excludeFolders: ["Projects"],
			}),
		);

		expect(excluded.summary.longestStreak).toBe(1);
	});

	it("computes weekly and monthly trend scope from filtered data", () => {
		const notes = [
			note("Jan.md", "2026-02-20", "Projects"),
			note("Mar1.md", "2026-03-01", "Projects"),
			note("Mar2.md", "2026-03-10", "Projects"),
			note("Mar3.md", "2026-03-14", "Projects"),
		];

		const data = buildDashboardData(notes, filters());

		expect(data.trendWeeklyModifiedNotes.length).toBeGreaterThan(0);
		expect(data.trendMonthlyModifiedNotes.length).toBeGreaterThan(0);
	});

	it("uses active trend metric for drill-down notes", () => {
		const notes = [
			note("Projects/New.md", "2026-03-10", "Projects", "note-created"),
			note("Projects/Refine.md", "2026-03-10", "Projects", "body-edit"),
		];

		const newNotesData = buildDashboardData(
			notes,
			filters({
				selectedDay: "2026-03-10",
				trendMetric: "new-notes",
			}),
		);
		expect(newNotesData.selectedDayNotes).toHaveLength(1);
		expect(newNotesData.selectedDayNotes[0]!.signal).toBe("note-created");

		const modifiedNotesData = buildDashboardData(
			notes,
			filters({
				selectedDay: "2026-03-10",
				trendMetric: "modified-notes",
			}),
		);
		expect(modifiedNotesData.selectedDayNotes).toHaveLength(1);
		expect(modifiedNotesData.selectedDayNotes[0]!.signal).toBe("body-edit");
	});

	it("uses Last modified property as the authoritative modified date", () => {
		const created = note(
			"Fleeting Notes/Recent Touch.md",
			"2026-02-11",
			"Fleeting Notes",
			"note-created",
		);
		created.lastModifiedPropertyMtime = new Date(
			"2026-03-14T12:00:00",
		).getTime();
		created.lastContentEditMtime = null;

		const data = buildDashboardData(
			[created],
			filters({
				includeFolders: ["Fleeting Notes"],
				trendMetric: "modified-notes",
				selectedDay: "2026-03-14",
			}),
		);

		expect(
			data.dailyModifiedNotes.find((day) => day.day === "2026-03-14")
				?.count,
		).toBe(1);
		expect(data.selectedDayNotes).toHaveLength(1);
	});

	it("does not count lastSeen-only touches as modified notes", () => {
		const created = note(
			"Fleeting Notes/OpenedOnly.md",
			"2026-02-11",
			"Fleeting Notes",
			"note-created",
		);
		created.lastContentEditMtime = null;
		created.lastPropertyEditMtime = null;
		created.lastModifiedPropertyMtime = null;

		const tracked = note(
			"Fleeting Notes/Tracked.md",
			"2026-03-10",
			"Fleeting Notes",
			"body-edit",
		);
		tracked.lastContentEditMtime = new Date(
			"2026-03-10T12:00:00",
		).getTime();

		const data = buildDashboardData(
			[created, tracked],
			filters({
				includeFolders: ["Fleeting Notes"],
				trendMetric: "modified-notes",
				selectedDay: "2026-03-14",
			}),
		);

		expect(
			data.dailyModifiedNotes.find((day) => day.day === "2026-03-14")
				?.count ?? 0,
		).toBe(0);
		expect(data.selectedDayNotes).toHaveLength(0);
	});

	it("counts body or link content edits even when effective time is old", () => {
		const edited = note(
			"Fleeting Notes/StaleProperty.md",
			"2026-02-11",
			"Fleeting Notes",
			"body-edit",
		);
		edited.effectiveMtime = new Date("2026-02-11T12:00:00").getTime();
		edited.lastContentEditMtime = new Date("2026-03-14T12:00:00").getTime();

		const data = buildDashboardData(
			[edited],
			filters({
				includeFolders: ["Fleeting Notes"],
				trendMetric: "modified-notes",
				selectedDay: "2026-03-14",
			}),
		);

		expect(
			data.dailyModifiedNotes.find((day) => day.day === "2026-03-14")
				?.count,
		).toBe(1);
		expect(data.selectedDayNotes).toHaveLength(1);
	});

	it("counts modified notes when original effective date is outside history window", () => {
		const edited = note(
			"Fleeting Notes/VeryOld.md",
			"2024-01-01",
			"Fleeting Notes",
			"body-edit",
		);
		edited.effectiveMtime = new Date("2024-01-01T12:00:00").getTime();
		edited.lastContentEditMtime = new Date("2026-03-14T12:00:00").getTime();

		const data = buildDashboardData(
			[edited],
			filters({
				includeFolders: ["Fleeting Notes"],
				trendMetric: "modified-notes",
				selectedDay: "2026-03-14",
			}),
		);

		expect(
			data.dailyModifiedNotes.find((day) => day.day === "2026-03-14")
				?.count,
		).toBe(1);
		expect(data.selectedDayNotes).toHaveLength(1);
	});

	it("falls back to significant property edits when Last modified is unavailable", () => {
		const legacy = note(
			"Fleeting Notes/Legacy.md",
			"2026-02-11",
			"Fleeting Notes",
			"note-created",
		);
		legacy.lastContentEditMtime = null;
		legacy.lastPropertyEditMtime = new Date(
			"2026-03-14T12:00:00",
		).getTime();

		const data = buildDashboardData(
			[legacy],
			filters({
				includeFolders: ["Fleeting Notes"],
				trendMetric: "modified-notes",
				selectedDay: "2026-03-14",
			}),
		);

		expect(
			data.dailyModifiedNotes.find((day) => day.day === "2026-03-14")
				?.count,
		).toBe(1);
		expect(data.selectedDayNotes).toHaveLength(1);
	});

	it("does not use lastSeen drift as a modified-note fallback", () => {
		const legacy = note(
			"Fleeting Notes/Legacy.md",
			"2026-02-11",
			"Fleeting Notes",
			"note-created",
		);
		legacy.lastContentEditMtime = null;

		const tracked = note(
			"Fleeting Notes/Tracked.md",
			"2026-03-10",
			"Fleeting Notes",
			"body-edit",
		);
		tracked.lastContentEditMtime = new Date(
			"2026-03-10T12:00:00",
		).getTime();

		const data = buildDashboardData(
			[legacy, tracked],
			filters({
				includeFolders: ["Fleeting Notes"],
				trendMetric: "modified-notes",
				selectedDay: "2026-03-14",
			}),
		);

		expect(
			data.dailyModifiedNotes.find((day) => day.day === "2026-03-14")
				?.count ?? 0,
		).toBe(0);
		expect(data.selectedDayNotes).toHaveLength(0);
	});

	it("uses streak calculation mode for new-only, modified-only, and new-or-modified (either) streaks", () => {
		const notes = [
			note(
				"Projects/New-Day1.md",
				"2026-03-01",
				"Projects",
				"note-created",
			),
			note(
				"Projects/New-Day2.md",
				"2026-03-02",
				"Projects",
				"note-created",
			),
			note(
				"Projects/Modified-Day3.md",
				"2026-03-03",
				"Projects",
				"body-edit",
			),
		];

		const newOnly = buildDashboardData(
			notes,
			filters({ streakCalculationMode: "new-only" }),
		);
		expect(newOnly.summary.longestStreak).toBe(2);

		const modifiedOnly = buildDashboardData(
			notes,
			filters({ streakCalculationMode: "modified-only" }),
		);
		expect(modifiedOnly.summary.longestStreak).toBe(1);

		const eitherMode = buildDashboardData(
			notes,
			filters({ streakCalculationMode: "new-and-modified" }),
		);
		expect(eitherMode.summary.longestStreak).toBe(3);
	});

	it("counts modified-only streak days from projected modified timestamps", () => {
		const created = note(
			"Fleeting Notes/CreatedThenTouched.md",
			"2026-03-01",
			"Fleeting Notes",
			"note-created",
		);
		created.lastModifiedPropertyMtime = new Date(
			"2026-03-10T12:00:00",
		).getTime();
		created.lastContentEditMtime = null;

		const data = buildDashboardData(
			[created],
			filters({
				includeFolders: ["Fleeting Notes"],
				streakCalculationMode: "modified-only",
			}),
		);

		expect(data.summary.longestStreak).toBe(1);
	});

	it("carries current streak from yesterday and flags action needed when no qualifying activity today", () => {
		const today = startOfDay(new Date());
		const yesterday = addDays(today, -1);

		const notes = [
			note(
				"Projects/Yesterday.md",
				toDateKey(yesterday),
				"Projects",
				"note-created",
			),
		];

		const data = buildDashboardData(
			notes,
			filters({ streakCalculationMode: "new-only" }),
		);

		expect(data.summary.currentStreak).toBe(1);
		expect(data.summary.streakNeedsActionToday).toBe(true);
		expect(data.summary.streakActionHint?.toLowerCase()).toContain(
			"create a new note",
		);
	});

	it("hides streak warning when qualifying activity exists today", () => {
		const today = startOfDay(new Date());

		const notes = [
			note(
				"Projects/Today.md",
				toDateKey(today),
				"Projects",
				"note-created",
			),
		];

		const data = buildDashboardData(
			notes,
			filters({ streakCalculationMode: "new-only" }),
		);

		expect(data.summary.currentStreak).toBe(1);
		expect(data.summary.streakNeedsActionToday).toBe(false);
		expect(data.summary.streakActionHint).toBeNull();
	});

	it("computes most active day and activity rhythm from include/exclude scoped notes", () => {
		const mondayEarlyA = note(
			"Projects/MondayA.md",
			"2026-03-02",
			"Projects",
			"body-edit",
		);
		mondayEarlyA.effectiveMtime = new Date("2026-03-02T06:15:00").getTime();

		const mondayEarlyB = note(
			"Projects/MondayB.md",
			"2026-03-02",
			"Projects",
			"body-edit",
		);
		mondayEarlyB.effectiveMtime = new Date("2026-03-02T07:45:00").getTime();

		const tuesdayAfternoon = note(
			"Projects/Tuesday.md",
			"2026-03-03",
			"Projects",
			"body-edit",
		);
		tuesdayAfternoon.effectiveMtime = new Date(
			"2026-03-03T13:30:00",
		).getTime();

		const excludedNightA = note(
			"Daily/NightA.md",
			"2026-03-05",
			"Daily",
			"body-edit",
		);
		excludedNightA.effectiveMtime = new Date(
			"2026-03-05T23:10:00",
		).getTime();

		const excludedNightB = note(
			"Daily/NightB.md",
			"2026-03-06",
			"Daily",
			"body-edit",
		);
		excludedNightB.effectiveMtime = new Date(
			"2026-03-06T23:20:00",
		).getTime();

		const data = buildDashboardData(
			[
				mondayEarlyA,
				mondayEarlyB,
				tuesdayAfternoon,
				excludedNightA,
				excludedNightB,
			],
			filters({ includeFolders: ["Projects"] }),
		);

		expect(data.summary.mostActiveDayLabel).toBe("Monday");
		expect(data.summary.activityRhythmLabel).toBe("Early Riser");
	});
});
