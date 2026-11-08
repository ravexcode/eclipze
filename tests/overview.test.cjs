const assert = require("node:assert/strict");
const test = require("node:test");

const { loadTypeScript } = require("./helpers/load-typescript.cjs");
const { formatYearIssueDayTooltip, getIssueHeatLevel } = loadTypeScript("src/utils/overview.ts");

test("year issue heat levels use fixed count ranges", () => {
  assert.equal(getIssueHeatLevel(0), 0);
  assert.equal(getIssueHeatLevel(1), 1);
  assert.equal(getIssueHeatLevel(3), 1);
  assert.equal(getIssueHeatLevel(4), 2);
  assert.equal(getIssueHeatLevel(7), 2);
  assert.equal(getIssueHeatLevel(8), 3);
  assert.equal(getIssueHeatLevel(12), 3);
});

test("year issue heat levels progress from dark gray to white", () => {
  const { ISSUE_HEAT_LEVELS } = loadTypeScript("src/constants/overview.ts");

  assert.deepEqual(Array.from(ISSUE_HEAT_LEVELS), [
    "bg-background-focus",
    "bg-foreground/30",
    "bg-foreground/65",
    "bg-foreground",
  ]);
});

test("year issue tooltip includes the exact day, month, year, and count", () => {
  const date = new Date(2026, 10, 7);

  assert.equal(
    formatYearIssueDayTooltip(date, 1),
    "Saturday, November 7, 2026: 1 issue",
  );
  assert.equal(
    formatYearIssueDayTooltip(date, 3),
    "Saturday, November 7, 2026: 3 issues",
  );
});
