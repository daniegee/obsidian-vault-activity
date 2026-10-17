import {
	App,
	PluginSettingTab,
	Setting,
	type SettingDefinitionItem,
} from "obsidian";
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

type SettingKey = keyof VaultActivityPluginSettings;

const STREAK_MODE_OPTIONS: Array<{
	value: StreakCalculationMode;
	label: string;
}> = [
	{ value: "new-only", label: "New notes only" },
	{ value: "modified-only", label: "Modified notes only" },
	{ value: "new-and-modified", label: "New or modified notes (either)" },
];

// Shared by the declarative definitions (Obsidian 1.13+) and the display()
// fallback for older versions, so both render the same copy.
const SETTING_COPY: Record<SettingKey, { name: string; desc: string }> = {
	dashboardIncludeFolders: {
		name: "Dashboard include folders",
		desc: "Optional include scope for all dashboard visuals and drill-down lists. When set, only notes in these folders are counted.",
	},
	dashboardExcludeFolders: {
		name: "Dashboard exclude folders",
		desc: "Exclude scope for all dashboard visuals and drill-down lists. Applied when include folders are empty.",
	},
	streakCalculationMode: {
		name: "Streak calculation mode",
		desc: "Choose which activity type can mark a day as active in streak calculations.",
	},
	createdDateProperty: {
		name: "Created date property",
		desc: "Frontmatter property used to timestamp new-note activity for trends and drill-down lists (falls back to file creation time when missing or invalid).",
	},
	modifiedDateProperty: {
		name: "Modified date property",
		desc: "Frontmatter property used to timestamp modified-note activity for trends and drill-down lists.",
	},
	autoRefresh: {
		name: "Auto refresh",
		desc: "Refresh dashboard data after file create, modify, delete, or rename events.",
	},
	refreshDebounceMs: {
		name: "Refresh delay (ms)",
		desc: "Wait time before a file event triggers dashboard recomputation.",
	},
};

// Settings that change what the index contains trigger an immediate refresh.
const REFRESH_REASONS: Partial<Record<SettingKey, string>> = {
	dashboardIncludeFolders: "settings:dashboard-include",
	dashboardExcludeFolders: "settings:dashboard-exclude",
	streakCalculationMode: "settings:streak-calculation-mode",
	createdDateProperty: "settings:created-date-property",
	modifiedDateProperty: "settings:modified-date-property",
};

const TEXTAREA_ROWS = 4;

export class VaultActivitySettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: VaultActivityPlugin,
	) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const copy = SETTING_COPY;
		return [
			{
				type: "group",
				heading: "Dashboard",
				cls: "vault-activity-settings-group",
				items: [
					{
						...copy.dashboardIncludeFolders,
						control: {
							type: "textarea",
							key: "dashboardIncludeFolders",
							rows: TEXTAREA_ROWS,
						},
					},
					{
						...copy.dashboardExcludeFolders,
						control: {
							type: "textarea",
							key: "dashboardExcludeFolders",
							placeholder:
								DEFAULT_SETTINGS.dashboardExcludeFolders.join(
									"\n",
								),
							rows: TEXTAREA_ROWS,
						},
					},
					{
						...copy.streakCalculationMode,
						control: {
							type: "dropdown",
							key: "streakCalculationMode",
							options: Object.fromEntries(
								STREAK_MODE_OPTIONS.map((option) => [
									option.value,
									option.label,
								]),
							),
						},
					},
					{
						...copy.createdDateProperty,
						control: {
							type: "text",
							key: "createdDateProperty",
							placeholder: DEFAULT_SETTINGS.createdDateProperty,
						},
					},
					{
						...copy.modifiedDateProperty,
						control: {
							type: "text",
							key: "modifiedDateProperty",
							placeholder: DEFAULT_SETTINGS.modifiedDateProperty,
						},
					},
					{
						...copy.autoRefresh,
						control: { type: "toggle", key: "autoRefresh" },
					},
					{
						...copy.refreshDebounceMs,
						control: {
							type: "number",
							key: "refreshDebounceMs",
							placeholder:
								DEFAULT_SETTINGS.refreshDebounceMs.toString(),
							min: 0,
							step: 1,
						},
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		const value = this.plugin.settings[key as SettingKey];
		// Folder lists are edited as one folder per line.
		return Array.isArray(value) ? value.join("\n") : value;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		await this.applySetting(key as SettingKey, value);
	}

	/**
	 * Normalises, stores and persists one setting, then refreshes the index
	 * when the setting affects what it contains. Used by both rendering paths.
	 */
	async applySetting(key: SettingKey, raw: unknown): Promise<void> {
		const settings = this.plugin.settings;
		const text = typeof raw === "string" ? raw : "";

		switch (key) {
			case "dashboardIncludeFolders":
			case "dashboardExcludeFolders":
				settings[key] = sanitiseFolderFilters(text);
				break;
			case "createdDateProperty":
			case "modifiedDateProperty":
				settings[key] = text.trim();
				break;
			case "streakCalculationMode":
				settings.streakCalculationMode = raw as StreakCalculationMode;
				break;
			case "autoRefresh":
				settings.autoRefresh = raw === true;
				break;
			case "refreshDebounceMs": {
				const parsed =
					typeof raw === "number"
						? Math.trunc(raw)
						: Number.parseInt(text, 10);
				settings.refreshDebounceMs =
					Number.isFinite(parsed) && parsed >= 0
						? parsed
						: DEFAULT_SETTINGS.refreshDebounceMs;
				break;
			}
		}

		await this.plugin.persistSettings();
		const reason = REFRESH_REASONS[key];
		if (reason) {
			this.plugin.scheduleRefresh(reason, true);
		}
	}

	/** Imperative fallback for Obsidian versions older than 1.13.0. */
	display(): void {
		const { containerEl } = this;
		const settings = this.plugin.settings;
		const copy = SETTING_COPY;
		containerEl.empty();

		new Setting(containerEl).setName("Dashboard").setHeading();

		const folderSetting = (
			key: "dashboardIncludeFolders" | "dashboardExcludeFolders",
			placeholder?: string,
		) =>
			new Setting(containerEl)
				.setName(copy[key].name)
				.setDesc(copy[key].desc)
				.addTextArea((text) => {
					if (placeholder) {
						text.setPlaceholder(placeholder);
					}
					text.setValue(settings[key].join("\n")).onChange(
						(value) => void this.applySetting(key, value),
					);
					text.inputEl.rows = TEXTAREA_ROWS;
					text.inputEl.addClass("vault-activity-settings-textarea");
				});

		folderSetting("dashboardIncludeFolders");
		folderSetting(
			"dashboardExcludeFolders",
			DEFAULT_SETTINGS.dashboardExcludeFolders.join("\n"),
		);

		new Setting(containerEl)
			.setName(copy.streakCalculationMode.name)
			.setDesc(copy.streakCalculationMode.desc)
			.addDropdown((dropdown) => {
				for (const option of STREAK_MODE_OPTIONS) {
					dropdown.addOption(option.value, option.label);
				}
				dropdown
					.setValue(settings.streakCalculationMode)
					.onChange(
						(value) =>
							void this.applySetting(
								"streakCalculationMode",
								value,
							),
					);
			});

		const textSetting = (
			key:
				| "createdDateProperty"
				| "modifiedDateProperty"
				| "refreshDebounceMs",
		) =>
			new Setting(containerEl)
				.setName(copy[key].name)
				.setDesc(copy[key].desc)
				.addText((text) => {
					text.setPlaceholder(String(DEFAULT_SETTINGS[key]))
						.setValue(String(settings[key]))
						.onChange(
							(value) => void this.applySetting(key, value),
						);
				});

		textSetting("createdDateProperty");
		textSetting("modifiedDateProperty");

		new Setting(containerEl)
			.setName(copy.autoRefresh.name)
			.setDesc(copy.autoRefresh.desc)
			.addToggle((toggle) => {
				toggle
					.setValue(settings.autoRefresh)
					.onChange(
						(value) => void this.applySetting("autoRefresh", value),
					);
			});

		textSetting("refreshDebounceMs");
	}
}
