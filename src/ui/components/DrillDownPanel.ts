import type { DashboardData, FilterState } from "../../types";
import { addDays, endOfMonth, parseDateKey, toDateKey } from "../../utils/date";

interface DrillDownPanelProps {
	data: DashboardData;
	onOpenNote: (path: string) => Promise<void>;
}

export function renderDrillDownPanel(
	container: HTMLElement,
	props: DrillDownPanelProps,
): void {
	const { data, onOpenNote } = props;

	container.empty();
	container.addClass("vault-activity-panel");

	const header = container.createDiv({ cls: "vault-activity-panel-header" });
	const isRangeView =
		data.filters.trendWindow === "yearly" ||
		data.filters.trendWindow === "all-time";
	const drilldownTitle = isRangeView ? "Range drill-down" : "Day drill-down";
	const selectionLabel =
		data.filters.selectedDay == null
			? isRangeView
				? "No range selected"
				: "No day selected"
			: isRangeView
				? formatRangeLabel(
						data.filters.selectedDay,
						data.filters.trendWindow,
					)
				: formatDateDisplay(data.filters.selectedDay);

	header.createEl("h3", { text: drilldownTitle });
	header.createEl("div", {
		cls: "vault-activity-panel-meta",
		text: selectionLabel,
	});

	const notesLabel =
		data.filters.trendMetric === "modified-notes"
			? "modified notes"
			: "new notes";
	header.createEl("span", {
		cls: "vault-activity-panel-meta",
		text: `${data.selectedDayNotes.length} ${notesLabel}`,
	});

	if (!data.filters.selectedDay) {
		const emptyCopy = isRangeView
			? "Select a trend point to view notes for that range."
			: "Select a trend point to view notes for that day.";
		container.createDiv({ cls: "vault-activity-empty", text: emptyCopy });
		return;
	}

	if (data.selectedDayNotes.length === 0) {
		const emptyLabel = isRangeView ? "range" : "day";
		container.createDiv({
			cls: "vault-activity-empty",
			text: `No notes matched the selected ${emptyLabel}`,
		});
		return;
	}

	const list = container.createDiv({ cls: "vault-activity-note-list" });

	data.selectedDayNotes.forEach((note) => {
		const item = list.createDiv({ cls: "vault-activity-note-item" });
		item.setAttribute("role", "button");
		item.setAttribute("tabindex", "0");
		item.setAttribute("aria-label", `Open ${note.title}`);

		const openNote = async () => {
			await onOpenNote(note.path);
		};

		item.onclick = async () => {
			await openNote();
		};
		item.onkeydown = async (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				await openNote();
			}
		};

		const button = item.createEl("button", {
			text: note.title,
			attr: { type: "button" },
		});
		button.onclick = async (event) => {
			event.stopPropagation();
			await openNote();
		};

		if (note.tags.length > 0) {
			const tags = item.createDiv({ cls: "vault-activity-note-tags" });
			note.tags.forEach((tag) => {
				tags.createSpan({
					cls: "tag vault-activity-note-tag",
					text: `#${tag}`,
				});
			});
		}
	});
}

function formatDateDisplay(dateKey: string): string {
	const date = parseDateKey(dateKey);
	const day = `${date.getDate()}`.padStart(2, "0");
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const year = `${date.getFullYear()}`;
	return `${day}-${month}-${year}`;
}

function formatRangeLabel(
	anchorDateKey: string,
	trendWindow: FilterState["trendWindow"],
): string {
	const start = parseDateKey(anchorDateKey);
	const end =
		trendWindow === "yearly" ? addDays(start, 6) : endOfMonth(start);
	return `${formatDateDisplay(anchorDateKey)} to ${formatDateDisplay(toDateKey(end))}`;
}
