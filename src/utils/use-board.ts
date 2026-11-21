"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  BOARD_ENDPOINT,
  BOARD_LIVE_SYNC_INTERVAL,
  BOARD_SAVE_DEBOUNCE_DELAY,
} from "@/constants/board";
import { CONNECTION_ERROR_MESSAGE } from "@/constants/snackbar";
import type { BoardColumns, BoardColumnOrder, BoardMove, BoardState } from "@/types/board";
import type { IssueFormValues, IssueItem } from "@/types/issues";
import type { IssueStatus } from "@/types/user";
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

const MOVE_ERROR_MESSAGE = "Unable to save the board.";

/**
 * Loads the issues of the board and saves every change made on it.
 *
 * Personal boards save moves together once the user stops moving cards for a moment.
 * Collaborative boards (a project with more than one member) save each move at once
 * and reload when another member changes the board.
 */
export function useBoard(showSnackbar: (message: string) => void) {
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collaborative, setCollaborative] = useState(false);

  const hasLoadedIssues = useRef(false);
  const isDragging = useRef(false);
  const changeVersion = useRef(0);
  const boardVersion = useRef<string | null>(null);
  const isCollaborative = useRef(false);

  // Moves not sent yet: the latest board on screen and the columns it changed.
  const unsavedColumns = useRef<BoardColumns | null>(null);
  const unsavedStatuses = useRef(new Set<IssueStatus>());
  const saveTimer = useRef<number | null>(null);
  const savesInFlight = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const columns = useMemo(() => groupIssuesByStatus(issues), [issues]);

  const hasUnsavedMoves = useCallback(() => (
    unsavedStatuses.current.size > 0 || savesInFlight.current > 0
  ), []);

  const applyBoardState = useCallback((state: BoardState) => {
    isCollaborative.current = state.collaborative;
    boardVersion.current = state.version;
    setCollaborative(state.collaborative);
  }, []);

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

      const [issuesResponse, boardResponse] = await Promise.all([
        apiFetch("/api/issues", { signal }),
        apiFetch(BOARD_ENDPOINT, { signal }),
      ]);
      if (!issuesResponse.ok || !boardResponse.ok) {
        setError("Unable to load the board.");
        return;
      }

      const [issuesData, boardState] = await Promise.all([
        issuesResponse.json() as Promise<{ issues: IssueItem[] }>,
        boardResponse.json() as Promise<BoardState>,
      ]);
      if (signal.aborted) return;

      // A response that started before a drag or a save would undo what the user just did.
      const boardChangedMeanwhile = versionAtStart !== changeVersion.current;
      if (isDragging.current || boardChangedMeanwhile || hasUnsavedMoves()) return;

      setIssues(issuesData.issues);
      applyBoardState(boardState);
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
  }, [applyBoardState, clearBoard, hasUnsavedMoves, showSnackbar]);

  const reload = useIssueRefresh(refresh, clearBoard);

  const setDragging = useCallback((dragging: boolean) => {
    isDragging.current = dragging;
  }, []);

  const reportRequestError = useCallback((requestError: unknown, fallbackMessage: string) => {
    showSnackbar(isConnectionError(requestError) ? CONNECTION_ERROR_MESSAGE : fallbackMessage);
  }, [showSnackbar]);

  const sendColumnOrders = useCallback(async (
    columnOrders: BoardColumnOrder[],
    keepalive: boolean,
  ) => {
    savesInFlight.current += 1;

    try {
      const response = await apiFetch(
        BOARD_ENDPOINT,
        {
          method: "PUT",
          headers: JSON_HEADERS,
          body: JSON.stringify({ columns: columnOrders }),
          keepalive,
        },
        KEEP_PRIVATE_CACHE,
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null) as ApiMessage;
        showSnackbar(data?.message ?? MOVE_ERROR_MESSAGE);
        return false;
      }

      const data = await response.json().catch(() => null) as { version?: string } | null;
      if (data?.version) boardVersion.current = data.version;
      return true;
    } catch (saveError) {
      reportRequestError(saveError, MOVE_ERROR_MESSAGE);
      return false;
    } finally {
      savesInFlight.current -= 1;
    }
  }, [reportRequestError, showSnackbar]);

  /** Sends every unsaved move in one request. Saves run one after another, in order. */
  const saveUnsavedMoves = useCallback((keepalive = false) => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    const boardToSave = unsavedColumns.current;
    const statusesToSave = [...unsavedStatuses.current];
    unsavedColumns.current = null;
    unsavedStatuses.current.clear();

    if (!boardToSave || statusesToSave.length === 0) return saveQueue.current;

    const columnOrders = statusesToSave.map((status) => ({
      status,
      orderedIds: boardToSave[status].map((issue) => issue.id),
    }));

    saveQueue.current = saveQueue.current.then(async () => {
      const saved = await sendColumnOrders(columnOrders, keepalive);

      // The server keeps the last good state; showing it undoes the failed move.
      if (!saved && !hasUnsavedMoves()) void reload(true);
    });

    return saveQueue.current;
  }, [hasUnsavedMoves, reload, sendColumnOrders]);

  const moveIssue = useCallback((move: BoardMove) => {
    changeVersion.current += 1;
    setIssues(flattenBoardColumns(move.columns));

    unsavedColumns.current = move.columns;
    unsavedStatuses.current.add(move.status);

    if (isCollaborative.current) {
      void saveUnsavedMoves();
      return;
    }

    // Each new move restarts the wait, so fast moves are saved together.
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void saveUnsavedMoves();
    }, BOARD_SAVE_DEBOUNCE_DELAY);
  }, [saveUnsavedMoves]);

  // Moves still waiting for the debounce are sent when the user leaves the page.
  useEffect(() => {
    const saveBeforeLeaving = () => void saveUnsavedMoves(true);

    window.addEventListener("pagehide", saveBeforeLeaving);

    return () => {
      window.removeEventListener("pagehide", saveBeforeLeaving);
      saveBeforeLeaving();
    };
  }, [saveUnsavedMoves]);

  // Shared boards check for changes made by other members and reload when there are any.
  useEffect(() => {
    if (!collaborative) return;

    const checkForChanges = async () => {
      const isBusy = isDragging.current || hasUnsavedMoves();
      if (document.visibilityState !== "visible" || isBusy) return;

      try {
        const response = await apiFetch(BOARD_ENDPOINT);
        if (!response.ok) return;

        const state = await response.json() as BoardState;
        if (state.version === boardVersion.current) return;
        if (isDragging.current || hasUnsavedMoves()) return;

        void reload(true);
      } catch {
        // A missed check is retried on the next interval.
      }
    };

    const timer = window.setInterval(() => void checkForChanges(), BOARD_LIVE_SYNC_INTERVAL);

    return () => window.clearInterval(timer);
  }, [collaborative, hasUnsavedMoves, reload]);

  /** Sends a create or edit request. Returns an error message, or null when it is saved. */
  const saveIssue = useCallback(async (
    url: string,
    method: "POST" | "PATCH",
    payload: unknown,
    fallbackMessage: string,
  ) => {
    // Pending moves go first, so the reload after this save shows them.
    await saveUnsavedMoves();

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
  }, [reload, saveUnsavedMoves]);

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
    collaborative,
    reload,
    setDragging,
    moveIssue,
    createIssue,
    updateIssue,
    deleteIssue,
  };
}
