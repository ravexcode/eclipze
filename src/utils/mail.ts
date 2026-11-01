import type { MailFormValues, MailUser } from "@/types/mail";

/**
 * Hides most of an email address, for example "rafael@example.com" becomes
 * "ra•••@example.com". The domain stays visible so people can still tell accounts apart.
 */
export function maskEmail(email: string) {
  const atIndex = email.lastIndexOf("@");

  if (atIndex <= 0) {
    return "•••";
  }

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  const visibleLength = localPart.length > 4 ? 2 : 1;

  return `${localPart.slice(0, visibleLength)}•••@${domain}`;
}

/** Mail participants never receive each other's full email address. */
export function serializeMailUser(user: {
  id: string;
  username: string | null;
  email: string;
}): MailUser {
  return {
    id: user.id,
    username: user.username,
    emailHint: maskEmail(user.email),
  };
}

export function getMailUserLabel(user: MailUser) {
  return user.username ?? user.emailHint;
}

/** Editing the recipient field drops a reply target, so the typed address is used instead. */
export function updateMailForm(current: MailFormValues, updates: Partial<MailFormValues>): MailFormValues {
  const next = { ...current, ...updates };

  if ("to" in updates && updates.to !== current.to) {
    delete next.recipientId;
  }

  return next;
}
