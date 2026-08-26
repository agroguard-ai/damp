# Phase 3: Role Management API Endpoints - Research

**Researched:** 2026-08-11
**Domain:** NestJS Controller, Service, DTO Validation, Prisma Querying, RBAC Endpoints
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Super Admin Endpoint**: `GET /api/admin/users` to list users with global roles, and `PATCH /api/admin/users/:userId/role` to update `globalRole`.
- **Farm Admin Endpoints**:
  - `GET /api/farms/:farmId/users` to list farm sub-users and their assigned roles.
  - `POST /api/farms/:farmId/users` to add/assign a sub-user to a farm role.
  - `PATCH /api/farms/:farmId/users/:userId` to update a sub-user's farm role.
  - `DELETE /api/farms/:farmId/users/:userId` to remove a sub-user from a farm.
- **Role Model Seeding / Lookup**: Default farm roles (`ADMIN`, `OPERATOR`, `VIEWER`) are fetched dynamically from the `Role` table by `name`.
- **Tooling Standard**: `pnpm` exclusively for build and test commands (`pnpm run build`, `pnpm test`).

</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Component | Responsibility | Rationale |
|-----------|----------------|-----------|
| `AdminUsersController` | Exposes `/admin/users` routes for Super Admins | Annotated with `@GlobalRoles(GlobalRole.SUPER_ADMIN)`. |
| `AdminUsersService` | Handles Prisma queries for global user list and role updates | Encapsulates platform user logic. |
| `FarmUsersController` | Exposes `/farms/:farmId/users` routes for Farm Admins | Protected with `FarmRoleGuard` and `@RequireFarmRole(...)`. |
| `FarmUsersService` | Handles Prisma operations for farm membership & role assignments | Encapsulates tenant membership logic. |
| DTOs | Validates request payloads with `class-validator` | Ensures strict input type validation before reaching service layer. |
</architectural_responsibility_map>

<research_summary>
## Summary

Phase 3 implements REST API endpoints in NestJS to allow Super Admins and Farm Admins to inspect, assign, modify, and revoke user roles:
1. **Global Admin Module (`AdminUsersModule`)**: Controller & service for platform-wide user management (`/admin/users`).
2. **Farm Users Module (`FarmUsersModule`)**: Controller & service for tenant sub-user management (`/farms/:farmId/users`).
3. **DTOs**: `UpdateGlobalRoleDto`, `AssignFarmUserRoleDto`, `UpdateFarmUserRoleDto`.

All code will be verified using `pnpm run build`.
</research_summary>

<standard_stack>
## Standard Stack

| Library | Version | Purpose |
|---------|---------|---------|
| `@nestjs/common` | `^11.0.1` | NestJS controllers, services, decorators |
| `class-validator` | `^0.15.1` | Input validation decorators (`@IsEnum`, `@IsString`, `@IsUUID`) |
| `class-transformer` | `^0.5.1` | Payload transformation |
| `@prisma/client` | `^7.8.0` | Database queries for `User`, `FarmUser`, `Role` |

### Commands
```bash
cd backend
pnpm run build
pnpm test
```
</standard_stack>

<Validation Architecture>
## Validation Architecture

1. **Build Check**: `pnpm run build` compiles NestJS without TypeScript errors.
2. **Unit / Integration Tests**: NestJS testing module verifies controller and service methods.
</Validation Architecture>

---
*Phase: 03-role-management-api-endpoints*
*Research completed: 2026-08-11*
