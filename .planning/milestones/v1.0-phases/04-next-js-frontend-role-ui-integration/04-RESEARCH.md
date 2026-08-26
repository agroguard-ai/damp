# Phase 4: Next.js Frontend Role & UI Integration - Research

**Researched:** 2026-08-11
**Domain:** Next.js App Router, Clerk Middleware, Component Role Guards, API Proxying
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Middleware Protection**: Clerk `clerkMiddleware` handles authentication on protected routes.
- **Admin Dashboard Route**: `/admin/users` page protected for Super Admins.
- **Farm Sub-users Route**: `/farms/[farmId]/users` page or tab allowing Farm Admins to manage sub-users (`ADMIN`, `OPERATOR`, `VIEWER`).
- **Role-Aware UI**: Disable/hide sensitive mutation buttons for `VIEWER` roles.
- **Tooling Standard**: `pnpm` exclusively for build and test commands (`pnpm run build`).

</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Component | Responsibility | Rationale |
|-----------|----------------|-----------|
| `proxyRequest` | Forwards frontend `/api/*` calls to NestJS backend with Clerk Bearer token | Centralized API client integration. |
| `/api/admin/users` Proxy | Next.js API route forwarding Super Admin user management calls | Clean API contract mapping. |
| `/api/farms/[farmId]/users` Proxy | Next.js API route forwarding farm sub-user management calls | Clean API contract mapping. |
| Super Admin UI (`/admin/users`) | Renders global user table and role toggles | Super Admin platform control interface. |
| Farm Sub-user UI (`/farms/[farmId]/users`) | Renders farm member table, invite modal, and role selector | Tenant sub-user delegation interface. |
| `RoleGuard` / Role Hooks | Provides role context to UI components for conditional rendering | Enforces role-aware UI display. |
</architectural_responsibility_map>

<research_summary>
## Summary

Phase 4 completes the dual-level RBAC integration by building Next.js frontend routes, API proxies, and UI components:
1. **API Proxy Routes**:
   - `src/app/api/admin/users/route.ts` & `src/app/api/admin/users/[userId]/role/route.ts`
   - `src/app/api/farms/[farmId]/users/route.ts` & `src/app/api/farms/[farmId]/users/[userId]/route.ts`
2. **UI Pages & Components**:
   - `/admin/users`: Super Admin management interface.
   - `/farms/[farmId]/users`: Farm Sub-user management interface.
   - Role-aware button guards for `VIEWER` permissions.

All frontend code will be validated using **`pnpm run build`** inside `frontend`.
</research_summary>

<standard_stack>
## Standard Stack

| Library | Version | Purpose |
|---------|---------|---------|
| `next` | `15.x` | App Router pages, API routes, middleware |
| `@clerk/nextjs` | `^6.x` | Client & server authentication |
| `lucide-react` | `^0.x` | Modern UI icons |

### Commands
```bash
cd frontend
pnpm run build
```
</standard_stack>

<Validation Architecture>
## Validation Architecture

1. **Build Check**: `pnpm run build` cleanly compiles Next.js pages and TypeScript without errors.
</Validation Architecture>

---
*Phase: 04-next-js-frontend-role-ui-integration*
*Research completed: 2026-08-11*
