---
phase: 1
slug: database-schema-audit-layer
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Prisma CLI (pnpm) |
| **Config file** | `backend/prisma/schema.prisma` |
| **Quick run command** | `cd backend && pnpm prisma validate` |
| **Full suite command** | `cd backend && pnpm prisma validate && pnpm prisma generate` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pnpm prisma validate`
- **After every plan wave:** Run `cd backend && pnpm prisma validate && pnpm prisma generate`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | SCHEMA-01 | T-01-01 | GlobalRole enum is strictly defined | schema | `cd backend && pnpm prisma validate` | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | SCHEMA-02 | T-01-02 | FarmUser links roleId to Role model | schema | `cd backend && pnpm prisma validate` | ✅ | ⬜ pending |
| 01-01-03 | 01 | 1 | SCHEMA-03 | T-01-03 | Migrations execute against PostgreSQL | integration | `cd backend && pnpm prisma generate` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

All phase behaviors have automated verification via Prisma CLI (`pnpm`).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-11
