import { Fragment } from "react";

import {
  ISSUE_HEATMAP_DAYS_PER_WEEK,
  ISSUE_HEATMAP_MONTH_COUNT,
  ISSUE_HEATMAP_WEEK_COUNT,
} from "@/constants/skeletons";

export default function IssuesSkeleton() {
  return (
    <div
      role="status"
      className="min-w-0 overflow-x-auto pb-1">
      <span className="sr-only">Loading issue activity…</span>

      <div
        aria-hidden="true"
        className="grid min-w-[650px] gap-1"
        style={{ gridTemplateColumns: `repeat(${ISSUE_HEATMAP_WEEK_COUNT}, minmax(0, 1fr))` }}>
        <div className="col-span-full grid min-h-5 grid-cols-12">
          {Array.from({ length: ISSUE_HEATMAP_MONTH_COUNT }, (_, index) => (
            <span
              key={index}
              className="skeleton h-1.5 w-5 rounded-full bg-background-focus" />
          ))}
        </div>

        {Array.from({ length: ISSUE_HEATMAP_DAYS_PER_WEEK }, (_, index) => {
          const gridRowStart = index + 2;

          return (
            <Fragment key={index}>
              {/* Square spacer keeps each row as tall as a heatmap cell, so the card does not jump. */}
              <span
                className="aspect-square"
                style={{ gridColumnStart: 1, gridRowStart }} />
              <span
                className="skeleton col-span-full h-2 self-center rounded-full bg-background-focus"
                style={{ gridRowStart }} />
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
