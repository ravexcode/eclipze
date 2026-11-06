import { SIDEBAR_LABEL_BAR_WIDTHS } from "@/constants/skeletons";

export default function LabelsSkeleton() {
  return (
    <div
      role="status"
      className="flex w-full flex-col gap-1">
      <span className="sr-only">Loading navigation…</span>

      {SIDEBAR_LABEL_BAR_WIDTHS.map((barWidth, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex w-full items-center justify-start gap-2 px-3 py-1.5">
          <span className="skeleton h-5 w-5 shrink-0 rounded-md bg-background-focus" />
          <span className={`skeleton h-2 rounded-full bg-background-focus ${barWidth}`} />
        </div>
      ))}
    </div>
  );
}
