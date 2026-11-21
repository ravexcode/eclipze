import { BOARD_SKELETON_COLUMN_CARD_COUNTS } from "@/constants/skeletons";

export default function BoardSkeleton() {
  return (
    <div
      role="status"
      className="flex min-h-0 flex-1 gap-3 overflow-hidden">
      <span className="sr-only">Loading board…</span>

      {BOARD_SKELETON_COLUMN_CARD_COUNTS.map((cardCount, columnIndex) => (
        <div
          key={columnIndex}
          aria-hidden="true"
          className="flex h-full w-72 shrink-0 flex-col gap-2 rounded-md border border-background-focus bg-background-card p-2">
          <div className="flex items-center gap-2 px-1 py-1.5">
            <span className="skeleton h-2 w-20 rounded-full bg-background-focus" />
            <span className="skeleton h-2 w-5 rounded-full bg-background-focus" />
          </div>

          {Array.from({ length: cardCount }, (_, cardIndex) => (
            <div
              key={cardIndex}
              className="flex flex-col gap-2 rounded-md border border-background-focus bg-background p-3">
              <span className="skeleton h-2 w-3/4 rounded-full bg-background-focus" />
              <span className="skeleton h-2 w-full rounded-full bg-background-focus" />
              <span className="skeleton h-2 w-2/3 rounded-full bg-background-focus" />
              <span className="skeleton mt-1 h-1.5 w-24 rounded-full bg-background-focus" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
