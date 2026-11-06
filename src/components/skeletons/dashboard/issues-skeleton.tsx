import {
  ISSUE_HEATMAP_CELL_COUNT,
  ISSUE_HEATMAP_MONTH_COUNT,
  ISSUE_HEATMAP_WEEK_COUNT,
} from "@/constants/skeletons";

export default function IssuesSkeleton() {
  return (
    <div
      role="status"
      className="min-w-0 overflow-x-auto pb-1">
      <span className="sr-only">Loading issue activity…</span>

      {/* One shimmer sweeps the whole grid, so the cells stay static. */}
      <div
        aria-hidden="true"
        className="skeleton grid min-w-[650px] gap-1"
        style={{ gridTemplateColumns: `repeat(${ISSUE_HEATMAP_WEEK_COUNT}, minmax(0, 1fr))` }}>
        <div className="col-span-full grid min-h-5 grid-cols-12">
          {Array.from({ length: ISSUE_HEATMAP_MONTH_COUNT }, (_, index) => (
            <span
              key={index}
              className="h-1.5 w-5 rounded-full bg-background-focus" />
          ))}
        </div>

        {Array.from({ length: ISSUE_HEATMAP_CELL_COUNT }, (_, index) => (
          <div
            key={index}
            className="aspect-square min-w-0 rounded-[3px] bg-background-focus" />
        ))}
      </div>
    </div>
  );
}
