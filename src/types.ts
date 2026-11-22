export type TimeWindow = "weekly" | "monthly" | "yearly" | "all-time";
export type TrendMetric = "new-notes" | "modified-notes";
export type ActivitySignal = "note-created" | "body-edit";
export type StreakCalculationMode =
	"new-only" | "modified-only" | "new-and-modified";

/** One note's stored state in data.json, keyed by path. Path, folder and title come from the key. */
export interface NoteSnapshot {
	createdMtime: number;
	/** Matches notes renamed while Obsidian was closed. */
	contentHash: string;
	/** Changes on body or link edits only, so property-only changes are ignored. */
	bodyHash: string;
	/** Previous modified-property value, to tell when the user bumped it. */
	lastModifiedPropertyMtime?: number | null;
	/** Timestamps of detected edits, at most one per local day, ascending. */
	editHistory: number[];
	/** File mtime when last read; an unchanged mtime lets scans skip the read. */
	fileMtime?: number;
	/** File size when last read; checked with fileMtime before skipping a read. */
	fileSize?: number;
}

export interface ParsedNoteContent {
	body: string;
	createdDateMs: number | null;
	lastModifiedDateMs: number | null;
}

export interface FrontmatterDateProperties {
	createdDateProperty: string;
	modifiedDateProperty: string;
}

export interface ActivityRecord {
	path: string;
	title: string;
	folder: string;
	effectiveMtime: number;
	signal: ActivitySignal;
	createdMtime: number;
	editHistory: number[];
}

export interface FilterState {
	includeFolders: string[];
	excludeFolders: string[];
	streakCalculationMode: StreakCalculationMode;
	trendWindow: TimeWindow;
	trendMetric: TrendMetric;
	selectedDay: string | null;
}

export interface DailyAggregate {
	day: string;
	count: number;
	notes: ActivityRecord[];
	folders: Record<string, number>;
}

export interface TrendPoint {
	label: string;
	day: string;
	count: number;
	notes: ActivityRecord[];
}

export interface StreakSegment {
	start: string;
	end: string;
	length: number;
	isCurrent: boolean;
	breakAfter: string | null;
}

export interface SummaryMetrics {
	mostActiveDayLabel: string;
	activityRhythmLabel: string;
	currentStreak: number;
	streakNeedsActionToday: boolean;
	streakActionHint: string | null;
	longestStreak: number;
}

export interface DashboardData {
	generatedAt: number;
	filters: FilterState;
	scopedNotes: ActivityRecord[];
	dailyNewNotes: DailyAggregate[];
	dailyModifiedNotes: DailyAggregate[];
	trendWeeklyNewNotes: TrendPoint[];
	trendWeeklyModifiedNotes: TrendPoint[];
	trendMonthlyNewNotes: TrendPoint[];
	trendMonthlyModifiedNotes: TrendPoint[];
	summary: SummaryMetrics;
	selectedDayNotes: ActivityRecord[];
}

export interface IndexerResult {
	notes: ActivityRecord[];
	snapshots: Record<string, NoteSnapshot>;
	folders: string[];
	generatedAt: number;
}

export interface VaultActivityPluginSettings {
	dashboardIncludeFolders: string[];
	dashboardExcludeFolders: string[];
	streakCalculationMode: StreakCalculationMode;
	createdDateProperty: string;
	modifiedDateProperty: string;
	autoRefresh: boolean;
	refreshDebounceMs: number;
}

export interface VaultActivityPluginData {
	settings: VaultActivityPluginSettings;
	snapshots: Record<string, NoteSnapshot>;
	/** Date property names the snapshots were parsed with; a change forces a full re-read. */
	indexedProperties?: string;
}
