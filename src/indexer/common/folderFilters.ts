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
	const includeFolders = filters.includeFolders;
	const excludeFolders = filters.excludeFolders;

	return notes.filter((note) => {
		const matchesInclude =
			includeFolders.length === 0
				? true
				: includeFolders.some((folder) =>
						matchesFolderFilter(note.folder, folder),
					);

		if (!matchesInclude) {
			return false;
		}

		if (includeFolders.length > 0) {
			return true;
		}

		const matchesExclude = excludeFolders.some((folder) =>
			matchesFolderFilter(note.folder, folder),
		);
		return !matchesExclude;
	});
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
