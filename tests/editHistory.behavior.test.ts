import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildDashboardData } from "../src/indexer/aggregates";
import { evaluateNoteActivity } from "../src/indexer/noteActivityEvaluator";
import { readSnapshots } from "../src/indexer/vaultIndexer";
import type { ActivityRecord, FilterState, NoteSnapshot } from "../src/types";

const at = (iso: string) => new Date(iso).getTime();

function evaluate(content: string, mtime: number, previous?: NoteSnapshot) {
	return evaluateNoteActivity(
		content,
		mtime,
		at("2026-03-01T09:00:00"),
		previous,
	).snapshot;
}

function filters(overrides: Partial<FilterState> = {}): FilterState {
	return {
		includeFolders: [],
		excludeFolders: [],
		streakCalculationMode: "modified-only",
		trendWindow: "weekly",
		trendMetric: "modified-notes",
		selectedDay: null,
		...overrides,
	};
}

function record(overrides: Partial<ActivityRecord>): ActivityRecord {
	return {
		path: "Projects/Note.md",
		title: "Note",
		folder: "Projects",
		effectiveMtime: at("2026-03-12T12:00:00"),
		signal: "body-edit",
		createdMtime: 0,
		editHistory: [at("2026-03-12T12:00:00")],
		...overrides,
	};
}

describe("edit history", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-14T18:00:00"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("records one entry per edited day, keeping the latest edit of each day", () => {
		const created = evaluate("Body", at("2026-03-01T09:00:00"));
		expect(created.editHistory).toEqual([]);

		const day1 = evaluate("Body v2", at("2026-03-10T09:00:00"), created);
		const day1Later = evaluate("Body v3", at("2026-03-10T17:00:00"), day1);
		const unchanged = evaluate(
			"Body v3",
			at("2026-03-11T09:00:00"),
			day1Later,
		);
		const day3 = evaluate("Body v4", at("2026-03-12T08:00:00"), unchanged);

		expect(day3.editHistory).toEqual([
			at("2026-03-10T17:00:00"),
			at("2026-03-12T08:00:00"),
		]);
	});

	it("ignores property-only edits", () => {
		const created = evaluate(
			"---\nstatus: draft\nLast modified: 2026-03-01\n---\nBody",
			at("2026-03-01T09:00:00"),
		);
		const edited = evaluate(
			"---\nstatus: done\nLast modified: 2026-03-01\n---\nBody",
			at("2026-03-10T09:00:00"),
			created,
		);

		expect(edited.editHistory).toEqual([]);

		// Bumping only the modified property is a property edit too.
		const bumped = evaluate(
			"---\nstatus: done\nLast modified: 2026-03-11\n---\nBody",
			at("2026-03-11T09:00:00"),
			edited,
		);
		expect(bumped.editHistory).toEqual([]);
	});

	it("dates an edit by the modified property when that property changed", () => {
		const created = evaluate(
			"---\nLast modified: 2026-03-01\n---\nBody",
			at("2026-03-01T09:00:00"),
		);
		// mtime reflects a later sync, the property reflects the real edit day.
		const edited = evaluate(
			"---\nLast modified: 2026-03-10\n---\nBody v2",
			at("2026-03-13T09:00:00"),
			created,
		);

		expect(edited.editHistory).toHaveLength(1);
		expect(new Date(edited.editHistory[0]!).getDate()).toBe(10);
	});

	it("keeps the edit's time of day when a date-only modified property names the same day", () => {
		const created = evaluate(
			"---\nLast modified: 2026-03-01\n---\nBody",
			at("2026-03-01T09:00:00"),
		);
		const edited = evaluate(
			"---\nLast modified: 2026-03-10\n---\nBody v2",
			at("2026-03-10T15:00:00"),
			created,
		);

		expect(edited.editHistory).toEqual([at("2026-03-10T15:00:00")]);
	});

	it("builds a streak from every edited day, not just the latest one", () => {
		const note = record({
			editHistory: [
				at("2026-03-12T12:00:00"),
				at("2026-03-13T12:00:00"),
				at("2026-03-14T12:00:00"),
			],
		});

		const data = buildDashboardData([note], filters());

		expect(data.summary.currentStreak).toBe(3);
		for (const day of ["2026-03-12", "2026-03-13", "2026-03-14"]) {
			expect(
				data.dailyModifiedNotes.find((item) => item.day === day)?.count,
			).toBe(1);
		}
	});

	it("strips old fields on load and seeds 1.1.9 notes from their last content edit", () => {
		const stored = readSnapshots({
			"Projects/Note.md": {
				path: "Projects/Note.md",
				title: "Note",
				createdMtime: 100,
				contentHash: "c",
				bodyHash: "b",
				linkHash: "l",
				lastMeaningfulMtime: 200,
				lastContentEditMtime: 200,
				lastMeaningfulSignal: "body-edit",
			} as any,
		});

		expect(stored["Projects/Note.md"]).toEqual({
			createdMtime: 100,
			contentHash: "c",
			bodyHash: "b",
			lastModifiedPropertyMtime: undefined,
			editHistory: [200],
			fileMtime: undefined,
			fileSize: undefined,
		});
		// Same body as stored, so the first rescan records no edit.
		const rescanned = evaluate("Body", 300, {
			...stored["Projects/Note.md"]!,
			bodyHash: evaluate("Body", 0).bodyHash,
		});
		expect(rescanned.editHistory).toEqual([200]);
	});

	it.each([
		[{ lastModifiedPropertyMtime: 500, lastContentEditMtime: 200 }, [500]],
		[
			{ lastMeaningfulMtime: 300, lastMeaningfulSignal: "body-edit" },
			[300],
		],
		[
			{ lastMeaningfulMtime: 300, lastMeaningfulSignal: "linking-edit" },
			[300],
		],
		[
			{ lastMeaningfulMtime: 300, lastMeaningfulSignal: "note-created" },
			[],
		],
		[{ lastPropertyEditMtime: 400 }, []],
	])("seeds legacy fields %j as %j", (legacy, expected) => {
		const stored = readSnapshots({
			"Note.md": {
				createdMtime: 100,
				contentHash: "c",
				bodyHash: "b",
				...legacy,
			},
		});

		expect(stored["Note.md"]!.editHistory).toEqual(expected);
	});

	it("seeds 1.1.9 notes with their modified property as the one known edit", () => {
		const stored = readSnapshots({
			"Note.md": {
				createdMtime: 100,
				contentHash: "c",
				bodyHash: "b",
				lastModifiedPropertyMtime: 500,
			},
		});

		expect(stored["Note.md"]!.editHistory).toEqual([500]);
	});

	it("keeps counting a note as new on its creation day after it is edited", () => {
		const note = record({
			createdMtime: at("2026-03-10T09:00:00"),
			signal: "body-edit",
			editHistory: [at("2026-03-12T12:00:00")],
		});

		const data = buildDashboardData(
			[note],
			filters({ trendMetric: "new-notes" }),
		);

		expect(
			data.dailyNewNotes.find((item) => item.day === "2026-03-10")?.count,
		).toBe(1);
		expect(
			data.dailyNewNotes.find((item) => item.day === "2026-03-12")?.count,
		).toBe(0);
	});

	it("lists a note once per week and month however many days it was edited", () => {
		const note = record({
			editHistory: ["09", "10", "11", "12", "13"].map((d) =>
				at(`2026-03-${d}T12:00:00`),
			),
		});

		const data = buildDashboardData(
			[note],
			filters({ trendWindow: "yearly", selectedDay: "2026-03-09" }),
		);

		expect(
			data.trendWeeklyModifiedNotes.find((p) => p.day === "2026-03-09")!
				.count,
		).toBe(1);
		expect(data.selectedDayNotes).toHaveLength(1);
		expect(data.selectedDayNotes[0]!.effectiveMtime).toBe(
			at("2026-03-13T12:00:00"),
		);
		expect(
			data.trendMonthlyModifiedNotes.find((p) => p.day === "2026-03-01")!
				.count,
		).toBe(1);
	});
});
