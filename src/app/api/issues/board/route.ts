import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getIssueAccessFilter, getIssueRecipientIds } from "@/lib/issue-access";
import { buildColumnOrder } from "@/lib/issue-board";
import { developerRoleRequired } from "@/lib/platform-access";
import prisma from "@/lib/prisma";
import { serializeIssue } from "@/lib/workspace";
import { badRequest, enumString, notFound, parseBody, requiredString } from "@/lib/workspace-api";

const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED"] as const;
const MAX_COLUMN_ISSUES = 1000;

function parseOrderedIds(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_COLUMN_ISSUES) return null;
  if (!value.every((issueId): issueId is string => typeof issueId === "string")) return null;

  return [...new Set(value)];
}

/** Moves an issue to a board column and saves the manual order of that column. */
export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (user.role !== "DEVELOPER") return developerRoleRequired();

  const body = await parseBody(request);
  if (!body) return badRequest("Invalid JSON body.");

  const issueId = requiredString(body.issueId, "issueId");
  if (issueId.error) return issueId.error;

  const status = enumString(body.status, STATUSES, "status");
  if (status.error) return status.error;

  const requestedIds = parseOrderedIds(body.orderedIds);
  if (!requestedIds || !requestedIds.includes(issueId.value)) {
    return badRequest("orderedIds must list the issues of the column, including the moved issue.");
  }

  const accessFilter = getIssueAccessFilter(user.id);

  const movedIssue = await prisma.$transaction(async transaction => {
    const issue = await transaction.issue.findFirst({
      where: { id: issueId.value, ...accessFilter },
      include: { project: { select: { userId: true } } },
    });
    if (!issue) return null;

    const columnIssues = await transaction.issue.findMany({
      where: {
        status: status.value,
        id: { not: issue.id },
        ...accessFilter,
      },
      orderBy: [
        { boardPosition: "asc" },
        { lastActivityAt: "desc" },
      ],
      select: { id: true, boardPosition: true },
    });

    const columnOrder = buildColumnOrder(
      requestedIds,
      columnIssues.map(columnIssue => columnIssue.id),
      issue.id,
    );
    const currentPositions = new Map(
      columnIssues.map(columnIssue => [columnIssue.id, columnIssue.boardPosition]),
    );

    for (const [position, columnIssueId] of columnOrder.entries()) {
      const isMovedIssue = columnIssueId === issue.id;
      if (isMovedIssue || currentPositions.get(columnIssueId) === position) continue;

      await transaction.issue.update({
        where: { id: columnIssueId },
        data: { boardPosition: position },
      });
    }

    const statusChanged = issue.status !== status.value;
    const updatedIssue = await transaction.issue.update({
      where: { id: issue.id },
      data: {
        boardPosition: columnOrder.indexOf(issue.id),
        ...(statusChanged
          ? {
              status: status.value,
              resolvedAt: status.value === "RESOLVED" ? new Date() : null,
              closedAt: status.value === "CLOSED" ? new Date() : null,
              lastActivityAt: new Date(),
            }
          : {}),
      },
    });

    if (statusChanged) {
      const notifications = getIssueRecipientIds(issue, user.id).map(recipientId => ({
        userId: recipientId,
        issueId: issue.id,
        type: "ISSUE_STATUS_CHANGED" as const,
      }));

      if (notifications.length) {
        await transaction.notification.createMany({ data: notifications });
      }
    }

    return updatedIssue;
  });

  if (!movedIssue) return notFound("Issue not found.");

  return NextResponse.json(
    { issue: serializeIssue(movedIssue) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
