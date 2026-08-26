# Phase 1: Database Schema & Role Link Layer - Research

**Researched:** 2026-08-11
**Domain:** Prisma ORM, PostgreSQL database schema modeling, RBAC relations
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **AuthN / AuthZ Separation**: Clerk manages user authentication; local Prisma database handles role-based authorization.
- **Package Manager Standard**: Strictly use `pnpm` across all workspace operations and scripts.
- **Global Roles**: `GlobalRole` enum (`SUPER_ADMIN`, `USER`) added to `User` model.
- **Farm-Level Roles**: Dynamic `Role` relation on `FarmUser` join table (`roleId`). Single role per farm per user, stored as list relation. Joining date equals role assignment date.
- **Naming Conventions**: Table names use singular/plural `@@map("...")` consistent with the existing database schema.

### the agent's Discretion
- Migration script naming (`pnpm prisma migrate dev`).
- Default role seeding script structure for populating default `Role` rows (`ADMIN`, `OPERATOR`, `VIEWER`).

### Deferred Ideas (OUT OF SCOPE)
- Custom permission builder UI (ABAC/PBAC) — deferred to v2.
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Data Persistence & Roles | Database/Storage (PostgreSQL + Prisma) | API/Backend (NestJS) | Prisma models define structural constraints, foreign keys, and role relationships. |
| Role Membership Link | Database/Storage (Prisma `FarmUser`) | API/Backend (NestJS) | Membership relation connects `User`, `Farm`, and `Role`. |
| Package Management | Tooling / Workspace | CI/CD | `pnpm` handles workspace dependency execution and script invocation. |
</architectural_responsibility_map>

<research_summary>
## Summary

Phase 1 establishes the relational foundation for multi-tenant access control and platform-wide role management in DAMP Agro. 

The update modifies two main models in `backend/prisma/schema.prisma`:
1. **`User` Model**: Adds `globalRole GlobalRole @default(USER) @map("global_role")` with enum `enum GlobalRole { SUPER_ADMIN USER }`.
2. **`FarmUser` Model**: Connects `roleId` to `model Role` via foreign key `roleId String @map("role_id")`.

**Primary recommendation:** Apply Prisma migrations locally via `pnpm prisma migrate dev --name add_global_roles_and_farm_user_role` and verify schema generation via `pnpm prisma generate`.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@prisma/client` | `^6.3.1` | Type-safe DB ORM | Existing database access layer |
| `prisma` | `^6.3.1` | Database migration & schema generator | Native CLI tooling |

### Commands
```bash
cd backend
pnpm prisma migrate dev --name add_global_roles_and_farm_user_role
pnpm prisma generate
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Schema Definition (Prisma)

```prisma
enum GlobalRole {
  SUPER_ADMIN
  USER
}

model User {
  id         String     @id @default(uuid())
  clerkId    String     @unique @map("clerk_id")
  email      String     @unique
  globalRole GlobalRole @default(USER) @map("global_role")
  createdAt  DateTime   @default(now()) @map("created_at")
  updatedAt  DateTime   @updatedAt @map("updated_at")

  farmUsers FarmUser[]

  @@map("users")
}

model Role {
  id        String   @id @default(uuid())
  name      String   @unique
  createdAt DateTime @default(now()) @map("created_at")

  farmUsers FarmUser[]

  @@map("roles")
}

model FarmUser {
  id     String @id @default(uuid())
  farmId String @map("farm_id")
  userId String @map("user_id")
  roleId String @map("role_id")

  farm Farm @relation(fields: [farmId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id])

  @@unique([farmId, userId])
  @@map("farm_users")
}
```
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Package Management | Package manager switching (npm/yarn/bun) | `pnpm` exclusively | Workspace consistency and lockfile integrity |
| Foreign Key Integrity | Application-level validation only | Foreign key constraints in Prisma schema | Prevents orphaned `FarmUser` records |
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Wrong Package Manager Command
**What goes wrong:** Using `npx` or `npm run` instead of `pnpm`.
**How to avoid:** Always use `pnpm prisma ...` or `pnpm exec prisma ...`.
</common_pitfalls>

<Validation Architecture>
## Validation Architecture

Nyquist Validation framework for Phase 1:
1. **Schema Syntax Verification**: `pnpm prisma validate` returns 0 syntax errors.
2. **Migration Execution**: `pnpm prisma migrate dev` generates valid SQL and applies migration without dropping data.
3. **TypeScript Client Generation**: `pnpm prisma generate` creates updated `@prisma/client` types containing `GlobalRole` and `Role` relations.
</Validation Architecture>

<sources>
### Primary (HIGH confidence)
- Existing `backend/prisma/schema.prisma` codebase definition.
- Official Prisma documentation on Relations and Enums.
</sources>

---
*Phase: 01-database-schema-audit-layer*
*Research completed: 2026-08-11*
*Ready for planning: yes*
