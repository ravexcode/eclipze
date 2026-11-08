import { INBOX_ROW_BAR_WIDTHS } from "@/constants/skeletons";

export default function InboxSkeleton() {
  return (
    <div
      role="status"
      className="flex flex-col">
      <span className="sr-only">Loading inbox…</span>

      {INBOX_ROW_BAR_WIDTHS.map((barWidth, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex min-h-9 items-center gap-2.5 px-2 py-2">
          <span className="skeleton h-1.5 w-1.5 shrink-0 rounded-full bg-background-focus" />
          <span className={`skeleton h-1.5 rounded-full bg-background-focus ${barWidth}`} />
        </div>
      ))}
    </div>
  );
}
