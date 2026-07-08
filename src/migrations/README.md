# Database Migrations

This directory contains SQL migration scripts for the ShuttleCoach database schema.

## Migration Files

- **`000_rollback.sql`** - Drops all tables (DESTRUCTIVE - use with caution)
- **`001_initial_schema.sql`** - Creates all database tables, indexes, and constraints
- **`002_seed_data.sql`** - Populates database with sample data for development
- **`run-migrations.ts`** - TypeScript script to execute migrations in order

## Database Schema

### Tables Created

1. **users** - Authentication and profile data for coaches and students
   - Stores username, password hash, role, and profile information
   - Indexed on username and role
   - Supports HEAD_COACH, ASSISTANT_COACH, and STUDENT roles

2. **batches** - Student batch groupings
   - Groups students by training schedule
   - Links to assigned coach
   - Referenced by students table

3. **students** - Student profile and training information
   - Comprehensive personal information
   - Auto-computed age from date_of_birth
   - Auto-computed BMI from height and weight
   - Links to batch and assigned coach
   - Supports strengths/weaknesses as arrays

4. **skill_assessments** - Bi-monthly skill assessments
   - 60 skills across 6 categories stored as JSONB
   - Unique constraint on (student_id, cycle_key)
   - Supports locking past assessments
   - Indexed on student and cycle

5. **fee_records** - Fee payment tracking
   - Tracks amount, due date, payment status
   - Supports PAID, PENDING, OVERDUE, WAIVED statuses
   - Multiple payment methods: CASH, UPI, BANK_TRANSFER
   - Indexed on student, status, and due_date

6. **curriculum_plans** - 8-week training curricula
   - Can be for batch OR individual student (CHECK constraint)
   - Stores weeks as JSONB array
   - Supports curriculum history tracking
   - Links to source batch plan if cloned

7. **training_logs** - Weekly training session notes
   - One log per student per cycle per week
   - Unique constraint on (student_id, cycle_key, week_number)
   - Tracks completion status and coach notes

### Key Features

- **UUID Primary Keys** - All tables use UUID for globally unique identifiers
- **Generated Columns** - Age and BMI auto-computed from base data
- **JSONB Storage** - Flexible schema for skill scores and curriculum weeks
- **Proper Indexes** - Optimized for common query patterns
- **Foreign Keys** - Maintains referential integrity
- **CHECK Constraints** - Enforces business rules at database level
- **Auto Timestamps** - created_at and updated_at managed automatically
- **Triggers** - Automatically updates updated_at on row changes

## Running Migrations

### Prerequisites

1. PostgreSQL database running (local or cloud)
2. Environment variables configured in `.env`:
   ```
   DATABASE_URL=postgresql://username:password@host:port/database
   ```

### Execute Migrations

Run all migrations in order:
```bash
npm run migrate
```

This will:
1. Execute `001_initial_schema.sql` (create tables)
2. Execute `002_seed_data.sql` (insert sample data)
3. Display summary of created records

### Rollback (DESTRUCTIVE)

⚠️ **WARNING**: This will delete all data and drop all tables!

```bash
npm run migrate:rollback
```

### Manual Execution

You can also run migrations manually using `psql`:

```bash
# Run schema creation
psql $DATABASE_URL -f src/migrations/001_initial_schema.sql

# Run seed data
psql $DATABASE_URL -f src/migrations/002_seed_data.sql

# Rollback
psql $DATABASE_URL -f src/migrations/000_rollback.sql
```

## Sample Data

The seed script (`002_seed_data.sql`) creates:

- **3 coaches**:
  - Head Coach: Sumit Dali (username: `headcoach`)
  - Assistant Coach: Priya Sharma (username: `assistant1`)
  - Assistant Coach: Amit Patel (username: `assistant2`)

- **3 batches**:
  - Morning Beginners
  - Evening Intermediate
  - Advanced Training

- **6 students**:
  - Aarav Mehta (Intermediate, BAID-2024-001)
  - Diya Singh (Beginner, BAID-2024-002)
  - Rohan Iyer (Intermediate, BAID-2024-003)
  - Ananya Reddy (Advanced, BAID-2024-004)
  - Arjun Nair (Beginner, no BAID)
  - Saanvi Gupta (Advanced, BAID-2024-005)

- **3 skill assessments** - For Aarav, Diya, and Saanvi
- **12 fee records** - Mix of paid, pending, and overdue
- **1 curriculum plan** - 8-week beginner program
- **4 training logs** - Sample session notes

All users (coaches and students) have the password: `password123`

## Database Design Highlights

### Computed Columns

```sql
-- Age computed from date of birth
age INTEGER GENERATED ALWAYS AS (
  EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))::INTEGER
) STORED

-- BMI computed from height and weight
bmi NUMERIC(4,1) GENERATED ALWAYS AS (
  CASE 
    WHEN height IS NOT NULL AND weight IS NOT NULL 
    THEN ROUND(weight / POWER(height/100, 2), 1)
    ELSE NULL 
  END
) STORED
```

### Curriculum XOR Constraint

Ensures curriculum plan is for EITHER batch OR student, never both:

```sql
CHECK (
  (batch_id IS NOT NULL AND student_id IS NULL) OR 
  (batch_id IS NULL AND student_id IS NOT NULL)
)
```

### Unique Constraints

- `users.username` - One username per user
- `skill_assessments(student_id, cycle_key)` - One assessment per student per cycle
- `training_logs(student_id, cycle_key, week_number)` - One log per week

### JSONB Structures

**Skill Scores Example:**
```json
{
  "forehand": {
    "Clear": 2,
    "Drop": 2,
    "Smash": 3,
    ...
  },
  "backhand": { ... },
  ...
}
```

**Curriculum Weeks Example:**
```json
[
  {
    "weekNumber": 1,
    "focusArea": "Basic Footwork & Grip",
    "objective": "Master basic footwork patterns",
    "drills": [
      {
        "id": "drill-001",
        "name": "Four-Corner Footwork",
        "description": "Move to all four corners",
        "category": "Footwork"
      }
    ]
  }
]
```

## Development vs Production

### Local Development
- Use local PostgreSQL: `postgresql://localhost:5432/shuttlecoach`
- SSL not required

### Production (Supabase/Neon/Railway)
- Use managed PostgreSQL connection string
- SSL enabled automatically
- Set `NODE_ENV=production`

## Troubleshooting

### Connection Issues
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT version();"
```

### View Tables
```bash
# List all tables
psql $DATABASE_URL -c "\dt"

# Describe table structure
psql $DATABASE_URL -c "\d students"
```

### Check Data
```bash
# Count records in each table
psql $DATABASE_URL -c "
  SELECT 
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM students) as students,
    (SELECT COUNT(*) FROM batches) as batches;
"
```

### Reset Database
If you need to start fresh:
```bash
npm run migrate:rollback
npm run migrate
```

## Next Steps

After running migrations:
1. ✅ Database schema is ready
2. ✅ Sample data is populated
3. → Implement JWT authentication endpoints (Task 48)
4. → Implement Student CRUD endpoints (Task 49)
5. → Test API endpoints with sample data

## References

- PostgreSQL Documentation: https://www.postgresql.org/docs/
- UUID Functions: https://www.postgresql.org/docs/current/uuid-ossp.html
- JSONB: https://www.postgresql.org/docs/current/datatype-json.html
- Generated Columns: https://www.postgresql.org/docs/current/ddl-generated-columns.html
