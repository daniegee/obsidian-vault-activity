import type { TFile, Vault } from "obsidian";
import type {
	ActivityRecord,
	IndexerResult,
	NoteSnapshot,
	VaultActivityPluginSettings,
} from "../types";
import { isFolderInScope } from "./common/folderFilters";
import {
	extractTitle,
	hashString,
	normalizeFolderPath,
} from "./common/noteContent";
import { evaluateNoteActivity } from "./noteActivityEvaluator";

export class VaultActivityIndexer {
	constructor(
		private readonly vault: Vault,
		private readonly settings: VaultActivityPluginSettings,
		private readonly previousSnapshots: Record<string, NoteSnapshot>,
		// Skip reading files whose mtime matches their snapshot. Off when parsing rules changed.
		private readonly reuseUnchanged = false,
	) {}

	async fullScan(): Promise<IndexerResult> {
		const markdownFiles = this.vault.getMarkdownFiles();
		const livePaths = new Set(markdownFiles.map((file) => file.path));
		// Snapshots whose file is gone: notes renamed while Obsidian was closed can reclaim them.
		const orphans = Object.entries(this.previousSnapshots)
			.filter(([path]) => !livePaths.has(path))
			.map(([, snapshot]) => snapshot);
		const nextSnapshots: Record<string, NoteSnapshot> = {};
		const notes: ActivityRecord[] = [];
		const folderSet = new Set<string>();
		const firstIndex = Object.keys(this.previousSnapshots).length === 0;

		// Capture paths now: a rename mid-scan mutates the file objects.
		for (const [path, file] of markdownFiles.map(
			(file) => [file.path, file] as const,
		)) {
			const inScope = isFolderInScope(
				normalizeFolderPath(path),
				this.settings.dashboardIncludeFolders,
				this.settings.dashboardExcludeFolders,
			);
			if (!inScope) {
				// Folder filters only hide notes; keep their stored history untouched.
				const kept = this.previousSnapshots[path];
				if (kept) {
					nextSnapshots[path] = kept;
				} else if (orphans.some((o) => o.fileMtime === file.stat.mtime)) {
					// Moved into a hidden folder while closed: keep its history, unevaluated.
					try {
						const moved = adoptOrphan(
							orphans,
							hashString(await this.vault.read(file)),
							file.stat.mtime,
						);
						if (moved) {
							nextSnapshots[path] = moved;
						}
					} catch {
						// Unreadable mid-scan: skip, the follow-up scan settles it.
					}
				}
				continue;
			}

			const snapshot = await this.scanFile(file, path, orphans, firstIndex);
			if (!snapshot) {
				continue;
			}

			nextSnapshots[path] = snapshot;
			notes.push(toActivityRecord(path, snapshot));
			folderSet.add(normalizeFolderPath(path));
		}

		notes.sort((left, right) => right.effectiveMtime - left.effectiveMtime);

		return {
			notes,
			snapshots: nextSnapshots,
			folders: Array.from(folderSet).sort((left, right) =>
				left.localeCompare(right),
			),
			generatedAt: Date.now(),
		};
	}

	private async scanFile(
		file: TFile,
		path: string,
		orphans: NoteSnapshot[],
		firstIndex: boolean,
	): Promise<NoteSnapshot | undefined> {
		let previous = this.previousSnapshots[path];
		if (
			this.reuseUnchanged &&
			previous?.fileMtime === file.stat.mtime &&
			previous.fileSize === file.stat.size
		) {
			return previous;
		}

		let content: string;
		try {
			content = await this.vault.read(file);
		} catch {
			// Moved or deleted mid-scan: keep what we had, the follow-up scan settles it.
			return previous;
		}

		previous ??= adoptOrphan(
			orphans,
			hashString(content),
			file.stat.mtime,
		);
		const seed = firstIndex && !previous;
		const { snapshot } = evaluateNoteActivity(
			content,
			file.stat.mtime,
			file.stat.ctime,
			previous,
			{
				createdDateProperty: this.settings.createdDateProperty,
				modifiedDateProperty: this.settings.modifiedDateProperty,
			},
		);
		// shortcut: an empty vault's first new note is seeded too, rare enough to accept.
		const editHistory =
			seed && snapshot.lastModifiedPropertyMtime != null
				? [snapshot.lastModifiedPropertyMtime]
				: snapshot.editHistory;
		return {
			...snapshot,
			editHistory,
			fileMtime: file.stat.mtime,
			fileSize: file.stat.size,
		};
	}
}

/** Moves snapshots for renamed notes (or every note under a renamed folder) so history follows. */
export function applyRenames(
	snapshots: Record<string, NoteSnapshot>,
	renames: Array<[from: string, to: string]>,
): void {
	for (const [from, to] of renames) {
		for (const [path, snapshot] of Object.entries(snapshots)) {
			if (path !== from && !path.startsWith(`${from}/`)) {
				continue;
			}
			delete snapshots[path];
			snapshots[to + path.slice(from.length)] = snapshot;
		}
	}
}

/** Keeps only the stored fields: older data.json versions carried more, and no edit history. */
export function readSnapshots(
	// 1.1.9 and earlier wrote no edit history, only these older fields.
	raw:
		| Record<
				string,
				Omit<NoteSnapshot, "editHistory"> & {
					editHistory?: number[];
					lastContentEditMtime?: number | null;
					lastMeaningfulMtime?: number | null;
					lastMeaningfulSignal?: string | null;
				}
		  >
		| undefined,
): Record<string, NoteSnapshot> {
	const snapshots: Record<string, NoteSnapshot> = {};
	for (const [path, stored] of Object.entries(raw ?? {})) {
		// Upgrading from 1.1.9: its newest stored edit time is the one past edit we know of.
		const seed =
			stored.lastModifiedPropertyMtime ??
			stored.lastContentEditMtime ??
			(stored.lastMeaningfulSignal !== "note-created"
				? stored.lastMeaningfulMtime
				: null);
		snapshots[path] = {
			createdMtime: stored.createdMtime,
			contentHash: stored.contentHash,
			bodyHash: stored.bodyHash,
			lastModifiedPropertyMtime: stored.lastModifiedPropertyMtime,
			editHistory: stored.editHistory ?? (seed != null ? [seed] : []),
			fileMtime: stored.fileMtime,
			fileSize: stored.fileSize,
		};
	}
	return snapshots;
}

/** Drops the snapshot at a path, or every snapshot under a deleted folder. */
export function removeSnapshots(
	snapshots: Record<string, NoteSnapshot>,
	path: string,
): void {
	for (const key of Object.keys(snapshots)) {
		if (key === path || key.startsWith(`${path}/`)) {
			delete snapshots[key];
		}
	}
}

// A move or rename keeps the file's mtime; a new note from a template doesn't.
function adoptOrphan(
	orphans: NoteSnapshot[],
	contentHash: string,
	fileMtime: number,
): NoteSnapshot | undefined {
	const index = orphans.findIndex(
		(orphan) =>
			orphan.contentHash === contentHash && orphan.fileMtime === fileMtime,
	);
	return index === -1 ? undefined : orphans.splice(index, 1)[0];
}

function toActivityRecord(
	path: string,
	snapshot: NoteSnapshot,
): ActivityRecord {
	const { editHistory } = snapshot;
	const lastEdit = editHistory[editHistory.length - 1];
	return {
		path,
		title: extractTitle(path),
		folder: normalizeFolderPath(path),
		effectiveMtime: lastEdit ?? snapshot.createdMtime,
		signal: lastEdit == null ? "note-created" : "body-edit",
		createdMtime: snapshot.createdMtime,
		editHistory,
	};
}

export function filterByTrackedMarkdown(file: unknown): file is TFile {
	return (
		typeof file === "object" &&
		file != null &&
		"path" in file &&
		"extension" in file &&
		file.extension === "md"
	);
}
