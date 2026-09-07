# Phase 06 Research: Frontend Reusable Pagination Component & Hook

## Technical Approach & Architecture

To build a clean, responsive, and URL-synchronized pagination UI in Next.js App Router for DAMP Agro:

1. **`usePagination` Hook** (`frontend/src/hooks/usePagination.ts`):
   - Accepts initial pagination state or options (`totalItems`, `initialPage`, `initialLimit`, `syncUrl`).
   - Uses `useSearchParams`, `usePathname`, and `useRouter` from `next/navigation` to read and update `page` and `limit` URL parameters.
   - Leverages `router.push(pathname + '?' + params.toString(), { scroll: false })` to achieve smooth URL synchronization without page scroll reset.
   - Provides calculated properties: `page`, `limit`, `totalPages`, `hasNextPage`, `hasPrevPage`, `startIndex`, `endIndex`, and helper functions `goToPage`, `nextPage`, `prevPage`, `setLimit`.

2. **`PaginationControls` Component** (`frontend/src/components/pagination/PaginationControls.tsx`):
   - Modern, sleek UI component adhering to project styling guidelines (rich glassmorphism / dark mode accents with Lucide React icons like `ChevronLeft`, `ChevronRight`).
   - Displays range statistics: `"Mostrando X a Y de Z resultados"`.
   - Renders page numbers with smart truncation (`1 ... 4 5 6 ... 10`) when total pages are large.
   - Includes page size selector dropdown / select input (`10`, `25`, `50`, `100` items per page).

3. **Placement**:
   - Hook: `frontend/src/hooks/usePagination.ts`
   - Component: `frontend/src/components/pagination/PaginationControls.tsx`
   - Re-export index: `frontend/src/components/pagination/index.ts`

## Validation Architecture

### Verification Strategy
- **Manual UI / DX Verification**: Verify `usePagination` hook and `PaginationControls` render properly in Next.js client components.
- **Build Verification**: Run `pnpm --filter frontend build` to ensure TypeScript types and Next.js SSR/client boundary compatibility.
