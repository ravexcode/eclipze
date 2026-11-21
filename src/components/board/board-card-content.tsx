import Link from "next/link";

import { boardPriorityStripeClasses } from "@/constants/board";
import { priorityClasses, priorityLabels, typeLabels } from "@/constants/issues";
import type { IssueItem } from "@/types/issues";
import { dateLabel } from "@/utils/issues";

type BoardCardContentProps = {
  issue: IssueItem;
  isOverlay?: boolean;
};

/** The look of a board card, shared by the card in a column and the card under the cursor. */
export default function BoardCardContent({
  issue,
  isOverlay = false,
}: BoardCardContentProps) {
  const requesterName = issue.requester?.username ?? issue.requester?.email;

  return (
    <article
      className={
        "relative flex flex-col gap-2 overflow-hidden rounded-md border bg-background p-3 pl-4 text-left transition-colors " +
        (isOverlay
          ? "rotate-1 cursor-grabbing border-accent shadow-xl"
          : "border-background-focus hover:bg-background-focus")
      }>
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-0.5 ${boardPriorityStripeClasses[issue.priority]}`} />

      {isOverlay ? (
        <p className="text-xs font-medium">
          {issue.title}
        </p>
      ) : (
        <Link
          href={`/issues/${issue.id}`}
          draggable={false}
          onClick={(event) => event.stopPropagation()}
          className="w-fit max-w-full rounded-sm text-xs font-medium hover:underline focus-visible:ring-1 focus-visible:ring-accent">
          {issue.title}
        </Link>
      )}

      {issue.description ? (
        <p className="line-clamp-2 text-xs text-foreground-off">
          {issue.description}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <span className="text-foreground-off">
          {typeLabels[issue.type]}
        </span>

        <span className={priorityClasses[issue.priority]}>
          {priorityLabels[issue.priority]}
        </span>
      </div>

      <p className="truncate text-xs text-foreground-off">
        {requesterName ? `${requesterName} · ` : ""}
        {dateLabel(issue.lastActivityAt)}
      </p>
    </article>
  );
}
