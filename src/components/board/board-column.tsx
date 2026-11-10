"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import type { MouseEvent } from "react";

import BoardCard from "@/components/board/board-card";
import { statusLabels } from "@/constants/issues";
import type { IssueItem } from "@/types/issues";
import type { IssueStatus } from "@/types/user";

type BoardColumnProps = {
  status: IssueStatus;
  issues: IssueItem[];
  totalCount: number;
  collapsed: boolean;
  highlighted: boolean;
  onToggleCollapsed: (status: IssueStatus) => void;
  onOpenIssue: (issueId: string) => void;
  onIssueContextMenu: (event: MouseEvent<HTMLDivElement>, issue: IssueItem) => void;
};

export default function BoardColumn({
  status,
  issues,
  totalCount,
  collapsed,
  highlighted,
  onToggleCollapsed,
  onOpenIssue,
  onIssueContextMenu,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  const label = statusLabels[status];
  const isFiltered = issues.length !== totalCount;
  const countLabel = isFiltered ? `${issues.length}/${totalCount}` : `${totalCount}`;
  const borderClass = highlighted || isOver ? "border-accent" : "border-background-focus";

  if (collapsed) {
    return (
      <section
        ref={setNodeRef}
        aria-label={`${label} column, collapsed`}
        className={`flex h-full w-11 shrink-0 flex-col items-center gap-3 rounded-md border bg-background-card py-2.5 transition-colors ${borderClass}`}>
        <button
          type="button"
          aria-expanded={false}
          aria-label={`Expand ${label} column`}
          onClick={() => onToggleCollapsed(status)}
          className="rounded-md p-1 text-foreground-off hover:bg-background-focus hover:text-foreground focus-visible:ring-1 focus-visible:ring-accent">
          <IconChevronRight size={15} />
        </button>

        <span className="text-xs text-foreground-off">
          {countLabel}
        </span>

        <span className="text-xs font-medium [writing-mode:vertical-rl]">
          {label}
        </span>
      </section>
    );
  }

  return (
    <section
      ref={setNodeRef}
      aria-label={`${label} column`}
      className={`flex h-full w-72 shrink-0 flex-col rounded-md border bg-background-card transition-colors ${borderClass}`}>
      <header className="flex items-center gap-2 px-3 py-2.5">
        <p className="truncate text-xs font-medium">
          {label}
        </p>

        <span className="rounded-md bg-background-focus px-1.5 py-0.5 text-xs text-foreground-off">
          {countLabel}
        </span>

        <button
          type="button"
          aria-expanded={true}
          aria-label={`Collapse ${label} column`}
          onClick={() => onToggleCollapsed(status)}
          className="ml-auto rounded-md p-1 text-foreground-off hover:bg-background-focus hover:text-foreground focus-visible:ring-1 focus-visible:ring-accent">
          <IconChevronLeft size={15} />
        </button>
      </header>

      <div
        data-lenis-prevent
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        <SortableContext
          items={issues.map((issue) => issue.id)}
          strategy={verticalListSortingStrategy}>
          {issues.map((issue) => (
            <BoardCard
              key={issue.id}
              issue={issue}
              onOpen={onOpenIssue}
              onContextMenu={onIssueContextMenu}
            />
          ))}
        </SortableContext>

        {issues.length === 0 ? (
          <p className="rounded-md border border-dashed border-background-focus px-3 py-6 text-center text-xs text-foreground-off">
            {isFiltered ? "No issues match the filters" : "Drop issues here"}
          </p>
        ) : null}
      </div>
    </section>
  );
}
