import type {
	DashboardData,
	TimeWindow,
	TrendMetric,
	TrendPoint,
} from "../../types";
import {
	addDays,
	formatShortDate,
	startOfDay,
	toDateKey,
} from "../../utils/date";

interface TrendChartProps {
	data: DashboardData;
	window: TimeWindow;
	metric: TrendMetric;
	onWindowChange: (window: TimeWindow) => void;
	onMetricChange: (metric: TrendMetric) => void;
	onSelectDay: (day: string) => void;
}

interface MergedTrendPoint {
	day: string;
	label: string;
	newCount: number;
	modifiedCount: number;
}

function pointsForWindow(
	data: DashboardData,
	window: TimeWindow,
	metric: TrendMetric,
): TrendPoint[] {
	const isModified = metric === "modified-notes";

	if (window === "yearly") {
		return isModified
			? data.trendWeeklyModifiedNotes
			: data.trendWeeklyNewNotes;
	}

	if (window === "all-time") {
		return isModified
			? data.trendMonthlyModifiedNotes
			: data.trendMonthlyNewNotes;
	}

	const days = window === "weekly" ? 7 : 30;
	const cutoff = toDateKey(addDays(startOfDay(new Date()), -(days - 1)));
	const daily = isModified ? data.dailyModifiedNotes : data.dailyNewNotes;

	return daily
		.filter((item) => item.day >= cutoff)
		.map((item) => ({
			day: item.day,
			label: formatShortDate(item.day),
			count: item.count,
			notes: item.notes,
		}));
}

function mergeSeries(
	newPoints: TrendPoint[],
	modifiedPoints: TrendPoint[],
): MergedTrendPoint[] {
	const merged = new Map<string, MergedTrendPoint>();

	for (const point of newPoints) {
		merged.set(point.day, {
			day: point.day,
			label: point.label,
			newCount: point.count,
			modifiedCount: 0,
		});
	}

	for (const point of modifiedPoints) {
		const existing = merged.get(point.day);
		if (existing) {
			existing.modifiedCount = point.count;
			continue;
		}

		merged.set(point.day, {
			day: point.day,
			label: point.label,
			newCount: 0,
			modifiedCount: point.count,
		});
	}

	return Array.from(merged.values()).sort((left, right) =>
		left.day.localeCompare(right.day),
	);
}
function buildPolyline(
	points: number[],
	width: number,
	height: number,
	maxValue: number,
): string {
	if (points.length === 0) {
		return "";
	}

	return points
		.map((value, index) => {
			const x =
				points.length === 1
					? width / 2
					: (index / (points.length - 1)) * width;
			const y = height - (value / maxValue) * height;
			return `${x},${y}`;
		})
		.join(" ");
}

export function renderTrendChart(
	container: HTMLElement,
	props: TrendChartProps,
): void {
	const {
		data,
		window,
		metric,
		onWindowChange,
		onMetricChange,
		onSelectDay,
	} = props;
	container.empty();
	container.addClass("vault-activity-panel");

	const header = container.createDiv({
		cls: "vault-activity-panel-header vault-activity-panel-header--stack",
	});
	const titleRow = header.createDiv({ cls: "vault-activity-trend-toolbar" });
	titleRow.createEl("h3", { text: "Activity trend" });

	const controls = titleRow.createDiv({
		cls: "vault-activity-trend-controls",
	});
	const windows: TimeWindow[] = ["weekly", "monthly", "yearly", "all-time"];

	windows.forEach((option) => {
		const label =
			option === "all-time"
				? "All time"
				: option.charAt(0).toUpperCase() + option.slice(1);
		const button = controls.createEl("button", {
			cls: `vault-activity-chip ${window === option ? "is-active" : ""}`,
			text: label,
			attr: { type: "button" },
		});
		button.onclick = () => onWindowChange(option);
	});

	const metricRow = header.createDiv({
		cls: "vault-activity-trend-metric-controls",
	});
	const metricOptions: Array<{ id: TrendMetric; label: string }> = [
		{ id: "new-notes", label: "New notes" },
		{ id: "modified-notes", label: "Modified notes" },
	];
	const activeMetricIndex = metricOptions.findIndex(
		(option) => option.id === metric,
	);
	metricRow.style.setProperty(
		"--vault-activity-metric-index",
		`${Math.max(activeMetricIndex, 0)}`,
	);
	metricRow.createDiv({ cls: "vault-activity-trend-metric-indicator" });

	const metricButtons: HTMLButtonElement[] = [];

	metricOptions.forEach((option) => {
		const button = metricRow.createEl("button", {
			cls: `vault-activity-chip ${metric === option.id ? "is-active" : ""}`,
			text: option.label,
			attr: { type: "button" },
		});
		metricButtons.push(button);
		button.onclick = () => {
			if (metric === option.id) {
				return;
			}

			const nextIndex = metricOptions.findIndex(
				(candidate) => candidate.id === option.id,
			);
			metricRow.style.setProperty(
				"--vault-activity-metric-index",
				`${nextIndex}`,
			);
			metricButtons.forEach((candidateButton, index) => {
				candidateButton.classList.toggle(
					"is-active",
					index === nextIndex,
				);
			});

			globalThis.setTimeout(() => onMetricChange(option.id), 170);
		};
	});

	const mergedSeries = mergeSeries(
		pointsForWindow(data, window, "new-notes"),
		pointsForWindow(data, window, "modified-notes"),
	);

	const newValues = mergedSeries.map((point) => point.newCount);
	const modifiedValues = mergedSeries.map((point) => point.modifiedCount);
	const activeValues =
		metric === "modified-notes" ? modifiedValues : newValues;

	if (mergedSeries.length === 0) {
		container.createDiv({
			cls: "vault-activity-empty",
			text: "No data points are available for this window and metric.",
		});
		return;
	}

	const PAD_X = 14;
	const PAD_Y = 12;
	const CHART_W = 600 - PAD_X * 2;
	const CHART_H = 160 - PAD_Y * 2;

	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 600 180");
	svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
	svg.addClass("vault-activity-trend-chart");
	container.appendChild(svg);

	// Inset group keeps all content away from the SVG boundary so edge nodes aren't clipped.
	const chartGroup = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"g",
	);
	chartGroup.setAttr("transform", `translate(${PAD_X}, ${PAD_Y})`);
	svg.appendChild(chartGroup);

	const max = Math.max(...newValues, ...modifiedValues, 1);

	const newPolyline = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"polyline",
	);
	newPolyline.setAttr("fill", "none");
	newPolyline.setAttr("stroke-width", "4");
	newPolyline.setAttr(
		"points",
		buildPolyline(newValues, CHART_W, CHART_H, max),
	);
	newPolyline.setAttr(
		"class",
		`vault-activity-trend-line vault-activity-trend-line--new ${metric === "new-notes" ? "is-active" : "is-inactive"}`,
	);
	chartGroup.appendChild(newPolyline);

	const modifiedPolyline = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"polyline",
	);
	modifiedPolyline.setAttr("fill", "none");
	modifiedPolyline.setAttr("stroke-width", "4");
	modifiedPolyline.setAttr(
		"points",
		buildPolyline(modifiedValues, CHART_W, CHART_H, max),
	);
	modifiedPolyline.setAttr(
		"class",
		`vault-activity-trend-line vault-activity-trend-line--modified ${metric === "modified-notes" ? "is-active" : "is-inactive"}`,
	);
	chartGroup.appendChild(modifiedPolyline);

	const dots = document.createElementNS("http://www.w3.org/2000/svg", "g");
	chartGroup.appendChild(dots);

	const isAggregated = window === "yearly" || window === "all-time";

	const renderDots = (seriesMetric: TrendMetric, values: number[]) => {
		const isActiveSeries = metric === seriesMetric;
		if (!isActiveSeries) {
			return;
		}

		values.forEach((value, index) => {
			const x =
				values.length === 1
					? CHART_W / 2
					: (index / (values.length - 1)) * CHART_W;
			const y = CHART_H - (value / max) * CHART_H;
			const point = mergedSeries[index]!;
			const isSelected =
				point.day === data.filters.selectedDay &&
				metric === seriesMetric;
			const countLabel =
				seriesMetric === "new-notes" ? "new notes" : "modified notes";
			const seriesLabel = `${point.label}: ${value} ${countLabel}`;

			const group = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"g",
			);
			group.setAttr(
				"class",
				`vault-activity-trend-group vault-activity-trend-group--${seriesMetric === "new-notes" ? "new" : "modified"} is-active`,
			);
			group.setAttr("role", "button");
			group.setAttr("tabindex", "0");
			group.setAttr(
				"aria-label",
				`${seriesLabel}. Click to open ${isAggregated ? "range" : "day"} drill-down details.`,
			);
			group.setAttr("aria-pressed", isSelected ? "true" : "false");

			const dot = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"circle",
			);
			dot.setAttr("cx", `${x}`);
			dot.setAttr("cy", `${y}`);
			dot.setAttr("r", isSelected ? "6" : "4");
			dot.setAttr(
				"class",
				`vault-activity-trend-dot${isSelected ? " is-selected" : ""}`,
			);
			dot.setAttr("pointer-events", "none");

			const hit = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"circle",
			);
			hit.setAttr("cx", `${x}`);
			hit.setAttr("cy", `${y}`);
			hit.setAttr("r", "14");
			hit.setAttr("fill", "transparent");
			hit.setAttr("class", "vault-activity-trend-hit");
			hit.setAttr("title", seriesLabel);

			group.appendChild(dot);
			group.appendChild(hit);
			dots.appendChild(group);

			group.addEventListener("mouseenter", () =>
				dot.setAttr("r", isSelected ? "7" : "6"),
			);
			group.addEventListener("mouseleave", () =>
				dot.setAttr("r", isSelected ? "6" : "4"),
			);

			group.addEventListener("click", () => onSelectDay(point.day));
			group.addEventListener("keydown", (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onSelectDay(point.day);
				}
			});
		});
	};

	renderDots("new-notes", newValues);
	renderDots("modified-notes", modifiedValues);

	const summary = container.createDiv({
		cls: "vault-activity-trend-summary",
	});
	const maxValue = Math.max(...activeValues, 0);
	const total = activeValues.reduce((sum, value) => sum + value, 0);
	const average = activeValues.length > 0 ? total / activeValues.length : 0;
	const peakLabel =
		window === "all-time"
			? "Best month"
			: window === "yearly"
				? "Best week"
				: "Best day";
	const avgLabel =
		window === "all-time"
			? "Avg/month"
			: window === "yearly"
				? "Average/week"
				: "Average/day";

	summary.createSpan({ text: `${peakLabel} count: ${maxValue}` });
	summary.createSpan({ text: `${avgLabel}: ${average.toFixed(1)}` });
	summary.createSpan({ text: `Total in range: ${total}` });
}
