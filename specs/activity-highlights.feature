@Feature-2
Feature: Activity highlights

  @Test-201
  Scenario: Streak mode changes streak length
    Given note-created and modified activity on different days
    When streak mode changes between new-only, modified-only, and new-and-modified
    Then longest streak reflects the selected mode

  @Test-202
  Scenario: Frontmatter-only updates are not body or link content edits
    Given a note already has a snapshot baseline
    When only frontmatter fields change
    Then the update is not classified as a body or link content edit
    And modified trend data may still use modified-related timestamps from metadata

  @Test-203
  Scenario: Last-seen changes do not create modified activity
    Given a note has no modified, content-edit, or property-edit timestamps
    When only last-seen time changes
    Then no modified activity is generated

  @Test-204
  Scenario: Streak action warning is shown only when action is needed today
    Given qualifying streak activity exists yesterday but not today
    When activity highlights are built
    Then needs-action-today is true
    And streak action hint is present
    And the warning icon is visible in highlights
    Given qualifying streak activity exists today
    Then needs-action-today is false
    And streak action hint is empty
    And the warning icon is hidden in highlights

  @Test-205
  Scenario: Note creation produces a note-created activity signal
    Given a note is indexed for the first time with no prior snapshot
    When activity signal evaluation runs
    Then the signal is note-created
    And activity timestamp falls back to file creation time

  @Test-206
  Scenario: Created date in frontmatter sets note-created time
    Given a note frontmatter includes a Date field
    When initial activity signal evaluation runs
    Then activity timestamp uses the Date field value

  @Test-207
  Scenario: Last modified metadata is tracked separately from creation timing
    Given a newly created note includes Last modified in frontmatter
    When initial activity signal evaluation runs
    Then activity timestamp uses note creation timing
    And last-modified-property time is stored separately

  @Test-208
  Scenario: Link changes are classified as linking edits
    Given a note already has a baseline snapshot
    When the body is updated with a new wikilink
    Then the signal is linking-edit

  @Test-209
  Scenario: Non-link body changes are classified as body edits
    Given a note already has a baseline snapshot
    When plain body text changes without link changes
    Then the signal is body-edit

  @Test-210
  Scenario: Content parsing extracts tags and links
    Given note content with frontmatter tags and body links
    When note content is parsed
    Then extracted tags include list and inline tag syntax
    And extracted links include markdown links and wikilinks

  @Test-211
  Scenario: Last modified is parsed from frontmatter
    Given frontmatter includes Last modified
    When note content is parsed
    Then last-modified timestamp is extracted

  @Test-212
  Scenario: Last modified can set the activity timestamp for body or link content edits
    Given a note has a baseline snapshot
    And updated content includes Last modified
    When a body or link content edit is detected
    Then activity timestamp uses Last modified value

  @Test-213
  Scenario: Activity timestamp falls back to file mtime when Last modified is absent
    Given a note has a baseline snapshot
    When a body content edit occurs without Last modified metadata
    Then activity timestamp uses file modified time

  @Test-214
  Scenario: Editing Last modified alone does not produce a body or link activity signal
    Given a note has a baseline snapshot and Last modified metadata
    When only Last modified metadata changes
    Then no activity signal is produced
    And fallback property-edit time is not set

  @Test-215
  Scenario: Configured created date property sets note-created timing
    Given created date property is configured to created_at
    When a new note includes created_at in frontmatter
    Then activity timestamp uses created_at

  @Test-216
  Scenario: Configured modified date property is parsed
    Given modified date property is configured to updated_at
    When note content includes updated_at in frontmatter
    Then last-modified timestamp is extracted from updated_at

  @Test-217
  Scenario: Configured modified property changes do not produce a body or link activity signal
    Given modified date property is configured to updated_at
    And a note has a baseline snapshot with updated_at
    When only updated_at changes
    Then no activity signal is produced
    And fallback property-edit time is not set
