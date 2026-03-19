import type { ActivityRecord, DashboardData, FilterState } from "../types";
import { toModifiedRecord } from "./common/activityRecords";
import { applyFilters } from "./common/folderFilters";
import { buildSummaryMetrics } from "./common/summaryMetrics";
import {
	buildDailyAggregates,
	buildGlobalDailyAggregates,
	groupTrend,
} from "./common/temporalAggregates";
import { addDays, parseDateKey, startOfDay, toDateKey } from "../utils/date";

const DASHBOARD_HISTORY_DAYS = 365;

export function buildDashboardData(
	notes: ActivityRecord[],
	filters: FilterState,
): DashboardData {
	const scopedNotes = applyFilters(notes, filters);
	const endDate = toDateKey(startOfDay(new Date()));
	const startDate = toDateKey(
		addDays(parseDateKey(endDate), -(DASHBOARD_HISTORY_DAYS - 1)),
	);
	const isWithinHistoryWindow = (timestamp: number): boolean => {
		const day = toDateKey(timestamp);
		return day >= startDate && day <= endDate;
	};

	const scopedHistoryNotes = scopedNotes.filter((note) => {
		const day = toDateKey(note.effectiveMtime);
		return day >= startDate && day <= endDate;
	});

	const scopedHistoryNewNotes = scopedHistoryNotes.filter(
		(note) => note.signal === "note-created",
	);
	const scopedHistoryModifiedNotes = scopedNotes
		.map(toModifiedRecord)
		.filter((note): note is ActivityRecord => note != null)
		.filter((note) => isWithinHistoryWindow(note.effectiveMtime));
	const scopedAllTimeNewNotes = scopedNotes.filter(
		(note) => note.signal === "note-created",
	);
	const scopedAllTimeModifiedNotes = scopedNotes
		.map(toModifiedRecord)
		.filter((note): note is ActivityRecord => note != null);

	const dailyNewNotes = buildDailyAggregates(
		scopedHistoryNewNotes,
		startDate,
		endDate,
	);
	const dailyModifiedNotes = buildDailyAggregates(
		scopedHistoryModifiedNotes,
		startDate,
		endDate,
	);

	// Keep "all-time" truly scoped to all matching notes, not the 365-day dashboard window.
	const allTimeTrendNewNotes = buildGlobalDailyAggregates(
		scopedAllTimeNewNotes,
	);
	const allTimeTrendModifiedNotes = buildGlobalDailyAggregates(
		scopedAllTimeModifiedNotes,
	);

	const trendWeeklyNewNotes = groupTrend(dailyNewNotes, "weekly");
	const trendWeeklyModifiedNotes = groupTrend(dailyModifiedNotes, "weekly");
	const trendMonthlyNewNotes = groupTrend(allTimeTrendNewNotes, "monthly");
	const trendMonthlyModifiedNotes = groupTrend(
		allTimeTrendModifiedNotes,
		"monthly",
	);

	const summary = buildSummaryMetrics(
		scopedNotes,
		scopedAllTimeNewNotes,
		scopedAllTimeModifiedNotes,
		filters.streakCalculationMode,
	);

	let selectedDayNotes: ActivityRecord[] = [];
	const activeDaily =
		filters.trendMetric === "modified-notes"
			? dailyModifiedNotes
			: dailyNewNotes;
	const activeWeekly =
		filters.trendMetric === "modified-notes"
			? trendWeeklyModifiedNotes
			: trendWeeklyNewNotes;
	const activeMonthly =
		filters.trendMetric === "modified-notes"
			? trendMonthlyModifiedNotes
			: trendMonthlyNewNotes;

	if (filters.selectedDay != null) {
		if (filters.trendWindow === "yearly") {
			selectedDayNotes =
				activeWeekly.find((item) => item.day === filters.selectedDay)
					?.notes ?? [];
		} else if (filters.trendWindow === "all-time") {
			selectedDayNotes =
				activeMonthly.find((item) => item.day === filters.selectedDay)
					?.notes ?? [];
		} else {
			selectedDayNotes =
				activeDaily.find((item) => item.day === filters.selectedDay)
					?.notes ?? [];
		}
	}

	return {
		generatedAt: Date.now(),
		filters,
		scopedNotes: scopedHistoryNotes,
		dailyNewNotes,
		dailyModifiedNotes,
		trendWeeklyNewNotes,
		trendWeeklyModifiedNotes,
		trendMonthlyNewNotes,
		trendMonthlyModifiedNotes,
		summary,
		selectedDayNotes,
	};
}
