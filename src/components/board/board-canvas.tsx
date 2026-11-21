"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useCallback, useMemo, useRef, useState, type MouseEvent } from "react";

import BoardCardContent from "@/components/board/board-card-content";
import BoardColumn from "@/components/board/board-column";
import IssueContextMenu from "@/components/issues/issue-context-menu";
import {
  BOARD_COLUMN_ORDER,
  BOARD_DRAG_ACTIVATION_DISTANCE,
  BOARD_TOUCH_ACTIVATION_DELAY,
  BOARD_TOUCH_ACTIVATION_TOLERANCE,
} from "@/constants/board";
import type { BoardColumns, BoardFilters, BoardMove } from "@/types/board";
import type { IssueItem } from "@/types/issues";
import type { IssueStatus } from "@/types/user";
import {
  buildBoardAnnouncements,
  findBoardIssue,
  findIssueStatus,
  hasSameColumnOrder,
  isBoardStatus,
  matchesBoardFilters,
  moveIssueToColumn,
} from "@/utils/board";
import {
  getIssueContextMenuPosition,
  type IssueContextMenuPosition,
} from "@/utils/issues";

type BoardCanvasProps = {
  columns: BoardColumns;
  filters: BoardFilters;
  collapsedColumns: IssueStatus[];
  onToggleCollapsed: (status: IssueStatus) => void;
  onCreateIssue: (status: IssueStatus) => void;
  onDraggingChange: (dragging: boolean) => void;
  onMoveIssue: (move: BoardMove) => void;
  onOpenIssue: (issueId: string) => void;
  onEditIssue: (issue: IssueItem) => void;
  onDeleteIssue: (issue: IssueItem) => void;
};

export default function BoardCanvas({
  columns,
  filters,
  collapsedColumns,
  onToggleCollapsed,
  onCreateIssue,
  onDraggingChange,
  onMoveIssue,
  onOpenIssue,
  onEditIssue,
  onDeleteIssue,
}: BoardCanvasProps) {
  // While a card is dragged the board shows this working copy instead of the saved columns.
  const [dragColumns, setDragColumns] = useState<BoardColumns | null>(null);
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    issue: IssueItem;
    position: IssueContextMenuPosition;
  } | null>(null);
  const contextMenuCard = useRef<HTMLDivElement | null>(null);

  const shownColumns = dragColumns ?? columns;
  const activeIssue = activeIssueId ? findBoardIssue(shownColumns, activeIssueId) : undefined;
  const activeStatus = activeIssueId ? findIssueStatus(shownColumns, activeIssueId) : undefined;

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: BOARD_DRAG_ACTIVATION_DISTANCE },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: BOARD_TOUCH_ACTIVATION_DELAY,
        tolerance: BOARD_TOUCH_ACTIVATION_TOLERANCE,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const announcements = useMemo(
    () => buildBoardAnnouncements(() => shownColumns),
    [shownColumns],
  );

  const finishDrag = () => {
    setDragColumns(null);
    setActiveIssueId(null);
    onDraggingChange(false);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setContextMenu(null);
    setDragColumns(columns);
    setActiveIssueId(String(event.active.id));
    onDraggingChange(true);
  };

  /** Moves the dragged card into the column under it, so that column opens a gap for it. */
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const issueId = String(active.id);
    const overId = String(over.id);
    const draggedRect = active.rect.current.translated;

    setDragColumns((currentColumns) => {
      if (!currentColumns) return currentColumns;

      const fromStatus = findIssueStatus(currentColumns, issueId);
      const toStatus = isBoardStatus(overId)
        ? overId
        : findIssueStatus(currentColumns, overId);

      if (!fromStatus || !toStatus || fromStatus === toStatus) {
        return currentColumns;
      }

      const destinationColumn = currentColumns[toStatus];
      let destinationIndex = destinationColumn.length;

      if (!isBoardStatus(overId)) {
        const overIndex = destinationColumn.findIndex((issue) => issue.id === overId);
        const isBelowOverCard =
          draggedRect !== null &&
          draggedRect.top > over.rect.top + over.rect.height / 2;

        destinationIndex = overIndex + (isBelowOverCard ? 1 : 0);
      }

      return moveIssueToColumn(
        currentColumns,
        issueId,
        fromStatus,
        toStatus,
        destinationIndex,
      );
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const droppedColumns = dragColumns;

    finishDrag();
    if (!over || !droppedColumns) return;

    const issueId = String(active.id);
    const overId = String(over.id);
    const status = findIssueStatus(droppedColumns, issueId);
    if (!status) return;

    let nextColumns = droppedColumns;

    // Dropping on another card of the same column changes the order inside that column.
    if (!isBoardStatus(overId) && overId !== issueId) {
      const column = droppedColumns[status];
      const fromIndex = column.findIndex((issue) => issue.id === issueId);
      const toIndex = column.findIndex((issue) => issue.id === overId);

      if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
        nextColumns = {
          ...droppedColumns,
          [status]: arrayMove(column, fromIndex, toIndex),
        };
      }
    }

    const originalStatus = findIssueStatus(columns, issueId);
    const nothingChanged =
      originalStatus === status &&
      hasSameColumnOrder(columns[status], nextColumns[status]);

    if (nothingChanged) return;

    onMoveIssue({
      issueId,
      status,
      columns: nextColumns,
    });
  };

  const openContextMenu = (event: MouseEvent<HTMLDivElement>, issue: IssueItem) => {
    event.preventDefault();
    contextMenuCard.current = event.currentTarget;
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

  const closeContextMenu = useCallback((returnFocus = true) => {
    setContextMenu(null);
    if (returnFocus) contextMenuCard.current?.focus();
  }, []);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{ announcements }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={finishDrag}>
        <div
          data-lenis-prevent
          className="animate-fade-in-up flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
          {BOARD_COLUMN_ORDER.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              issues={shownColumns[status].filter((issue) => matchesBoardFilters(issue, filters))}
              totalCount={shownColumns[status].length}
              collapsed={collapsedColumns.includes(status)}
              highlighted={activeStatus === status}
              onToggleCollapsed={onToggleCollapsed}
              onCreateIssue={onCreateIssue}
              onOpenIssue={onOpenIssue}
              onIssueContextMenu={openContextMenu}
            />
          ))}
        </div>

        <DragOverlay>
          {activeIssue ? (
            <BoardCardContent
              issue={activeIssue}
              isOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

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
