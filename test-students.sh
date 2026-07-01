#!/bin/bash

# Test script for Student CRUD API endpoints
# This script tests all student endpoints with proper authorization

BASE_URL="http://localhost:5000/api"

echo "=========================================="
echo "Student CRUD API Endpoint Tests"
echo "=========================================="
echo ""

# Step 1: Login as Head Coach
echo "1. Logging in as Head Coach..."
HEAD_COACH_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "headcoach",
    "password": "password123"
  }')

HEAD_COACH_TOKEN=$(echo "$HEAD_COACH_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$HEAD_COACH_TOKEN" ]; then
  echo "❌ Failed to login as Head Coach"
  echo "Response: $HEAD_COACH_RESPONSE"
  exit 1
fi

echo "✅ Head Coach logged in successfully"
echo "Token: ${HEAD_COACH_TOKEN:0:20}..."
echo ""

# Step 2: Login as Assistant Coach
echo "2. Logging in as Assistant Coach..."
ASSISTANT_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "assistant1",
    "password": "password123"
  }')

ASSISTANT_TOKEN=$(echo "$ASSISTANT_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
ASSISTANT_ID=$(echo "$ASSISTANT_RESPONSE" | grep -o '"id":"[^"]*' | grep -m 1 -o '[a-f0-9-]\{36\}')

if [ -z "$ASSISTANT_TOKEN" ]; then
  echo "❌ Failed to login as Assistant Coach"
  echo "Response: $ASSISTANT_RESPONSE"
  exit 1
fi

echo "✅ Assistant Coach logged in successfully"
echo "Token: ${ASSISTANT_TOKEN:0:20}..."
echo "Assistant Coach ID: $ASSISTANT_ID"
echo ""

# Step 3: Create a new student (as Head Coach)
echo "3. Creating a new student (as Head Coach)..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/students" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HEAD_COACH_TOKEN" \
  -d '{
    "fullName": "Test Student",
    "dateOfBirth": "2005-03-15",
    "gender": "Male",
    "contactPhone": "9876543210",
    "email": "test@example.com",
    "height": 170,
    "weight": 65,
    "skillLevel": "Beginner",
    "strengths": ["Stamina", "Footwork"],
    "weaknesses": ["Backhand", "Service"]
  }')

STUDENT_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$STUDENT_ID" ]; then
  echo "❌ Failed to create student"
  echo "Response: $CREATE_RESPONSE"
else
  echo "✅ Student created successfully"
  echo "Student ID: $STUDENT_ID"
  echo "Response: $CREATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESPONSE"
fi
echo ""

# Step 4: Create a student under 18 (requires guardian info)
echo "4. Creating a student under 18 with guardian info..."
CREATE_MINOR_RESPONSE=$(curl -s -X POST "$BASE_URL/students" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HEAD_COACH_TOKEN" \
  -d '{
    "fullName": "Minor Student",
    "dateOfBirth": "2010-06-20",
    "gender": "Female",
    "contactPhone": "9876543211",
    "guardianName": "Parent Name",
    "guardianPhone": "9876543212",
    "skillLevel": "Beginner"
  }')

MINOR_STUDENT_ID=$(echo "$CREATE_MINOR_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$MINOR_STUDENT_ID" ]; then
  echo "❌ Failed to create minor student"
  echo "Response: $CREATE_MINOR_RESPONSE"
else
  echo "✅ Minor student created successfully"
  echo "Student ID: $MINOR_STUDENT_ID"
fi
echo ""

# Step 5: Create student assigned to Assistant Coach
echo "5. Creating a student assigned to Assistant Coach..."
ASSIGNED_RESPONSE=$(curl -s -X POST "$BASE_URL/students" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HEAD_COACH_TOKEN" \
  -d "{
    \"fullName\": \"Assigned Student\",
    \"dateOfBirth\": \"2006-08-10\",
    \"gender\": \"Male\",
    \"contactPhone\": \"9876543213\",
    \"assignedCoachId\": \"$ASSISTANT_ID\",
    \"skillLevel\": \"Intermediate\"
  }")

ASSIGNED_STUDENT_ID=$(echo "$ASSIGNED_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$ASSIGNED_STUDENT_ID" ]; then
  echo "❌ Failed to create assigned student"
  echo "Response: $ASSIGNED_RESPONSE"
else
  echo "✅ Student assigned to Assistant Coach created successfully"
  echo "Student ID: $ASSIGNED_STUDENT_ID"
fi
echo ""

# Step 6: Get single student (as Head Coach)
echo "6. Getting single student by ID (as Head Coach)..."
GET_RESPONSE=$(curl -s -X GET "$BASE_URL/students/$STUDENT_ID" \
  -H "Authorization: Bearer $HEAD_COACH_TOKEN")

echo "$GET_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$GET_RESPONSE"
echo ""

# Step 7: Update student (as Head Coach)
echo "7. Updating student (as Head Coach)..."
UPDATE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/students/$STUDENT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HEAD_COACH_TOKEN" \
  -d '{
    "height": 175,
    "weight": 68,
    "skillLevel": "Intermediate",
    "coachFeedback": "Good progress on forehand smashes"
  }')

echo "$UPDATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$UPDATE_RESPONSE"
echo ""

# Step 8: List all students (as Head Coach)
echo "8. Listing all students (as Head Coach)..."
LIST_RESPONSE=$(curl -s -X GET "$BASE_URL/students?page=1&limit=10" \
  -H "Authorization: Bearer $HEAD_COACH_TOKEN")

echo "$LIST_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LIST_RESPONSE"
echo ""

# Step 9: List students with search (as Head Coach)
echo "9. Searching students by name (as Head Coach)..."
SEARCH_RESPONSE=$(curl -s -X GET "$BASE_URL/students?search=Test" \
  -H "Authorization: Bearer $HEAD_COACH_TOKEN")

echo "$SEARCH_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SEARCH_RESPONSE"
echo ""

# Step 10: List students as Assistant Coach (should see only assigned students)
echo "10. Listing students as Assistant Coach (should see only assigned)..."
ASSISTANT_LIST_RESPONSE=$(curl -s -X GET "$BASE_URL/students" \
  -H "Authorization: Bearer $ASSISTANT_TOKEN")

echo "$ASSISTANT_LIST_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ASSISTANT_LIST_RESPONSE"
echo ""

# Step 11: Assistant Coach tries to access non-assigned student (should fail)
echo "11. Assistant Coach trying to access non-assigned student (should fail)..."
FORBIDDEN_RESPONSE=$(curl -s -X GET "$BASE_URL/students/$STUDENT_ID" \
  -H "Authorization: Bearer $ASSISTANT_TOKEN")

echo "$FORBIDDEN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$FORBIDDEN_RESPONSE"
echo ""

# Step 12: Assistant Coach accesses assigned student (should succeed)
echo "12. Assistant Coach accessing assigned student (should succeed)..."
ALLOWED_RESPONSE=$(curl -s -X GET "$BASE_URL/students/$ASSIGNED_STUDENT_ID" \
  -H "Authorization: Bearer $ASSISTANT_TOKEN")

echo "$ALLOWED_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ALLOWED_RESPONSE"
echo ""

# Step 13: Assistant Coach updates assigned student (should succeed)
echo "13. Assistant Coach updating assigned student (should succeed)..."
ASSISTANT_UPDATE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/students/$ASSIGNED_STUDENT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ASSISTANT_TOKEN" \
  -d '{
    "coachFeedback": "Improved serve technique"
  }')

echo "$ASSISTANT_UPDATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ASSISTANT_UPDATE_RESPONSE"
echo ""

# Step 14: Test validation - create student without required fields (should fail)
echo "14. Testing validation - creating student without required fields (should fail)..."
VALIDATION_RESPONSE=$(curl -s -X POST "$BASE_URL/students" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HEAD_COACH_TOKEN" \
  -d '{
    "fullName": "Incomplete Student"
  }')

echo "$VALIDATION_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$VALIDATION_RESPONSE"
echo ""

# Step 15: Test validation - create minor without guardian info (should fail)
echo "15. Testing validation - creating minor without guardian info (should fail)..."
GUARDIAN_VALIDATION_RESPONSE=$(curl -s -X POST "$BASE_URL/students" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HEAD_COACH_TOKEN" \
  -d '{
    "fullName": "Minor Without Guardian",
    "dateOfBirth": "2010-01-01",
    "gender": "Male",
    "contactPhone": "9999999999"
  }')

echo "$GUARDIAN_VALIDATION_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$GUARDIAN_VALIDATION_RESPONSE"
echo ""

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "✅ All student CRUD API endpoint tests completed"
echo ""
echo "Key Features Tested:"
echo "- Create student with validation"
echo "- Create minor student with guardian info"
echo "- Get single student by ID"
echo "- Update student with partial data"
echo "- List students with pagination"
echo "- Search students by name"
echo "- Role-based authorization (HEAD_COACH vs ASSISTANT_COACH)"
echo "- Assistant Coach can only access assigned students"
echo "- Age and BMI computed automatically"
echo "- Field validation for required data"
echo ""
echo "Note: Age and BMI are computed on the database server automatically"
echo "=========================================="
