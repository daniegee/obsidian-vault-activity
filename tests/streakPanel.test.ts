import { describe, expect, it } from "vitest";

import { renderStreakPanel } from "../src/ui/components/StreakPanel";
import type { DashboardData } from "../src/types";

type ElementOptions = {
	cls?: string;
	text?: string;
	attr?: Record<string, string>;
};

class MockElement {
	tagName: string;
	classes: string[] = [];
	textContent = "";
	attrs: Record<string, string> = {};
	children: MockElement[] = [];

	constructor(tagName: string) {
		this.tagName = tagName;
	}

	empty(): void {
		this.children = [];
	}

	addClass(cls: string): void {
		this.classes.push(...cls.split(/\s+/).filter(Boolean));
	}

	setAttribute(name: string, value: string): void {
		this.attrs[name] = value;
	}

	createDiv(options: ElementOptions = {}): MockElement {
		return this.createChild("div", options);
	}

	createSpan(options: ElementOptions = {}): MockElement {
		return this.createChild("span", options);
	}

	createEl(tagName: string, options: ElementOptions = {}): MockElement {
		return this.createChild(tagName, options);
	}

	findByClass(targetClass: string): MockElement[] {
		const matches: MockElement[] = [];

		if (this.classes.includes(targetClass)) {
			matches.push(this);
		}

		for (const child of this.children) {
			matches.push(...child.findByClass(targetClass));
		}

		return matches;
	}

	private createChild(tagName: string, options: ElementOptions): MockElement {
		const child = new MockElement(tagName);

		if (options.cls) {
			child.addClass(options.cls);
		}

		if (options.text) {
			child.textContent = options.text;
		}

		if (options.attr) {
			for (const [key, value] of Object.entries(options.attr)) {
				child.setAttribute(key, value);
			}
		}

		this.children.push(child);
		return child;
	}
}

function createDashboardData(
	overrides: Partial<DashboardData["summary"]>,
): DashboardData {
	return {
		generatedAt: 0,
		filters: {
			includeFolders: [],
			excludeFolders: [],
			streakCalculationMode: "new-and-modified",
			trendWindow: "monthly",
			trendMetric: "new-notes",
			selectedDay: null,
		},
		scopedNotes: [],
		dailyNewNotes: [],
		dailyModifiedNotes: [],
		trendWeeklyNewNotes: [],
		trendWeeklyModifiedNotes: [],
		trendMonthlyNewNotes: [],
		trendMonthlyModifiedNotes: [],
		selectedDayNotes: [],
		summary: {
			mostActiveDayLabel: "Monday",
			activityRhythmLabel: "Early Riser",
			currentStreak: 1,
			streakNeedsActionToday: false,
			streakActionHint: null,
			longestStreak: 2,
			...overrides,
		},
	};
}

describe("streak panel", () => {
	it("shows warning icon when action is needed and hint is present", () => {
		const container = new MockElement("div");
		const data = createDashboardData({
			streakNeedsActionToday: true,
			streakActionHint:
				"No qualifying activity yet today. Create a new note to keep your streak alive.",
		});

		renderStreakPanel(container as unknown as HTMLElement, data);

		const warningIcons = container.findByClass(
			"vault-activity-kpi-warning-icon",
		);
		expect(warningIcons).toHaveLength(1);
		expect(warningIcons[0]!.attrs["aria-label"]).toBe(
			data.summary.streakActionHint,
		);
		expect(warningIcons[0]!.attrs["tabindex"]).toBe("0");
	});

	it("hides warning icon when action is not needed", () => {
		const container = new MockElement("div");
		const data = createDashboardData({
			streakNeedsActionToday: false,
			streakActionHint: null,
		});

		renderStreakPanel(container as unknown as HTMLElement, data);

		expect(
			container.findByClass("vault-activity-kpi-warning-icon"),
		).toHaveLength(0);
	});

	it("hides warning icon when hint is missing even if needs-action is true", () => {
		const container = new MockElement("div");
		const data = createDashboardData({
			streakNeedsActionToday: true,
			streakActionHint: null,
		});

		renderStreakPanel(container as unknown as HTMLElement, data);

		expect(
			container.findByClass("vault-activity-kpi-warning-icon"),
		).toHaveLength(0);
	});
});
