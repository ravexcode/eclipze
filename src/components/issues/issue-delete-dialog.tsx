"use client";

import Dialog from "@/components/ui/dialog";
import type { IssueItem } from "@/types/issues";

type IssueDeleteDialogProps = {
  issue: IssueItem | null;
  onClose(): void;
  onConfirm(issue: IssueItem): void;
};

export default function IssueDeleteDialog({
  issue,
  onClose,
  onConfirm,
}: IssueDeleteDialogProps) {
  return (
    <Dialog
      isOpen={issue !== null}
      onClose={onClose}
      title="Delete issue"
      description="This issue and its messages will be deleted permanently and cannot be undone.">
      {issue ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-md border border-background-focus bg-background-focus px-3 py-2 text-xs font-medium">
            {issue.title}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-xs text-foreground-off hover:bg-background-focus">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!issue) return;
                onClose();
                onConfirm(issue);
              }}
              className="rounded-md bg-alert-red px-3 py-1.5 text-xs text-white hover:brightness-110">
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
