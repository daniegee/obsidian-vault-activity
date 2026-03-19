import { describe, expect, it, vi } from "vitest";
import { WorkspaceLeaf } from "obsidian";

import type VaultActivityPlugin from "../src/main";
import { VaultActivityDashboardView } from "../src/ui/DashboardView";
import type { IndexerResult, VaultActivityPluginSettings } from "../src/types";
import { DEFAULT_SETTINGS } from "../src/settings";
import { MockElement, installMockDocument } from "./mocks/dom";

function createPluginMock(
	settingsOverrides: Partial<VaultActivityPluginSettings> = {},
) {
	return {
		settings: {
			...DEFAULT_SETTINGS,
			...settingsOverrides,
		},
		registerDashboardView: vi.fn(),
		unregisterDashboardView: vi.fn(),
	} as unknown as VaultActivityPlugin;
}

function createIndexResult(): IndexerResult {
	const effectiveMtime = new Date("2026-03-10T12:00:00").getTime();
	return {
		notes: [
			{
				path: "Projects/Launch.md",
				title: "Launch",
				folder: "Projects",
				tags: ["alpha"],
				effectiveMtime,
				lastModifiedPropertyMtime: null,
				lastContentEditMtime: effectiveMtime,
				lastPropertyEditMtime: null,
				signal: "note-created",
			},
		],
		snapshots: {},
		folders: ["Projects"],
		generatedAt: Date.now(),
	};
}

describe("dashboard view smoke", () => {
	it("registers on open, renders loading then dashboard, and unregisters on close", async () => {
		const restoreDocument = installMockDocument();
		try {
			const plugin = createPluginMock();
			const view = new VaultActivityDashboardView(
				new WorkspaceLeaf(),
				plugin,
			);

			const root = new MockElement("div");
			(view as unknown as { contentEl: HTMLElement }).contentEl =
				root as unknown as HTMLElement;
			(
				view as unknown as {
					app: { workspace: { openLinkText: () => Promise<void> } };
				}
			).app = {
				workspace: {
					openLinkText: vi.fn().mockResolvedValue(undefined),
				},
			};

			await view.onOpen();

			expect(plugin.registerDashboardView).toHaveBeenCalledWith(view);
			const loadingStates = root.findByClass("vault-activity-empty");
			expect(
				loadingStates.some((state) =>
					state.textContent.includes("Indexing vault activity data"),
				),
			).toBe(true);

			view.setIndexResult(createIndexResult());

			expect(root.findByClass("vault-activity-layout")).toHaveLength(1);
			const headings = root
				.findByTag("h3")
				.map((element) => element.textContent);
			expect(headings).toContain("Activity highlights");
			expect(headings).toContain("Activity trend");
			expect(headings).toContain("Day drill-down");

			await view.onClose();
			expect(plugin.unregisterDashboardView).toHaveBeenCalledWith(view);
		} finally {
			restoreDocument();
		}
	});
});
