-- Manual order of an issue inside its kanban board column (lower values first).
ALTER TABLE "issues" ADD COLUMN "boardPosition" INTEGER NOT NULL DEFAULT 0;

-- Start every column in the order the issue list already shows: latest activity first.
UPDATE "issues"
SET "boardPosition" = "ranked"."position"
FROM (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "status"
      ORDER BY "lastActivityAt" DESC, "id" ASC
    ) - 1 AS "position"
  FROM "issues"
) AS "ranked"
WHERE "issues"."id" = "ranked"."id";

-- The board reads each column by status, ordered by position.
CREATE INDEX "issues_status_boardPosition_idx" ON "issues"("status", "boardPosition");
