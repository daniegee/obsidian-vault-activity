@Feature-1
Feature: User settings

  @Test-101
  Scenario: Default settings are applied
    Given no saved plugin data exists
    When settings are initialised
    Then include folders are empty
    And exclude folders contain Templates
    And streak mode is new-and-modified
    And created date property is Date
    And modified date property is Last modified
    And auto-refresh is enabled
    And refresh debounce is 400 ms

  @Test-102
  Scenario: Folder settings are normalised
    Given a user enters folder values with commas, new lines, and slashes
    When folder values are parsed
    Then empty values are removed
    And leading and trailing slashes are removed
    And normalised folder paths are stored

  @Test-103
  Scenario: Include folders take priority over exclude folders
    Given include folders and exclude folders are both configured
    When a note matches both include and exclude paths
    Then the note is included in scoped results

  @Test-104
  Scenario: Custom date properties are respected
    Given custom created and modified property names are configured
    When note metadata is evaluated
    Then created timestamps use the configured created property
    And modified timestamps use the configured modified property

  @Test-105
  Scenario: Auto-refresh and debounce settings control refresh scheduling
    Given auto-refresh is disabled
    When a non-immediate refresh is scheduled
    Then no refresh callback runs
    Given auto-refresh is enabled with debounce
    When multiple refresh schedules happen quickly
    Then one refresh runs using the latest reason
