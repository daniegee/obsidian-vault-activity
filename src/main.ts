import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import {
	VaultActivityIndexer,
	filterByTrackedMarkdown,
} from "./indexer/vaultIndexer";
import { DEFAULT_SETTINGS, VaultActivitySettingTab } from "./settings";
import type {
	IndexerResult,
	VaultActivityPluginData,
	VaultActivityPluginSettings,
} from "./types";
import {
	VaultActivityDashboardView,
	VIEW_TYPE_VAULT_ACTIVITY,
} from "./ui/DashboardView";

export default class VaultActivityPlugin extends Plugin {
	settings: VaultActivityPluginSettings = DEFAULT_SETTINGS;
	snapshots: VaultActivityPluginData["snapshots"] = {};

	private latestIndex: IndexerResult | null = null;
	private readonly views = new Set<VaultActivityDashboardView>();
	private refreshTimer: ReturnType<typeof globalThis.setTimeout> | null =
		null;
	private refreshInFlight: Promise<void> | null = null;

	async onload(): Promise<void> {
		await this.loadPluginData();

		this.addSettingTab(new VaultActivitySettingTab(this.app, this));

		this.registerView(
			VIEW_TYPE_VAULT_ACTIVITY,
			(leaf) => new VaultActivityDashboardView(leaf, this),
		);

		this.addRibbonIcon("activity", "Open vault activity", async () => {
			await this.openDashboard();
		});

		this.addCommand({
			id: "open-dashboard",
			name: "Open dashboard",
			callback: async () => this.openDashboard(),
		});

		this.addCommand({
			id: "refresh-dashboard-data",
			name: "Refresh dashboard data",
			callback: async () => this.refreshIndex("command"),
		});

		this.registerEvent(
			this.app.vault.on("modify", (file) =>
				this.handleVaultChange("modify", file),
			),
		);
		this.registerEvent(
			this.app.vault.on("create", (file) =>
				this.handleVaultChange("create", file),
			),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) =>
				this.handleVaultChange("delete", file),
			),
		);
		this.registerEvent(
			this.app.vault.on("rename", (file) =>
				this.handleVaultChange("rename", file),
			),
		);

		await this.refreshIndex("startup", true);
	}

	onunload(): void {
		if (this.refreshTimer != null) {
			globalThis.clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}
	}

	registerDashboardView(view: VaultActivityDashboardView): void {
		this.views.add(view);
		if (this.latestIndex) {
			view.setIndexResult(this.latestIndex);
		}
	}

	unregisterDashboardView(view: VaultActivityDashboardView): void {
		this.views.delete(view);
	}

	async persistSettings(): Promise<void> {
		await this.savePluginData();
	}

	scheduleRefresh(reason: string, immediate = false): void {
		if (!this.settings.autoRefresh && !immediate) {
			return;
		}

		if (this.refreshTimer != null) {
			globalThis.clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}

		const delay = immediate ? 0 : this.settings.refreshDebounceMs;
		this.refreshTimer = globalThis.setTimeout(() => {
			this.refreshTimer = null;
			void this.refreshIndex(reason);
		}, delay);
	}

	async refreshIndex(reason: string, silent = false): Promise<void> {
		if (this.refreshInFlight != null) {
			await this.refreshInFlight;
			return;
		}

		this.refreshInFlight = (async () => {
			const indexer = new VaultActivityIndexer(
				this.app.vault,
				this.settings,
				this.snapshots,
			);
			const nextIndex = await indexer.fullScan();
			this.snapshots = nextIndex.snapshots;
			this.latestIndex = nextIndex;
			await this.savePluginData();
			this.views.forEach((view) => view.setIndexResult(nextIndex));
			if (!silent) {
				new Notice(
					`Vault activity refreshed${reason ? ` (${reason})` : ""}.`,
				);
			}
		})();

		try {
			await this.refreshInFlight;
		} finally {
			this.refreshInFlight = null;
		}
	}

	async openDashboard(): Promise<void> {
		let leaf: WorkspaceLeaf | null = null;
		const existingLeaves = this.app.workspace.getLeavesOfType(
			VIEW_TYPE_VAULT_ACTIVITY,
		);
		if (existingLeaves.length > 0) {
			leaf = existingLeaves[0] ?? null;
		} else {
			leaf = this.app.workspace.getRightLeaf(false);
			await leaf?.setViewState({
				type: VIEW_TYPE_VAULT_ACTIVITY,
				active: true,
			});
		}

		if (leaf) {
			void this.app.workspace.revealLeaf(leaf);
		}
	}

	private async loadPluginData(): Promise<void> {
		const rawData =
			(await this.loadData()) as Partial<VaultActivityPluginData> | null;
		this.settings = {
			...DEFAULT_SETTINGS,
			...(rawData?.settings ?? undefined),
		};
		this.snapshots = rawData?.snapshots ?? {};
	}

	private async savePluginData(): Promise<void> {
		await this.saveData({
			settings: this.settings,
			snapshots: this.snapshots,
		} satisfies VaultActivityPluginData);
	}

	private handleVaultChange(reason: string, file: unknown): void {
		if (reason === "delete" && filterByTrackedMarkdown(file)) {
			delete this.snapshots[file.path];
			this.scheduleRefresh(reason, true);
			return;
		}

		if (filterByTrackedMarkdown(file)) {
			this.scheduleRefresh(reason);
		}
	}
}
