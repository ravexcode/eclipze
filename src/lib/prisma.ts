import "server-only";

import { PrismaClient } from "@prisma/client";

import { isDatabaseUrlTlsEnforced } from "@/utils/database-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

const databaseUrl = process.env.DATABASE_URL;

if (process.env.NODE_ENV === "production" && databaseUrl && !isDatabaseUrlTlsEnforced(databaseUrl)) {
  console.warn("[prisma] DATABASE_URL does not set sslmode=require; database traffic may be unencrypted.");
}

export default prisma;
