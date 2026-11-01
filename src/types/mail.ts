export type MailFolder = "inbox" | "sent";

export type MailUser = {
  id: string;
  username: string | null;
  // Masked address such as "ra•••@example.com"; the full email is never sent to the client.
  emailHint: string;
};

export type MailItem = {
  id: string;
  senderId: string;
  recipientId: string;
  subject: string;
  body: string;
  readAt: string | null;
  sentAt: string;
  sender: MailUser;
  recipient: MailUser;
};

export type MailFormValues = {
  to: string;
  // Set when replying, so a reply reaches the sender without knowing their email.
  recipientId?: string;
  subject: string;
  body: string;
};
