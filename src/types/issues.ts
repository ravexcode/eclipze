import type { IssuePriority, IssueStatus, IssueType } from "@/types/user";

export type IssueItem = {
  id: string;
  title: string;
  description: string | null;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  boardPosition: number;
  lastActivityAt: string;
  createdAt: string;
  requester?: {
    id: string;
    username: string | null;
    email: string;
  };
};

export type IssueFormValues = {
  title: string;
  description: string;
  type: IssueType;
  priority: IssuePriority;
};
