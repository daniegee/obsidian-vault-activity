import type {
	ActivitySignal,
	FrontmatterDateProperties,
	NoteSnapshot,
} from "../types";
import {
	extractTitle,
	hashString,
	normalizeFolderPath,
} from "./common/noteContent";
import { parseNoteContent } from "./noteContentParser";

interface NoteActivityEvaluation {
	snapshot: NoteSnapshot;
	isMeaningful: boolean;
	signal: ActivitySignal | null;
}

export function evaluateNoteActivity(
	path: string,
	content: string,
	mtime: number,
	createdMtime: number,
	previous: NoteSnapshot | undefined,
	properties?: Partial<FrontmatterDateProperties>,
): NoteActivityEvaluation {
	const {
		body,
		links,
		tags,
		propertyHash,
		createdDateMs,
		lastModifiedDateMs,
	} = parseNoteContent(content, properties);
	const contentHash = hashString(content);
	const bodyHash = hashString(body);
	const linkHash = hashString(links.join("|"));
	const folder = normalizeFolderPath(path);
	const title = extractTitle(path);
	const resolvedModifiedMtime = lastModifiedDateMs ?? mtime;

	if (!previous) {
		const signal: ActivitySignal = "note-created";
		const initialCreatedMtime = createdDateMs ?? createdMtime;
		return {
			isMeaningful: true,
			signal,
			snapshot: {
				path,
				folder,
				title,
				createdMtime,
				contentHash,
				bodyHash,
				linkHash,
				propertyHash,
				tags,
				lastMeaningfulMtime: initialCreatedMtime,
				lastModifiedPropertyMtime: lastModifiedDateMs,
				lastContentEditMtime: null,
				lastPropertyEditMtime: null,
				lastMeaningfulSignal: signal,
			},
		};
	}

	const bodyChanged = previous.bodyHash !== bodyHash;
	const linksChanged = previous.linkHash !== linkHash;
	const propertiesChanged =
		previous.propertyHash == null
			? false
			: previous.propertyHash !== propertyHash;
	const isMeaningful = bodyChanged || linksChanged;
	const lastContentEditMtime = isMeaningful
		? mtime
		: (previous.lastContentEditMtime ?? null);
	const lastPropertyEditMtime =
		propertiesChanged && lastModifiedDateMs == null
			? mtime
			: (previous.lastPropertyEditMtime ?? null);
	const signal: ActivitySignal | null = linksChanged
		? "linking-edit"
		: bodyChanged
			? "body-edit"
			: null;
	const lastMeaningfulMtime = isMeaningful
		? resolvedModifiedMtime
		: previous.lastMeaningfulMtime;
	const lastMeaningfulSignal = isMeaningful
		? signal
		: previous.lastMeaningfulSignal;

	return {
		isMeaningful,
		signal,
		snapshot: {
			path,
			folder,
			title,
			createdMtime: previous.createdMtime ?? createdMtime,
			contentHash,
			bodyHash,
			linkHash,
			propertyHash,
			tags,
			lastMeaningfulMtime,
			lastModifiedPropertyMtime: lastModifiedDateMs,
			lastContentEditMtime,
			lastPropertyEditMtime,
			lastMeaningfulSignal,
		},
	};
}
