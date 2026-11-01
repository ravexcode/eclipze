-- Rolling AI credit usage windows filter by user, entry type, and date.
CREATE INDEX "ai_credit_ledger_entries_userId_type_createdAt_idx" ON "ai_credit_ledger_entries"("userId", "type", "createdAt");

-- Deleting an MCP connection sets these foreign keys to NULL; without an index
-- PostgreSQL scans the whole table to find the referencing rows.
CREATE INDEX "agents_mcpConnectionId_idx" ON "agents"("mcpConnectionId");
CREATE INDEX "agent_runs_mcpConnectionId_idx" ON "agent_runs"("mcpConnectionId");

-- These single-column indexes duplicate the leading column of an existing unique index.
DROP INDEX IF EXISTS "ai_provider_connections_userId_idx";
DROP INDEX IF EXISTS "legal_acceptances_userId_idx";
DROP INDEX IF EXISTS "database_connections_userId_idx";
