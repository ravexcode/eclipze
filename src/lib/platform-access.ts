import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";

export async function denyPlatformAdministration() {
  const user = await getCurrentUser();
  return NextResponse.json(
    { message: user ? "Platform administration is unavailable to application roles." : "Unauthorized" },
    { status: user ? 403 : 401 },
  );
}

/** Response for workspace tools that only the Developer role can use. */
export function developerRoleRequired() {
  return NextResponse.json(
    { message: "This feature requires the Developer role." },
    { status: 403 },
  );
}
