-- AlterEnum
ALTER TYPE "AiProvider" ADD VALUE 'OLLAMA';

-- AlterTable
ALTER TABLE "ai_provider_connections" ADD COLUMN "baseUrl" TEXT;
