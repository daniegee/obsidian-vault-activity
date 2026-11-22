@Feature-3
Feature: Activity trends

  @Test-301
  Scenario: Edits are dated by the modified property, then file modified time
    Given a note already has a baseline snapshot
    When its body changes
    Then the edit is dated by the modified property if it was bumped with the edit
    And by the file modified time otherwise

  @Test-302
  Scenario: Trend metric switches active dataset
    Given both new and modified activity exist on the same date
    When trend metric is new-notes
    Then selected data returns new-note records
    When trend metric is modified-notes
    Then selected data returns modified-note records
