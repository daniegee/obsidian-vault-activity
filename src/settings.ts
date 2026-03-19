import { App, PluginSettingTab, Setting } from "obsidian";
import { sanitiseFolderFilters } from "./indexer/common/folderFilters";
import type VaultActivityPlugin from "./main";
import type {
	StreakCalculationMode,
	VaultActivityPluginSettings,
} from "./types";

export const DEFAULT_SETTINGS: VaultActivityPluginSettings = {
	dashboardIncludeFolders: [],
	dashboardExcludeFolders: ["Templates"],
	streakCalculationMode: "new-and-modified",
	createdDateProperty: "Date",
	modifiedDateProperty: "Last modified",
	autoRefresh: true,
	refreshDebounceMs: 400,
};

const STREAK_MODE_OPTIONS: Array<{
	value: StreakCalculationMode;
	label: string;
}> = [
	{ value: "new-only", label: "New notes only" },
	{ value: "modified-only", label: "Modified notes only" },
	{ value: "new-and-modified", label: "New or modified notes (either)" },
];

export class VaultActivitySettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: VaultActivityPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Dashboard").setHeading();

		new Setting(containerEl)
			.setName("Dashboard include folders")
			.setDesc(
				"Optional include scope for all dashboard visuals and drill-down lists. When set, only notes in these folders are counted.",
			)
			.addTextArea((text) => {
				text.setValue(
					this.plugin.settings.dashboardIncludeFolders.join("\n"),
				).onChange(async (value) => {
					this.plugin.settings.dashboardIncludeFolders =
						sanitiseFolderFilters(value);
					await this.plugin.persistSettings();
					this.plugin.scheduleRefresh(
						"settings:dashboard-include",
						true,
					);
				});
				text.inputEl.rows = 4;
				text.inputEl.addClass("vault-activity-settings-textarea");
			});

		new Setting(containerEl)
			.setName("Dashboard exclude folders")
			.setDesc(
				"Exclude scope for all dashboard visuals and drill-down lists. Applied when include folders are empty.",
			)
			.addTextArea((text) => {
				text.setPlaceholder(
					DEFAULT_SETTINGS.dashboardExcludeFolders.join("\n"),
				)
					.setValue(
						this.plugin.settings.dashboardExcludeFolders.join("\n"),
					)
					.onChange(async (value) => {
						this.plugin.settings.dashboardExcludeFolders =
							sanitiseFolderFilters(value);
						await this.plugin.persistSettings();
						this.plugin.scheduleRefresh(
							"settings:dashboard-exclude",
							true,
						);
					});
				text.inputEl.rows = 4;
				text.inputEl.addClass("vault-activity-settings-textarea");
			});

		new Setting(containerEl)
			.setName("Streak calculation mode")
			.setDesc(
				"Choose which activity type can mark a day as active in streak calculations.",
			)
			.addDropdown((dropdown) => {
				for (const option of STREAK_MODE_OPTIONS) {
					dropdown.addOption(option.value, option.label);
				}
				dropdown
					.setValue(this.plugin.settings.streakCalculationMode)
					.onChange((value) => {
						this.plugin.settings.streakCalculationMode =
							value as StreakCalculationMode;
						void (async () => {
							await this.plugin.persistSettings();
							this.plugin.scheduleRefresh(
								"settings:streak-calculation-mode",
								true,
							);
						})();
					});
			});

		new Setting(containerEl)
			.setName("Created date property")
			.setDesc(
				"Frontmatter property used to timestamp new-note activity for trends and drill-down lists (falls back to file creation time when missing or invalid).",
			)
			.addText((text) => {
				text.setPlaceholder(DEFAULT_SETTINGS.createdDateProperty)
					.setValue(this.plugin.settings.createdDateProperty)
					.onChange((value) => {
						this.plugin.settings.createdDateProperty = value.trim();
						void (async () => {
							await this.plugin.persistSettings();
							this.plugin.scheduleRefresh(
								"settings:created-date-property",
								true,
							);
						})();
					});
			});

		new Setting(containerEl)
			.setName("Modified date property")
			.setDesc(
				"Frontmatter property used to timestamp modified-note activity for trends and drill-down lists.",
			)
			.addText((text) => {
				text.setPlaceholder(DEFAULT_SETTINGS.modifiedDateProperty)
					.setValue(this.plugin.settings.modifiedDateProperty)
					.onChange((value) => {
						this.plugin.settings.modifiedDateProperty =
							value.trim();
						void (async () => {
							await this.plugin.persistSettings();
							this.plugin.scheduleRefresh(
								"settings:modified-date-property",
								true,
							);
						})();
					});
			});

		new Setting(containerEl)
			.setName("Auto refresh")
			.setDesc(
				"Refresh dashboard data after file create, modify, delete, or rename events.",
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.autoRefresh)
					.onChange((value) => {
						this.plugin.settings.autoRefresh = value;
						void this.plugin.persistSettings();
					});
			});

		new Setting(containerEl)
			.setName("Refresh delay (ms)")
			.setDesc(
				"Wait time before a file event triggers dashboard recomputation.",
			)
			.addText((text) => {
				text.setPlaceholder(
					DEFAULT_SETTINGS.refreshDebounceMs.toString(),
				)
					.setValue(String(this.plugin.settings.refreshDebounceMs))
					.onChange((value) => {
						const parsed = Number.parseInt(value, 10);
						this.plugin.settings.refreshDebounceMs =
							Number.isFinite(parsed) && parsed >= 0
								? parsed
								: DEFAULT_SETTINGS.refreshDebounceMs;
						void this.plugin.persistSettings();
					});
			});
	}
}
