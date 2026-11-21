import type { BoardFilters } from "@/types/board";
import type { IssuePriority, IssueStatus } from "@/types/user";

export const BOARD_COLUMN_ORDER: IssueStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_USER",
  "RESOLVED",
  "CLOSED",
];

export const BOARD_DEFAULT_COLLAPSED_COLUMNS: IssueStatus[] = ["CLOSED"];

export const BOARD_COLLAPSED_COLUMNS_STORAGE_KEY = "eclipze-board-collapsed-columns";

export const BOARD_ENDPOINT = "/api/issues/board";

/** Quiet time, in milliseconds, after the last move before a personal board saves its changes. */
export const BOARD_SAVE_DEBOUNCE_DELAY = 500;

/** How often, in milliseconds, a shared board checks for changes made by other members. */
export const BOARD_LIVE_SYNC_INTERVAL = 3000;

export const initialBoardFilters: BoardFilters = {
  query: "",
  type: "ALL",
  priority: "ALL",
};

/** Pointer travel, in pixels, before a press on a card becomes a drag instead of a click. */
export const BOARD_DRAG_ACTIVATION_DISTANCE = 6;

/** Touch hold, in milliseconds, before a card starts to drag, so the board can still scroll. */
export const BOARD_TOUCH_ACTIVATION_DELAY = 200;
export const BOARD_TOUCH_ACTIVATION_TOLERANCE = 6;

export const boardPriorityStripeClasses: Record<IssuePriority, string> = {
  HIGH: "bg-priority-high",
  MEDIUM: "bg-priority-medium",
  LOW: "bg-priority-low",
};
