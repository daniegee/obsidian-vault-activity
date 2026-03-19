import type {
	ActivityRecord,
	DailyAggregate,
	StreakCalculationMode,
	StreakSegment,
} from "../../types";
import { addDays, parseDateKey, startOfDay, toDateKey } from "../../utils/date";

export function buildStreakSegments(daily: DailyAggregate[]): StreakSegment[] {
	const activeDays = daily.filter((item) => item.count > 0);
	if (activeDays.length === 0) {
		return [];
	}

	const segments: StreakSegment[] = [];
	let currentStart = activeDays[0]!.day;
	let currentEnd = activeDays[0]!.day;
	let currentLength = 1;

	for (let index = 1; index < activeDays.length; index += 1) {
		const previous = parseDateKey(activeDays[index - 1]!.day);
		const current = parseDateKey(activeDays[index]!.day);
		const isConsecutive =
			addDays(previous, 1).getTime() === current.getTime();

		if (isConsecutive) {
			currentEnd = activeDays[index]!.day;
			currentLength += 1;
			continue;
		}

		segments.push({
			start: currentStart,
			end: currentEnd,
			length: currentLength,
			isCurrent: false,
			breakAfter: activeDays[index - 1]!.day,
		});

		currentStart = activeDays[index]!.day;
		currentEnd = activeDays[index]!.day;
		currentLength = isConsecutive ? currentLength + 1 : 1;
	}

	segments.push({
		start: currentStart,
		end: currentEnd,
		length: currentLength,
		isCurrent: false,
		breakAfter: null,
	});

	const today = toDateKey(startOfDay(new Date()));
	const currentSegment =
		segments.find((segment) => segment.end === today) ?? null;
	if (currentSegment) {
		currentSegment.isCurrent = true;
	}

	return segments;
}

function streakActionText(mode: StreakCalculationMode): string {
	if (mode === "new-only") {
		return "Create a new note";
	}
	if (mode === "modified-only") {
		return "Modify an existing note";
	}
	return "Create a new note or modify an existing one";
}

export function resolveCurrentStreakState(
	streakSegments: StreakSegment[],
	streakCalculationMode: StreakCalculationMode,
): {
	currentStreak: number;
	streakNeedsActionToday: boolean;
	streakActionHint: string | null;
} {
	const today = toDateKey(startOfDay(new Date()));
	const yesterday = toDateKey(addDays(startOfDay(new Date()), -1));
	const todaySegment =
		streakSegments.find((segment) => segment.end === today) ?? null;

	if (todaySegment) {
		return {
			currentStreak: todaySegment.length,
			streakNeedsActionToday: false,
			streakActionHint: null,
		};
	}

	const yesterdaySegment =
		streakSegments.find((segment) => segment.end === yesterday) ?? null;
	if (!yesterdaySegment) {
		return {
			currentStreak: 0,
			streakNeedsActionToday: false,
			streakActionHint: null,
		};
	}

	return {
		currentStreak: yesterdaySegment.length,
		streakNeedsActionToday: true,
		streakActionHint: `No qualifying activity yet today. ${streakActionText(streakCalculationMode)} to keep your streak alive.`,
	};
}

export function resolveMostActiveDay(notes: ActivityRecord[]): string {
	if (notes.length === 0) {
		return "No activity yet";
	}

	const weekdayLabels: Record<number, string> = {
		0: "Sunday",
		1: "Monday",
		2: "Tuesday",
		3: "Wednesday",
		4: "Thursday",
		5: "Friday",
		6: "Saturday",
	};
	const counts: Record<number, number> = {
		0: 0,
		1: 0,
		2: 0,
		3: 0,
		4: 0,
		5: 0,
		6: 0,
	};

	for (const note of notes) {
		const weekday = new Date(note.effectiveMtime).getDay();
		counts[weekday] = (counts[weekday] ?? 0) + 1;
	}

	const weekdayPriority = [1, 2, 3, 4, 5, 6, 0];
	let bestDay = weekdayPriority[0] ?? 1;
	let bestCount = counts[bestDay] ?? 0;

	for (const day of weekdayPriority) {
		const count = counts[day] ?? 0;
		if (count > bestCount) {
			bestDay = day;
			bestCount = count;
		}
	}

	return weekdayLabels[bestDay] ?? "Monday";
}

export function resolveActivityRhythm(notes: ActivityRecord[]): string {
	if (notes.length === 0) {
		return "No activity rhythm yet";
	}

	const buckets: Record<"early" | "afternoon" | "evening" | "night", number> =
		{
			early: 0,
			afternoon: 0,
			evening: 0,
			night: 0,
		};

	for (const note of notes) {
		const hour = new Date(note.effectiveMtime).getHours();
		if (hour >= 5 && hour < 11) {
			buckets.early += 1;
		} else if (hour >= 11 && hour < 17) {
			buckets.afternoon += 1;
		} else if (hour >= 17 && hour < 22) {
			buckets.evening += 1;
		} else {
			buckets.night += 1;
		}
	}

	const orderedBuckets: Array<{ key: keyof typeof buckets; label: string }> =
		[
			{ key: "early", label: "Early Riser" },
			{ key: "afternoon", label: "Afternoon Warrior" },
			{ key: "evening", label: "Evening Builder" },
			{ key: "night", label: "Night Owl" },
		];

	const firstBucket = orderedBuckets[0];
	if (!firstBucket) {
		return "No activity rhythm yet";
	}

	let best = firstBucket;
	let bestCount = buckets[best.key];

	for (const bucket of orderedBuckets) {
		if (buckets[bucket.key] > bestCount) {
			best = bucket;
			bestCount = buckets[bucket.key];
		}
	}

	return best.label;
}

export function notesForStreakMode(
	mode: StreakCalculationMode,
	newNotes: ActivityRecord[],
	modifiedNotes: ActivityRecord[],
): ActivityRecord[] {
	if (mode === "new-only") {
		return newNotes;
	}

	if (mode === "modified-only") {
		return modifiedNotes;
	}

	return [...newNotes, ...modifiedNotes];
}
