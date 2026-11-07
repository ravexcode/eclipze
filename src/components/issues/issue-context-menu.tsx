"use client";

import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useEffect, useRef, type KeyboardEvent } from "react";

import { ISSUE_CONTEXT_MENU_WIDTH } from "@/constants/issues";
import type { IssueContextMenuPosition } from "@/utils/issues";

type IssueContextMenuProps = {
  position: IssueContextMenuPosition;
  onEdit(): void;
  onDelete(): void;
  onClose(returnFocus?: boolean): void;
};

export default function IssueContextMenu({
  position,
  onEdit,
  onDelete,
  onClose,
}: IssueContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']")?.focus();

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose(false);
      }
    };
    const handleViewportChange = () => onClose(false);

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [onClose]);

  const focusMenuItem = (current: HTMLButtonElement, key: string) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']") ?? [],
    );
    const currentIndex = items.indexOf(current);
    let nextIndex = currentIndex;

    if (key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % items.length;
    }
    if (key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    }
    if (key === "Home") {
      nextIndex = 0;
    }
    if (key === "End") {
      nextIndex = items.length - 1;
    }
    items[nextIndex]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (event.target instanceof HTMLButtonElement) {
        focusMenuItem(event.target, event.key);
      }
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  const chooseItem = (handler: () => void) => {
    onClose(false);
    handler();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Issue actions"
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: `min(${ISSUE_CONTEXT_MENU_WIDTH}px, calc(100vw - 16px))`,
        maxHeight: "calc(100vh - 16px)",
        overflowY: "auto",
        zIndex: 50,
      }}
      className="rounded-md border border-background-focus bg-background-card p-1 shadow-xl">
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        onClick={() => chooseItem(onEdit)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs hover:bg-background-focus focus-visible:outline-2 focus-visible:outline-accent">
        <IconPencil size={14} />
        Edit issue
      </button>
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        onClick={() => chooseItem(onDelete)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs text-alert-red hover:bg-background-focus focus-visible:outline-2 focus-visible:outline-accent">
        <IconTrash size={14} />
        Delete issue
      </button>
    </div>
  );
}
