import { useCallback, useRef, useState, type MouseEvent } from "react";

import IssueContextMenu from "@/components/issues/issue-context-menu";
import type { IssueItem } from "@/types/issues";
import type { UserRole } from "@/types/user";
import {
  priorityClasses,
  priorityLabels,
  statusLabels,
  typeLabels,
} from "@/constants/issues";
import {
  dateLabel,
  getIssueContextMenuPosition,
  type IssueContextMenuPosition,
} from "@/utils/issues";
import IssueResultsSkeleton from "@/components/skeletons/issues/results-skeleton";

type IssueResultsProps = {
  error: string | null;
  loading: boolean;
  issues: IssueItem[];
  role: UserRole;
  onOpenIssue: (issueId: string) => void;
  onEditIssue: (issue: IssueItem) => void;
  onDeleteIssue: (issue: IssueItem) => void;
};

export default function IssueResults({
  error,
  loading,
  issues,
  role,
  onOpenIssue,
  onEditIssue,
  onDeleteIssue,
}: IssueResultsProps) {
  const [contextMenu, setContextMenu] = useState<{
    issue: IssueItem;
    position: IssueContextMenuPosition;
  } | null>(null);
  const cardRef = useRef<HTMLButtonElement>(null);
  const closeContextMenu = useCallback((returnFocus = true) => {
    setContextMenu(null);
    if (returnFocus) cardRef.current?.focus();
  }, []);

  const openContextMenu = (event: MouseEvent<HTMLButtonElement>, issue: IssueItem) => {
    event.preventDefault();
    cardRef.current = event.currentTarget;
    setContextMenu({
      issue,
      position: getIssueContextMenuPosition(
        event.clientX,
        event.clientY,
        event.currentTarget.getBoundingClientRect(),
        window.innerWidth,
        window.innerHeight,
      ),
    });
  };

  return (
    <>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-priority-high bg-background-card p-3 text-xs text-priority-high">
          {error}
        </p>
      )}

      {loading ? (
        <IssueResultsSkeleton />
      ) : issues.length === 0 ? (
        <div className="rounded-md bg-background-card p-8 text-center">
          <p className="text-xs">No issues found</p>
          <p className="mt-2 text-xs text-foreground-off">
            Create an issue when you need help or want to propose a feature.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {issues.map((item) => (
            <button
              key={item.id}
              ref={contextMenu?.issue.id === item.id ? cardRef : undefined}
              type="button"
              onClick={() => onOpenIssue(item.id)}
              onContextMenu={(event) => openContextMenu(event, item)}
              className="flex w-full flex-col gap-3 rounded-md border border-background-focus bg-background-card p-4 text-left transition-colors hover:bg-background-focus focus-visible:ring-1 focus-visible:ring-accent md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium">{item.title}</span>
                  <span className="text-xs text-foreground-off">
                    {typeLabels[item.type]}
                  </span>
                  {role === "DEVELOPER" && item.requester && (
                    <span className="text-xs text-foreground-off">
                      by {item.requester.username ?? item.requester.email}
                    </span>
                  )}
                </div>

                <p className="mt-1 line-clamp-2 text-xs text-foreground-off">
                  {item.description}
                </p>
                <p className="mt-2 text-xs text-foreground-off">
                  Updated {dateLabel(item.lastActivityAt)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3 text-xs">
                <span className={priorityClasses[item.priority]}>
                  {priorityLabels[item.priority]}
                </span>
                <span className="text-foreground-off">
                  {statusLabels[item.status]}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {contextMenu ? (
        <IssueContextMenu
          position={contextMenu.position}
          onClose={closeContextMenu}
          onEdit={() => onEditIssue(contextMenu.issue)}
          onDelete={() => onDeleteIssue(contextMenu.issue)}
        />
      ) : null}
    </>
  );
}
