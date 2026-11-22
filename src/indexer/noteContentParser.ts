import type { FrontmatterDateProperties, ParsedNoteContent } from "../types";
import { extractFrontmatterDate } from "./common/noteContent";

const DEFAULT_FRONTMATTER_DATE_PROPERTIES: FrontmatterDateProperties = {
	createdDateProperty: "Created",
	modifiedDateProperty: "Last modified",
	dateFormat: "",
};

export function parseNoteContent(
	content: string,
	properties?: Partial<FrontmatterDateProperties>,
): ParsedNoteContent {
	const resolvedProperties = resolveDateProperties(properties);
	const normalized = content.split("\r\n").join("\n");

	if (!normalized.startsWith("---\n")) {
		const body = normalized.trim();
		return {
			body,
			createdDateMs: null,
			lastModifiedDateMs: null,
		};
	}

	const closingIndex = normalized.indexOf("\n---\n", 4);

	if (closingIndex === -1) {
		const body = normalized.trim();
		return {
			body,
			createdDateMs: null,
			lastModifiedDateMs: null,
		};
	}

	const frontmatter = normalized.slice(4, closingIndex);
	const body = normalized.slice(closingIndex + 5).trim();
	const createdDateMs = extractFrontmatterDate(
		frontmatter,
		resolvedProperties.createdDateProperty,
		resolvedProperties.dateFormat,
	);
	const lastModifiedDateMs = extractFrontmatterDate(
		frontmatter,
		resolvedProperties.modifiedDateProperty,
		resolvedProperties.dateFormat,
	);

	return {
		body,
		createdDateMs,
		lastModifiedDateMs,
	};
}

function resolveDateProperties(
	properties?: Partial<FrontmatterDateProperties>,
): FrontmatterDateProperties {
	return {
		createdDateProperty: normalizePropertyName(
			properties?.createdDateProperty,
			DEFAULT_FRONTMATTER_DATE_PROPERTIES.createdDateProperty,
		),
		modifiedDateProperty: normalizePropertyName(
			properties?.modifiedDateProperty,
			DEFAULT_FRONTMATTER_DATE_PROPERTIES.modifiedDateProperty,
		),
		dateFormat: properties?.dateFormat?.trim() ?? "",
	};
}

function normalizePropertyName(
	value: string | undefined,
	fallback: string,
): string {
	// Blank is the user opting out of the property, so it is not swapped for the default.
	return value === undefined ? fallback : value.trim();
}
