import { describe, expect, it } from "vitest";

import {
	eachDay,
	endOfMonth,
	parseDateKey,
	startOfWeek,
	toDateKey,
} from "../src/utils/date";

describe("date utilities edge cases", () => {
	it("round-trips leap-day keys", () => {
		expect(toDateKey(parseDateKey("2024-02-29"))).toBe("2024-02-29");
	});

	it("starts week on Monday when source date is Sunday", () => {
		const sunday = new Date(2026, 2, 15, 14, 45, 0, 0);
		expect(toDateKey(startOfWeek(sunday))).toBe("2026-03-09");
	});

	it("returns inclusive daily ranges across month boundaries", () => {
		const days = eachDay(new Date(2026, 0, 30), new Date(2026, 1, 2));
		expect(days.map((date) => toDateKey(date))).toEqual([
			"2026-01-30",
			"2026-01-31",
			"2026-02-01",
			"2026-02-02",
		]);
	});

	it("returns end-of-month timestamps at end-of-day", () => {
		const end = endOfMonth(new Date(2024, 1, 3, 8, 0, 0, 0));
		expect(toDateKey(end)).toBe("2024-02-29");
		expect(end.getHours()).toBe(23);
		expect(end.getMinutes()).toBe(59);
		expect(end.getSeconds()).toBe(59);
		expect(end.getMilliseconds()).toBe(999);
	});
});
