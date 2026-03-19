const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const TAGS_PROPERTY_REGEX = /^(tags?)\s*:\s*(.*)$/i;
const TOP_LEVEL_FRONTMATTER_PROPERTY_REGEX = /^([^\s][^:]*)\s*:\s*(.*)$/;

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

export function normalizeTrackedFrontmatter(
	frontmatter: string,
	modifiedDateProperty: string,
): string {
	const lines = frontmatter.split("\n");
	const trackedLines: string[] = [];
	const normalizedModifiedProperty =
		normalizeFrontmatterKey(modifiedDateProperty);

	for (let index = 0; index < lines.length; ) {
		index = appendTrackedFrontmatterLines(
			lines,
			index,
			trackedLines,
			normalizedModifiedProperty,
		);
	}

	return trackedLines.join("\n");
}

export function extractLinks(body: string): string[] {
	const tokens: string[] = [];
	const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
	const markdownLinkRegex = /\[[^\]]*\]\(([^)]+)\)/g;

	for (const match of body.matchAll(wikiLinkRegex)) {
		const raw = (match[1] ?? "").trim();
		if (raw.length > 0) {
			tokens.push(raw.toLowerCase());
		}
	}

	for (const match of body.matchAll(markdownLinkRegex)) {
		const raw = (match[1] ?? "").trim();
		if (raw.length > 0) {
			tokens.push(raw.toLowerCase());
		}
	}

	return Array.from(new Set(tokens)).sort((left, right) =>
		left.localeCompare(right),
	);
}

export function extractFrontmatterTags(frontmatter: string): string[] {
	const tags: string[] = [];
	const lines = frontmatter.split("\n");

	for (let index = 0; index < lines.length; index += 1) {
		const line = (lines[index] ?? "").trim();
		const keyMatch = TAGS_PROPERTY_REGEX.exec(line);
		if (!keyMatch) {
			continue;
		}

		const inlineValue = (keyMatch[2] ?? "").trim();

		if (inlineValue.startsWith("[")) {
			inlineValue
				.slice(1, inlineValue.endsWith("]") ? -1 : undefined)
				.split(",")
				.map(cleanTag)
				.filter(Boolean)
				.forEach((tag) => tags.push(tag));
			continue;
		}

		if (inlineValue.length > 0) {
			inlineValue
				.split(/[ ,]+/)
				.map(cleanTag)
				.filter(Boolean)
				.forEach((tag) => tags.push(tag));
			continue;
		}

		for (let next = index + 1; next < lines.length; next += 1) {
			const listLine = lines[next] ?? "";
			if (!/^\s*-\s+/.test(listLine)) {
				break;
			}
			tags.push(cleanTag(listLine.replace(/^\s*-\s+/, "")));
		}
	}

	return Array.from(new Set(tags.filter(Boolean)));
}

function appendTrackedFrontmatterLines(
	lines: string[],
	startIndex: number,
	trackedLines: string[],
	normalizedModifiedProperty: string,
): number {
	const rawLine = lines[startIndex] ?? "";
	const propertyMatch = TOP_LEVEL_FRONTMATTER_PROPERTY_REGEX.exec(rawLine);

	if (!propertyMatch) {
		const trimmedLine = rawLine.trim();
		if (trimmedLine.length > 0) {
			trackedLines.push(trimmedLine);
		}
		return startIndex + 1;
	}

	const normalizedProperty = normalizeFrontmatterKey(propertyMatch[1] ?? "");
	const includeProperty = normalizedProperty !== normalizedModifiedProperty;
	if (includeProperty) {
		trackedLines.push(rawLine.trim());
	}

	return appendContinuationLines(
		lines,
		startIndex + 1,
		trackedLines,
		includeProperty,
	);
}

function appendContinuationLines(
	lines: string[],
	startIndex: number,
	trackedLines: string[],
	includeProperty: boolean,
): number {
	let index = startIndex;

	while (
		index < lines.length &&
		isFrontmatterContinuationLine(lines[index] ?? "")
	) {
		const trimmedLine = (lines[index] ?? "").trim();
		if (includeProperty && trimmedLine.length > 0) {
			trackedLines.push(trimmedLine);
		}
		index += 1;
	}

	return index;
}

function isFrontmatterContinuationLine(line: string): boolean {
	return /^\s+/.test(line) || /^\s*-\s+/.test(line);
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

function cleanTag(value: string): string {
	let cleaned = value.trim();

	if (cleaned.startsWith("#")) {
		cleaned = cleaned.slice(1);
	}

	if (
		(cleaned.startsWith("'") && cleaned.endsWith("'")) ||
		(cleaned.startsWith('"') && cleaned.endsWith('"'))
	) {
		cleaned = cleaned.slice(1, -1);
	}

	return cleaned.trim();
}
