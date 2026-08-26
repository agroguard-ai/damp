# Project Retrospective: DAMP Agro Platform

## Milestone: v1.0 — Dual-Level Role Architecture

**Shipped:** 2026-08-17
**Phases:** 4 | **Plans:** 4

### What Was Built
- **Database Schema & Role Link Layer**: Updated Prisma models with `GlobalRole` enum (`SUPER_ADMIN`, `USER`) and `Role` relation on `FarmUser`.
- **NestJS Authorization Infrastructure**: Created `@GlobalRoles()` and `@RequireFarmRole()` decorators alongside `GlobalRolesGuard`, `FarmRoleGuard`, and `SuperAdminGuard`.
- **Role Management API Endpoints**: Built REST endpoints for Super Admin user management (`/admin/users`) and Farm Admin sub-user assignment (`/farms/:farmId/users`).
- **Next.js Frontend Role & UI Integration**: Protected routes in middleware/layout and built Farm Sub-user management UI with role-conditioned action controls.

### What Worked
- **Relational Role Model**: Using relational `Role` models over hardcoded enums allowed seamless extension to farm-level sub-user roles.
- **Hybrid AuthN / AuthZ**: Keeping Clerk for identity while holding authorization roles in local Prisma PostgreSQL eliminated third-party API latency on every request.

### Key Lessons
- Clear separation between Global Roles and Farm Roles simplifies NestJS Guard logic and Next.js UI component conditioning.

---
