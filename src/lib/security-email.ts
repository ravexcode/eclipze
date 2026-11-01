import "server-only";

import {
  SECURITY_NOTICE_COPY,
  type SecurityNoticeKind,
} from "@/constants/auth-email";
import { describeDevice, getRequestIp } from "@/lib/auth";
import {
  sendEmailAfterResponse,
  sendTransactionalEmail,
} from "@/lib/email-delivery";
import { escapeHtml } from "@/utils/html";

export type SecurityNoticeRequest = {
  ip: string;
  device: string;
  occurredAt: string;
};

function renderPlainText(kind: SecurityNoticeKind, request: SecurityNoticeRequest) {
  const copy = SECURITY_NOTICE_COPY[kind];

  return [
    `ECLIPZE — ${copy.title}`,
    "",
    copy.body,
    "",
    `IP address: ${request.ip}`,
    `Device: ${request.device}`,
    `Date and time (UTC): ${request.occurredAt}`,
    "",
    copy.advice,
    "",
    "This mailbox does not receive replies.",
  ].join("\n");
}

function renderHtml(kind: SecurityNoticeKind, request: SecurityNoticeRequest) {
  const copy = SECURITY_NOTICE_COPY[kind];

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h1>${escapeHtml(copy.title)}</h1>
      <p>${escapeHtml(copy.body)}</p>
      <ul>
        <li><strong>IP address:</strong> ${escapeHtml(request.ip)}</li>
        <li><strong>Device:</strong> ${escapeHtml(request.device)}</li>
        <li><strong>Date and time (UTC):</strong> ${escapeHtml(request.occurredAt)}</li>
      </ul>
      <p>${escapeHtml(copy.advice)}</p>
      <p style="font-size: 12px; color: #676767;">This mailbox does not receive replies.</p>
    </div>
  `;
}

export async function sendSecurityNoticeEmail(input: {
  to: string;
  kind: SecurityNoticeKind;
  request: SecurityNoticeRequest;
}) {
  await sendTransactionalEmail({
    to: input.to,
    subject: SECURITY_NOTICE_COPY[input.kind].subject,
    html: renderHtml(input.kind, input.request),
    text: renderPlainText(input.kind, input.request),
  });
}

/**
 * Emails the account owner about a security-relevant change after the response is sent.
 * Request details are captured now, so the email shows when and where the change happened.
 */
export function notifySecurityEvent(request: Request, input: {
  to: string;
  kind: SecurityNoticeKind;
}) {
  const requestDetails: SecurityNoticeRequest = {
    ip: getRequestIp(request),
    device: describeDevice(request.headers.get("user-agent")),
    occurredAt: new Date().toISOString(),
  };

  sendEmailAfterResponse(`${input.kind} notice`, () => sendSecurityNoticeEmail({
    to: input.to,
    kind: input.kind,
    request: requestDetails,
  }));
}
