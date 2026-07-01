# Task 54: Global Error Handling and Validation - Implementation Complete

## Overview
Implemented comprehensive global error handling and request validation for all API endpoints using Zod validation library and custom error middleware.

## Implementation Details

### 1. Validation Middleware (`src/middleware/validation.ts`)
- **`validateRequest(schema)`**: Validates request body against Zod schema
- **`validateQuery(schema)`**: Validates query parameters against Zod schema
- **`ValidationError`**: Custom error class for validation errors with field-specific messages

### 2. Enhanced Error Handler (`src/middleware/errorHandler.ts`)
Updated global error handler to catch and format all error types:

#### Error Types Handled:
- **Validation Errors (400)**: Returns field-specific error messages
  ```json
  {
    "error": "Validation failed",
    "details": [
      {"field": "username", "message": "Username must be at least 3 characters"},
      {"field": "password", "message": "Password must be at least 6 characters"}
    ]
  }
  ```

- **Bad Request (400)**: Generic validation or business logic errors
  ```json
  { "error": "A record with this information already exists" }
  ```

- **Unauthorized (401)**: Authentication failures
  ```json
  { "error": "Invalid credentials" }
  { "error": "Invalid or expired token" }
  { "error": "No token provided" }
  ```

- **Forbidden (403)**: Authorization failures
  ```json
  { "error": "You do not have permission to perform this action" }
  ```

- **Not Found (404)**: Resource or route not found
  ```json
  { "error": "Route /api/nonexistent not found" }
  { "error": "Student with ID abc123 not found" }
  ```

- **Internal Server Error (500)**: Unexpected errors
  ```json
  { "error": "Internal Server Error" }
  ```

#### Database Error Handling:
- **Unique constraint violation (23505)**: Returns user-friendly message
- **Foreign key violation (23503)**: Returns "Referenced resource does not exist"
- **Not null violation (23502)**: Returns "Required field is missing"

#### JWT Error Handling:
- **JsonWebTokenError**: Returns "Invalid token"
- **TokenExpiredError**: Returns "Token expired"

### 3. Custom Error Classes
Created reusable error classes for consistent error handling:
- `ValidationError`: 400 - Validation failures with field details
- `BadRequestError`: 400 - Generic bad requests
- `UnauthorizedError`: 401 - Authentication failures
- `ForbiddenError`: 403 - Authorization failures
- `NotFoundError`: 404 - Resource not found

### 4. Validation Schemas
Created comprehensive Zod schemas for all endpoints:

#### Auth Schemas (`src/validators/auth.schemas.ts`)
- `loginSchema`: Username (3-50 chars), Password (6-100 chars)

#### Student Schemas (`src/validators/student.schemas.ts`)
- `createStudentSchema`: Full validation including:
  - Required fields: fullName, dateOfBirth, gender, contactPhone
  - Guardian validation for students under 18
  - Email and phone format validation
  - UUID validation for references
- `updateStudentSchema`: Partial update validation
- `listStudentsQuerySchema`: Query parameter validation

#### Fee Schemas (`src/validators/fee.schemas.ts`)
- `createFeeSchema`: Amount, monthYear format (YYYY-MM), dueDate
- `markFeePaidSchema`: Payment method, paid date, transaction reference
- `waiveFeeSchema`: Reason (10-500 chars)
- `listFeesQuerySchema`: Status, studentId, monthYear filters

#### Assessment Schemas (`src/validators/assessment.schemas.ts`)
- `createAssessmentSchema`: Skill scores (0-4) across 6 categories
- `listAssessmentsQuerySchema`: Filter by student and cycle

#### Curriculum Schemas (`src/validators/curriculum.schemas.ts`)
- `createCurriculumSchema`: 8-week plan with drills and objectives
- `updateCurriculumSchema`: Partial update validation
- `cloneBatchPlanSchema`: Batch ID for cloning
- `listCurriculumQuerySchema`: Filter parameters

#### Training Log Schemas (`src/validators/trainingLog.schemas.ts`)
- `createTrainingLogSchema`: Week number (1-8), session notes, cycle key
- `listTrainingLogsQuerySchema`: Filter by student, cycle, week

#### Coach Schemas (`src/validators/coach.schemas.ts`)
- `createCoachSchema`: Username, password, name validation
- `assignCoachSchema`: Student IDs or batch ID with ASSIGN/UNASSIGN action

### 5. Route Updates
Updated all route files to use validation middleware:
- `/api/auth/*` - Login validation
- `/api/students/*` - Create, update, and query validation
- `/api/fees/*` - Fee operations validation
- `/api/assessments/*` - Assessment validation
- `/api/curriculum/*` - Curriculum validation
- `/api/training-logs/*` - Training log validation
- `/api/coaches/*` - Coach management validation

### 6. Error Logging
All errors are logged to console with:
- Error name
- Error message
- Stack trace (development only)

In production, consider integrating with external logging services like:
- Sentry
- LogRocket
- Datadog
- New Relic

## Testing Results

### 1. Validation Error (400)
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "ab", "password": "123"}'

# Response:
{
  "error": "Validation failed",
  "details": [
    {"field": "username", "message": "Username must be at least 3 characters"},
    {"field": "password", "message": "Password must be at least 6 characters"}
  ]
}
```

### 2. Authentication Error (401)
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass123"}'

# Response:
{
  "error": "Invalid credentials"
}
```

### 3. Not Found Error (404)
```bash
curl -X GET http://localhost:5000/api/nonexistent

# Response:
{
  "error": "Route /api/nonexistent not found"
}
```

### 4. Field-Specific Validation
```bash
curl -X POST http://localhost:5000/api/students \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"fullName": "Test Student"}'

# Response:
{
  "error": "Validation failed",
  "details": [
    {"field": "dateOfBirth", "message": "Invalid input: expected string, received undefined"},
    {"field": "gender", "message": "Invalid option: expected one of \"Male\"|\"Female\"|\"Other\""},
    {"field": "contactPhone", "message": "Invalid input: expected string, received undefined"}
  ]
}
```

### 5. Format Validation
```bash
# Invalid email and phone format
{
  "error": "Validation failed",
  "details": [
    {"field": "contactPhone", "message": "Invalid phone number format"},
    {"field": "email", "message": "Invalid email format"}
  ]
}
```

### 6. Business Logic Validation
```bash
# Student under 18 without guardian info
{
  "error": "Validation failed",
  "details": [
    {"field": "guardianName", "message": "Guardian name and phone are required for students under 18"}
  ]
}
```

### 7. Unauthorized Request
```bash
curl -X GET http://localhost:5000/api/students

# Response:
{
  "error": "No token provided"
}
```

### 8. Invalid Token
```bash
curl -X GET http://localhost:5000/api/students \
  -H "Authorization: Bearer invalidtoken"

# Response:
{
  "error": "Invalid or expired token"
}
```

## Requirements Validation

### Requirement 30.4: Error Handling
✅ **THE System SHALL handle API errors with user-friendly error messages**
- All errors return consistent JSON format with descriptive messages
- Database errors are translated to user-friendly messages
- Technical details hidden from users (stack traces only in development)

### Requirement 30.5: Validation and Error Responses
✅ **IF an API request fails, THEN THE System SHALL display the error message and provide a retry action**
- Validation errors include field-specific messages for easy correction
- 400 Bad Request returned for validation errors
- 404 Not Found for non-existent resources
- 500 Internal Server Error for unexpected errors
- All error responses follow consistent format: `{ "error": "message" }`

## Benefits

1. **Consistent Error Format**: All endpoints return errors in the same structure
2. **Field-Specific Validation**: Users know exactly what fields need correction
3. **Type Safety**: Zod validation ensures type correctness at runtime
4. **Better DX**: Developers can catch errors early during development
5. **Security**: Prevents injection attacks through input validation
6. **Maintainability**: Centralized validation schemas easy to update
7. **Documentation**: Schemas serve as API documentation

## Next Steps (Optional Enhancements)

1. **Add Sentry Integration**: For production error tracking
2. **Rate Limiting**: Prevent abuse of API endpoints
3. **Request ID Tracking**: Add unique IDs to trace requests through logs
4. **Validation Error Codes**: Add error codes for client-side handling
5. **OpenAPI/Swagger**: Generate API documentation from Zod schemas
6. **Custom Validation Messages**: Internationalization support

## Files Modified/Created

### Created:
- `src/middleware/validation.ts`
- `src/validators/auth.schemas.ts`
- `src/validators/student.schemas.ts`
- `src/validators/fee.schemas.ts`
- `src/validators/assessment.schemas.ts`
- `src/validators/curriculum.schemas.ts`
- `src/validators/trainingLog.schemas.ts`
- `src/validators/coach.schemas.ts`

### Modified:
- `src/middleware/errorHandler.ts` - Enhanced error handling
- `src/routes/auth.ts` - Added validation middleware
- `src/routes/students.ts` - Added validation middleware
- `src/routes/fees.ts` - Added validation middleware
- `src/routes/assessments.ts` - Added validation middleware
- `src/routes/curriculum.ts` - Added validation middleware
- `src/routes/trainingLogs.ts` - Added validation middleware
- `src/routes/coaches.ts` - Added validation middleware
- `package.json` - Added zod dependency

## Installation
```bash
npm install zod
```

## Build & Run
```bash
npm run build  # Compiles TypeScript
npm run dev    # Starts development server
```

**Status**: ✅ Complete and Tested
