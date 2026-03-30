import { ItemView, WorkspaceLeaf } from "obsidian";
import type VaultActivityPlugin from "../main";
import type { FilterState, IndexerResult } from "../types";
import { buildDashboardData } from "../indexer/aggregates";
import { renderDrillDownPanel } from "./components/DrillDownPanel";
import { renderStreakPanel } from "./components/StreakPanel";
import { renderTrendChart } from "./components/TrendChart";

export const VIEW_TYPE_VAULT_ACTIVITY = "vault-activity-dashboard";

export class VaultActivityDashboardView extends ItemView {
	private indexResult: IndexerResult | null = null;
	private filters: FilterState;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: VaultActivityPlugin,
	) {
		super(leaf);
		this.filters = this.createDefaultFilters();
	}

	getViewType(): string {
		return VIEW_TYPE_VAULT_ACTIVITY;
	}

	getDisplayText(): string {
		return "Vault activity";
	}

	getIcon(): string {
		return "activity";
	}

	onOpen(): Promise<void> {
		this.plugin.registerDashboardView(this);
		this.render();
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.plugin.unregisterDashboardView(this);
		return Promise.resolve();
	}

	setIndexResult(result: IndexerResult): void {
		this.indexResult = result;
		this.render();
	}

	private createDefaultFilters(): FilterState {
		return {
			includeFolders: [...this.plugin.settings.dashboardIncludeFolders],
			excludeFolders: [...this.plugin.settings.dashboardExcludeFolders],
			streakCalculationMode: this.plugin.settings.streakCalculationMode,
			trendWindow: "weekly",
			trendMetric: "new-notes",
			selectedDay: null,
		};
	}

	private withSettingsFolders(filters: FilterState): FilterState {
		return {
			...filters,
			includeFolders: [...this.plugin.settings.dashboardIncludeFolders],
			excludeFolders: [...this.plugin.settings.dashboardExcludeFolders],
			streakCalculationMode: this.plugin.settings.streakCalculationMode,
		};
	}

	private render(): void {
		const content = this.contentEl;
		content.empty();
		content.addClass("vault-activity-dashboard");

		const header = content.createDiv({ cls: "vault-activity-header" });
		header.createEl("h1", { text: "Vault activity" });

		if (!this.indexResult) {
			const state = content.createDiv({ cls: "vault-activity-empty" });
			state.setText("Indexing vault activity data...");
			return;
		}

		const effectiveFilters = this.withSettingsFolders(this.filters);
		const data = buildDashboardData(
			this.indexResult.notes,
			effectiveFilters,
		);
		const modules = content.createDiv({ cls: "vault-activity-layout" });

		const streak = modules.createDiv({
			cls: "vault-activity-layout-block",
		});
		renderStreakPanel(streak, data);

		const trend = modules.createDiv({ cls: "vault-activity-layout-block" });
		renderTrendChart(trend, {
			data,
			window: this.filters.trendWindow,
			metric: this.filters.trendMetric,
			onWindowChange: (trendWindow) => {
				this.filters = {
					...this.filters,
					trendWindow,
					selectedDay: null,
				};
				this.render();
			},
			onMetricChange: (trendMetric) => {
				this.filters = {
					...this.filters,
					trendMetric,
					selectedDay: null,
				};
				this.render();
			},
			onSelectDay: (day) => {
				this.filters = {
					...this.filters,
					selectedDay: this.filters.selectedDay === day ? null : day,
				};
				this.render();
			},
		});

		const drilldown = modules.createDiv({
			cls: "vault-activity-layout-block",
		});
		renderDrillDownPanel(drilldown, {
			data,
			onOpenNote: async (path) => {
				await this.app.workspace.openLinkText(path, "", true);
			},
		});
	}
}
