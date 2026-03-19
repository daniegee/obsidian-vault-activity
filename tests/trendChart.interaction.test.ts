import { afterEach, describe, expect, it, vi } from "vitest";

import { renderTrendChart } from "../src/ui/components/TrendChart";
import type { DashboardData } from "../src/types";
import { MockElement, installMockDocument } from "./mocks/dom";

function makeData(): DashboardData {
	return {
		generatedAt: 0,
		filters: {
			includeFolders: [],
			excludeFolders: [],
			streakCalculationMode: "new-and-modified",
			trendWindow: "yearly",
			trendMetric: "new-notes",
			selectedDay: null,
		},
		scopedNotes: [],
		dailyNewNotes: [
			{
				day: "2026-03-10",
				count: 2,
				notes: [],
				folders: { Projects: 2 },
			},
			{
				day: "2026-03-11",
				count: 1,
				notes: [],
				folders: { Projects: 1 },
			},
		],
		dailyModifiedNotes: [
			{
				day: "2026-03-10",
				count: 1,
				notes: [],
				folders: { Projects: 1 },
			},
			{
				day: "2026-03-11",
				count: 3,
				notes: [],
				folders: { Projects: 3 },
			},
		],
		trendWeeklyNewNotes: [
			{
				day: "2026-03-10",
				label: "Mar 10",
				count: 2,
				notes: [],
			},
			{
				day: "2026-03-17",
				label: "Mar 17",
				count: 1,
				notes: [],
			},
		],
		trendWeeklyModifiedNotes: [
			{
				day: "2026-03-10",
				label: "Mar 10",
				count: 1,
				notes: [],
			},
			{
				day: "2026-03-17",
				label: "Mar 17",
				count: 3,
				notes: [],
			},
		],
		trendMonthlyNewNotes: [],
		trendMonthlyModifiedNotes: [],
		selectedDayNotes: [],
		summary: {
			mostActiveDayLabel: "Monday",
			activityRhythmLabel: "Early Riser",
			currentStreak: 1,
			streakNeedsActionToday: false,
			streakActionHint: null,
			longestStreak: 1,
		},
	};
}

describe("trend chart interaction behavior", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("triggers window, metric, and day selection callbacks from UI interactions", () => {
		const restoreDocument = installMockDocument();
		try {
			vi.useFakeTimers();

			const container = new MockElement("div");
			const onWindowChange = vi.fn();
			const onMetricChange = vi.fn();
			const onSelectDay = vi.fn();

			renderTrendChart(container as unknown as HTMLElement, {
				data: makeData(),
				window: "yearly",
				metric: "new-notes",
				onWindowChange,
				onMetricChange,
				onSelectDay,
			});

			const monthlyButton = container
				.findByTag("button")
				.find((button) => button.textContent === "Monthly");
			expect(monthlyButton).toBeDefined();
			monthlyButton?.onclick?.({});
			expect(onWindowChange).toHaveBeenCalledWith("monthly");

			const modifiedButton = container
				.findByTag("button")
				.find((button) => button.textContent === "Modified notes");
			expect(modifiedButton).toBeDefined();
			modifiedButton?.onclick?.({});
			expect(onMetricChange).not.toHaveBeenCalled();
			vi.runOnlyPendingTimers();
			expect(onMetricChange).toHaveBeenCalledWith("modified-notes");

			const groups = container.findByClass("vault-activity-trend-group");
			expect(groups.length).toBeGreaterThan(0);
			groups[0]!.dispatch("click", {});

			expect(onSelectDay).toHaveBeenCalledTimes(1);
			expect(onSelectDay.mock.calls[0]![0]).toMatch(
				/^\d{4}-\d{2}-\d{2}$/,
			);
		} finally {
			restoreDocument();
		}
	});
});
