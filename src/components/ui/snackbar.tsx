import { IconAlertCircle, IconAlertTriangle, IconX } from "@tabler/icons-react";

interface Props {
  mode: "warn" | "error";
  message: string;
  onClose(): void;
}

export default function Snackbar(props: Props) {
  const isError = props.mode === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-md border border-background-focus bg-background-card p-4 text-xs text-foreground">
      {isError ? (
        <IconAlertCircle size={18} className="mt-0.5 shrink-0 text-alert-red" />
      ) : (
        <IconAlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
      )}
      <p className="flex-1">{props.message}</p>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={props.onClose}
        className="-mr-1 -mt-1 rounded-md p-1 text-foreground-off hover:bg-background-focus hover:text-foreground">
        <IconX size={16} />
      </button>
    </div>
  );
}
