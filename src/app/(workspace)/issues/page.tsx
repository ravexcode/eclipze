"use client";

import { useCallback, useMemo, useRef, useState, type SubmitEvent } from "react";

import IssueFilters from "@/components/issues/issue-filters";
import IssueForm from "@/components/issues/issue-form";
import IssueDeleteDialog from "@/components/issues/issue-delete-dialog";
import IssueResults from "@/components/issues/issue-results";
import IssueToolbar from "@/components/issues/issue-toolbar";
import DashLayout from "@/components/layouts/dash";
import Dialog from "@/components/ui/dialog";
import Heading from "@/components/ui/heading";
import Snackbar from "@/components/ui/snackbar";
import { initialIssueForm } from "@/constants/issues";
import { CONNECTION_ERROR_MESSAGE } from "@/constants/snackbar";
import type { IssueFormValues, IssueItem } from "@/types/issues";
import type { IssueStatus, IssueType, UserRole } from "@/types/user";
import { apiFetch } from "@/utils/api-fetch";
import { IssuesCache } from "@/utils/cache";
import { isConnectionError } from "@/utils/connection-error";
import { buildIssueUpdatePayload, filterIssues } from "@/utils/issues";
import { refreshSessionUser } from "@/utils/session";
import { useIssueRefresh } from "@/utils/use-issue-refresh";
import { useSnackbar } from "@/utils/snackbar";
import { useRouter } from "next/navigation";

export default function IssuesPage() {
  const router = useRouter();
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [role, setRole] = useState<UserRole>("USER");
  const [unread, setUnread] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | IssueStatus>("ALL");
  const [type, setType] = useState<"ALL" | IssueType>("ALL");
  const [showForm, setShowForm] = useState(false);
  const [editingIssue, setEditingIssue] = useState<IssueItem | null>(null);
  const [deletingIssue, setDeletingIssue] = useState<IssueItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<IssueFormValues>(initialIssueForm);
  const [editForm, setEditForm] = useState<IssueFormValues>(initialIssueForm);
  const sessionUserId = useRef<string | null>(null);
  const pendingDeletes = useRef(new Set<string>());
  const hasLoadedIssues = useRef(false);
  const { snackbar, showSnackbar, dismissSnackbar } = useSnackbar();

  const clearIssues = useCallback(() => {
    setIssues([]);
    setUnread(0);
    setRole("USER");
    sessionUserId.current = null;
    hasLoadedIssues.current = false;
    setShowForm(false);
    setEditingIssue(null);
    setDeletingIssue(null);
    setCreateForm({ ...initialIssueForm });
    setEditForm({ ...initialIssueForm });
  }, []);

  const refresh = useCallback(async (signal: AbortSignal) => {
    if (!hasLoadedIssues.current) setLoading(true);
    setError(null);
    try {
      const sessionUser = await refreshSessionUser();
      if (signal.aborted) return;
      if (!sessionUser) {
        clearIssues();
        return;
      }
      sessionUserId.current = sessionUser.id;
      setRole(sessionUser.role);
      const [issueResponse, notificationResponse] = await Promise.all([
        apiFetch("/api/issues", { signal }),
        apiFetch("/api/notifications?countOnly=true", { signal }),
      ]);
      if (!issueResponse.ok || !notificationResponse.ok) {
        clearIssues();
        setError("Unable to load issues.");
        return;
      }
      const data = await issueResponse.json() as { issues: IssueItem[] };
      const notifications = await notificationResponse.json() as { unread: number };
      if (signal.aborted) return;
      const visibleIssues = data.issues.filter((issue) => !pendingDeletes.current.has(issue.id));
      setIssues(visibleIssues);
      setUnread(notifications.unread);
      IssuesCache.update(sessionUser.id, sessionUser.role, visibleIssues, notifications.unread, "all-issues");
      hasLoadedIssues.current = true;
    } catch (loadError) {
      if (signal.aborted) return;
      if (isConnectionError(loadError)) {
        showSnackbar(CONNECTION_ERROR_MESSAGE);
        return;
      }
      clearIssues();
      setError(loadError instanceof Error ? loadError.message : "Unable to load issues.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [clearIssues, showSnackbar]);

  const load = useIssueRefresh(refresh, clearIssues);

  const filteredIssues = useMemo(
    () => filterIssues(issues, query, status, type),
    [issues, query, status, type],
  );

  const createIssue = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFormError(null);

    try {
      const response = await apiFetch("/api/issues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!response.ok) {
        setFormError(data?.message ?? "Unable to create issue.");
        return;
      }

      setCreateForm({ ...initialIssueForm });
      setFormError(null);
      setShowForm(false);

      await load(true);
    } catch (requestError) {
      if (isConnectionError(requestError)) {
        showSnackbar(CONNECTION_ERROR_MESSAGE);
      }
    }
  };

  const deleteIssue = async (issue: IssueItem) => {
    const issueIndex = issues.findIndex((currentIssue) => currentIssue.id === issue.id);
    if (issueIndex < 0 || pendingDeletes.current.has(issue.id)) return;

    const deletingUserId = sessionUserId.current;
    pendingDeletes.current.add(issue.id);
    setIssues((currentIssues) => currentIssues.filter((currentIssue) => currentIssue.id !== issue.id));

    try {
      const response = await apiFetch(
        `/api/issues/${issue.id}`,
        { method: "DELETE" },
        { invalidatePrivateCache: false },
      );
      const data = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!response.ok) {
        pendingDeletes.current.delete(issue.id);
        setIssues((currentIssues) => {
          if (currentIssues.some((currentIssue) => currentIssue.id === issue.id)) {
            return currentIssues;
          }

          const restoredIssues = [...currentIssues];
          restoredIssues.splice(Math.min(issueIndex, restoredIssues.length), 0, issue);
          return restoredIssues;
        });
        showSnackbar(data?.message ?? "Unable to delete issue.");
        return;
      }

      pendingDeletes.current.delete(issue.id);
      if (deletingUserId) {
        IssuesCache.removeIssue(deletingUserId, issue.id);
      }
    } catch (deleteError) {
      pendingDeletes.current.delete(issue.id);
      setIssues((currentIssues) => {
        if (currentIssues.some((currentIssue) => currentIssue.id === issue.id)) {
          return currentIssues;
        }

        const restoredIssues = [...currentIssues];
        const insertionIndex = Math.min(issueIndex, restoredIssues.length);
        restoredIssues.splice(insertionIndex, 0, issue);
        return restoredIssues;
      });

      if (isConnectionError(deleteError)) {
        showSnackbar(CONNECTION_ERROR_MESSAGE);
      }
    }
  };

  const openEditIssue = (issue: IssueItem) => {
    setEditForm({
      title: issue.title,
      description: issue.description ?? "",
      type: issue.type,
      priority: issue.priority,
    });
    setFormError(null);
    setEditingIssue(issue);
  };

  const updateIssue = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingIssue || isSavingEdit) return;

    setFormError(null);
    setIsSavingEdit(true);
    try {
      const response = await apiFetch(`/api/issues/${editingIssue.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildIssueUpdatePayload(editForm, role)),
      });
      const data = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!response.ok) {
        setFormError(data?.message ?? "Unable to update issue.");
        return;
      }

      setEditingIssue(null);
      await load(true);
    } catch (requestError) {
      if (isConnectionError(requestError)) {
        showSnackbar(CONNECTION_ERROR_MESSAGE);
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <DashLayout
      current="issues"
      router={router}>
      <main
        className="w-full min-w-0">
        <Heading label="Issues" />

        <div
          className="mx-auto flex w-full max-w-350 flex-col gap-5 p-4 md:p-6">
          <IssueToolbar
            unread={unread}
            loading={loading}
            onRefresh={() => void load(true)}
            onCreateIssue={() => {
              setError(null);
              setFormError(null);
              setShowForm(true);
            }}
          />

          <IssueFilters
            query={query}
            status={status}
            type={type}
            onQueryChange={setQuery}
            onStatusChange={setStatus}
            onTypeChange={setType}
          />

          <IssueResults
            error={error}
            loading={loading}
            issues={filteredIssues}
            role={role}
            onOpenIssue={(issueId) => router.push(`/issues/${issueId}`)}
            onEditIssue={openEditIssue}
            onDeleteIssue={setDeletingIssue}
          />
        </div>
      </main>

      <Dialog
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        size="lg"
        title="New issue"
        description="Describe what you need so the team can follow up.">
        <IssueForm
          form={createForm}
          error={formError}
          onChange={(updates) =>
            setCreateForm((previous) => ({ ...previous, ...updates }))
          }
          onSubmit={createIssue}
          onCancel={() => setShowForm(false)}
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
          onSubmit={updateIssue}
          onCancel={() => setEditingIssue(null)}
          submitLabel={isSavingEdit ? "Saving..." : "Save changes"}
          priorityDisabled={role !== "DEVELOPER" || isSavingEdit}
        />
      </Dialog>

      <IssueDeleteDialog
        issue={deletingIssue}
        onClose={() => setDeletingIssue(null)}
        onConfirm={(issue) => void deleteIssue(issue)}
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
