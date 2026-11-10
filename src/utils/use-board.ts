"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { BOARD_ENDPOINT } from "@/constants/board";
import { CONNECTION_ERROR_MESSAGE } from "@/constants/snackbar";
import type { BoardMove } from "@/types/board";
import type { IssueFormValues, IssueItem } from "@/types/issues";
import { apiFetch } from "@/utils/api-fetch";
import { flattenBoardColumns, groupIssuesByStatus } from "@/utils/board";
import { isConnectionError } from "@/utils/connection-error";
import { buildIssueUpdatePayload } from "@/utils/issues";
import { refreshSessionUser } from "@/utils/session";
import { useIssueRefresh } from "@/utils/use-issue-refresh";

type ApiMessage = {
  message?: string;
} | null;

// The board refreshes itself after each change, so the shared cache event is not needed.
const KEEP_PRIVATE_CACHE = { invalidatePrivateCache: false };

const JSON_HEADERS = { "content-type": "application/json" };

/** Loads the issues of the board and saves every change made on it. */
export function useBoard(showSnackbar: (message: string) => void) {
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedIssues = useRef(false);
  const isDragging = useRef(false);
  const changeVersion = useRef(0);

  const columns = useMemo(() => groupIssuesByStatus(issues), [issues]);

  const clearBoard = useCallback(() => {
    setIssues([]);
    hasLoadedIssues.current = false;
  }, []);

  const refresh = useCallback(async (signal: AbortSignal) => {
    if (!hasLoadedIssues.current) setLoading(true);
    setError(null);
    const versionAtStart = changeVersion.current;

    try {
      const sessionUser = await refreshSessionUser();
      if (signal.aborted) return;
      if (!sessionUser) {
        clearBoard();
        return;
      }

      const response = await apiFetch("/api/issues", { signal });
      if (!response.ok) {
        setError("Unable to load the board.");
        return;
      }

      const data = await response.json() as { issues: IssueItem[] };
      if (signal.aborted) return;

      // A response that started before a drag or a save would undo what the user just did.
      const boardChangedMeanwhile = versionAtStart !== changeVersion.current;
      if (isDragging.current || boardChangedMeanwhile) return;

      setIssues(data.issues);
      hasLoadedIssues.current = true;
    } catch (loadError) {
      if (signal.aborted) return;
      if (isConnectionError(loadError)) {
        showSnackbar(CONNECTION_ERROR_MESSAGE);
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Unable to load the board.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [clearBoard, showSnackbar]);

  const reload = useIssueRefresh(refresh, clearBoard);

  const setDragging = useCallback((dragging: boolean) => {
    isDragging.current = dragging;
  }, []);

  const reportRequestError = useCallback((requestError: unknown, fallbackMessage: string) => {
    showSnackbar(isConnectionError(requestError) ? CONNECTION_ERROR_MESSAGE : fallbackMessage);
  }, [showSnackbar]);

  const moveIssue = useCallback(async (move: BoardMove) => {
    const previousIssues = issues;
    const orderedIds = move.columns[move.status].map((issue) => issue.id);

    changeVersion.current += 1;
    const versionOfMove = changeVersion.current;
    setIssues(flattenBoardColumns(move.columns));

    const restoreBoard = () => {
      // A newer move already replaced this one on screen; reloading shows the saved state.
      if (versionOfMove !== changeVersion.current) {
        void reload(true);
        return;
      }
      setIssues(previousIssues);
    };

    try {
      const response = await apiFetch(
        BOARD_ENDPOINT,
        {
          method: "PUT",
          headers: JSON_HEADERS,
          body: JSON.stringify({
            issueId: move.issueId,
            status: move.status,
            orderedIds,
          }),
        },
        KEEP_PRIVATE_CACHE,
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null) as ApiMessage;
        restoreBoard();
        showSnackbar(data?.message ?? "Unable to move the issue.");
      }
    } catch (moveError) {
      restoreBoard();
      reportRequestError(moveError, "Unable to move the issue.");
    }
  }, [issues, reload, reportRequestError, showSnackbar]);

  /** Sends a create or edit request. Returns an error message, or null when it is saved. */
  const saveIssue = useCallback(async (
    url: string,
    method: "POST" | "PATCH",
    payload: unknown,
    fallbackMessage: string,
  ) => {
    try {
      const response = await apiFetch(
        url,
        {
          method,
          headers: JSON_HEADERS,
          body: JSON.stringify(payload),
        },
        KEEP_PRIVATE_CACHE,
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null) as ApiMessage;
        return data?.message ?? fallbackMessage;
      }

      changeVersion.current += 1;
      await reload(true);
      return null;
    } catch (saveError) {
      return isConnectionError(saveError) ? CONNECTION_ERROR_MESSAGE : fallbackMessage;
    }
  }, [reload]);

  const createIssue = useCallback((form: IssueFormValues) => (
    saveIssue("/api/issues", "POST", form, "Unable to create issue.")
  ), [saveIssue]);

  const updateIssue = useCallback((issueId: string, form: IssueFormValues) => (
    saveIssue(
      `/api/issues/${issueId}`,
      "PATCH",
      buildIssueUpdatePayload(form, "DEVELOPER"),
      "Unable to update issue.",
    )
  ), [saveIssue]);

  const deleteIssue = useCallback(async (issue: IssueItem) => {
    const previousIssues = issues;

    changeVersion.current += 1;
    setIssues((currentIssues) =>
      currentIssues.filter((currentIssue) => currentIssue.id !== issue.id),
    );

    try {
      const response = await apiFetch(
        `/api/issues/${issue.id}`,
        { method: "DELETE" },
        KEEP_PRIVATE_CACHE,
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null) as ApiMessage;
        setIssues(previousIssues);
        showSnackbar(data?.message ?? "Unable to delete issue.");
      }
    } catch (deleteError) {
      setIssues(previousIssues);
      reportRequestError(deleteError, "Unable to delete issue.");
    }
  }, [issues, reportRequestError, showSnackbar]);

  return {
    columns,
    loading,
    error,
    reload,
    setDragging,
    moveIssue,
    createIssue,
    updateIssue,
    deleteIssue,
  };
}
