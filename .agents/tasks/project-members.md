# Task: Projects with more than one member

Status: pending
Created: 2026-11-21

## Goal

Let a project owner add other users as members of a project. Only some plans can do this.
Once a project has more than one member, the board becomes collaborative: each move is saved at once and other members see changes live.

## Current state

- `Project` has a single owner (`Project.userId`). There is no member model.
- `getIssueAccessFilter` (`src/lib/issue-access.ts`) only lets in the issue author and the project owner.
- `ownedProject` (`src/lib/workspace-api.ts`) only lets the owner create issues in a project.
- The board already supports collaboration:
  - `countProjectMembers` in `src/lib/issue-board.ts` returns `1` for every project. It is the only place to change.
  - `isBoardCollaborative` → `GET /api/issues/board` → `useBoard` turns on live sync (`BOARD_LIVE_SYNC_INTERVAL`) and immediate saves.
  - Personal boards wait `BOARD_SAVE_DEBOUNCE_DELAY` (500 ms) after the last move and save every move together.

## To do

1. **Database (needs approval before running):** add a `ProjectMember` model with a migration:
   - `projectId`, `userId`, `role` (`OWNER` | `MEMBER`), `createdAt`
   - `@@unique([projectId, userId])`, `@@index([userId])`
   - Backfill one `OWNER` row per existing project.
2. **Plan gating:** decide which `UserPlan` values (`FREE`, `PLUS`, `MAX`, `TEAM`, `INSIDER`, `DEVELOPER`) can add members, and the member limit per plan. Put the rule in `src/constants/` and enforce it on the server.
3. **API:** routes to list, invite or add, and remove project members. Only the owner can manage members.
4. **Access:** extend `getIssueAccessFilter` and `ownedProject` (or a new `projectMember` helper) so members can see and create issues. Extend `getIssueRecipientIds` so members get notifications.
5. **Board:** make `countProjectMembers` count `ProjectMember` rows grouped by `projectId`.
6. **UI:** a members section on the project page (list, add, remove), with the plan limit and an upgrade hint.
7. **Tests:** access for members and non-members, plan limits, and that a board turns collaborative only when a project has 2 or more members.

## Open questions

- Which plans can add members, and how many?
- Should new members be invited by email (a pending state) or added directly by username?
- Can members create issues, move cards, or only view?
