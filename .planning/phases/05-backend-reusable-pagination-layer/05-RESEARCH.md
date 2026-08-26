# Phase 05 Research: Backend Reusable Pagination Layer

## Technical Approach & Architecture

To implement a clean, reusable pagination mechanism across all NestJS backend services and Prisma queries in DAMP Agro:

1. **`PaginationQueryDto`**: Standard class-validator DTO with defaults (`page = 1`, `limit = 10`, `sortBy`, `sortOrder`). Employs `@Type(() => Number)` from `class-transformer` so query params from HTTP GET requests (which arrive as strings) are correctly transformed to numbers before validation.
2. **`PaginatedResult<T>` Interface**: Generic interface defining the API contract:
   - `data: T[]`
   - `meta: { totalItems: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean; }`
3. **Prisma `paginate()` Helper**: Reusable utility function that accepts a Prisma model delegate (e.g. `prisma.user`), query DTO, and optional standard Prisma `findMany` options (where, select, include, orderBy). It runs `$transaction` or `Promise.all` executing `count()` and `findMany()` concurrently:
   - `skip = (page - 1) * limit`
   - `take = limit`
   - `totalPages = Math.ceil(totalItems / limit)`
   - `hasNextPage = page < totalPages`
   - `hasPrevPage = page > 1`

## Code Conventions & File Placement

- **Location**: `backend/src/common/pagination/`
  - `dto/pagination-query.dto.ts`
  - `interfaces/paginated-result.interface.ts`
  - `pagination.helper.ts` (or `paginate.ts`)
  - `pagination.module.ts` / exports index `index.ts`
- **Validation**: NestJS `ValidationPipe` with `{ transform: true }` (already global in NestJS setup).

## Validation Architecture

### Verification Strategy
- **Unit Tests**: `pagination.helper.spec.ts` testing `paginate()` function with a mocked Prisma delegate:
  - First page query returning exact items & correct meta.
  - Middle page query returning correct `hasNextPage` & `hasPrevPage`.
  - Empty dataset handling (`totalItems = 0`, `totalPages = 0`, `hasNextPage = false`, `hasPrevPage = false`).
  - Max limit boundary testing (e.g., clamping limit to max 100 to prevent DoS via `limit=100000`).
