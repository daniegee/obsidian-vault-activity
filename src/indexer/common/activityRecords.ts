import type { ActivityRecord } from "../../types";

/** The note's creation event; it stays put after later edits change the note's signal. */
export function toCreatedRecord(note: ActivityRecord): ActivityRecord {
	return {
		...note,
		effectiveMtime: note.createdMtime,
		signal: "note-created",
	};
}

/** One record per day the note was edited. */
export function toModifiedRecords(note: ActivityRecord): ActivityRecord[] {
	return note.editHistory.map((editedAt) => ({
		...note,
		effectiveMtime: editedAt,
		signal: "body-edit",
	}));
}
