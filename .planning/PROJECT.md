# DAMP Agro — Farm Management Platform

## What This Is

DAMP Agro is a precision livestock management and GIS telemetry platform that enables farm owners and operators to track animal health, monitor live GPS collar positions, manage pasture zones, and receive automated escape and health alerts. The platform consists of a NestJS REST API, a Next.js App Router frontend dashboard, a PostgreSQL/PostGIS spatial database, and a Python FastAPI ML microservice.

## Core Value

Real-time precision livestock monitoring and GIS geofence management with secure multi-tenant farm access control.

## Business Context

- **Customer**: Farm owners, cattle ranchers, livestock operators, and agricultural veterinarians.
- **Revenue model**: Tiered SaaS subscription plan based on number of active farms and IoT collars.
- **Success metric**: Multi-tenant access security with zero unauthorized cross-farm data exposure.

## Requirements

### Validated

- ✓ Multi-service monorepo architecture (NestJS backend, Next.js frontend, FastAPI ML service) — existing
- ✓ PostGIS spatial database schema for farms, sectors, zones, geofences, collars, animals, telemetry, and alerts — existing
- ✓ Clerk authentication integration for frontend routes and NestJS Bearer JWT validation — existing
- ✓ Interactive Leaflet GIS maps for real-time livestock tracking and pasture boundary creation — existing
- ✓ Rule-based ML health anomaly prediction API (fever, hypothermia, inactivity) — existing
- ✓ IoT telemetry simulation scripts for position streaming and escape event testing — existing
- ✓ **Dual-Level Role Architecture**: Global Roles (`SUPER_ADMIN`, `USER`) and Farm-level Roles (`ADMIN`, `OPERATOR`, `VIEWER`) — v1.0
- ✓ **Database Schema Role Link**: Prisma schema with `Role` relation on `FarmUser` — v1.0
- ✓ **Super Admin Platform Management**: Super Admin endpoints and proxy routes to manage users and global roles — v1.0
- ✓ **Farm Sub-user Management**: Farm Admin API and Next.js modal UI to invite and assign farm roles — v1.0
- ✓ **NestJS Authorization Guards**: `GlobalRolesGuard` and `FarmRoleGuard` protecting endpoints — v1.0
- ✓ **Frontend UI Role Integration**: Next.js role hooks, middleware protection, and permission-conditioned UI controls — v1.0

### Active

- [ ] **Reusable Backend Pagination Utility**: Generic `PaginationQueryDto`, `PaginatedResult<T>` interface, and Prisma `paginate()` helper in NestJS supporting page/limit and pagination metadata (`totalItems`, `totalPages`, etc.).
- [ ] **Reusable Frontend Pagination Component & Hook**: React `usePagination` hook, URL search param synchronization helper, and custom `PaginationControls` component in Next.js.
- [ ] **Proof of Concept Integration**: Implement pagination on an existing list endpoint (e.g. Admin Users or Animals) and UI table to validate end-to-end functionality.

### Out of Scope

- [ ] **Native Auth Migration** — Replacing Clerk with custom NestJS JWT/bcrypt authentication is excluded; Clerk is retained for AuthN.
- [ ] **Dynamic Visual Permission Builder UI** — Granular per-permission UI editing for custom roles is deferred to a future milestone.

## Context

- **Authentication vs. Authorization Split**: Clerk manages user identity and JWT issuance (AuthN). Prisma local PostgreSQL database manages domain authorization (AuthZ) for global platform roles and farm-level access.
- **Single-Role Per Farm Membership**: A user has one active role per farm in `FarmUser` (managed as a relational list for future multi-role support). Join date equals role assignment date.
- **PostGIS Integration**: Spatial queries and geofences are constrained by farm ownership (`farmId`).

## Constraints

- **Package Manager**: **Strictly `pnpm`** across all backend and frontend packages and commands (do NOT use `npm`, `yarn`, or `bun`).
- **Security**: Strict multi-tenant isolation ensuring farm sub-users cannot inspect or modify data outside their authorized farm(s).
- **Authentication Provider**: Clerk JWT session tokens must be validated on every API request without hitting external Clerk APIs on every database lookup.
- **Database**: PostgreSQL with PostGIS extension (`postgis/postgis:15-3.3-alpine`) running locally.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hybrid AuthN / AuthZ | Use Clerk for authentication (login, JWT tokens) and local Prisma DB for authorization (roles, permissions per farm). | ✓ Good |
| Relational `Role` Model over Enum | Using a `Role` table for farm roles allows future extension to dynamic permissions (`RolePermission`) without schema migrations. | ✓ Good |
| Package Manager Standard | Enforce `pnpm` as the sole package manager for scripts, installs, and tooling. | ✓ Approved |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

---
*Last updated: 2026-08-17 after v1.0 milestone completion*
