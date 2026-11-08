"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SNACKBAR_DURATION } from "@/constants/snackbar";

export type SnackbarMessage = {
  mode: "warn" | "error";
  message: string;
};

export function useSnackbar() {
  const [snackbar, setSnackbar] = useState<SnackbarMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissSnackbar = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setSnackbar(null);
  }, []);

  const showSnackbar = useCallback((message: string, mode: SnackbarMessage["mode"] = "error") => {
    if (timer.current) clearTimeout(timer.current);
    setSnackbar({ mode, message });
    timer.current = setTimeout(() => {
      timer.current = null;
      setSnackbar(null);
    }, SNACKBAR_DURATION);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { snackbar, showSnackbar, dismissSnackbar };
}
