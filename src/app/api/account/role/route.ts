import { NextResponse } from "next/server";

import { ACCOUNT_ROLE_OPTIONS } from "@/constants/account-roles";
import { getCurrentUser, serializeUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { badRequest, parseBody } from "@/lib/workspace-api";
import type { UserRole } from "@/types/user";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
};

// Switches between the Client and Developer roles. Roles only change which workspace
// tools the account sees; neither grants access to other users' data or internal tools.
export async function PUT(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await parseBody(request);
  const role = ACCOUNT_ROLE_OPTIONS.find(option => option.role === body?.role)?.role;

  if (!role) {
    return badRequest("Choose the Client or Developer role.");
  }

  const updatedUser = user.role === role
    ? user
    : await prisma.user.update({
      where: { id: user.id },
      data: { role: role satisfies UserRole },
    });

  return NextResponse.json(
    { message: "Account role updated.", user: serializeUser(updatedUser) },
    { headers: PRIVATE_NO_STORE_HEADERS },
  );
}
