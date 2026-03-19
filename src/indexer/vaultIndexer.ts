import type { TFile, Vault } from "obsidian";
import type {
	ActivityRecord,
	IndexerResult,
	NoteSnapshot,
	VaultActivityPluginSettings,
} from "../types";
import { evaluateNoteActivity } from "./noteActivityEvaluator";

export class VaultActivityIndexer {
	constructor(
		private readonly vault: Vault,
		private readonly settings: VaultActivityPluginSettings,
		private readonly previousSnapshots: Record<string, NoteSnapshot>,
	) {}

	async fullScan(): Promise<IndexerResult> {
		const markdownFiles = this.vault.getMarkdownFiles();
		const nextSnapshots: Record<string, NoteSnapshot> = {};
		const notes: ActivityRecord[] = [];
		const folderSet = new Set<string>();

		for (const file of markdownFiles) {
			const content = await this.vault.read(file);
			const evaluation = evaluateNoteActivity(
				file.path,
				content,
				file.stat.mtime,
				file.stat.ctime,
				this.previousSnapshots[file.path],
				{
					createdDateProperty: this.settings.createdDateProperty,
					modifiedDateProperty: this.settings.modifiedDateProperty,
				},
			);

			nextSnapshots[file.path] = evaluation.snapshot;

			if (evaluation.snapshot.lastMeaningfulMtime == null) {
				continue;
			}

			const record: ActivityRecord = {
				path: file.path,
				title: evaluation.snapshot.title,
				folder: evaluation.snapshot.folder,
				tags: evaluation.snapshot.tags,
				effectiveMtime: evaluation.snapshot.lastMeaningfulMtime,
				lastModifiedPropertyMtime:
					evaluation.snapshot.lastModifiedPropertyMtime ?? null,
				lastContentEditMtime:
					evaluation.snapshot.lastContentEditMtime ?? null,
				lastPropertyEditMtime:
					evaluation.snapshot.lastPropertyEditMtime ?? null,
				signal: evaluation.snapshot.lastMeaningfulSignal ?? "body-edit",
			};

			notes.push(record);
			folderSet.add(record.folder);
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
