import type { IssueItem } from "@/types/issues";
import type { IssuePriority, IssueStatus, IssueType } from "@/types/user";

/** Issues of the board grouped by column, each list in display order. */
export type BoardColumns = Record<IssueStatus, IssueItem[]>;

export type BoardFilters = {
  query: string;
  type: "ALL" | IssueType;
  priority: "ALL" | IssuePriority;
};

/** The order of one board column, as the save request sends it. */
export type BoardColumnOrder = {
  status: IssueStatus;
  orderedIds: string[];
};

/** What the board endpoint reports about the board of the current user. */
export type BoardState = {
  collaborative: boolean;
  version: string;
};

/** A finished drag: the issue, its destination column, and the board after the move. */
export type BoardMove = {
  issueId: string;
  status: IssueStatus;
  columns: BoardColumns;
};
