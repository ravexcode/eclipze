import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getIssueAccessFilter, getIssueRecipientIds } from "@/lib/issue-access";
import { buildColumnOrder, getBoardVersion, isBoardCollaborative } from "@/lib/issue-board";
import { developerRoleRequired } from "@/lib/platform-access";
import prisma from "@/lib/prisma";
import { badRequest, parseBody } from "@/lib/workspace-api";

const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED"] as const;
const MAX_COLUMN_ISSUES = 1000;

type BoardStatus = typeof STATUSES[number];

type ColumnOrder = {
  status: BoardStatus;
  orderedIds: string[];
};

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

function isBoardStatus(value: unknown): value is BoardStatus {
  return STATUSES.includes(value as BoardStatus);
}

function parseOrderedIds(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_COLUMN_ISSUES) return null;
  if (!value.every((issueId): issueId is string => typeof issueId === "string")) return null;

  return [...new Set(value)];
}

/**
 * Reads the columns of a save request.
 * Each column appears once, and an issue may only be listed in one column.
 */
function parseColumnOrders(value: unknown): ColumnOrder[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > STATUSES.length) {
    return null;
  }

  const columnOrders: ColumnOrder[] = [];
  const seenStatuses = new Set<BoardStatus>();
  const seenIssueIds = new Set<string>();

  for (const column of value) {
    if (typeof column !== "object" || column === null) return null;

    const { status, orderedIds: rawOrderedIds } = column as Record<string, unknown>;
    if (!isBoardStatus(status) || seenStatuses.has(status)) return null;

    const orderedIds = parseOrderedIds(rawOrderedIds);
    if (!orderedIds) return null;
    if (orderedIds.some(issueId => seenIssueIds.has(issueId))) return null;

    seenStatuses.add(status);
    orderedIds.forEach(issueId => seenIssueIds.add(issueId));
    columnOrders.push({ status, orderedIds });
  }

  return columnOrders;
}

/** Tells the board whether it is shared with other people, and the current board version. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (user.role !== "DEVELOPER") return developerRoleRequired();

  const [collaborative, version] = await Promise.all([
    isBoardCollaborative(user.id),
    getBoardVersion(user.id),
  ]);

  return NextResponse.json(
    { collaborative, version },
    { headers: NO_STORE_HEADERS },
  );
}

/**
 * Saves the order of one or more board columns in a single transaction.
 * Issues listed in a column they are not in yet move to that column.
 */
export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (user.role !== "DEVELOPER") return developerRoleRequired();

  const body = await parseBody(request);
  if (!body) return badRequest("Invalid JSON body.");

  const columnOrders = parseColumnOrders(body.columns);
  if (!columnOrders) {
    return badRequest("columns must list each changed board column once, with the ordered ids of its issues.");
  }

  const accessFilter = getIssueAccessFilter(user.id);
  const listedIssueIds = columnOrders.flatMap(column => column.orderedIds);

  await prisma.$transaction(async transaction => {
    // Issues deleted or no longer visible since the move are skipped.
    const listedIssues = await transaction.issue.findMany({
      where: { id: { in: listedIssueIds }, ...accessFilter },
      include: { project: { select: { userId: true } } },
    });
    const listedIssuesById = new Map(listedIssues.map(issue => [issue.id, issue]));

    for (const column of columnOrders) {
      const unlistedColumnIssues = await transaction.issue.findMany({
        where: {
          status: column.status,
          id: { notIn: listedIssueIds },
          ...accessFilter,
        },
        orderBy: [
          { boardPosition: "asc" },
          { lastActivityAt: "desc" },
        ],
        select: { id: true, boardPosition: true },
      });

      const requestedIds = column.orderedIds.filter(issueId => listedIssuesById.has(issueId));
      const columnOrder = buildColumnOrder(
        requestedIds,
        unlistedColumnIssues.map(columnIssue => columnIssue.id),
      );
      const unlistedPositions = new Map(
        unlistedColumnIssues.map(columnIssue => [columnIssue.id, columnIssue.boardPosition]),
      );

      for (const [position, issueId] of columnOrder.entries()) {
        const listedIssue = listedIssuesById.get(issueId);

        if (!listedIssue) {
          if (unlistedPositions.get(issueId) === position) continue;

          await transaction.issue.update({
            where: { id: issueId },
            data: { boardPosition: position },
          });
          continue;
        }

        const statusChanged = listedIssue.status !== column.status;
        if (!statusChanged && listedIssue.boardPosition === position) continue;

        await transaction.issue.update({
          where: { id: issueId },
          data: {
            boardPosition: position,
            ...(statusChanged
              ? {
                  status: column.status,
                  resolvedAt: column.status === "RESOLVED" ? new Date() : null,
                  closedAt: column.status === "CLOSED" ? new Date() : null,
                  lastActivityAt: new Date(),
                }
              : {}),
          },
        });

        if (!statusChanged) continue;

        const notifications = getIssueRecipientIds(listedIssue, user.id).map(recipientId => ({
          userId: recipientId,
          issueId,
          type: "ISSUE_STATUS_CHANGED" as const,
        }));

        if (notifications.length) {
          await transaction.notification.createMany({ data: notifications });
        }
      }
    }
  });

  return NextResponse.json(
    { version: await getBoardVersion(user.id) },
    { headers: NO_STORE_HEADERS },
  );
}
