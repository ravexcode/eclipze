import "server-only";

import type { AuthCodePurpose } from "@/lib/auth";

const emailTheme = {
  background: "#08090d",
  surface: "#101116",
  surfaceRaised: "#191a22",
  textPrimary: "#fafafa",
  textSecondary: "#b4b5c0",
  accent: "#7280ff",
  accentMuted: "#42465f",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const noReplyFrom = process.env.AUTH_EMAIL_NO_REPLY_FROM ?? process.env.AUTH_EMAIL_FROM;

  if (!apiKey || !noReplyFrom) {
    throw new Error("Email delivery is not configured. Add RESEND_API_KEY and AUTH_EMAIL_NO_REPLY_FROM to your environment.");
  }

  return {
    apiKey,
    from: noReplyFrom,
    replyTo: process.env.AUTH_EMAIL_REPLY_TO,
  };
}

function getEmailCopy(purpose: AuthCodePurpose) {
  if (purpose === "EMAIL_VERIFICATION") {
    return {
      subject: "Verify your Eclipze account",
      title: "Verify your email",
      body: "Use the verification code below to finish creating your Eclipze account and activate access to your workspace.",
    };
  }

  return {
    subject: "Reset your Eclipze password",
    title: "Reset your password",
    body: "Use the verification code below to choose a new password for your Eclipze account.",
  };
}

function renderSecurityEmailTemplate(input: {
  title: string;
  body: string;
  details?: Array<{ label: string; value: string }>;
  code?: string;
}) {
  const details = input.details?.map(({ label, value }) => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid ${emailTheme.surfaceRaised}; color: ${emailTheme.textSecondary}; font-size: 13px;">${escapeHtml(label)}</td>
      <td align="right" style="padding: 12px 0; border-bottom: 1px solid ${emailTheme.surfaceRaised}; color: ${emailTheme.textPrimary}; font-size: 13px; font-weight: 600;">${escapeHtml(value)}</td>
    </tr>
  `).join("") ?? "";

  const codeSection = input.code ? `
    <tr>
      <td style="padding: 4px 28px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: ${emailTheme.surfaceRaised}; border: 1px solid ${emailTheme.accentMuted}; border-radius: 12px;">
          <tr>
            <td style="padding: 22px 16px; text-align: center;">
              <div style="font-size: 12px; line-height: 1.5; color: ${emailTheme.textSecondary}; margin-bottom: 12px;">YOUR ONE-TIME CODE</div>
              <div style="font-family: 'SFMono-Regular', Consolas, monospace; font-size: 36px; line-height: 1.2; font-weight: 700; letter-spacing: 8px; color: ${emailTheme.textPrimary};">${escapeHtml(input.code)}</div>
              <div style="font-size: 12px; line-height: 1.5; color: ${emailTheme.textSecondary}; margin-top: 12px;">This code expires in 10 minutes.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : "";

  const detailsSection = input.details ? `
    <tr>
      <td style="padding: 0 28px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${details}</table>
      </td>
    </tr>
  ` : "";

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${input.title}</title>
      </head>
      <body style="margin: 0; padding: 0; background: ${emailTheme.background}; color: ${emailTheme.textPrimary}; font-family: Arial, Helvetica, sans-serif;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: ${emailTheme.background}; margin: 0; padding: 40px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 520px;">
                <tr>
                  <td style="padding-bottom: 20px; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; letter-spacing: 2px; color: ${emailTheme.textPrimary};">ECLIPZE<span style="color: ${emailTheme.accent};">.</span></td>
                </tr>
                <tr>
                  <td style="background: ${emailTheme.surface}; border: 1px solid ${emailTheme.surfaceRaised}; border-radius: 14px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 32px 28px 12px; font-size: 11px; line-height: 1.5; letter-spacing: 1.3px; color: ${emailTheme.accent};">ACCOUNT SECURITY</td>
                      </tr>
                      <tr>
                        <td style="padding: 0 28px 12px;">
                          <h1 style="margin: 0; font-size: 28px; line-height: 1.2; font-weight: 700; color: ${emailTheme.textPrimary};">${escapeHtml(input.title)}</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 28px 24px; font-size: 15px; line-height: 1.7; color: ${emailTheme.textSecondary};">${escapeHtml(input.body)}</td>
                      </tr>
                      ${codeSection}
                      ${detailsSection}
                      <tr>
                        <td style="padding: 18px 28px; border-top: 1px solid ${emailTheme.surfaceRaised}; font-size: 12px; line-height: 1.6; color: ${emailTheme.textSecondary};">
                          ${input.code ? "If you did not request this, you can safely ignore this email. Never share your code with anyone." : "If this was not you, reset your password immediately and contact support."}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 12px 0; text-align: center; font-size: 12px; line-height: 1.7; color: ${emailTheme.textSecondary};">
                    Eclipze security notification<br />This is an automated message; replies are not monitored.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function renderPlainTextEmail(input: {
  title: string;
  body: string;
  code: string;
}) {
  return [
    `ECLIPZE — ${input.title}`,
    "",
    input.body,
    "",
    `Verification code: ${input.code}`,
    "This code expires in 10 minutes.",
    "",
    "This mailbox does not receive replies.",
    "If you did not request this, you can safely ignore this email.",
  ].join("\n");
}

export async function sendAuthCodeEmail(input: {
  to: string;
  code: string;
  purpose: AuthCodePurpose;
}) {
  const config = getResendConfig();
  const copy = getEmailCopy(input.purpose);

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
      subject: copy.subject,
      html: renderSecurityEmailTemplate({
        title: copy.title,
        body: copy.body,
        code: input.code,
      }),
      text: renderPlainTextEmail({
        title: copy.title,
        body: copy.body,
        code: input.code,
      }),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(`Resend request failed with ${response.status}: ${errorText}`);
  }
}

export async function sendNewSignInEmail(input: {
  to: string;
  ip: string;
  device: string;
  occurredAt: string;
}) {
  const config = getResendConfig();
  const body = `A new sign-in to your Eclipze profile was detected.\n\nIP address: ${input.ip}\nDevice: ${input.device}\nDate and time (UTC): ${input.occurredAt}\n\nIf this was not you, reset your password immediately and contact support.`;
  const ip = escapeHtml(input.ip);
  const device = escapeHtml(input.device);
  const occurredAt = escapeHtml(input.occurredAt);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: config.from,
      to: [input.to],
      reply_to: config.replyTo,
      subject: "New access to your profile",
      text: `ECLIPZE — New access to your profile\n\n${body}`,
      html: renderSecurityEmailTemplate({
        title: "New access to your profile",
        body: "A new sign-in to your Eclipze profile was detected. Review the details below.",
        details: [
          { label: "IP address", value: input.ip },
          { label: "Device", value: input.device },
          { label: "Date and time (UTC)", value: input.occurredAt },
        ],
      }),
    }),
  });
  if (!response.ok) throw new Error(`Resend request failed with ${response.status}`);
}
