import type { IssueStatus, Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";

type IssueBoardClient = Prisma.TransactionClient | typeof prisma;

/** Returns the position that places an issue above every other issue of a board column. */
export async function getTopBoardPosition(
  status: IssueStatus,
  client: IssueBoardClient = prisma,
) {
  const column = await client.issue.aggregate({
    where: { status },
    _min: { boardPosition: true },
  });

  return (column._min.boardPosition ?? 1) - 1;
}

/**
 * Builds the final order of a board column.
 * Issues the client listed keep the requested order; issues it did not list
 * (created or moved by someone else meanwhile) keep their place after them.
 */
export function buildColumnOrder(
  requestedIds: string[],
  columnIssueIds: string[],
  movedIssueId: string,
) {
  const allowedIds = new Set([...columnIssueIds, movedIssueId]);
  const orderedIds = requestedIds.filter(issueId => allowedIds.has(issueId));
  const listedIds = new Set(orderedIds);
  const unlistedIds = columnIssueIds.filter(issueId => !listedIds.has(issueId));

  return [...orderedIds, ...unlistedIds];
}
