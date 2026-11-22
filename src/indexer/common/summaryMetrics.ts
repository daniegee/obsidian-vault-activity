import type {
	ActivityRecord,
	StreakCalculationMode,
	SummaryMetrics,
} from "../../types";
import {
	buildStreakSegments,
	notesForStreakMode,
	resolveActivityRhythm,
	resolveCurrentStreakState,
	resolveMostActiveDay,
} from "./summaryHelpers";
import { buildGlobalDailyAggregates } from "./temporalAggregates";

export function buildSummaryMetrics(
	scopedAllTimeNewNotes: ActivityRecord[],
	scopedAllTimeModifiedNotes: ActivityRecord[],
	streakCalculationMode: StreakCalculationMode,
): SummaryMetrics {
	const streakNotes = notesForStreakMode(
		streakCalculationMode,
		scopedAllTimeNewNotes,
		scopedAllTimeModifiedNotes,
	);
	const streakDaily = buildGlobalDailyAggregates(streakNotes);
	const streakSegments = buildStreakSegments(streakDaily);
	const { currentStreak, streakNeedsActionToday, streakActionHint } =
		resolveCurrentStreakState(streakSegments, streakCalculationMode);
	const longestStreak = streakSegments.reduce(
		(max, segment) => Math.max(max, segment.length),
		0,
	);
	// Every creation and recorded edit, so these agree with streaks and trends.
	const allActivity = [
		...scopedAllTimeNewNotes,
		...scopedAllTimeModifiedNotes,
	];
	const mostActiveDayLabel = resolveMostActiveDay(allActivity);
	const activityRhythmLabel = resolveActivityRhythm(allActivity);

	return {
		mostActiveDayLabel,
		activityRhythmLabel,
		currentStreak,
		streakNeedsActionToday,
		streakActionHint,
		longestStreak,
	};
}
