import "server-only";

import { after } from "next/server";

/**
 * Sends an email after the response is finished. Unlike a floating promise, `after`
 * keeps serverless functions alive until the send completes. Failures are logged without
 * the provider response, which can echo the recipient address.
 */
export function sendEmailAfterResponse(label: string, send: () => Promise<void>) {
  after(async () => {
    try {
      await send();
    } catch (error) {
      console.error(`[email] ${label} could not be sent.`, error instanceof Error ? error.name : "");
    }
  });
}

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_NO_REPLY_FROM ?? process.env.AUTH_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("Email delivery is not configured. Add RESEND_API_KEY and AUTH_EMAIL_NO_REPLY_FROM to your environment.");
  }

  return {
    apiKey,
    from,
    replyTo: process.env.AUTH_EMAIL_REPLY_TO,
  };
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const config = getResendConfig();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.to],
      reply_to: config.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend request failed with ${response.status}`);
  }
}
