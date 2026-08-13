# Implementation Plan: Drill Marketplace

## Overview

This plan implements the Drill Marketplace feature across both the API and frontend. The work is organized in layers: database migration first, then backend API endpoints, then frontend UI changes. Each task builds incrementally on prior steps and references specific requirements for traceability.

## Tasks

- [x] 1. Database migration and type definitions
  - [x] 1.1 Create migration `024_drill_marketplace.sql`
    - Add `sport` column to `drills` table with CHECK constraint (`badminton`, `tennis`, `table_tennis`, `squash`) and default `'badminton'`
    - Add `center_id` column to `drills` table if not already present (VARCHAR(50), FK to centers, nullable)
    - Add `source_drill_id` column to `drills` table (VARCHAR(50), FK to drills, nullable)
    - Add `sport` column to `centers` table (VARCHAR(30), nullable, CHECK constraint)
    - Create indexes: `idx_drills_sport`, `idx_drills_center_id`, `idx_drills_source_drill_id`
    - Existing drill records keep all fields unchanged; sport defaults to `'badminton'`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 2.1, 2.2, 2.4_

  - [x] 1.2 Update TypeScript types and constants
    - Add `Sport` type and `SUPPORTED_SPORTS` constant to `src/types/index.ts`
    - Extend the `Drill` interface with `sport`, `centerId`, `sourceDrillId` fields
    - Add `sport` to the `Center` interface (nullable)
    - Add request/response types: `CreateGlobalDrillRequest`, `MarketplaceQuery`, `AdoptDrillRequest`, `AdoptDrillResponse`
    - _Requirements: 2.1, 2.2_

  - [x] 1.3 Extend Zod validation schemas in `src/validators/drill.schemas.ts`
    - Add `sportSchema` with `.enum(['badminton', 'tennis', 'table_tennis', 'squash'])`
    - Add `sport` field to `createDrillSchema` (required)
    - Add `sport` field to `updateDrillSchema` (optional)
    - Create `createGlobalDrillSchema` for admin drill creation (name, description, category, sport all required)
    - Create `adoptDrillSchema` with required `drillId` string
    - Create `marketplaceQuerySchema` with optional category and search params
    - _Requirements: 2.2, 2.3, 3.3_

- [x] 2. Admin Global Drill CRUD (Backend)
  - [x] 2.1 Create `src/controllers/admin/drills.ts` with admin drill handlers
    - Implement `listGlobalDrills` handler: query drills WHERE `center_id IS NULL AND is_archived = false`, support sport/category/search filters
    - Implement `createGlobalDrill` handler: insert drill with `center_id = NULL` and provided name, description, category, sport
    - Implement `updateGlobalDrill` handler: update by ID only if `center_id IS NULL`
    - Implement `archiveGlobalDrill` handler: set `is_archived = true` only if `center_id IS NULL`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 2.2 Register admin drill routes in `src/routes/admin.ts`
    - Add routes: GET `/drills`, POST `/drills`, PATCH `/drills/:id`, DELETE `/drills/:id`
    - Apply validation middleware using the new schemas
    - All routes require ADMIN role (already scoped by router middleware)
    - _Requirements: 3.1_

  - [ ]* 2.3 Write property tests for admin drill management
    - **Property 2: Global Drill Creation Round-Trip** — verify stored record has `center_id = NULL` and fields match input
    - **Property 4: Admin List Filtering Correctness** — verify filter results match all active criteria
    - **Validates: Requirements 3.2, 3.3, 3.6, 3.7**

- [x] 3. Center Sport Configuration (Backend)
  - [x] 3.1 Extend admin center endpoints to support `sport` field
    - Update `createCenter` in `src/controllers/admin/centers.ts` to accept and store `sport` parameter
    - Update `updateCenter` to allow changing the center's `sport` value
    - Ensure center list/detail responses include the `sport` field
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 4. Marketplace and Adoption Endpoints (Backend)
  - [x] 4.1 Implement marketplace handler in `src/controllers/drills.ts`
    - Add `listMarketplaceDrills` handler: look up center's sport, query global drills matching sport (or all if NULL), exclude already-adopted drills (via `source_drill_id` check), support category/search filters
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.4_

  - [x] 4.2 Implement adoption handler in `src/controllers/drills.ts`
    - Add `adoptDrill` handler: validate global drill exists and is not archived, check not already adopted by center, copy fields into new center drill with `source_drill_id` reference
    - Return 409 if already adopted, 404 if drill not found
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 4.3 Register marketplace and adoption routes in `src/routes/drills.ts`
    - Add `GET /marketplace` route (HEAD_COACH, ASSISTANT_COACH) with marketplace query validation
    - Add `POST /adopt` route (HEAD_COACH only) with adopt schema validation
    - Place these routes BEFORE the existing `/:id` routes to avoid param conflicts
    - _Requirements: 5.1, 6.1_

  - [ ]* 4.4 Write property tests for marketplace and adoption
    - **Property 5: Marketplace Sport Filtering** — verify correct filtering by center sport
    - **Property 6: Marketplace Excludes Adopted Drills** — verify adopted drills not in results
    - **Property 7: Adoption Copies Fields with Lineage** — verify adopted record has correct center_id, source_drill_id, and copied fields
    - **Property 8: Adoption Idempotence Rejection** — verify second adoption fails with error
    - **Validates: Requirements 5.2, 5.5, 6.2, 6.3, 6.4, 7.4**

- [x] 5. Preserve Existing Drill Functionality (Backend)
  - [x] 5.1 Update existing drill handlers to enforce tenant isolation with global drill exclusion
    - Modify `listDrills` in `src/controllers/drills.ts`: ensure query includes `center_id = $centerId` (not IS NULL), so global drills never appear
    - Modify `createDrill`: ensure `sport` is included in insert (default to center's sport or 'badminton')
    - Verify `updateDrill` and `archiveDrill` only operate on drills where `center_id` matches tenant
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 5.2 Write property tests for tenant isolation
    - **Property 9: Tenant Read Isolation** — verify only center's drills returned, no globals or other-center drills
    - **Property 10: Tenant Write Isolation** — verify creation sets center_id, updates/archives only work on center's own drills
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

- [x] 6. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Frontend: Hide Curriculum and Add Sports Constant
  - [x] 7.1 Remove curriculum from TopNav navigation config
    - In `src/components/TopNav.tsx`, remove the `{ label: 'Curriculum', path: '/curriculum' }` entry from the `COACH_NAV` Training dropdown items array
    - Keep the curriculum route in `App.tsx` but add a redirect: navigating to `/curriculum` redirects to `/dashboard`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 7.2 Create sports constants file `src/constants/sports.ts`
    - Export `SUPPORTED_SPORTS` array and `Sport` type for frontend use
    - _Requirements: 2.2_

- [x] 8. Frontend: Admin Drill Catalog
  - [x] 8.1 Create `src/hooks/useAdminDrills.ts` hook
    - Implement CRUD operations against `/api/admin/drills` endpoint
    - Support filter by sport, category, and search
    - Return drills list, loading state, error state, and mutation functions (create, update, archive)
    - _Requirements: 3.1, 3.6, 3.7_

  - [x] 8.2 Create `src/components/AdminDrillCatalog.tsx` component
    - Display global drills in a list/table with sport and category columns
    - Provide create form with name, description, category, sport fields
    - Provide inline edit or edit form for existing drills
    - Include archive action with confirmation prompt
    - Add filter controls for sport and category, and search input for name
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 8.3 Create `src/pages/admin/AdminDrillCatalogPage.tsx` and register route
    - Create page component wrapping `AdminDrillCatalog`
    - Add route in `App.tsx` at `/admin/drill-catalog` with ADMIN role protection
    - Add navigation entry in admin panel nav (if applicable)
    - _Requirements: 4.1_

- [x] 9. Frontend: Marketplace and Adoption UI
  - [x] 9.1 Create `src/hooks/useMarketplace.ts` hook
    - Fetch from `GET /api/drills/marketplace` with optional category/search params
    - Return marketplace drills, loading/error state, and refetch function
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 9.2 Create `src/components/MarketplaceTab.tsx` component
    - Display global drills with name, description, category, and an "Adopt" button
    - Support category filter and search input
    - Call `POST /api/drills/adopt` on adopt button click
    - Show success toast/feedback on successful adoption, refresh marketplace list
    - Handle error for already-adopted drills gracefully
    - _Requirements: 5.6, 5.7, 6.1, 6.6_

  - [x] 9.3 Integrate marketplace tab into `src/pages/DrillsPage.tsx`
    - Add a "Marketplace" tab visible to HEAD_COACH role
    - Render `MarketplaceTab` component when tab is active
    - Existing "My Drills" tab remains default and unchanged
    - _Requirements: 5.6_

- [x] 10. Frontend: Center Sport in Admin Pages
  - [x] 10.1 Update admin center create/edit forms to include sport field
    - Add sport dropdown (using `SUPPORTED_SPORTS`) to `CreateCenterPage.tsx` and `CenterDetailPage.tsx`
    - Ensure sport is sent in API requests for create/update center
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The API and frontend are in separate project directories; tasks specify which project each change targets
- Migration 024 is the next available migration number after the existing 023_courses_table.sql

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "7.1", "7.2"] },
    { "id": 2, "tasks": ["2.1", "3.1", "5.1"] },
    { "id": 3, "tasks": ["2.2", "4.1", "4.2"] },
    { "id": 4, "tasks": ["2.3", "4.3", "5.2"] },
    { "id": 5, "tasks": ["4.4", "8.1", "9.1"] },
    { "id": 6, "tasks": ["8.2", "9.2", "10.1"] },
    { "id": 7, "tasks": ["8.3", "9.3"] }
  ]
}
```
