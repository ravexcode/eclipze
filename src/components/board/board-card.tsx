"use client";

import { useSortable } from "@dnd-kit/sortable";
import type { MouseEvent } from "react";

import BoardCardContent from "@/components/board/board-card-content";
import type { IssueItem } from "@/types/issues";

type BoardCardProps = {
  issue: IssueItem;
  onOpen: (issueId: string) => void;
  onContextMenu: (event: MouseEvent<HTMLDivElement>, issue: IssueItem) => void;
};

export default function BoardCard({
  issue,
  onOpen,
  onContextMenu,
}: BoardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue.id });

  const style = {
    transform: transform
      ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
      : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-label={`Issue ${issue.title}. Press space to move it.`}
      onClick={() => onOpen(issue.id)}
      onContextMenu={(event) => onContextMenu(event, issue)}
      className={
        "cursor-grab touch-manipulation rounded-md outline-hidden focus-visible:ring-1 focus-visible:ring-accent " +
        (isDragging ? "opacity-30" : "")
      }>
      <BoardCardContent issue={issue} />
    </div>
  );
}
