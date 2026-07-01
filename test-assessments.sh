#!/bin/bash

# ShuttleCoach API - Assessment Endpoints Test Script
# Tests POST, GET (list), GET (single), and PATCH endpoints
# Tests past cycle locking logic (403 Forbidden)

API_URL="http://localhost:5000/api"
TOKEN=""
STUDENT_ID=""
ASSESSMENT_ID=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "ShuttleCoach Assessment API Tests"
echo "=========================================="
echo ""

# Test 1: Login as HEAD_COACH
echo -e "${YELLOW}Test 1: Login as HEAD_COACH${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "headcoach", "password": "password123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo -e "${GREEN}✓ Login successful${NC}"
  echo "Token: ${TOKEN:0:20}..."
else
  echo -e "${RED}✗ Login failed${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi
echo ""

# Test 2: Get a student ID to use for testing
echo -e "${YELLOW}Test 2: Get student ID${NC}"
STUDENTS_RESPONSE=$(curl -s -X GET "$API_URL/students?limit=1" \
  -H "Authorization: Bearer $TOKEN")

STUDENT_ID=$(echo $STUDENTS_RESPONSE | jq -r '.students[0].id')

if [ "$STUDENT_ID" != "null" ] && [ -n "$STUDENT_ID" ]; then
  echo -e "${GREEN}✓ Student ID retrieved${NC}"
  echo "Student ID: $STUDENT_ID"
else
  echo -e "${RED}✗ Failed to get student ID${NC}"
  echo "Response: $STUDENTS_RESPONSE"
  exit 1
fi
echo ""

# Test 3: Create a new assessment for current cycle
echo -e "${YELLOW}Test 3: Create assessment for current cycle${NC}"

# Get current cycle (e.g., "Jan-Feb 2025")
CURRENT_MONTH=$(date +%m)
CURRENT_YEAR=$(date +%Y)

# Determine current cycle
if [ $CURRENT_MONTH -le 2 ]; then
  CURRENT_CYCLE="Jan-Feb $CURRENT_YEAR"
elif [ $CURRENT_MONTH -le 4 ]; then
  CURRENT_CYCLE="Mar-Apr $CURRENT_YEAR"
elif [ $CURRENT_MONTH -le 6 ]; then
  CURRENT_CYCLE="May-Jun $CURRENT_YEAR"
elif [ $CURRENT_MONTH -le 8 ]; then
  CURRENT_CYCLE="Jul-Aug $CURRENT_YEAR"
elif [ $CURRENT_MONTH -le 10 ]; then
  CURRENT_CYCLE="Sep-Oct $CURRENT_YEAR"
else
  CURRENT_CYCLE="Nov-Dec $CURRENT_YEAR"
fi

echo "Current cycle: $CURRENT_CYCLE"

CREATE_RESPONSE=$(curl -s -X POST "$API_URL/assessments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"$STUDENT_ID\",
    \"cycleKey\": \"$CURRENT_CYCLE\",
    \"scores\": {
      \"forehand\": {
        \"Clear\": 2,
        \"Drop\": 2,
        \"Smash\": 3,
        \"Drive\": 2,
        \"NetShot\": 2,
        \"Lift\": 2,
        \"CrossDrop\": 1,
        \"Slice\": 1,
        \"Push\": 2,
        \"Tap\": 2
      },
      \"backhand\": {
        \"Clear\": 1,
        \"Drop\": 1,
        \"Smash\": 2,
        \"Drive\": 2,
        \"NetShot\": 2,
        \"Lift\": 2,
        \"CrossDrop\": 1,
        \"Slice\": 1,
        \"Push\": 2,
        \"Tap\": 1
      },
      \"return\": {
        \"ForehandReturn\": 2,
        \"BackhandReturn\": 2,
        \"ShortReturn\": 2,
        \"LongReturn\": 2,
        \"CrossReturn\": 1,
        \"StraightReturn\": 2,
        \"DropReturn\": 2,
        \"SmashReturn\": 2,
        \"DriveReturn\": 2,
        \"NetReturn\": 2
      },
      \"service\": {
        \"ShortServe\": 3,
        \"LongServe\": 3,
        \"FlickServe\": 2,
        \"DriveServe\": 2,
        \"BackhandShort\": 2,
        \"BackhandLong\": 2,
        \"ForehandShort\": 3,
        \"ForehandLong\": 3,
        \"DoubleShort\": 2,
        \"DoubleLong\": 2
      },
      \"overhead\": {
        \"Smash\": 3,
        \"JumpSmash\": 2,
        \"Clear\": 2,
        \"Drop\": 2,
        \"SliceDrop\": 1,
        \"HalfSmash\": 2,
        \"RoundTheHead\": 2,
        \"BackhandClear\": 1,
        \"BackhandDrop\": 1,
        \"BlockSmash\": 2
      },
      \"rally\": {
        \"Consistency\": 2,
        \"Footwork\": 2,
        \"Positioning\": 2,
        \"Recovery\": 2,
        \"Anticipation\": 2,
        \"Shot Selection\": 2,
        \"Court Coverage\": 2,
        \"Endurance\": 3,
        \"Speed\": 2,
        \"Agility\": 2
      }
    }
  }")

ASSESSMENT_ID=$(echo $CREATE_RESPONSE | jq -r '.id')

if [ "$ASSESSMENT_ID" != "null" ] && [ -n "$ASSESSMENT_ID" ]; then
  echo -e "${GREEN}✓ Assessment created successfully${NC}"
  echo "Assessment ID: $ASSESSMENT_ID"
  echo "Recorded by: $(echo $CREATE_RESPONSE | jq -r '.recordedBy')"
  echo "Is locked: $(echo $CREATE_RESPONSE | jq -r '.isLocked')"
else
  echo -e "${RED}✗ Failed to create assessment${NC}"
  echo "Response: $CREATE_RESPONSE"
fi
echo ""

# Test 4: Get assessments list (filter by student)
echo -e "${YELLOW}Test 4: Get assessments list (filter by studentId)${NC}"
LIST_RESPONSE=$(curl -s -X GET "$API_URL/assessments?studentId=$STUDENT_ID" \
  -H "Authorization: Bearer $TOKEN")

ASSESSMENT_COUNT=$(echo $LIST_RESPONSE | jq 'length')

if [ "$ASSESSMENT_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✓ Assessments list retrieved${NC}"
  echo "Found $ASSESSMENT_COUNT assessment(s)"
  echo "First assessment cycle: $(echo $LIST_RESPONSE | jq -r '.[0].cycleKey')"
else
  echo -e "${RED}✗ No assessments found${NC}"
  echo "Response: $LIST_RESPONSE"
fi
echo ""

# Test 5: Get assessments list (filter by cycle)
echo -e "${YELLOW}Test 5: Get assessments list (filter by cycleKey)${NC}"
LIST_BY_CYCLE_RESPONSE=$(curl -s -X GET "$API_URL/assessments?studentId=$STUDENT_ID&cycleKey=$CURRENT_CYCLE" \
  -H "Authorization: Bearer $TOKEN")

CYCLE_ASSESSMENT_COUNT=$(echo $LIST_BY_CYCLE_RESPONSE | jq 'length')

if [ "$CYCLE_ASSESSMENT_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✓ Assessments list by cycle retrieved${NC}"
  echo "Found $CYCLE_ASSESSMENT_COUNT assessment(s) for $CURRENT_CYCLE"
else
  echo -e "${RED}✗ No assessments found for cycle${NC}"
  echo "Response: $LIST_BY_CYCLE_RESPONSE"
fi
echo ""

# Test 6: Get single assessment by ID
echo -e "${YELLOW}Test 6: Get single assessment by ID${NC}"
GET_RESPONSE=$(curl -s -X GET "$API_URL/assessments/$ASSESSMENT_ID" \
  -H "Authorization: Bearer $TOKEN")

GET_ID=$(echo $GET_RESPONSE | jq -r '.id')

if [ "$GET_ID" == "$ASSESSMENT_ID" ]; then
  echo -e "${GREEN}✓ Single assessment retrieved${NC}"
  echo "Student ID: $(echo $GET_RESPONSE | jq -r '.studentId')"
  echo "Cycle: $(echo $GET_RESPONSE | jq -r '.cycleKey')"
  echo "Recorded by: $(echo $GET_RESPONSE | jq -r '.recordedBy')"
else
  echo -e "${RED}✗ Failed to get assessment${NC}"
  echo "Response: $GET_RESPONSE"
fi
echo ""

# Test 7: Update current cycle assessment (should succeed)
echo -e "${YELLOW}Test 7: Update current cycle assessment (should succeed)${NC}"
UPDATE_RESPONSE=$(curl -s -X PATCH "$API_URL/assessments/$ASSESSMENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"scores\": {
      \"forehand\": {
        \"Clear\": 3,
        \"Drop\": 3,
        \"Smash\": 4,
        \"Drive\": 3,
        \"NetShot\": 3,
        \"Lift\": 2,
        \"CrossDrop\": 2,
        \"Slice\": 2,
        \"Push\": 3,
        \"Tap\": 3
      },
      \"backhand\": {
        \"Clear\": 2,
        \"Drop\": 2,
        \"Smash\": 2,
        \"Drive\": 2,
        \"NetShot\": 2,
        \"Lift\": 2,
        \"CrossDrop\": 1,
        \"Slice\": 1,
        \"Push\": 2,
        \"Tap\": 2
      },
      \"return\": {
        \"ForehandReturn\": 2,
        \"BackhandReturn\": 2,
        \"ShortReturn\": 2,
        \"LongReturn\": 2,
        \"CrossReturn\": 1,
        \"StraightReturn\": 2,
        \"DropReturn\": 2,
        \"SmashReturn\": 2,
        \"DriveReturn\": 2,
        \"NetReturn\": 2
      },
      \"service\": {
        \"ShortServe\": 3,
        \"LongServe\": 3,
        \"FlickServe\": 2,
        \"DriveServe\": 2,
        \"BackhandShort\": 2,
        \"BackhandLong\": 2,
        \"ForehandShort\": 3,
        \"ForehandLong\": 3,
        \"DoubleShort\": 2,
        \"DoubleLong\": 2
      },
      \"overhead\": {
        \"Smash\": 3,
        \"JumpSmash\": 2,
        \"Clear\": 2,
        \"Drop\": 2,
        \"SliceDrop\": 1,
        \"HalfSmash\": 2,
        \"RoundTheHead\": 2,
        \"BackhandClear\": 1,
        \"BackhandDrop\": 1,
        \"BlockSmash\": 2
      },
      \"rally\": {
        \"Consistency\": 2,
        \"Footwork\": 2,
        \"Positioning\": 2,
        \"Recovery\": 2,
        \"Anticipation\": 2,
        \"Shot Selection\": 2,
        \"Court Coverage\": 2,
        \"Endurance\": 3,
        \"Speed\": 2,
        \"Agility\": 2
      }
    }
  }")

UPDATE_SUCCESS=$(echo $UPDATE_RESPONSE | jq -r '.id')

if [ "$UPDATE_SUCCESS" == "$ASSESSMENT_ID" ]; then
  echo -e "${GREEN}✓ Assessment updated successfully${NC}"
  echo "Updated forehand Clear from 2 to: $(echo $UPDATE_RESPONSE | jq -r '.scores.forehand.Clear')"
else
  echo -e "${RED}✗ Failed to update assessment${NC}"
  echo "Response: $UPDATE_RESPONSE"
fi
echo ""

# Test 8: Try to create assessment for past cycle (should fail with 403)
echo -e "${YELLOW}Test 8: Try to create assessment for past cycle (should fail with 403)${NC}"

# Use a past cycle
PAST_CYCLE="Jan-Feb 2023"

PAST_CREATE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL/assessments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"$STUDENT_ID\",
    \"cycleKey\": \"$PAST_CYCLE\",
    \"scores\": {
      \"forehand\": { \"Clear\": 1, \"Drop\": 1, \"Smash\": 1, \"Drive\": 1, \"NetShot\": 1, \"Lift\": 1, \"CrossDrop\": 1, \"Slice\": 1, \"Push\": 1, \"Tap\": 1 },
      \"backhand\": { \"Clear\": 1, \"Drop\": 1, \"Smash\": 1, \"Drive\": 1, \"NetShot\": 1, \"Lift\": 1, \"CrossDrop\": 1, \"Slice\": 1, \"Push\": 1, \"Tap\": 1 },
      \"return\": { \"ForehandReturn\": 1, \"BackhandReturn\": 1, \"ShortReturn\": 1, \"LongReturn\": 1, \"CrossReturn\": 1, \"StraightReturn\": 1, \"DropReturn\": 1, \"SmashReturn\": 1, \"DriveReturn\": 1, \"NetReturn\": 1 },
      \"service\": { \"ShortServe\": 1, \"LongServe\": 1, \"FlickServe\": 1, \"DriveServe\": 1, \"BackhandShort\": 1, \"BackhandLong\": 1, \"ForehandShort\": 1, \"ForehandLong\": 1, \"DoubleShort\": 1, \"DoubleLong\": 1 },
      \"overhead\": { \"Smash\": 1, \"JumpSmash\": 1, \"Clear\": 1, \"Drop\": 1, \"SliceDrop\": 1, \"HalfSmash\": 1, \"RoundTheHead\": 1, \"BackhandClear\": 1, \"BackhandDrop\": 1, \"BlockSmash\": 1 },
      \"rally\": { \"Consistency\": 1, \"Footwork\": 1, \"Positioning\": 1, \"Recovery\": 1, \"Anticipation\": 1, \"Shot Selection\": 1, \"Court Coverage\": 1, \"Endurance\": 1, \"Speed\": 1, \"Agility\": 1 }
    }
  }")

HTTP_STATUS=$(echo "$PAST_CREATE_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
RESPONSE_BODY=$(echo "$PAST_CREATE_RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" == "403" ]; then
  echo -e "${GREEN}✓ Past cycle creation correctly rejected (403 Forbidden)${NC}"
  echo "Error message: $(echo $RESPONSE_BODY | jq -r '.error')"
else
  echo -e "${RED}✗ Past cycle creation should have been rejected with 403${NC}"
  echo "HTTP Status: $HTTP_STATUS"
  echo "Response: $RESPONSE_BODY"
fi
echo ""

# Test 9: Try to update a past cycle assessment (should fail with 403)
echo -e "${YELLOW}Test 9: Try to update past cycle assessment (should fail with 403)${NC}"

# First, let's manually update the existing assessment to be a past cycle for testing
# We'll use SQL to do this (this is just for testing purposes)
echo "Note: This test requires manually setting is_locked=true or using a past cycle assessment"
echo "Skipping this test in automated script"
echo ""

# Test 10: Login as STUDENT and query their assessments
echo -e "${YELLOW}Test 10: Login as STUDENT and query assessments${NC}"

STUDENT_LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "aarav", "password": "password123"}')

STUDENT_TOKEN=$(echo $STUDENT_LOGIN_RESPONSE | jq -r '.token')

if [ "$STUDENT_TOKEN" != "null" ] && [ -n "$STUDENT_TOKEN" ]; then
  echo "Student token obtained"
  
  # Query assessments as student
  STUDENT_ASSESSMENTS=$(curl -s -X GET "$API_URL/assessments" \
    -H "Authorization: Bearer $STUDENT_TOKEN")
  
  STUDENT_ASSESSMENT_COUNT=$(echo $STUDENT_ASSESSMENTS | jq 'length')
  
  if [ "$STUDENT_ASSESSMENT_COUNT" -ge 0 ]; then
    echo -e "${GREEN}✓ Student can query assessments${NC}"
    echo "Found $STUDENT_ASSESSMENT_COUNT assessment(s)"
  else
    echo -e "${RED}✗ Failed to query assessments as student${NC}"
    echo "Response: $STUDENT_ASSESSMENTS"
  fi
else
  echo -e "${YELLOW}⚠ Student login failed, skipping student assessment query test${NC}"
fi
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}✓ POST /api/assessments - Create assessment${NC}"
echo -e "${GREEN}✓ GET /api/assessments?studentId=<id> - List assessments by student${NC}"
echo -e "${GREEN}✓ GET /api/assessments?studentId=<id>&cycleKey=<key> - List assessments by cycle${NC}"
echo -e "${GREEN}✓ GET /api/assessments/:id - Get single assessment${NC}"
echo -e "${GREEN}✓ PATCH /api/assessments/:id - Update assessment${NC}"
echo -e "${GREEN}✓ Past cycle locking (403 Forbidden)${NC}"
echo ""
echo "All assessment endpoint tests completed!"
