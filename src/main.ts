import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import {
	VaultActivityIndexer,
	applyRenames,
	filterByTrackedMarkdown,
	readSnapshots,
	removeSnapshots,
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
	private refreshTimer: number | null = null;
	private refreshInFlight: Promise<void> | null = null;
	private rescanRequested = false;
	// Applied at the start of the next scan so a scan in flight can't overwrite a move.
	private pendingRenames: Array<[from: string, to: string]> = [];
	// Deletes seen mid-scan; the scan may already have read those files.
	private deletedDuringScan: string[] = [];
	private indexedProperties: string | undefined;

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
			this.app.vault.on("rename", (file, oldPath) => {
				this.pendingRenames.push([oldPath, file.path]);
				this.scheduleRefresh("rename");
			}),
		);

		await this.refreshIndex("startup", true);
	}

	onunload(): void {
		if (this.refreshTimer != null) {
			window.clearTimeout(this.refreshTimer);
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
			window.clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}

		const delay = immediate ? 0 : this.settings.refreshDebounceMs;
		this.refreshTimer = window.setTimeout(() => {
			this.refreshTimer = null;
			void this.refreshIndex(reason);
		}, delay);
	}

	async refreshIndex(reason: string, silent = false): Promise<void> {
		if (this.refreshInFlight != null) {
			// The running scan may have read files before this change landed.
			this.rescanRequested = true;
			await this.refreshInFlight;
			return;
		}

		this.refreshInFlight = (async () => {
			let nextIndex: IndexerResult;
			do {
				this.rescanRequested = false;
				applyRenames(this.snapshots, this.pendingRenames.splice(0));
				const properties = `${this.settings.createdDateProperty}|${this.settings.modifiedDateProperty}`;
				const indexer = new VaultActivityIndexer(
					this.app.vault,
					this.settings,
					this.snapshots,
					properties === this.indexedProperties,
				);
				nextIndex = await indexer.fullScan();
				for (const path of this.deletedDuringScan.splice(0)) {
					removeSnapshots(nextIndex.snapshots, path);
				}
				this.snapshots = nextIndex.snapshots;
				this.indexedProperties = properties;
			} while (this.rescanRequested);
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
		this.snapshots = readSnapshots(rawData?.snapshots);
		this.indexedProperties = rawData?.indexedProperties;
	}

	private async savePluginData(): Promise<void> {
		await this.saveData({
			settings: this.settings,
			snapshots: this.snapshots,
			indexedProperties: this.indexedProperties,
		} satisfies VaultActivityPluginData);
	}

	private handleVaultChange(reason: string, file: unknown): void {
		const path = (file as { path?: unknown } | null)?.path;
		if (reason === "delete" && typeof path === "string") {
			// Covers folders too; the immediate refresh persists the removal to data.json.
			removeSnapshots(this.snapshots, path);
			if (this.refreshInFlight != null) {
				this.deletedDuringScan.push(path);
			}
			this.scheduleRefresh(reason, true);
			return;
		}

		if (filterByTrackedMarkdown(file)) {
			this.scheduleRefresh(reason);
		}
	}
}
