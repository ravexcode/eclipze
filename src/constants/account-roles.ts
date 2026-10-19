import type { UserRole } from "@/types/user";

// Roles change which workspace tools an account sees. They never grant internal or
// cross-account access.
export const ACCOUNT_ROLE_OPTIONS: Array<{
  role: UserRole;
  label: string;
  description: string;
}> = [
  {
    role: "USER",
    label: "Client",
    description: "Report issues and follow their progress in the projects you work on.",
  },
  {
    role: "DEVELOPER",
    label: "Developer",
    description: "Triage issue status and priority in your projects, and use the ERD editor on paid plans.",
  },
];
