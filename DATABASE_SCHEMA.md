# ShuttleCoach Database Schema Reference

## Quick Overview

7 main tables supporting badminton training management:
- **users** - Authentication for coaches and students
- **batches** - Training group management
- **students** - Student profiles and training data
- **skill_assessments** - Bi-monthly skill evaluations (60 skills)
- **fee_records** - Payment tracking
- **curriculum_plans** - 8-week training programs
- **training_logs** - Weekly session notes

---

## Tables

### users
Authentication and profile data for all system users

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | User identifier |
| username | VARCHAR(50) | UNIQUE, NOT NULL | Login username |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt hashed password |
| role | ENUM | NOT NULL | HEAD_COACH \| ASSISTANT_COACH \| STUDENT |
| name | VARCHAR(100) | NOT NULL | Full display name |
| email | VARCHAR(100) | | Contact email |
| profile_photo | TEXT | | Photo URL or base64 |
| specialization | VARCHAR(100) | | Coach specialization area |
| created_at | TIMESTAMP | DEFAULT NOW() | Account creation |
| last_active | TIMESTAMP | DEFAULT NOW() | Last login time |

**Indexes:** `username`, `role`

---

### batches
Student groupings by schedule

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Batch identifier |
| name | VARCHAR(100) | NOT NULL | Batch name (e.g., "Morning Beginners") |
| schedule | VARCHAR(100) | | Training schedule text |
| assigned_coach_id | UUID | FK → users.id | Assigned coach |
| created_at | TIMESTAMP | DEFAULT NOW() | Batch creation date |

**Indexes:** `assigned_coach_id`

---

### students
Comprehensive student profiles

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Student identifier |
| full_name | VARCHAR(100) | NOT NULL | Student full name |
| date_of_birth | DATE | NOT NULL | Birth date |
| age | INTEGER | GENERATED | Auto-computed from DOB |
| gender | ENUM | NOT NULL | Male \| Female \| Other |
| contact_phone | VARCHAR(20) | NOT NULL | Phone number |
| email | VARCHAR(100) | | Email address |
| guardian_name | VARCHAR(100) | | Guardian for minors |
| guardian_phone | VARCHAR(20) | | Guardian contact |
| baid_number | VARCHAR(50) | | Badminton Association ID |
| batch_id | UUID | FK → batches.id | Assigned batch |
| assigned_coach_id | UUID | FK → users.id | Assigned coach |
| profile_photo | TEXT | | Photo URL |
| height | NUMERIC(5,2) | | Height in cm |
| weight | NUMERIC(5,2) | | Weight in kg |
| bmi | NUMERIC(4,1) | GENERATED | Auto-computed BMI |
| blood_group | VARCHAR(5) | | Blood type |
| medical_conditions | TEXT | | Medical notes |
| emergency_contact | TEXT | | Emergency contact info |
| strengths | TEXT[] | | Array of strength tags |
| weaknesses | TEXT[] | | Array of weakness tags |
| coach_feedback | TEXT | | Coach notes |
| skill_level | ENUM | | Beginner \| Intermediate \| Advanced \| Professional |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMP | AUTO UPDATE | Last update |

**Indexes:** `batch_id`, `assigned_coach_id`, `full_name`

**Computed Columns:**
- `age = EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))`
- `bmi = ROUND(weight / POWER(height/100, 2), 1)`

---

### skill_assessments
Bi-monthly skill evaluations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Assessment identifier |
| student_id | UUID | FK → students.id | Student being assessed |
| cycle_key | VARCHAR(20) | NOT NULL | Cycle (e.g., "Jan-Feb 2025") |
| recorded_by | VARCHAR(100) | NOT NULL | Coach name |
| recorded_at | TIMESTAMP | DEFAULT NOW() | Assessment timestamp |
| scores | JSONB | NOT NULL | 60 skills across 6 categories |
| is_locked | BOOLEAN | DEFAULT FALSE | Locked for past cycles |

**Constraints:** UNIQUE(student_id, cycle_key)  
**Indexes:** `student_id`, `cycle_key`

**JSONB Structure:**
```json
{
  "forehand": {
    "Clear": 2,
    "Drop": 2,
    "Smash": 3,
    "Drive": 2,
    "NetShot": 2,
    "Lift": 2,
    "CrossDrop": 1,
    "Slice": 1,
    "Push": 2,
    "Tap": 2
  },
  "backhand": { ... },
  "return": { ... },
  "service": { ... },
  "overhead": { ... },
  "rally": { ... }
}
```

**Score Scale:** 0 (untested) → 1 (beginner) → 2 (intermediate) → 3 (advanced) → 4 (professional)

---

### fee_records
Payment tracking

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Fee record identifier |
| student_id | UUID | FK → students.id | Student |
| amount | NUMERIC(10,2) | NOT NULL | Fee amount |
| month_year | VARCHAR(7) | NOT NULL | Period (e.g., "2025-01") |
| due_date | DATE | NOT NULL | Payment due date |
| paid_date | DATE | | Actual payment date |
| status | ENUM | NOT NULL | PAID \| PENDING \| OVERDUE \| WAIVED |
| payment_method | ENUM | | CASH \| UPI \| BANK_TRANSFER |
| transaction_ref | VARCHAR(100) | | Transaction reference |
| notes | TEXT | | Payment notes |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMP | AUTO UPDATE | Last update |

**Indexes:** `student_id`, `status`, `due_date`

---

### curriculum_plans
8-week training programs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Plan identifier |
| cycle_key | VARCHAR(20) | NOT NULL | Cycle (e.g., "Jan-Feb 2025") |
| batch_id | UUID | FK → batches.id | For batch plans |
| student_id | UUID | FK → students.id | For individual plans |
| source_batch_plan_id | UUID | FK → curriculum_plans.id | Source if cloned |
| weeks | JSONB | NOT NULL | 8-week structure |
| is_archived | BOOLEAN | DEFAULT FALSE | Archived flag |
| created_at | TIMESTAMP | DEFAULT NOW() | Plan creation |
| updated_at | TIMESTAMP | AUTO UPDATE | Last update |

**Constraints:** CHECK(batch_id XOR student_id) - Plan is for batch OR student, not both  
**Indexes:** `batch_id`, `student_id`, `cycle_key`

**JSONB Structure:**
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
  },
  // ... weeks 2-8
]
```

---

### training_logs
Weekly session notes

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Log identifier |
| student_id | UUID | FK → students.id | Student |
| week_number | INTEGER | CHECK 1-8 | Week in cycle |
| cycle_key | VARCHAR(20) | NOT NULL | Cycle identifier |
| session_notes | TEXT | | Coach observations |
| is_completed | BOOLEAN | DEFAULT FALSE | Week completion flag |
| recorded_by | VARCHAR(100) | NOT NULL | Coach name |
| recorded_at | TIMESTAMP | DEFAULT NOW() | Log timestamp |

**Constraints:** UNIQUE(student_id, cycle_key, week_number)  
**Indexes:** `student_id`, `cycle_key`

---

## Relationships

```
users (coaches)
  ↓ assigned_coach_id
  ├─→ batches
  │     ↓ batch_id
  │     └─→ students
  │           ↓ student_id
  │           ├─→ skill_assessments
  │           ├─→ fee_records
  │           ├─→ curriculum_plans (individual)
  │           └─→ training_logs
  └─→ students (direct assignment)

batches
  ↓ batch_id
  └─→ curriculum_plans (batch-level)
```

---

## Enums

### user_role
- `HEAD_COACH` - Full system access
- `ASSISTANT_COACH` - Access to assigned students
- `STUDENT` - Read-only access to own data

### gender_type
- `Male`
- `Female`
- `Other`

### skill_level_type
- `Beginner`
- `Intermediate`
- `Advanced`
- `Professional`

### fee_status_type
- `PAID` - Payment received
- `PENDING` - Awaiting payment
- `OVERDUE` - Past due date
- `WAIVED` - Fee waived with reason

### payment_method_type
- `CASH`
- `UPI`
- `BANK_TRANSFER`

---

## Auto-Updated Columns

**Triggers automatically update `updated_at` on:**
- students
- fee_records
- curriculum_plans

**Function:**
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Sample Queries

### Get all students in a batch
```sql
SELECT s.*, b.name as batch_name, u.name as coach_name
FROM students s
LEFT JOIN batches b ON s.batch_id = b.id
LEFT JOIN users u ON s.assigned_coach_id = u.id
WHERE b.id = 'batch-uuid';
```

### Get student's latest assessment
```sql
SELECT *
FROM skill_assessments
WHERE student_id = 'student-uuid'
ORDER BY recorded_at DESC
LIMIT 1;
```

### Get overdue fees
```sql
SELECT s.full_name, f.*
FROM fee_records f
JOIN students s ON f.student_id = s.id
WHERE f.status = 'OVERDUE'
ORDER BY f.due_date;
```

### Get curriculum for student
```sql
SELECT *
FROM curriculum_plans
WHERE student_id = 'student-uuid'
  AND cycle_key = 'Jan-Feb 2025';
```

### Get coach's assigned students
```sql
SELECT *
FROM students
WHERE assigned_coach_id = 'coach-uuid'
ORDER BY full_name;
```

---

## Migration Files

1. **001_initial_schema.sql** - Creates all tables, indexes, constraints
2. **002_seed_data.sql** - Populates sample data
3. **000_rollback.sql** - Drops all tables (destructive)

Run with: `npm run migrate`

---

## Notes

- All IDs are UUIDs for global uniqueness
- JSONB used for flexible nested structures
- Generated columns auto-compute derived values
- Proper indexing for common query patterns
- Foreign keys maintain referential integrity
- CHECK constraints enforce business rules
- SSL enabled for production databases
