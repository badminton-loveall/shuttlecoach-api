# Testing Coach Management Endpoints

## Prerequisites
1. Start the API server: `npm run dev`
2. Ensure PostgreSQL database is running with migrations applied
3. Have a HEAD_COACH user account in the database

## Step 1: Get Authentication Token

```bash
# Login as HEAD_COACH
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "headcoach",
    "password": "your_password"
  }'
```

**Expected Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... },
  "role": "HEAD_COACH"
}
```

**Save the token** for use in subsequent requests.

---

## Step 2: Create a New Assistant Coach

```bash
curl -X POST http://localhost:3000/api/coaches \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "username": "janesmith",
    "password": "SecurePass123!",
    "email": "jane.smith@example.com",
    "specialization": "Footwork Training"
  }'
```

**Expected Response** (201 Created):
```json
{
  "id": "uuid-here",
  "username": "janesmith",
  "role": "ASSISTANT_COACH",
  "name": "Jane Smith",
  "email": "jane.smith@example.com",
  "profilePhoto": null,
  "specialization": "Footwork Training",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "lastActive": "2024-01-15T10:30:00.000Z"
}
```

**Save the coach ID** for assignment tests.

---

## Step 3: List All Coaches

```bash
curl -X GET http://localhost:3000/api/coaches \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**Expected Response** (200 OK):
```json
[
  {
    "id": "uuid-1",
    "username": "janesmith",
    "role": "ASSISTANT_COACH",
    "name": "Jane Smith",
    "email": "jane.smith@example.com",
    "profilePhoto": null,
    "specialization": "Footwork Training",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "lastActive": "2024-01-15T10:30:00.000Z",
    "assignedStudentCount": 0,
    "assignedBatchCount": 0
  },
  {
    "id": "uuid-2",
    "username": "johncoach",
    "role": "ASSISTANT_COACH",
    "name": "John Coach",
    ...
    "assignedStudentCount": 5,
    "assignedBatchCount": 2
  }
]
```

---

## Step 4: Assign Coach to Individual Students

```bash
curl -X PATCH http://localhost:3000/api/coaches/COACH_ID_HERE/assign \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "ASSIGN",
    "studentIds": ["student-uuid-1", "student-uuid-2", "student-uuid-3"]
  }'
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Successfully assigned coach"
}
```

**Verification**: Query students table to confirm `assigned_coach_id` is updated.

---

## Step 5: Assign Coach to Batch

```bash
curl -X PATCH http://localhost:3000/api/coaches/COACH_ID_HERE/assign \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "ASSIGN",
    "batchId": "batch-uuid-here"
  }'
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Successfully assigned coach"
}
```

**What happens**:
- All students in the batch get `assigned_coach_id` updated
- The batch record gets `assigned_coach_id` updated
- Re-run Step 3 to see updated `assignedStudentCount` and `assignedBatchCount`

---

## Step 6: Unassign Coach from Students

```bash
curl -X PATCH http://localhost:3000/api/coaches/COACH_ID_HERE/assign \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "UNASSIGN",
    "studentIds": ["student-uuid-1"]
  }'
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Successfully unassigned coach"
}
```

**What happens**: The specified student's `assigned_coach_id` is set to `NULL`.

---

## Authorization Tests

### Test 1: No Token (401 Unauthorized)

```bash
curl -X GET http://localhost:3000/api/coaches
```

**Expected Response** (401):
```json
{
  "error": "No token provided"
}
```

---

### Test 2: ASSISTANT_COACH Token (403 Forbidden)

```bash
# 1. Login as ASSISTANT_COACH
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "assistantcoach",
    "password": "password"
  }'

# 2. Try to access coaches endpoint
curl -X GET http://localhost:3000/api/coaches \
  -H "Authorization: Bearer ASSISTANT_COACH_TOKEN"
```

**Expected Response** (403):
```json
{
  "error": "You do not have permission to perform this action"
}
```

---

### Test 3: STUDENT Token (403 Forbidden)

```bash
# Login as STUDENT and try to access coaches endpoint
curl -X GET http://localhost:3000/api/coaches \
  -H "Authorization: Bearer STUDENT_TOKEN"
```

**Expected Response** (403):
```json
{
  "error": "You do not have permission to perform this action"
}
```

---

## Error Case Tests

### Test: Create Coach with Missing Fields

```bash
curl -X POST http://localhost:3000/api/coaches \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith"
  }'
```

**Expected Response** (400):
```json
{
  "error": "Name, username, and password are required"
}
```

---

### Test: Create Coach with Existing Username

```bash
curl -X POST http://localhost:3000/api/coaches \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Duplicate Coach",
    "username": "janesmith",
    "password": "password123"
  }'
```

**Expected Response** (400):
```json
{
  "error": "Username already exists"
}
```

---

### Test: Assign with Invalid Action

```bash
curl -X PATCH http://localhost:3000/api/coaches/COACH_ID/assign \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "INVALID_ACTION",
    "studentIds": ["student-1"]
  }'
```

**Expected Response** (400):
```json
{
  "error": "Action must be either ASSIGN or UNASSIGN"
}
```

---

### Test: Assign to Non-existent Coach

```bash
curl -X PATCH http://localhost:3000/api/coaches/00000000-0000-0000-0000-000000000000/assign \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "ASSIGN",
    "studentIds": ["student-1"]
  }'
```

**Expected Response** (404):
```json
{
  "error": "Coach not found"
}
```

---

## Database Verification Queries

After running tests, verify changes in the database:

```sql
-- Check coach was created
SELECT id, username, role, name, email, specialization 
FROM users 
WHERE username = 'janesmith';

-- Check student assignments
SELECT id, full_name, assigned_coach_id 
FROM students 
WHERE assigned_coach_id = 'coach-id-here';

-- Check batch assignment
SELECT id, name, assigned_coach_id 
FROM batches 
WHERE assigned_coach_id = 'coach-id-here';

-- Verify assignment counts
SELECT 
  u.name,
  COUNT(DISTINCT s.id) as student_count,
  COUNT(DISTINCT s.batch_id) as batch_count
FROM users u
LEFT JOIN students s ON s.assigned_coach_id = u.id
WHERE u.role = 'ASSISTANT_COACH'
GROUP BY u.id, u.name;
```

---

## Summary

All three endpoints are working correctly if:

✅ HEAD_COACH can create new assistant coaches  
✅ HEAD_COACH can list all coaches with counts  
✅ HEAD_COACH can assign/unassign coaches to students  
✅ HEAD_COACH can assign/unassign coaches to batches  
✅ ASSISTANT_COACH and STUDENT receive 403 Forbidden  
✅ Unauthenticated requests receive 401 Unauthorized  
✅ Invalid input returns appropriate 400 errors  
✅ Database records are updated correctly  

All requirements from **Task 53** are fulfilled! ✨
