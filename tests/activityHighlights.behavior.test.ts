import { describe, expect, it } from "vitest";

import { buildDashboardData } from "../src/indexer/aggregates";
import { evaluateNoteActivity } from "../src/indexer/noteActivityEvaluator";
import { parseNoteContent } from "../src/indexer/noteContentParser";
import { startOfDay, addDays, toDateKey } from "../src/utils/date";
import type { ActivityRecord, FilterState } from "../src/types";

const customDateProperties = {
	createdDateProperty: "created_at",
	modifiedDateProperty: "updated_at",
};

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

describe("activity highlights behavior", () => {
	it("[Test-201] changes streak length based on streak mode", () => {
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
		const modifiedOnly = buildDashboardData(
			notes,
			filters({ streakCalculationMode: "modified-only" }),
		);
		const either = buildDashboardData(
			notes,
			filters({ streakCalculationMode: "new-and-modified" }),
		);

		expect(newOnly.summary.longestStreak).toBe(2);
		expect(modifiedOnly.summary.longestStreak).toBe(1);
		expect(either.summary.longestStreak).toBe(3);
	});

	it("[Test-202] classifies frontmatter-only updates as non-body-or-link-content edits", () => {
		const initial = evaluateNoteActivity(
			"Projects/Test.md",
			"---\ntags: [one]\n---\nBody",
			1000,
			500,
			undefined,
		);
		const frontmatterOnly = evaluateNoteActivity(
			"Projects/Test.md",
			"---\ntags: [one, two]\n---\nBody",
			2000,
			500,
			initial.snapshot,
		);

		expect(frontmatterOnly.isMeaningful).toBe(false);
		expect(frontmatterOnly.signal).toBeNull();
		expect(frontmatterOnly.snapshot.lastMeaningfulMtime).toBe(500);
		expect(frontmatterOnly.snapshot.lastMeaningfulSignal).toBe(
			"note-created",
		);
		expect(frontmatterOnly.snapshot.lastContentEditMtime).toBeNull();
		expect(frontmatterOnly.snapshot.lastPropertyEditMtime).toBe(2000);

		const metadataDriven = note(
			"Projects/Metadata.md",
			"2026-03-01",
			"Projects",
			"note-created",
		);
		metadataDriven.lastModifiedPropertyMtime = new Date(
			"2026-03-14T12:00:00",
		).getTime();
		metadataDriven.lastContentEditMtime = null;

		const data = buildDashboardData(
			[metadataDriven],
			filters({
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

	it("[Test-203] does not create modified activity from last-seen-only changes", () => {
		const openedOnly = note(
			"Opened.md",
			"2026-02-11",
			"Projects",
			"note-created",
		);
		openedOnly.lastContentEditMtime = null;
		openedOnly.lastPropertyEditMtime = null;
		openedOnly.lastModifiedPropertyMtime = null;

		const data = buildDashboardData(
			[openedOnly],
			filters({
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

	it("[Test-204] sets streak needs-action and hint only when today has no qualifying activity", () => {
		const today = startOfDay(new Date());
		const yesterday = addDays(today, -1);

		const needsAction = buildDashboardData(
			[
				note(
					"Projects/Yesterday.md",
					toDateKey(yesterday),
					"Projects",
					"note-created",
				),
			],
			filters({ streakCalculationMode: "new-only" }),
		);

		expect(needsAction.summary.streakNeedsActionToday).toBe(true);
		expect(needsAction.summary.streakActionHint).toBeTruthy();

		const noActionNeeded = buildDashboardData(
			[
				note(
					"Projects/Today.md",
					toDateKey(today),
					"Projects",
					"note-created",
				),
			],
			filters({ streakCalculationMode: "new-only" }),
		);

		expect(noActionNeeded.summary.streakNeedsActionToday).toBe(false);
		expect(noActionNeeded.summary.streakActionHint).toBeNull();
	});

	it("[Test-205] emits note-created signal and uses file creation time as activity timestamp", () => {
		const result = evaluateNoteActivity(
			"Projects/Test.md",
			"",
			1000,
			500,
			undefined,
		);

		expect(result.isMeaningful).toBe(true);
		expect(result.signal).toBe("note-created");
		expect(result.snapshot.lastMeaningfulMtime).toBe(500);
		expect(result.snapshot.lastMeaningfulSignal).toBe("note-created");
	});

	it("[Test-206] uses frontmatter Date for note-created timing when present", () => {
		const result = evaluateNoteActivity(
			"Projects/Test.md",
			"---\nDate: 2024-05-01\n---\nBody",
			5000,
			1000,
			undefined,
		);

		expect(result.snapshot.lastMeaningfulMtime).toBe(
			new Date(2024, 4, 1).getTime(),
		);
	});

	it("[Test-207] stores Last modified separately from note-created timing", () => {
		const result = evaluateNoteActivity(
			"Projects/Test.md",
			"---\nLast modified: 2024-05-01\n---\nBody",
			5000,
			1000,
			undefined,
		);

		expect(result.snapshot.lastMeaningfulMtime).toBe(1000);
		expect(result.snapshot.lastModifiedPropertyMtime).toBe(
			new Date(2024, 4, 1).getTime(),
		);
		expect(result.snapshot.lastMeaningfulSignal).toBe("note-created");
	});

	it("[Test-208] classifies linking edits when links change", () => {
		const initial = evaluateNoteActivity(
			"Projects/Test.md",
			"Body",
			1000,
			500,
			undefined,
		);
		const changed = evaluateNoteActivity(
			"Projects/Test.md",
			"Body with [[Second Note]]",
			2000,
			500,
			initial.snapshot,
		);

		expect(changed.isMeaningful).toBe(true);
		expect(changed.signal).toBe("linking-edit");
		expect(changed.snapshot.lastMeaningfulSignal).toBe("linking-edit");
		expect(changed.snapshot.lastMeaningfulMtime).toBe(2000);
	});

	it("[Test-209] classifies plain body edits as body-edit", () => {
		const initial = evaluateNoteActivity(
			"Projects/Test.md",
			"Body",
			1000,
			500,
			undefined,
		);
		const changed = evaluateNoteActivity(
			"Projects/Test.md",
			"Body changed",
			2000,
			500,
			initial.snapshot,
		);

		expect(changed.isMeaningful).toBe(true);
		expect(changed.signal).toBe("body-edit");
		expect(changed.snapshot.lastMeaningfulSignal).toBe("body-edit");
		expect(changed.snapshot.lastMeaningfulMtime).toBe(2000);
	});

	it("[Test-210] extracts tags and links from note content", () => {
		const parsedTags = parseNoteContent(
			"---\ntags:\n  - alpha\n  - beta\n---\nBody",
		);
		const inlineTags = parseNoteContent("---\ntags: [one, two]\n---\nBody");
		const parsedLinks = parseNoteContent(
			"Body with [[Note One]] and [site](https://example.com)",
		);

		expect(parsedTags.tags).toEqual(["alpha", "beta"]);
		expect(inlineTags.tags).toEqual(["one", "two"]);
		expect(parsedLinks.links).toEqual(["https://example.com", "note one"]);
	});

	it("[Test-211] extracts Last modified from frontmatter", () => {
		const parsed = parseNoteContent(
			"---\nLast modified: '2026-03-14'\n---\nBody",
		);
		expect(parsed.lastModifiedDateMs).toBe(new Date(2026, 2, 14).getTime());
	});

	it("[Test-212] uses Last modified as activity timestamp for body or link content edits", () => {
		const initial = evaluateNoteActivity(
			"Projects/Test.md",
			"Body",
			1000,
			500,
			undefined,
		);
		const changed = evaluateNoteActivity(
			"Projects/Test.md",
			"---\nLast modified: 2026-03-14\n---\nBody changed",
			4000,
			500,
			initial.snapshot,
		);

		expect(changed.snapshot.lastMeaningfulMtime).toBe(
			new Date(2026, 2, 14).getTime(),
		);
	});

	it("[Test-213] keeps using file mtime when Last modified is missing", () => {
		const initial = evaluateNoteActivity(
			"Projects/Test.md",
			"Body",
			1000,
			500,
			undefined,
		);
		const changed = evaluateNoteActivity(
			"Projects/Test.md",
			"Body changed",
			2000,
			500,
			initial.snapshot,
		);

		expect(changed.snapshot.lastMeaningfulMtime).toBe(2000);
	});

	it("[Test-214] does not treat Last modified changes as fallback property edits", () => {
		const initial = evaluateNoteActivity(
			"Projects/Test.md",
			"---\nLast modified: 2026-03-13\n---\nBody",
			1000,
			500,
			undefined,
		);

		const changed = evaluateNoteActivity(
			"Projects/Test.md",
			"---\nLast modified: 2026-03-14\n---\nBody",
			2000,
			500,
			initial.snapshot,
		);

		expect(changed.signal).toBeNull();
		expect(changed.snapshot.lastModifiedPropertyMtime).toBe(
			new Date(2026, 2, 14).getTime(),
		);
		expect(changed.snapshot.lastPropertyEditMtime).toBeNull();
	});

	it("[Test-215] uses configured created date property for note-created timing", () => {
		const result = evaluateNoteActivity(
			"Projects/Test.md",
			"---\ncreated_at: 2024-05-03\n---\nBody",
			5000,
			1000,
			undefined,
			customDateProperties,
		);

		expect(result.snapshot.lastMeaningfulMtime).toBe(
			new Date(2024, 4, 3).getTime(),
		);
	});

	it("[Test-216] extracts configured modified property from frontmatter", () => {
		const parsed = parseNoteContent(
			"---\nupdated_at: '2026-03-14'\n---\nBody",
			customDateProperties,
		);

		expect(parsed.lastModifiedDateMs).toBe(new Date(2026, 2, 14).getTime());
	});

	it("[Test-217] does not treat configured modified property as fallback property edits", () => {
		const initial = evaluateNoteActivity(
			"Projects/Test.md",
			"---\nupdated_at: 2026-03-13\n---\nBody",
			1000,
			500,
			undefined,
			customDateProperties,
		);

		const changed = evaluateNoteActivity(
			"Projects/Test.md",
			"---\nupdated_at: 2026-03-14\n---\nBody",
			2000,
			500,
			initial.snapshot,
			customDateProperties,
		);

		expect(changed.signal).toBeNull();
		expect(changed.snapshot.lastModifiedPropertyMtime).toBe(
			new Date(2026, 2, 14).getTime(),
		);
		expect(changed.snapshot.lastPropertyEditMtime).toBeNull();
	});
});
