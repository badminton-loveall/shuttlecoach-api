# Requirements Document

## Introduction

The Drill Marketplace feature introduces a platform-level drill catalog managed by the ADMIN, enabling multi-sport support and a marketplace experience for centers. Centers can browse sport-specific global drills and adopt them into their own library. The `/curriculum` page is hidden from center navigation to simplify initial onboarding, while the code remains intact for future use.

## Glossary

- **Platform_Admin**: The system-wide administrator (ADMIN role) who manages the master drill catalog and platform configuration
- **Center**: A tenant entity representing a coaching academy; the primary multi-tenant boundary
- **Head_Coach**: The primary coach at a center with full management permissions within that center
- **Global_Drill**: A drill record created by Platform_Admin with no center_id, available to all centers via the marketplace
- **Center_Drill**: A drill record scoped to a specific center via center_id, owned and editable by that center
- **Marketplace**: The browsing interface where centers discover and adopt Global_Drills into their own library
- **Adoption**: The act of copying a Global_Drill into a center's own drill library as a new Center_Drill
- **Sport**: A classification tag on drills indicating which sport the drill belongs to (e.g., badminton, tennis)
- **Drill_Catalog**: The admin-managed collection of all Global_Drills across all sports

## Requirements

### Requirement 1: Hide Curriculum Page from Center Navigation

**User Story:** As a Platform_Admin, I want to hide the curriculum page from center users, so that the onboarding experience remains simple until the feature is ready.

#### Acceptance Criteria

1. THE Navigation_Component SHALL exclude the curriculum route from all menu items rendered for Head_Coach and Assistant_Coach roles
2. WHEN a user navigates directly to the /curriculum URL, THE Router SHALL redirect the user to the /dashboard page
3. THE Curriculum_Route SHALL remain in the codebase source files without deletion

### Requirement 2: Sport Dimension on Drills

**User Story:** As a Platform_Admin, I want drills to be tagged by sport, so that centers only see drills relevant to their sport.

#### Acceptance Criteria

1. THE Drills_Table SHALL include a sport column that identifies which sport a drill belongs to
2. THE Sport column SHALL accept values from a predefined list of supported sports (e.g., badminton, tennis, table_tennis, squash)
3. WHEN a drill is created, THE System SHALL require a sport value to be provided
4. THE Centers_Table SHALL include a sport column indicating the primary sport offered at that center
5. WHEN a center is created or updated, THE Admin_API SHALL allow setting the center sport value

### Requirement 3: Global Drill Catalog Management

**User Story:** As a Platform_Admin, I want to create and manage a master catalog of drills, so that centers have a curated library to adopt from.

#### Acceptance Criteria

1. THE Admin_API SHALL expose CRUD endpoints for Global_Drills at /api/admin/drills
2. WHEN Platform_Admin creates a Global_Drill, THE System SHALL store the drill with a NULL center_id to indicate platform-level scope
3. THE Admin_API SHALL allow Platform_Admin to set name, description, category, and sport for each Global_Drill
4. WHEN Platform_Admin updates a Global_Drill, THE System SHALL modify only the master record without affecting adopted Center_Drills
5. WHEN Platform_Admin archives a Global_Drill, THE System SHALL set is_archived to true on the master record without affecting adopted Center_Drills
6. THE Admin_Drill_List endpoint SHALL support filtering by sport and category
7. THE Admin_Drill_List endpoint SHALL support searching by drill name

### Requirement 4: Admin Drill Management UI

**User Story:** As a Platform_Admin, I want a dedicated admin interface to manage the drill catalog, so that I can curate drills efficiently.

#### Acceptance Criteria

1. THE Admin_Panel SHALL include a Drill Catalog page accessible from the admin navigation
2. THE Admin_Drill_Page SHALL display all Global_Drills with sport and category information
3. THE Admin_Drill_Page SHALL provide a form to create new Global_Drills with name, description, category, and sport fields
4. THE Admin_Drill_Page SHALL allow editing existing Global_Drills inline or via a form
5. THE Admin_Drill_Page SHALL allow archiving Global_Drills with a confirmation prompt
6. THE Admin_Drill_Page SHALL provide filter controls for sport and category
7. THE Admin_Drill_Page SHALL provide a search input for drill name filtering

### Requirement 5: Drill Marketplace Browsing

**User Story:** As a Head_Coach, I want to browse a marketplace of global drills filtered to my center's sport, so that I can discover relevant drills to add to my library.

#### Acceptance Criteria

1. THE Center_API SHALL expose a marketplace endpoint at GET /api/drills/marketplace that returns Global_Drills
2. WHEN a center user requests the marketplace, THE System SHALL filter Global_Drills by the center's configured sport
3. THE Marketplace_Endpoint SHALL support additional filtering by category
4. THE Marketplace_Endpoint SHALL support searching by drill name
5. THE Marketplace_Endpoint SHALL exclude Global_Drills that the center has already adopted
6. THE Drills_Page SHALL include a Marketplace tab or section accessible to Head_Coach users
7. THE Marketplace_UI SHALL display each Global_Drill with its name, description, category, and an adopt button

### Requirement 6: Drill Adoption

**User Story:** As a Head_Coach, I want to adopt drills from the marketplace into my center's library, so that my coaches can use them in training plans.

#### Acceptance Criteria

1. THE Center_API SHALL expose an adoption endpoint at POST /api/drills/adopt that copies a Global_Drill into the center's library
2. WHEN a Head_Coach adopts a Global_Drill, THE System SHALL create a new Center_Drill record with the center's center_id and copy name, description, category, and sport from the Global_Drill
3. WHEN a Head_Coach adopts a Global_Drill, THE System SHALL store a reference to the source Global_Drill id on the adopted Center_Drill record
4. IF a Head_Coach attempts to adopt a Global_Drill that has already been adopted by that center, THEN THE System SHALL return an error indicating the drill was already adopted
5. AFTER adoption, THE Center_Drill SHALL be fully editable by the Head_Coach independently from the original Global_Drill
6. THE Marketplace_UI SHALL provide visual feedback confirming successful adoption

### Requirement 7: Center Sport Configuration

**User Story:** As a Platform_Admin, I want to assign a sport to each center, so that the marketplace shows relevant drills automatically.

#### Acceptance Criteria

1. WHEN Platform_Admin creates a center, THE Admin_API SHALL accept a sport parameter
2. WHEN Platform_Admin updates a center, THE Admin_API SHALL allow changing the center's sport value
3. THE Center_Details response SHALL include the configured sport value
4. IF a center has no sport configured, THEN THE Marketplace_Endpoint SHALL return all Global_Drills regardless of sport

### Requirement 8: Existing Drill Data Migration

**User Story:** As a Platform_Admin, I want existing drills to be migrated with the new sport column populated, so that the marketplace and filtering work correctly from day one.

#### Acceptance Criteria

1. WHEN the migration runs, THE System SHALL add a sport column to the drills table with a default value of 'badminton' for all existing records
2. WHEN the migration runs, THE System SHALL add a center_id column to the drills table if not already present
3. WHEN the migration runs, THE System SHALL add a source_drill_id column to the drills table to track adoption lineage
4. THE Migration SHALL set the sport value to 'badminton' for all pre-existing drill records
5. THE Migration SHALL preserve all existing drill data without modification to name, description, category, or is_archived fields

### Requirement 9: Existing Drill Functionality Preservation

**User Story:** As a Head_Coach, I want my existing center drills to continue working unchanged, so that my current workflow is not disrupted.

#### Acceptance Criteria

1. THE existing GET /api/drills endpoint SHALL continue to return only Center_Drills scoped to the requesting center
2. THE existing POST /api/drills endpoint SHALL continue to create Center_Drills scoped to the requesting center
3. THE existing PATCH /api/drills/:id endpoint SHALL continue to update only Center_Drills owned by the requesting center
4. THE existing DELETE /api/drills/:id endpoint SHALL continue to archive only Center_Drills owned by the requesting center
5. WHEN listing drills via GET /api/drills, THE System SHALL exclude Global_Drills from the response (only center-owned drills appear)
