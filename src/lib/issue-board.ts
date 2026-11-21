import type { IssueStatus, Prisma } from "@prisma/client";

import { getIssueAccessFilter } from "@/lib/issue-access";
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
  unlistedColumnIds: string[],
) {
  const listedIds = new Set(requestedIds);
  const remainingIds = unlistedColumnIds.filter(issueId => !listedIds.has(issueId));

  return [...requestedIds, ...remainingIds];
}

/**
 * Counts the people who work on each project.
 * Projects only have an owner today, so every project counts one member.
 * See `.agents/tasks/project-members.md`: once project members exist, count them here.
 */
export async function countProjectMembers(projectIds: string[]) {
  return new Map(projectIds.map(projectId => [projectId, 1]));
}

/**
 * A board is collaborative when one of the projects it shows has more than one member.
 * Collaborative boards save each move at once and follow changes made by others live.
 */
export async function isBoardCollaborative(userId: string) {
  const projects = await prisma.issue.findMany({
    where: {
      ...getIssueAccessFilter(userId),
      projectId: { not: null },
    },
    distinct: ["projectId"],
    select: { projectId: true },
  });

  const projectIds = projects
    .map(project => project.projectId)
    .filter((projectId): projectId is string => projectId !== null);

  const memberCounts = await countProjectMembers(projectIds);

  return [...memberCounts.values()].some(memberCount => memberCount > 1);
}

/**
 * A short fingerprint of every issue the user can see on the board.
 * It changes whenever an issue is created, edited, moved or deleted.
 */
export async function getBoardVersion(userId: string) {
  const summary = await prisma.issue.aggregate({
    where: getIssueAccessFilter(userId),
    _count: { _all: true },
    _max: { updatedAt: true },
  });

  const latestUpdate = summary._max.updatedAt?.toISOString() ?? "empty";

  return `${summary._count._all}:${latestUpdate}`;
}
