import type { IssueFormValues, IssueItem } from "@/types/issues";
import {
  ISSUE_CONTEXT_MENU_HEIGHT,
  ISSUE_CONTEXT_MENU_OFFSET,
  ISSUE_CONTEXT_MENU_VIEWPORT_PADDING,
  ISSUE_CONTEXT_MENU_WIDTH,
} from "@/constants/issues";
import type { IssueStatus, IssueType, UserRole } from "@/types/user";

const ISSUE_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export type IssueContextMenuPosition = {
  top: number;
  left: number;
};

export function getIssueContextMenuPosition(
  clientX: number,
  clientY: number,
  cardRect: DOMRect,
  viewportWidth: number,
  viewportHeight: number,
): IssueContextMenuPosition {
  const usesKeyboardPosition = clientX === 0 && clientY === 0;
  const anchorLeft = usesKeyboardPosition ? cardRect.left : clientX;
  const anchorTop = usesKeyboardPosition ? cardRect.bottom : clientY;
  const maxLeft = Math.max(
    ISSUE_CONTEXT_MENU_VIEWPORT_PADDING,
    viewportWidth - ISSUE_CONTEXT_MENU_WIDTH - ISSUE_CONTEXT_MENU_VIEWPORT_PADDING,
  );
  const maxTop = Math.max(
    ISSUE_CONTEXT_MENU_VIEWPORT_PADDING,
    viewportHeight - ISSUE_CONTEXT_MENU_HEIGHT - ISSUE_CONTEXT_MENU_VIEWPORT_PADDING,
  );

  return {
    left: Math.min(
      Math.max(anchorLeft + ISSUE_CONTEXT_MENU_OFFSET, ISSUE_CONTEXT_MENU_VIEWPORT_PADDING),
      maxLeft,
    ),
    top: Math.min(
      Math.max(anchorTop + ISSUE_CONTEXT_MENU_OFFSET, ISSUE_CONTEXT_MENU_VIEWPORT_PADDING),
      maxTop,
    ),
  };
}

export function buildIssueUpdatePayload(form: IssueFormValues, role: UserRole) {
  return {
    title: form.title,
    description: form.description,
    type: form.type,
    ...(role === "DEVELOPER" ? { priority: form.priority } : {}),
  };
}

export function dateLabel(value: string) {
  return ISSUE_DATE_FORMATTER.format(new Date(value));
}

export function filterIssues(
  issues: IssueItem[],
  query: string,
  status: "ALL" | IssueStatus,
  type: "ALL" | IssueType,
) {
  const normalizedQuery = query.trim().toLowerCase();

  return issues.filter((item) => {
    const searchableText = `${item.title} ${item.description ?? ""} ${item.requester?.username ?? ""}`.toLowerCase();
    const matchesQuery =
      !normalizedQuery || searchableText.includes(normalizedQuery);

    return (
      matchesQuery &&
      (status === "ALL" || item.status === status) &&
      (type === "ALL" || item.type === type)
    );
  });
}
