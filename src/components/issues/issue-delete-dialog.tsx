"use client";

import { useState } from "react";

import Dialog from "@/components/ui/dialog";
import type { IssueItem } from "@/types/issues";
import { apiFetch } from "@/utils/api-fetch";

type IssueDeleteDialogProps = {
  issue: IssueItem | null;
  onClose(): void;
  onDeleted(): Promise<void>;
};

export default function IssueDeleteDialog({
  issue,
  onClose,
  onDeleted,
}: IssueDeleteDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const closeDialog = () => {
    if (isDeleting) return;

    setError(null);
    onClose();
  };

  const deleteIssue = async () => {
    if (!issue || isDeleting) return;

    setError(null);
    setIsDeleting(true);
    try {
      const response = await apiFetch(`/api/issues/${issue.id}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!response.ok) {
        setError(data?.message ?? "Unable to delete issue.");
        return;
      }

      setError(null);
      onClose();
      await onDeleted();
    } catch {
      setError("Unable to delete issue.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      isOpen={issue !== null}
      onClose={closeDialog}
      title="Delete issue"
      description="This issue and its messages will be deleted permanently and cannot be undone.">
      {issue ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-md border border-background-focus bg-background-focus px-3 py-2 text-xs font-medium">
            {issue.title}
          </p>
          {error ? (
            <p role="alert" className="text-xs text-alert-red">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDialog}
              disabled={isDeleting}
              className="rounded-md px-3 py-1.5 text-xs text-foreground-off hover:bg-background-focus disabled:opacity-50">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void deleteIssue()}
              disabled={isDeleting}
              className="rounded-md bg-alert-red px-3 py-1.5 text-xs text-white hover:brightness-110 disabled:opacity-50">
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
