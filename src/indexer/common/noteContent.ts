import { moment } from "obsidian";

// d/m/y or m/d/y with a consistent separator and an optional time.
const NUMERIC_DATE_REGEX =
	/^(\d{1,2})([./-])(\d{1,2})\2(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

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
	dateFormat = "",
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

		return parseFrontmatterDateValue(rawValue, dateFormat);
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

function parseFrontmatterDateValue(
	rawValue: string,
	dateFormat: string,
): number | null {
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

	const formats = dateFormat
		? [dateFormat, moment.ISO_8601]
		: [moment.ISO_8601];
	for (const format of formats) {
		const parsed = moment.parseZone(value, format, true);
		if (parsed.isValid()) {
			// Keep the written wall-clock time so the day never shifts with the viewer's timezone.
			return parsed.local(true).valueOf();
		}
	}

	const numeric = NUMERIC_DATE_REGEX.exec(value);
	if (numeric) {
		return parseNumericDate(numeric);
	}

	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function parseNumericDate(match: RegExpExecArray): number | null {
	const [
		first = 0,
		second = 0,
		year = 0,
		hours = 0,
		minutes = 0,
		seconds = 0,
	] = [1, 3, 4, 5, 6, 7].map((group) => Number(match[group] ?? 0));
	const toLocal = (month: number, day: number): number | null => {
		const date = new Date(year, month - 1, day, hours, minutes, seconds);
		// Date rolls overflow into the next month or day, so a mismatch means invalid.
		const valid = date.getMonth() === month - 1 && date.getDate() === day;
		return valid ? date.getTime() : null;
	};
	const dayFirst = toLocal(second, first);
	const monthFirst = toLocal(first, second);

	// Both readings fit (e.g. 03/04/2024): unknown beats a wrong guess.
	if (dayFirst != null && monthFirst != null && first !== second) {
		return null;
	}

	return dayFirst ?? monthFirst;
}
