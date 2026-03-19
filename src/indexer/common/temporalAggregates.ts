import type { ActivityRecord, DailyAggregate, TrendPoint } from "../../types";
import {
	eachDay,
	formatMonthLabel,
	formatShortDate,
	parseDateKey,
	startOfMonth,
	startOfWeek,
	toDateKey,
} from "../../utils/date";

export function buildDailyAggregates(
	notes: ActivityRecord[],
	startDate: string,
	endDate: string,
): DailyAggregate[] {
	const notesByDay = new Map<string, ActivityRecord[]>();

	for (const note of notes) {
		const day = toDateKey(note.effectiveMtime);
		const bucket = notesByDay.get(day);

		if (bucket) {
			bucket.push(note);
		} else {
			notesByDay.set(day, [note]);
		}
	}

	return eachDay(parseDateKey(startDate), parseDateKey(endDate)).map(
		(date) => {
			const day = toDateKey(date);
			const dayNotes = (notesByDay.get(day) ?? [])
				.slice()
				.sort(
					(left, right) => right.effectiveMtime - left.effectiveMtime,
				);
			const folders: Record<string, number> = {};

			for (const note of dayNotes) {
				folders[note.folder] = (folders[note.folder] ?? 0) + 1;
			}

			return {
				day,
				count: dayNotes.length,
				notes: dayNotes,
				folders,
			};
		},
	);
}

export function groupTrend(
	daily: DailyAggregate[],
	granularity: "weekly" | "monthly",
): TrendPoint[] {
	const grouped = new Map<string, ActivityRecord[]>();

	for (const item of daily) {
		const anchor =
			granularity === "weekly"
				? startOfWeek(parseDateKey(item.day))
				: startOfMonth(parseDateKey(item.day));
		const key = toDateKey(anchor);
		const bucket = grouped.get(key);

		if (bucket) {
			bucket.push(...item.notes);
		} else {
			grouped.set(key, [...item.notes]);
		}
	}

	return Array.from(grouped.entries())
		.sort((left, right) => left[0].localeCompare(right[0]))
		.map(([day, notes]) => ({
			day,
			label:
				granularity === "weekly"
					? `Week of ${formatShortDate(day)}`
					: formatMonthLabel(parseDateKey(day)),
			count: notes.length,
			notes: notes
				.slice()
				.sort(
					(left, right) => right.effectiveMtime - left.effectiveMtime,
				),
		}));
}

export function buildGlobalDailyAggregates(
	notes: ActivityRecord[],
): DailyAggregate[] {
	if (notes.length === 0) {
		return [];
	}

	const sorted = notes
		.slice()
		.sort((left, right) => left.effectiveMtime - right.effectiveMtime);
	const startDate = toDateKey(sorted[0]!.effectiveMtime);
	const last = sorted.at(-1);
	if (!last) {
		return [];
	}
	const endDate = toDateKey(last.effectiveMtime);

	return buildDailyAggregates(sorted, startDate, endDate);
}
