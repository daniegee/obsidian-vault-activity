import type { FrontmatterDateProperties, ParsedNoteContent } from "../types";
import {
	extractFrontmatterDate,
	extractFrontmatterTags,
	extractLinks,
	hashString,
	normalizeTrackedFrontmatter,
} from "./common/noteContent";

const DEFAULT_FRONTMATTER_DATE_PROPERTIES: FrontmatterDateProperties = {
	createdDateProperty: "Date",
	modifiedDateProperty: "Last modified",
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
			links: extractLinks(body),
			tags: [],
			propertyHash: hashString(""),
			createdDateMs: null,
			lastModifiedDateMs: null,
		};
	}

	const closingIndex = normalized.indexOf("\n---\n", 4);

	if (closingIndex === -1) {
		const body = normalized.trim();
		return {
			body,
			links: extractLinks(body),
			tags: [],
			propertyHash: hashString(""),
			createdDateMs: null,
			lastModifiedDateMs: null,
		};
	}

	const frontmatter = normalized.slice(4, closingIndex);
	const body = normalized.slice(closingIndex + 5).trim();
	const tags = extractFrontmatterTags(frontmatter);
	const propertyHash = hashString(
		normalizeTrackedFrontmatter(
			frontmatter,
			resolvedProperties.modifiedDateProperty,
		),
	);
	const createdDateMs = extractFrontmatterDate(
		frontmatter,
		resolvedProperties.createdDateProperty,
	);
	const lastModifiedDateMs = extractFrontmatterDate(
		frontmatter,
		resolvedProperties.modifiedDateProperty,
	);

	return {
		body,
		links: extractLinks(body),
		tags,
		propertyHash,
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
	};
}

function normalizePropertyName(
	value: string | undefined,
	fallback: string,
): string {
	const trimmed = value?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : fallback;
}
