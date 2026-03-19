# Vault Activity for Obsidian

<p align="left">
  <a href="#"><img alt="Obsidian" src="https://img.shields.io/badge/Obsidian-Plugin-7C3AED?style=flat-square"></a>
  <a href="#"><img alt="Min Obsidian" src="https://img.shields.io/badge/Min%20App-1.5.0-0EA5E9?style=flat-square"></a>
  <a href="#"><img alt="Version" src="https://img.shields.io/badge/Version-0.1.0-10B981?style=flat-square"></a>
</p>

Turn your vault into a tiny analytics lab: streaks, trends, and click-through note lists that answer the important question:

**"Am I writing consistently, or just collecting tabs?"**

Vault Activity is an Obsidian plugin that tracks **new note** and **modified note** activity, then visualises it in a dashboard designed for quick daily check-ins.

## Why this plugin exists

Most writing habits fail quietly. This plugin helps you catch drift early by making activity visible:

- Current streak and longest streak
- Most active weekday and rhythm-style summary - understand your note habits at a glance
- Trend chart with multiple time windows
- Drill-down list of notes behind each chart point

> [!NOTE]
> Following Zettlekasten, I found it difficult to maintain a consistent and balanced pace between new fleeting note news and

## Features

### 1) Dashboard at a glance

- Streak stats and activity highlights
- Weekly, monthly, yearly, and all-time trend windows
- Toggle between **New notes** and **Modified notes** metrics

### 2) Drill-down details

- Weekly/monthly windows: click a day to list matching notes
- Yearly/all-time windows: click a week/month bucket to inspect grouped notes

### 3) Flexible configuration that makes sense for your vault

- Set the conditions for your streak and stats
- New notes use frontmatter property (default: `Date`), then fallback to file creation time
- Modified notes use frontmatter property (default: `Last modified`)
- If modified property is missing, the plugin falls back to meaningful edit detection
- Include and exclude folder filters apply across all dashboard surfaces

## Install

This plugin is currently set up as a local/community plugin workflow.

## Usage

### Commands

- `Open Vault Activity`
- `Refresh Vault Activity data`

### Obsidian Settings

| Setting                   | What it does                                        | Default            |
| ------------------------- | --------------------------------------------------- | ------------------ |
| Dashboard include folders | Optional allow-list scope for all visuals and lists | Empty              |
| Dashboard exclude folders | Exclude scope used when include list is empty       | `Templates`        |
| Streak calculation mode   | Choose what marks a day active                      | `new-and-modified` |
| Created date property     | Frontmatter key for new-note timestamps             | `Date`             |
| Modified date property    | Frontmatter key for modified-note timestamps        | `Last modified`    |
| Auto-refresh              | Recompute on create/modify/delete/rename events     | `true`             |
| Refresh debounce (ms)     | Delay before recomputing after events               | `400`              |

## Important behavior notes

> [!IMPORTANT]
> Obsidian provides the current modified time for files, not a full historical timeline of every edit event.
> The dashboard therefore represents each note's latest known activity position, not a complete per-edit history.

> [!NOTE]
> Meaningful-edit filtering is most accurate after the plugin has at least one prior snapshot to compare against.
> On first install, non-empty notes may be treated as meaningful because no baseline snapshot exists yet.

## Limitations

- Desktop only (`isDesktopOnly: true`)
- Yearly/all-time drill-down aggregates by week or month buckets
- One selected drill-down point is shown at a time

## Privacy

Vault Activity is local-first:

- No external analytics
- No remote data sync by this plugin
- Data is stored using Obsidian plugin storage for local snapshots/settings

## Development

### Scripts

```bash
npm run dev            # watch/dev build
npm run build          # production build
npm run lint           # eslint
npm run test           # vitest
npm run test:coverage  # vitest with coverage
npm run format         # prettier
```

### Tech stack

- TypeScript
- Obsidian plugin API
- esbuild
- Vitest

## Public release checklist

- [ ] Handle wider date format compatibility for frontmatter date fields
- [ ] Add license file
- [ ] Prepare community plugin release artifacts

## Contributing

Issues and PRs are welcome. If you spot weird date parsing, edge-case folder filters, or suspicious streak behavior, please open an issue with:

- Obsidian version
- Plugin version
- Example frontmatter/date format
- Steps to reproduce

## Author

Created by **daniegee**

If this plugin helps your writing cadence, star the repo and keep the streak alive.
