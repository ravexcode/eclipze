import prisma from "@/lib/prisma";
import type { UserPlan } from "@/types/user";
import { getMonthStartUtc, getSubscriptionPlan } from "@/utils/plans";

// Each check returns an error message when the limit is reached, or null when the action is allowed.
type LimitedUser = {
  id: string;
  plan: UserPlan;
};

export async function checkProjectLimit(user: LimitedUser) {
  const plan = getSubscriptionPlan(user.plan);
  const limit = plan.limits.projects;

  if (limit === null) {
    return null;
  }

  const projectCount = await prisma.project.count({ where: { userId: user.id } });

  if (projectCount < limit) {
    return null;
  }

  const projectLabel = limit === 1 ? "1 project" : `${limit} projects`;

  return `Your ${plan.name} plan includes ${projectLabel}. Upgrade your plan to create more.`;
}

export async function checkMonthlyMailLimit(user: LimitedUser) {
  const plan = getSubscriptionPlan(user.plan);
  const limit = plan.limits.monthlyMails;

  if (limit === null) {
    return null;
  }

  const sentThisMonth = await prisma.mail.count({
    where: {
      senderId: user.id,
      sentAt: { gte: getMonthStartUtc() },
    },
  });

  if (sentThisMonth < limit) {
    return null;
  }

  return `Your ${plan.name} plan includes ${limit.toLocaleString("en-US")} messages per month. Upgrade your plan or wait until next month to send more.`;
}
