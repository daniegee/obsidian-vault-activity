@Feature-3
Feature: Activity trends

  @Test-301
  Scenario: Modified activity projection follows timestamp priority
    Given a note has multiple possible modified timestamps
    When modified trend data is built
    Then timestamp priority is modified property, then content edit, then property edit

  @Test-302
  Scenario: Trend metric switches active dataset
    Given both new and modified activity exist on the same date
    When trend metric is new-notes
    Then selected data returns new-note records
    When trend metric is modified-notes
    Then selected data returns modified-note records
