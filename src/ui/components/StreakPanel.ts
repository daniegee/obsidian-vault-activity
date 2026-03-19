import { setIcon } from "obsidian";
import type { DashboardData } from "../../types";

export function renderStreakPanel(
	container: HTMLElement,
	data: DashboardData,
): void {
	container.empty();
	container.addClass("vault-activity-panel");

	const header = container.createDiv({ cls: "vault-activity-panel-header" });
	header.createEl("h3", { text: "Activity highlights" });

	const stats = container.createDiv({ cls: "vault-activity-streak-stats" });
	const current = stats.createDiv({ cls: "vault-activity-kpi" });
	const currentLabelRow = current.createDiv({
		cls: "vault-activity-kpi-label-row",
	});
	currentLabelRow.createSpan({
		cls: "vault-activity-kpi-label",
		text: "Current streak (days)",
	});

	if (data.summary.streakNeedsActionToday && data.summary.streakActionHint) {
		const warningIcon = currentLabelRow.createSpan({
			cls: "vault-activity-kpi-warning-icon clickable-icon has-tooltip",
		});
		setIcon(warningIcon, "alert-circle");
		warningIcon.setAttribute("aria-label", data.summary.streakActionHint);
		warningIcon.setAttribute("tabindex", "0");
	}

	current.createSpan({
		cls: "vault-activity-kpi-value",
		text: `${data.summary.currentStreak}`,
	});

	const longest = stats.createDiv({ cls: "vault-activity-kpi" });
	longest.createSpan({
		cls: "vault-activity-kpi-label",
		text: "Longest streak (days)",
	});
	longest.createSpan({
		cls: "vault-activity-kpi-value",
		text: `${data.summary.longestStreak}`,
	});

	const funStats = container.createDiv({
		cls: "vault-activity-streak-stats vault-activity-streak-stats--fun",
	});

	const activeDay = funStats.createDiv({ cls: "vault-activity-kpi" });
	activeDay.createSpan({
		cls: "vault-activity-kpi-label",
		text: "Most active day",
	});
	activeDay.createSpan({
		cls: "vault-activity-kpi-value vault-activity-kpi-value--text",
		text: data.summary.mostActiveDayLabel,
	});

	const rhythm = funStats.createDiv({ cls: "vault-activity-kpi" });
	rhythm.createSpan({
		cls: "vault-activity-kpi-label",
		text: "Activity rhythm",
	});
	rhythm.createSpan({
		cls: "vault-activity-kpi-value vault-activity-kpi-value--text",
		text: data.summary.activityRhythmLabel,
	});
}
