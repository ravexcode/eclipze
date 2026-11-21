"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useState, type MouseEvent, type TransitionEvent } from "react";

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

const iconButtonClass =
  "rounded-md p-1 text-foreground-off hover:bg-background-focus hover:text-foreground focus-visible:ring-1 focus-visible:ring-accent";

/**
 * A board column that slides between its full width and a narrow strip.
 * Both views stay mounted so the change can animate; the hidden one is inert.
 */
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

  // Cards stay rendered while the column closes, then leave once the animation ends.
  const [cardsRendered, setCardsRendered] = useState(!collapsed);
  const showCards = !collapsed || cardsRendered;

  const label = statusLabels[status];
  const isFiltered = issues.length !== totalCount;
  const countLabel = isFiltered ? `${issues.length}/${totalCount}` : `${totalCount}`;
  const borderClass = highlighted || isOver ? "border-accent" : "border-background-focus";
  const widthClass = collapsed ? "w-11" : "w-72";

  const finishWidthTransition = (event: TransitionEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== "width") return;

    setCardsRendered(!collapsed);
  };

  return (
    <section
      ref={setNodeRef}
      aria-label={collapsed ? `${label} column, collapsed` : `${label} column`}
      onTransitionEnd={finishWidthTransition}
      className={`relative h-full shrink-0 overflow-hidden rounded-md border bg-background-card transition-[width,border-color] duration-300 ease-out motion-reduce:duration-[1ms] ${widthClass} ${borderClass}`}>
      <div
        inert={!collapsed}
        className={
          "absolute inset-y-0 left-0 flex w-11 flex-col items-center gap-3 py-2.5 transition-opacity duration-200 motion-reduce:duration-[1ms] " +
          (collapsed ? "opacity-100 delay-100" : "pointer-events-none opacity-0")
        }>
        <button
          type="button"
          aria-expanded={false}
          aria-label={`Expand ${label} column`}
          onClick={() => onToggleCollapsed(status)}
          className={iconButtonClass}>
          <IconChevronRight size={15} />
        </button>

        <span className="text-xs text-foreground-off">
          {countLabel}
        </span>

        <span className="text-xs font-medium [writing-mode:vertical-rl]">
          {label}
        </span>
      </div>

      <div
        inert={collapsed}
        className={
          "flex h-full w-72 flex-col transition-opacity duration-200 motion-reduce:duration-[1ms] " +
          (collapsed ? "pointer-events-none opacity-0" : "opacity-100 delay-100")
        }>
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
            className={`ml-auto ${iconButtonClass}`}>
            <IconChevronLeft size={15} />
          </button>
        </header>

        <div
          data-lenis-prevent
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {showCards ? (
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
          ) : null}

          {showCards && issues.length === 0 ? (
            <p className="rounded-md border border-dashed border-background-focus px-3 py-6 text-center text-xs text-foreground-off">
              {isFiltered ? "No issues match the filters" : "Drop issues here"}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
