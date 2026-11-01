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
