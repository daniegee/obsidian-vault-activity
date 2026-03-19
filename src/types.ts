export type TimeWindow = "weekly" | "monthly" | "yearly" | "all-time";
export type TrendMetric = "new-notes" | "modified-notes";
export type ActivitySignal = "note-created" | "linking-edit" | "body-edit";
export type StreakCalculationMode =
	| "new-only"
	| "modified-only"
	| "new-and-modified";

export interface NoteSnapshot {
	path: string;
	folder: string;
	title: string;
	createdMtime: number;
	contentHash: string;
	bodyHash: string;
	linkHash: string;
	propertyHash?: string;
	tags: string[];
	lastMeaningfulMtime: number | null;
	lastModifiedPropertyMtime?: number | null;
	lastContentEditMtime?: number | null;
	lastPropertyEditMtime?: number | null;
	lastMeaningfulSignal: ActivitySignal | null;
}

export interface ParsedNoteContent {
	body: string;
	links: string[];
	tags: string[];
	propertyHash: string;
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
	tags: string[];
	effectiveMtime: number;
	lastModifiedPropertyMtime?: number | null;
	lastContentEditMtime?: number | null;
	lastPropertyEditMtime?: number | null;
	signal: ActivitySignal;
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
}
