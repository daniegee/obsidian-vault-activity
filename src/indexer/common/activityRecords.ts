import type { ActivityRecord } from "../../types";

export function toModifiedRecord(note: ActivityRecord): ActivityRecord | null {
	const modifiedPropertyMtime = note.lastModifiedPropertyMtime ?? null;
	if (modifiedPropertyMtime != null) {
		return {
			...note,
			effectiveMtime: modifiedPropertyMtime,
			signal: note.signal === "note-created" ? "body-edit" : note.signal,
		};
	}

	const contentEditMtime = note.lastContentEditMtime ?? null;
	if (contentEditMtime != null) {
		return {
			...note,
			effectiveMtime: contentEditMtime,
			signal: note.signal === "note-created" ? "body-edit" : note.signal,
		};
	}

	const propertyEditMtime = note.lastPropertyEditMtime ?? null;
	if (propertyEditMtime != null) {
		return {
			...note,
			effectiveMtime: propertyEditMtime,
			signal: note.signal === "note-created" ? "body-edit" : note.signal,
		};
	}

	if (note.signal !== "note-created") {
		return note;
	}

	return null;
}
