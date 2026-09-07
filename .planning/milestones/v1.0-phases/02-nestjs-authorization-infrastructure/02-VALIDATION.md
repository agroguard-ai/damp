---
phase: 2
slug: nestjs-authorization-infrastructure
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-11
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest / NestJS Testing |
| **Config file** | `backend/package.json` |
| **Quick run command** | `cd backend && pnpm run build` |
| **Full suite command** | `cd backend && pnpm run build && pnpm test` |
| **Estimated runtime** | ~10 seconds |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | AUTHZ-03 | Custom decorators attach metadata | unit | `cd backend && pnpm run build` | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | AUTHZ-01 | GlobalRolesGuard evaluates globalRole claim | integration | `cd backend && pnpm run build` | ✅ | ⬜ pending |
| 02-01-03 | 01 | 1 | AUTHZ-02, AUTHZ-04 | FarmRoleGuard checks farm roles & allows SuperAdmin override | integration | `cd backend && pnpm run build` | ✅ | ⬜ pending |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify dependencies
- [x] Sampling latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-11
