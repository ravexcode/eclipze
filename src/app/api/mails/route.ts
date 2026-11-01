import { NextResponse } from "next/server";

import { RATE_LIMIT_RULES } from "@/constants/rate-limit";
import { getCurrentUser, normalizeEmail } from "@/lib/auth";
import { checkMonthlyMailLimit } from "@/lib/plan-limits";
import { enforceRateLimits } from "@/lib/rate-limit";
import { badRequest, parseBody, requiredString } from "@/lib/workspace-api";
import prisma from "@/lib/prisma";
import { serializeMailUser } from "@/utils/mail";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };
const USER_SUMMARY = { id: true, username: true, email: true } as const;

type MailWithUsers = {
  id: string;
  senderId: string;
  recipientId: string;
  subject: string;
  body: string;
  readAt: Date | null;
  sentAt: Date;
  sender: { id: string; username: string | null; email: string };
  recipient: { id: string; username: string | null; email: string };
};

function serializeMail(mail: MailWithUsers) {
  return {
    id: mail.id,
    senderId: mail.senderId,
    recipientId: mail.recipientId,
    subject: mail.subject,
    body: mail.body,
    readAt: mail.readAt?.toISOString() ?? null,
    sentAt: mail.sentAt.toISOString(),
    sender: serializeMailUser(mail.sender),
    recipient: serializeMailUser(mail.recipient),
  };
}

/**
 * Replies address the sender by id, since clients only see a masked email.
 * New messages address the recipient by email or username.
 */
function getRecipientLookup(body: Record<string, unknown>) {
  if (typeof body.recipientId === "string" && body.recipientId.trim()) {
    const recipientId = body.recipientId.trim();

    if (recipientId.length > 64) {
      return { error: badRequest("Recipient is invalid.") };
    }

    return { where: { id: recipientId } };
  }

  const recipientAddress = requiredString(body.to, "to");
  if (recipientAddress.error) return { error: recipientAddress.error };

  if (recipientAddress.value.length > 255) {
    return { error: badRequest("Recipient must be 255 characters or fewer.") };
  }

  if (recipientAddress.value.includes("@")) {
    return { where: { email: normalizeEmail(recipientAddress.value) } };
  }

  return { where: { username: recipientAddress.value } };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }

  const folder = new URL(request.url).searchParams.get("folder") ?? "inbox";
  if (folder !== "inbox" && folder !== "sent") return badRequest("folder must be inbox or sent.");

  const mails = await prisma.mail.findMany({
    where: folder === "inbox" ? { recipientId: user.id } : { senderId: user.id },
    orderBy: { sentAt: "desc" },
    take: 50,
    include: {
      sender: { select: USER_SUMMARY },
      recipient: { select: USER_SUMMARY },
    },
  });

  return NextResponse.json({ mails: mails.map(serializeMail) }, { headers: PRIVATE_NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }

  const rateLimitResponse = await enforceRateLimits([
    { rule: RATE_LIMIT_RULES.mailSendByUser, subject: user.id },
  ]);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = await parseBody(request);
  if (!body) return badRequest("Invalid JSON body.");

  const subject = requiredString(body.subject, "subject");
  if (subject.error) return subject.error;
  const mailBody = requiredString(body.body, "body");
  if (mailBody.error) return mailBody.error;

  if (subject.value.length > 200) return badRequest("Subject must be 200 characters or fewer.");
  if (mailBody.value.length > 20000) return badRequest("Message must be 20,000 characters or fewer.");

  const recipientLookup = getRecipientLookup(body);
  if ("error" in recipientLookup) return recipientLookup.error;

  const recipient = await prisma.user.findFirst({
    where: {
      AND: [
        recipientLookup.where,
        { id: { not: user.id } },
      ],
      emailVerifiedAt: { not: null },
    },
    select: USER_SUMMARY,
  });

  if (!recipient) return badRequest("No verified user was found for that email or username.");

  const limitMessage = await checkMonthlyMailLimit(user);
  if (limitMessage) {
    return NextResponse.json({ message: limitMessage }, { status: 403, headers: PRIVATE_NO_STORE_HEADERS });
  }

  const mail = await prisma.mail.create({
    data: {
      senderId: user.id,
      recipientId: recipient.id,
      subject: subject.value,
      body: mailBody.value,
    },
    include: {
      sender: { select: USER_SUMMARY },
      recipient: { select: USER_SUMMARY },
    },
  });

  return NextResponse.json({ mail: serializeMail(mail) }, { status: 201, headers: PRIVATE_NO_STORE_HEADERS });
}
