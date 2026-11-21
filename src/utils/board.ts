import type { Announcements } from "@dnd-kit/core";

import {
  BOARD_COLLAPSED_COLUMNS_STORAGE_KEY,
  BOARD_COLUMN_ORDER,
  BOARD_DEFAULT_COLLAPSED_COLUMNS,
} from "@/constants/board";
import { statusLabels } from "@/constants/issues";
import type { BoardColumns, BoardFilters } from "@/types/board";
import type { IssueItem } from "@/types/issues";
import type { IssueStatus } from "@/types/user";

export function isBoardStatus(value: unknown): value is IssueStatus {
  return BOARD_COLUMN_ORDER.includes(value as IssueStatus);
}

function createEmptyColumns(): BoardColumns {
  return {
    OPEN: [],
    IN_PROGRESS: [],
    WAITING_FOR_USER: [],
    RESOLVED: [],
    CLOSED: [],
  };
}

/** Manual position first; issues that share a position show the latest activity first. */
function compareBoardIssues(first: IssueItem, second: IssueItem) {
  if (first.boardPosition !== second.boardPosition) {
    return first.boardPosition - second.boardPosition;
  }

  return second.lastActivityAt.localeCompare(first.lastActivityAt);
}

export function groupIssuesByStatus(issues: IssueItem[]): BoardColumns {
  const columns = createEmptyColumns();

  for (const issue of issues) {
    columns[issue.status].push(issue);
  }

  for (const status of BOARD_COLUMN_ORDER) {
    columns[status].sort(compareBoardIssues);
  }

  return columns;
}

/** Turns the board back into a flat issue list, with each position matching the display order. */
export function flattenBoardColumns(columns: BoardColumns): IssueItem[] {
  return BOARD_COLUMN_ORDER.flatMap((status) =>
    columns[status].map((issue, position) => ({
      ...issue,
      status,
      boardPosition: position,
    })),
  );
}

export function findIssueStatus(columns: BoardColumns, issueId: string) {
  return BOARD_COLUMN_ORDER.find((status) =>
    columns[status].some((issue) => issue.id === issueId),
  );
}

export function findBoardIssue(columns: BoardColumns, issueId: string) {
  for (const status of BOARD_COLUMN_ORDER) {
    const issue = columns[status].find((columnIssue) => columnIssue.id === issueId);
    if (issue) return issue;
  }

  return undefined;
}

/** Moves an issue to another column, at the given index of that column. */
export function moveIssueToColumn(
  columns: BoardColumns,
  issueId: string,
  fromStatus: IssueStatus,
  toStatus: IssueStatus,
  toIndex: number,
): BoardColumns {
  const issue = columns[fromStatus].find((columnIssue) => columnIssue.id === issueId);
  if (!issue) return columns;

  const sourceColumn = columns[fromStatus].filter((columnIssue) => columnIssue.id !== issueId);
  const destinationColumn = [...columns[toStatus]];
  const insertionIndex = Math.min(Math.max(toIndex, 0), destinationColumn.length);

  destinationColumn.splice(insertionIndex, 0, { ...issue, status: toStatus });

  return {
    ...columns,
    [fromStatus]: sourceColumn,
    [toStatus]: destinationColumn,
  };
}

export function hasSameColumnOrder(first: IssueItem[], second: IssueItem[]) {
  return (
    first.length === second.length &&
    first.every((issue, index) => issue.id === second[index].id)
  );
}

export function hasActiveBoardFilters(filters: BoardFilters) {
  return (
    filters.query.trim() !== "" ||
    filters.type !== "ALL" ||
    filters.priority !== "ALL"
  );
}

export function matchesBoardFilters(issue: IssueItem, filters: BoardFilters) {
  const normalizedQuery = filters.query.trim().toLowerCase();
  const requesterName = issue.requester?.username ?? issue.requester?.email ?? "";
  const searchableText = `${issue.title} ${issue.description ?? ""} ${requesterName}`.toLowerCase();

  return (
    (!normalizedQuery || searchableText.includes(normalizedQuery)) &&
    (filters.type === "ALL" || issue.type === filters.type) &&
    (filters.priority === "ALL" || issue.priority === filters.priority)
  );
}

export function readCollapsedColumns(): IssueStatus[] {
  try {
    const storedValue = window.localStorage.getItem(BOARD_COLLAPSED_COLUMNS_STORAGE_KEY);
    if (!storedValue) return BOARD_DEFAULT_COLLAPSED_COLUMNS;

    const parsedValue: unknown = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return BOARD_DEFAULT_COLLAPSED_COLUMNS;

    return parsedValue.filter(isBoardStatus);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
    return BOARD_DEFAULT_COLLAPSED_COLUMNS;
  }
}

export function writeCollapsedColumns(collapsedColumns: IssueStatus[]) {
  try {
    window.localStorage.setItem(
      BOARD_COLLAPSED_COLUMNS_STORAGE_KEY,
      JSON.stringify(collapsedColumns),
    );
  } catch {
    // The board still works when the preference cannot be saved.
  }
}

/** Screen reader messages for each step of a drag, naming issues and columns. */
export function buildBoardAnnouncements(
  getColumns: () => BoardColumns,
): Announcements {
  const describeIssue = (issueId: string | number) =>
    findBoardIssue(getColumns(), String(issueId))?.title ?? "Issue";

  const describeColumn = (targetId: string | number | undefined) => {
    if (targetId === undefined) return null;

    const status = isBoardStatus(targetId)
      ? targetId
      : findIssueStatus(getColumns(), String(targetId));

    return status ? statusLabels[status] : null;
  };

  return {
    onDragStart({ active }) {
      return `Picked up issue ${describeIssue(active.id)}.`;
    },
    onDragOver({ active, over }) {
      const column = describeColumn(over?.id);

      return column
        ? `Issue ${describeIssue(active.id)} is over the ${column} column.`
        : `Issue ${describeIssue(active.id)} is not over a column.`;
    },
    onDragEnd({ active, over }) {
      const column = describeColumn(over?.id);

      return column
        ? `Issue ${describeIssue(active.id)} was dropped in the ${column} column.`
        : `Issue ${describeIssue(active.id)} was dropped outside the board.`;
    },
    onDragCancel({ active }) {
      return `Move cancelled. Issue ${describeIssue(active.id)} returned to its column.`;
    },
  };
}
