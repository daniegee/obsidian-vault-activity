@Feature-4
Feature: Drill-down Day/Range Selection

  @Test-401
  Scenario: Weekly and monthly windows drill down by day
    Given weekly or monthly trend window is active
    When a chart node is selected
    Then drill-down notes are returned from daily buckets

  @Test-402
  Scenario: Yearly and all-time windows drill down by aggregated range
    Given yearly or all-time trend window is active
    When a chart node is selected
    Then yearly uses weekly buckets
    And all-time uses monthly buckets
