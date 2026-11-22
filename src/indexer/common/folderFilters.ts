import type { ActivityRecord, FilterState } from "../../types";

export function sanitiseFolderFilters(value: string): string[] {
	return value
		.split(/\r?\n|,/)
		.map((entry) => entry.trim().replace(/^\/+/, "").replace(/\/+$/, ""))
		.filter(Boolean);
}

export function applyFilters(
	notes: ActivityRecord[],
	filters: FilterState,
): ActivityRecord[] {
	return notes.filter((note) =>
		isFolderInScope(
			note.folder,
			filters.includeFolders,
			filters.excludeFolders,
		),
	);
}

/** Include list wins when set; otherwise everything outside the exclude list. */
export function isFolderInScope(
	folder: string,
	includeFolders: string[],
	excludeFolders: string[],
): boolean {
	if (includeFolders.length > 0) {
		return includeFolders.some((include) =>
			matchesFolderFilter(folder, include),
		);
	}
	return !excludeFolders.some((exclude) =>
		matchesFolderFilter(folder, exclude),
	);
}

function matchesFolderFilter(path: string, folder: string): boolean {
	const normalizedPath = path
		.replace(/^\/+/, "")
		.replace(/\/+$/, "")
		.toLowerCase();
	const normalizedFolder = folder
		.replace(/^\/+/, "")
		.replace(/\/+$/, "")
		.toLowerCase();
	if (!normalizedFolder) {
		return false;
	}
	return (
		normalizedPath === normalizedFolder ||
		normalizedPath.startsWith(`${normalizedFolder}/`)
	);
}
