import { describe, expect, it, vi } from "vitest";
import type { SettingDefinitionGroup } from "obsidian";

import type VaultActivityPlugin from "../src/main";
import { DEFAULT_SETTINGS, VaultActivitySettingTab } from "../src/settings";
import type { VaultActivityPluginSettings } from "../src/types";

function createTab(overrides: Partial<VaultActivityPluginSettings> = {}) {
	const plugin = {
		settings: { ...DEFAULT_SETTINGS, ...overrides },
		persistSettings: vi.fn().mockResolvedValue(undefined),
		scheduleRefresh: vi.fn(),
	};
	const tab = new VaultActivitySettingTab(
		{} as never,
		plugin as unknown as VaultActivityPlugin,
	);
	return { tab, plugin };
}

function controlKeys(tab: VaultActivitySettingTab): string[] {
	const [group] = tab.getSettingDefinitions() as SettingDefinitionGroup[];
	return (group?.items ?? []).map((item) =>
		"control" in item && item.control ? item.control.key : "",
	);
}

describe("settings tab declarative definitions", () => {
	it("defines one control per plugin setting", () => {
		const { tab } = createTab();
		expect(controlKeys(tab).sort()).toEqual(
			Object.keys(DEFAULT_SETTINGS).sort(),
		);
	});

	it("reads folder lists as one folder per line and other values as-is", () => {
		const { tab } = createTab({
			dashboardIncludeFolders: ["Projects", "Areas/Work"],
			refreshDebounceMs: 250,
		});
		expect(tab.getControlValue("dashboardIncludeFolders")).toBe(
			"Projects\nAreas/Work",
		);
		expect(tab.getControlValue("refreshDebounceMs")).toBe(250);
		expect(tab.getControlValue("autoRefresh")).toBe(true);
	});

	it("normalises folder input, persists and refreshes immediately", async () => {
		const { tab, plugin } = createTab();
		await tab.setControlValue(
			"dashboardExcludeFolders",
			" Archive \n\n/Templates/ ",
		);

		expect(plugin.settings.dashboardExcludeFolders).toEqual([
			"Archive",
			"Templates",
		]);
		expect(plugin.persistSettings).toHaveBeenCalledTimes(1);
		expect(plugin.scheduleRefresh).toHaveBeenCalledWith(
			"settings:dashboard-exclude",
			true,
		);
	});

	it("trims date property names before saving", async () => {
		const { tab, plugin } = createTab();
		await tab.setControlValue("createdDateProperty", "  Created  ");
		expect(plugin.settings.createdDateProperty).toBe("Created");
		expect(plugin.scheduleRefresh).toHaveBeenCalledWith(
			"settings:created-date-property",
			true,
		);
	});

	it("persists auto refresh and delay without rescanning", async () => {
		const { tab, plugin } = createTab();
		await tab.setControlValue("autoRefresh", false);
		await tab.setControlValue("refreshDebounceMs", 900);

		expect(plugin.settings.autoRefresh).toBe(false);
		expect(plugin.settings.refreshDebounceMs).toBe(900);
		expect(plugin.persistSettings).toHaveBeenCalledTimes(2);
		expect(plugin.scheduleRefresh).not.toHaveBeenCalled();
	});

	it("falls back to the default delay for negative or invalid input", async () => {
		const { tab, plugin } = createTab({ refreshDebounceMs: 900 });
		await tab.setControlValue("refreshDebounceMs", -5);
		expect(plugin.settings.refreshDebounceMs).toBe(
			DEFAULT_SETTINGS.refreshDebounceMs,
		);

		await tab.applySetting("refreshDebounceMs", "not a number");
		expect(plugin.settings.refreshDebounceMs).toBe(
			DEFAULT_SETTINGS.refreshDebounceMs,
		);
	});
});
