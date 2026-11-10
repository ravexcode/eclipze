"use client";

import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";

import BoardCanvas from "@/components/board/board-canvas";
import BoardToolbar from "@/components/board/board-toolbar";
import IssueDeleteDialog from "@/components/issues/issue-delete-dialog";
import IssueForm from "@/components/issues/issue-form";
import DashLayout from "@/components/layouts/dash";
import BoardSkeleton from "@/components/skeletons/board/board-skeleton";
import Dialog from "@/components/ui/dialog";
import Heading from "@/components/ui/heading";
import Snackbar from "@/components/ui/snackbar";
import { initialBoardFilters } from "@/constants/board";
import { initialIssueForm } from "@/constants/issues";
import type { BoardFilters } from "@/types/board";
import type { IssueFormValues, IssueItem } from "@/types/issues";
import type { IssueStatus } from "@/types/user";
import { readCollapsedColumns, writeCollapsedColumns } from "@/utils/board";
import { useSnackbar } from "@/utils/snackbar";
import { useBoard } from "@/utils/use-board";

export default function BoardPage() {
  const router = useRouter();
  const { snackbar, showSnackbar, dismissSnackbar } = useSnackbar();
  const board = useBoard(showSnackbar);

  const [filters, setFilters] = useState<BoardFilters>(initialBoardFilters);
  const [collapsedColumns, setCollapsedColumns] = useState<IssueStatus[]>(readCollapsedColumns);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<IssueFormValues>(initialIssueForm);
  const [editingIssue, setEditingIssue] = useState<IssueItem | null>(null);
  const [editForm, setEditForm] = useState<IssueFormValues>(initialIssueForm);
  const [deletingIssue, setDeletingIssue] = useState<IssueItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const toggleCollapsedColumn = (status: IssueStatus) => {
    const nextCollapsedColumns = collapsedColumns.includes(status)
      ? collapsedColumns.filter((collapsedStatus) => collapsedStatus !== status)
      : [...collapsedColumns, status];

    setCollapsedColumns(nextCollapsedColumns);
    writeCollapsedColumns(nextCollapsedColumns);
  };

  const openCreateForm = () => {
    setFormError(null);
    setShowCreateForm(true);
  };

  const openEditForm = (issue: IssueItem) => {
    setEditForm({
      title: issue.title,
      description: issue.description ?? "",
      type: issue.type,
      priority: issue.priority,
    });
    setFormError(null);
    setEditingIssue(issue);
  };

  const submitCreateForm = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    const errorMessage = await board.createIssue(createForm);
    setIsSaving(false);

    if (errorMessage) {
      setFormError(errorMessage);
      return;
    }

    setCreateForm({ ...initialIssueForm });
    setShowCreateForm(false);
  };

  const submitEditForm = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingIssue || isSaving) return;

    setIsSaving(true);
    const errorMessage = await board.updateIssue(editingIssue.id, editForm);
    setIsSaving(false);

    if (errorMessage) {
      setFormError(errorMessage);
      return;
    }

    setEditingIssue(null);
  };

  return (
    <DashLayout
      current="board"
      router={router}>
      <main className="flex h-full w-full min-w-0 flex-col">
        <Heading label="Board" />

        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
          <BoardToolbar
            filters={filters}
            loading={board.loading}
            onFiltersChange={(updates) =>
              setFilters((previous) => ({ ...previous, ...updates }))
            }
            onRefresh={() => void board.reload(true)}
            onCreateIssue={openCreateForm}
          />

          {board.error ? (
            <p
              role="alert"
              className="rounded-md border border-priority-high bg-background-card p-3 text-xs text-priority-high">
              {board.error}
            </p>
          ) : null}

          {board.loading ? (
            <BoardSkeleton />
          ) : (
            <BoardCanvas
              columns={board.columns}
              filters={filters}
              collapsedColumns={collapsedColumns}
              onToggleCollapsed={toggleCollapsedColumn}
              onDraggingChange={board.setDragging}
              onMoveIssue={(move) => void board.moveIssue(move)}
              onOpenIssue={(issueId) => router.push(`/issues/${issueId}`)}
              onEditIssue={openEditForm}
              onDeleteIssue={setDeletingIssue}
            />
          )}
        </div>
      </main>

      <Dialog
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        size="lg"
        title="New issue"
        description="New issues enter the board at the top of the Open column.">
        <IssueForm
          form={createForm}
          error={formError}
          onChange={(updates) =>
            setCreateForm((previous) => ({ ...previous, ...updates }))
          }
          onSubmit={submitCreateForm}
          onCancel={() => setShowCreateForm(false)}
          submitLabel={isSaving ? "Saving..." : "Submit issue"}
        />
      </Dialog>

      <Dialog
        isOpen={editingIssue !== null}
        onClose={() => setEditingIssue(null)}
        size="lg"
        title="Edit issue">
        <IssueForm
          form={editForm}
          error={formError}
          onChange={(updates) =>
            setEditForm((previous) => ({ ...previous, ...updates }))
          }
          onSubmit={submitEditForm}
          onCancel={() => setEditingIssue(null)}
          submitLabel={isSaving ? "Saving..." : "Save changes"}
          priorityDisabled={isSaving}
        />
      </Dialog>

      <IssueDeleteDialog
        issue={deletingIssue}
        onClose={() => setDeletingIssue(null)}
        onConfirm={(issue) => void board.deleteIssue(issue)}
      />

      {snackbar ? (
        <Snackbar
          mode={snackbar.mode}
          message={snackbar.message}
          onClose={dismissSnackbar}
        />
      ) : null}
    </DashLayout>
  );
}
