import {
  ISSUE_RESULTS_SKELETON_COUNT,
  ISSUE_RESULTS_TITLE_BAR_WIDTHS,
} from "@/constants/skeletons";

export default function IssueResultsSkeleton() {
  return (
    <div
      role="status"
      className="flex flex-col gap-2">
      <span className="sr-only">Loading issues…</span>

      {Array.from({ length: ISSUE_RESULTS_SKELETON_COUNT }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex w-full flex-col gap-3 rounded-md border border-background-focus bg-background-card p-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`skeleton h-2 rounded-full bg-background-focus ${ISSUE_RESULTS_TITLE_BAR_WIDTHS[index]}`} />
              <span className="skeleton h-2 w-10 rounded-full bg-background-focus" />
            </div>

            <div className="mt-1 flex flex-col gap-1">
              <span className="skeleton h-2 w-5/6 rounded-full bg-background-focus" />
              <span className="skeleton h-2 w-2/3 rounded-full bg-background-focus" />
            </div>

            <span className="skeleton mt-2 block h-1.5 w-24 rounded-full bg-background-focus" />
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span className="skeleton h-2 w-12 rounded-full bg-background-focus" />
            <span className="skeleton h-2 w-14 rounded-full bg-background-focus" />
          </div>
        </div>
      ))}
    </div>
  );
}
