const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export function hashString(value: string): string {
	let hash = 2166136261;

	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.codePointAt(index) ?? 0;
		hash = Math.imul(hash, 16777619);
	}

	return `${hash >>> 0}`;
}

export function normalizeFolderPath(path: string): string {
	const normalized = path.split("\\").join("/");
	const lastSlash = normalized.lastIndexOf("/");
	return lastSlash === -1 ? "/" : normalized.slice(0, lastSlash) || "/";
}

export function extractTitle(path: string): string {
	const filename = path.split("/").pop() ?? path;
	return filename.replace(/\.md$/i, "");
}

export function extractFrontmatterDate(
	frontmatter: string,
	propertyName: string,
): number | null {
	const lines = frontmatter.split("\n");
	const normalizedTarget = normalizeFrontmatterKey(propertyName);

	if (!normalizedTarget) {
		return null;
	}

	for (const rawLine of lines) {
		const line = rawLine.trim();
		const separator = line.indexOf(":");
		if (separator === -1) {
			continue;
		}

		const rawKey = line.slice(0, separator).trim();
		const rawValue = line.slice(separator + 1);
		const key = normalizeFrontmatterKey(rawKey);

		if (key !== normalizedTarget) {
			continue;
		}

		return parseFrontmatterDateValue(rawValue);
	}

	return null;
}

function normalizeFrontmatterKey(rawKey: string): string {
	let key = rawKey.trim();

	if (
		(key.startsWith('"') && key.endsWith('"')) ||
		(key.startsWith("'") && key.endsWith("'"))
	) {
		key = key.slice(1, -1).trim();
	}

	const normalizedSeparators = key.toLowerCase().split(/[_-]+/).join(" ");
	return normalizedSeparators.split(/\s+/).filter(Boolean).join(" ");
}

function parseFrontmatterDateValue(rawValue: string): number | null {
	let value = rawValue.trim();

	if (value.length === 0) {
		return null;
	}

	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		value = value.slice(1, -1).trim();
	}

	const isoDate = ISO_DATE_REGEX.exec(value);
	if (isoDate) {
		const year = Number(isoDate[1]);
		const month = Number(isoDate[2]);
		const day = Number(isoDate[3]);
		const parsed = new Date(year, month - 1, day).getTime();
		return Number.isFinite(parsed) ? parsed : null;
	}

	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : null;
}
