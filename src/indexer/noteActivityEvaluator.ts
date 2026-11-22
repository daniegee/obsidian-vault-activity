import type { FrontmatterDateProperties, NoteSnapshot } from "../types";
import { hashString } from "./common/noteContent";
import { parseNoteContent } from "./noteContentParser";
import { toDateKey } from "../utils/date";

interface NoteActivityEvaluation {
	snapshot: NoteSnapshot;
	isMeaningful: boolean;
}

export function evaluateNoteActivity(
	content: string,
	mtime: number,
	createdMtime: number,
	previous: NoteSnapshot | undefined,
	properties?: Partial<FrontmatterDateProperties>,
): NoteActivityEvaluation {
	const { body, createdDateMs, lastModifiedDateMs } = parseNoteContent(
		content,
		properties,
	);
	const contentHash = hashString(content);
	// Links live in the body, so a link change is a body change too.
	const bodyHash = hashString(body);

	if (!previous) {
		return {
			isMeaningful: true,
			snapshot: {
				createdMtime: createdDateMs ?? createdMtime,
				contentHash,
				bodyHash,
				lastModifiedPropertyMtime: lastModifiedDateMs,
				editHistory: [],
			},
		};
	}

	const isMeaningful = previous.bodyHash !== bodyHash;
	// Only body or link edits count. A modified property bumped alongside them is the
	// user's own edit date, which survives sync rewriting mtime.
	const modifiedPropertyBumpedTo =
		lastModifiedDateMs != null &&
		lastModifiedDateMs !== (previous.lastModifiedPropertyMtime ?? null)
			? lastModifiedDateMs
			: null;
	const editHistory = isMeaningful
		? recordEdit(
				previous.editHistory,
				// On the same day mtime carries the real time of day that a date-only property lacks.
				modifiedPropertyBumpedTo != null &&
					toDateKey(modifiedPropertyBumpedTo) !== toDateKey(mtime)
					? modifiedPropertyBumpedTo
					: mtime,
			)
		: previous.editHistory;

	return {
		isMeaningful,
		snapshot: {
			// Keep the stored date when the property is missing: it may be a renamed note's adopted creation date.
			createdMtime: createdDateMs ?? previous.createdMtime,
			contentHash,
			bodyHash,
			lastModifiedPropertyMtime: lastModifiedDateMs,
			editHistory,
		},
	};
}

// One entry per local day (the latest edit that day) keeps the history small.
function recordEdit(history: number[], editedAt: number): number[] {
	const day = toDateKey(editedAt);
	const sameDay = history.find((at) => toDateKey(at) === day) ?? editedAt;
	return [
		...history.filter((at) => toDateKey(at) !== day),
		Math.max(sameDay, editedAt),
	].sort((left, right) => left - right);
}
