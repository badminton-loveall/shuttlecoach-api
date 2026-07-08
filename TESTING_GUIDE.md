# Testing Guide: Task 48 - JWT Authentication

## Prerequisites

Before testing the authentication endpoints, you must:

1. ✅ **Set up Supabase Database**
   - Follow the `SUPABASE_SETUP.md` guide
   - Create a Supabase project
   - Get the PostgreSQL connection string
   - Update `.env` file with `DATABASE_URL`

2. ✅ **Run Database Migrations**
   ```bash
   cd /Users/midhunvmanikkath/Documents/PROJECTS/LOVEALL/API/shuttlecoach-api
   npm run migrate
   ```
   
   This will create all tables and seed sample data including test users.

3. ✅ **Verify Environment Variables**
   Check your `.env` file contains:
   ```env
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
   JWT_SECRET=dev-secret-key-please-change-in-production
   PORT=5000
   NODE_ENV=development
   ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
   ```

## Starting the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm run build
npm start
```

Expected output:
```
✅ Database connected successfully

╔════════════════════════════════════════╗
║   ShuttleCoach API Server Started     ║
╠════════════════════════════════════════╣
║  Port:        5000                     ║
║  Environment: development              ║
║  Database:    Connected ✅             ║
╚════════════════════════════════════════╝
```

## Test Accounts

After running migrations, you can use these credentials:

| Role | Username | Password | Description |
|------|----------|----------|-------------|
| HEAD_COACH | `headcoach` | `password123` | Full admin access |
| ASSISTANT_COACH | `assistant1` | `password123` | Limited coach access |
| ASSISTANT_COACH | `assistant2` | `password123` | Limited coach access |
| STUDENT | `aarav` | `password123` | Student profile access |
| STUDENT | `diya` | `password123` | Student profile access |
| STUDENT | `saanvi` | `password123` | Student profile access |

## Automated Testing Script

Run the included test script:

```bash
# Make sure the server is running first
npm run dev

# In a new terminal window:
./test-auth.sh
```

This script will automatically test:
- ✅ Health check endpoint
- ✅ Successful login (all roles)
- ✅ Failed login scenarios (wrong password, missing fields, non-existent user)
- ✅ Authenticated /me endpoint
- ✅ Unauthorized access attempts

## Manual Testing

### Method 1: Using curl

#### Test 1: Login (Success)
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "headcoach",
    "password": "password123"
  }'
```

**Expected Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "11111111-1111-1111-1111-111111111111",
    "username": "headcoach",
    "role": "HEAD_COACH",
    "name": "Sumit Dali",
    "email": "sumit@shuttlecoach.com",
    "profilePhoto": null,
    "specialization": "Advanced Training",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "lastActive": "2025-01-15T12:30:00.000Z"
  },
  "role": "HEAD_COACH"
}
```

#### Test 2: Get Current User Profile
```bash
# First, save the token from login response
TOKEN="paste-your-token-here"

curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200 OK):**
```json
{
  "user": {
    "id": "11111111-1111-1111-1111-111111111111",
    "username": "headcoach",
    "role": "HEAD_COACH",
    "name": "Sumit Dali",
    "email": "sumit@shuttlecoach.com",
    "profilePhoto": null,
    "specialization": "Advanced Training",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "lastActive": "2025-01-15T12:30:00.000Z"
  },
  "role": "HEAD_COACH"
}
```

#### Test 3: Login (Wrong Password)
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "headcoach",
    "password": "wrongpassword"
  }'
```

**Expected Response (401 Unauthorized):**
```json
{
  "error": "Invalid credentials"
}
```

#### Test 4: /me Endpoint (No Token)
```bash
curl -X GET http://localhost:5000/api/auth/me
```

**Expected Response (401 Unauthorized):**
```json
{
  "error": "No token provided"
}
```

### Method 2: Using Postman

#### Setup

1. **Create a new Collection**: "ShuttleCoach API"

2. **Create Environment Variables**:
   - `baseUrl`: `http://localhost:5000`
   - `token`: (leave empty, will be set after login)

#### Request 1: Login

- **Method**: POST
- **URL**: `{{baseUrl}}/api/auth/login`
- **Headers**: `Content-Type: application/json`
- **Body** (raw JSON):
  ```json
  {
    "username": "headcoach",
    "password": "password123"
  }
  ```
- **Tests** (optional - to save token):
  ```javascript
  const response = pm.response.json();
  pm.environment.set("token", response.token);
  ```

#### Request 2: Get Current User

- **Method**: GET
- **URL**: `{{baseUrl}}/api/auth/me`
- **Headers**: 
  - `Authorization: Bearer {{token}}`

#### Request 3: Login - Assistant Coach

- **Method**: POST
- **URL**: `{{baseUrl}}/api/auth/login`
- **Body**:
  ```json
  {
    "username": "assistant1",
    "password": "password123"
  }
  ```

#### Request 4: Login - Student

- **Method**: POST
- **URL**: `{{baseUrl}}/api/auth/login`
- **Body**:
  ```json
  {
    "username": "aarav",
    "password": "password123"
  }
  ```

## Test Scenarios

### ✅ Positive Test Cases

1. **Valid login - Head Coach**
   - Username: `headcoach`, Password: `password123`
   - Expected: 200 OK, returns token and user profile

2. **Valid login - Assistant Coach**
   - Username: `assistant1`, Password: `password123`
   - Expected: 200 OK, returns token with ASSISTANT_COACH role

3. **Valid login - Student**
   - Username: `aarav`, Password: `password123`
   - Expected: 200 OK, returns token with STUDENT role

4. **Get user profile with valid token**
   - Header: `Authorization: Bearer <valid-token>`
   - Expected: 200 OK, returns user profile

5. **Token includes correct role claim**
   - Decode JWT token at https://jwt.io
   - Verify payload contains `id`, `username`, `role`, `iat`, `exp`

### ❌ Negative Test Cases

1. **Login with wrong password**
   - Username: `headcoach`, Password: `wrongpassword`
   - Expected: 401 Unauthorized, "Invalid credentials"

2. **Login with non-existent user**
   - Username: `nonexistent`, Password: `password123`
   - Expected: 401 Unauthorized, "Invalid credentials"

3. **Login with missing password**
   - Username: `headcoach`, Password: (missing)
   - Expected: 400 Bad Request, "Username and password are required"

4. **Login with missing username**
   - Username: (missing), Password: `password123`
   - Expected: 400 Bad Request, "Username and password are required"

5. **Access /me without token**
   - No Authorization header
   - Expected: 401 Unauthorized, "No token provided"

6. **Access /me with invalid token**
   - Header: `Authorization: Bearer invalid-token-12345`
   - Expected: 401 Unauthorized, "Invalid or expired token"

7. **Access /me with malformed Authorization header**
   - Header: `Authorization: invalid-format`
   - Expected: 401 Unauthorized, "No token provided"

8. **Access /me with expired token**
   - Use a token older than 24 hours
   - Expected: 401 Unauthorized, "Invalid or expired token"

## Verifying Password Hashing

### Check that passwords are hashed with bcrypt (salt rounds ≥ 10)

1. **Check seed data** (already done):
   - Open `src/migrations/002_seed_data.sql`
   - Verify password_hash starts with `$2b$10$` (indicates bcrypt with 10 rounds)

2. **Query database directly** (optional):
   ```sql
   SELECT username, password_hash FROM users LIMIT 1;
   ```
   
   Should return something like:
   ```
   username: headcoach
   password_hash: $2b$10$rKvVJH8YnRVH0SZLqJ3mj.xQZGX9p8YqKqVHxJ9mJ3mJ9mJ3mJ3mJ3
   ```
   
   The `$2b$10$` prefix confirms bcrypt with 10 salt rounds.

## Verifying JWT Token

### Decode and inspect JWT token

1. Copy the token from login response
2. Go to https://jwt.io
3. Paste token in the "Encoded" section
4. Verify the decoded payload contains:
   ```json
   {
     "id": "11111111-1111-1111-1111-111111111111",
     "username": "headcoach",
     "role": "HEAD_COACH",
     "iat": 1705315200,
     "exp": 1705401600
   }
   ```
5. Verify expiration is 24 hours from issued time:
   - `exp - iat = 86400` seconds (24 hours)

## Troubleshooting

### Server won't start

**Error: "Missing required environment variable: DATABASE_URL"**
- Solution: Update `.env` file with your Supabase connection string

**Error: "connect ECONNREFUSED"**
- Solution: Database is not accessible. Verify Supabase connection string is correct

**Error: "password authentication failed"**
- Solution: Check the password in your DATABASE_URL is correct

### Login fails

**"Invalid credentials" error for correct password**
- Check that migrations have been run: `npm run migrate`
- Verify user exists in database:
  ```sql
  SELECT username, role FROM users WHERE username = 'headcoach';
  ```

**"Cannot read property 'password_hash' of undefined"**
- User doesn't exist in database
- Run migrations: `npm run migrate`

### Token issues

**"Invalid or expired token" immediately after login**
- Check JWT_SECRET in .env matches what was used to generate token
- Restart server after changing JWT_SECRET

**Token works but user profile not found**
- Database connection lost
- User was deleted from database

## Success Criteria

Task 48 is complete when:

- ✅ POST /api/auth/login endpoint accepts username and password
- ✅ Login returns JWT token with 24-hour expiration
- ✅ Login returns user profile (without password hash)
- ✅ Login returns user role (HEAD_COACH, ASSISTANT_COACH, or STUDENT)
- ✅ Invalid credentials return 401 Unauthorized
- ✅ Missing fields return 400 Bad Request
- ✅ GET /api/auth/me requires valid JWT token
- ✅ /me endpoint returns authenticated user profile
- ✅ /me endpoint rejects requests without token (401)
- ✅ /me endpoint rejects invalid/expired tokens (401)
- ✅ Passwords hashed with bcrypt (salt rounds ≥ 10)
- ✅ JWT middleware extracts user info from token
- ✅ User info attached to request object for downstream use
- ✅ All test scenarios pass

## Next Steps

After Task 48 is verified:

1. **Frontend Integration**
   - Update frontend to call /api/auth/login
   - Store token in localStorage or httpOnly cookie
   - Include token in Authorization header for all API requests
   - Handle 401 responses by redirecting to login

2. **Task 49: Student CRUD Endpoints**
   - Implement POST /api/students
   - Implement GET /api/students (with filtering)
   - Implement GET /api/students/:id
   - Implement PATCH /api/students/:id

3. **Add Protected Routes**
   - Use `authenticate` middleware on all protected endpoints
   - Use `authorize` middleware for role-specific endpoints

## Additional Notes

- **Token Storage**: Frontend should store token securely (httpOnly cookie preferred)
- **Token Refresh**: Consider implementing refresh tokens for better UX (not in this task)
- **Rate Limiting**: Add rate limiting on /login to prevent brute-force attacks (future task)
- **Audit Logging**: Consider logging all authentication attempts (future enhancement)

---

**Last Updated**: 2025-01-15  
**Task**: 48 - JWT Authentication Middleware  
**Status**: Implementation Complete - Awaiting Database Setup for Testing
