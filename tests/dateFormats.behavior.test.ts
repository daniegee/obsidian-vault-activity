import { describe, expect, it } from "vitest";

import { parseNoteContent } from "../src/indexer/noteContentParser";

function created(value: string, dateFormat?: string): number | null {
	return parseNoteContent(`---\nCreated: ${value}\n---\nBody`, {
		dateFormat,
	}).createdDateMs;
}

const local = (...parts: [number, number, number, number?, number?]) =>
	new Date(
		parts[0],
		parts[1] - 1,
		parts[2],
		parts[3] ?? 0,
		parts[4] ?? 0,
	).getTime();

describe("frontmatter date formats", () => {
	it("[Test-403] reads ISO dates and local date-times as written", () => {
		expect(created("2024-01-15")).toBe(local(2024, 1, 15));
		expect(created("'2024-01-15T10:30'")).toBe(local(2024, 1, 15, 10, 30));
		expect(created("2024-01-15 10:30")).toBe(local(2024, 1, 15, 10, 30));
	});

	it("[Test-404] keeps the written wall-clock time when an offset is present", () => {
		expect(created("2024-01-15T23:30:00-05:00")).toBe(
			local(2024, 1, 15, 23, 30),
		);
		expect(created("2024-01-15T00:15:00Z")).toBe(local(2024, 1, 15, 0, 15));
		expect(created("2024-01-15T08:00+09:00")).toBe(local(2024, 1, 15, 8));
	});

	it("[Test-405] reads unambiguous numeric dates in either order", () => {
		expect(created("15/01/2024")).toBe(local(2024, 1, 15));
		expect(created("15.01.2024")).toBe(local(2024, 1, 15));
		expect(created("1-15-2024")).toBe(local(2024, 1, 15));
		expect(created("05/05/2024")).toBe(local(2024, 5, 5));
		expect(created("15/01/2024 18:45")).toBe(local(2024, 1, 15, 18, 45));
	});

	it("[Test-406] treats ambiguous or impossible numeric dates as unknown", () => {
		expect(created("03/04/2024")).toBeNull();
		expect(created("31/02/2024")).toBeNull();
		expect(created("15/01-2024")).toBeNull();
		expect(created("not a date")).toBeNull();
	});

	it("[Test-407] uses the configured format before automatic detection", () => {
		expect(created("03/04/2024", "DD/MM/YYYY")).toBe(local(2024, 4, 3));
		expect(created("03/04/2024", "MM/DD/YYYY")).toBe(local(2024, 3, 4));
		expect(created("15 January 2024", "D MMMM YYYY")).toBe(
			local(2024, 1, 15),
		);
		// ISO still works alongside a custom format.
		expect(created("2024-01-15", "DD/MM/YYYY")).toBe(local(2024, 1, 15));
	});

	it("[Test-408] reads Unix timestamps through the configured format", () => {
		const instant = Date.UTC(2024, 0, 15, 12);
		expect(created(String(instant / 1000), "X")).toBe(instant);
		expect(created(String(instant), "x")).toBe(instant);
	});

	it("[Test-409] keeps English text dates working", () => {
		expect(created("January 15, 2024")).toBe(local(2024, 1, 15));
	});
});
