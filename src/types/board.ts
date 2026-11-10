import type { IssueItem } from "@/types/issues";
import type { IssuePriority, IssueStatus, IssueType } from "@/types/user";

/** Issues of the board grouped by column, each list in display order. */
export type BoardColumns = Record<IssueStatus, IssueItem[]>;

export type BoardFilters = {
  query: string;
  type: "ALL" | IssueType;
  priority: "ALL" | IssuePriority;
};

/** A finished drag: the issue, its destination column, and the board after the move. */
export type BoardMove = {
  issueId: string;
  status: IssueStatus;
  columns: BoardColumns;
};
