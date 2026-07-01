#!/bin/bash

# Test script for curriculum and training log endpoints
# This script tests all endpoints for Task 52

BASE_URL="http://localhost:5000/api"

echo "=========================================="
echo "Testing Curriculum & Training Log Endpoints"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Login as Head Coach to get JWT token
echo -e "${YELLOW}1. Logging in as Head Coach...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "headcoach",
    "password": "password123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Failed to login${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Login successful${NC}"
echo ""

# Get a student ID for testing
echo -e "${YELLOW}2. Fetching a student ID for testing...${NC}"
STUDENTS_RESPONSE=$(curl -s -X GET "$BASE_URL/students?limit=1" \
  -H "Authorization: Bearer $TOKEN")

STUDENT_ID=$(echo $STUDENTS_RESPONSE | grep -oE '"id":"[^"]*"' | sed -n '1p' | cut -d'"' -f4)

if [ -z "$STUDENT_ID" ]; then
  echo -e "${RED}❌ Failed to get student ID${NC}"
  echo "Response: $STUDENTS_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Student ID: $STUDENT_ID${NC}"
echo ""

# Get a batch ID for testing
echo -e "${YELLOW}3. Fetching students to find a batch ID...${NC}"
BATCH_ID=$(echo $STUDENTS_RESPONSE | grep -oE '"batchId":"[^"]*"' | sed -n '1p' | cut -d'"' -f4)

if [ -z "$BATCH_ID" ]; then
  echo -e "${YELLOW}⚠ No batch ID found in student data${NC}"
  # Use null for testing individual plan
  BATCH_ID="null"
fi

echo -e "${GREEN}✓ Batch ID: $BATCH_ID${NC}"
echo ""

# Test 1: Create a curriculum plan for an individual student
echo -e "${YELLOW}4. Creating individual curriculum plan...${NC}"
CURRICULUM_RESPONSE=$(curl -s -X POST "$BASE_URL/curriculum" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cycleKey": "Jan-Feb 2026",
    "studentId": "'$STUDENT_ID'",
    "weeks": [
      {
        "weekNumber": 1,
        "focusArea": "Basic Footwork",
        "drills": [
          {
            "id": "drill-1",
            "name": "Shadow Footwork",
            "description": "Practice court movement without shuttlecock",
            "category": "Footwork"
          }
        ],
        "objective": "Master basic court movement patterns"
      },
      {
        "weekNumber": 2,
        "focusArea": "Forehand Technique",
        "drills": [
          {
            "id": "drill-2",
            "name": "Forehand Clear Practice",
            "description": "Focus on proper forehand clear technique",
            "category": "Stroke Practice"
          }
        ],
        "objective": "Develop consistent forehand clear"
      },
      {
        "weekNumber": 3,
        "focusArea": "Service Practice",
        "drills": [],
        "objective": "Improve service accuracy"
      },
      {
        "weekNumber": 4,
        "focusArea": "Net Play",
        "drills": [],
        "objective": "Master net shots"
      },
      {
        "weekNumber": 5,
        "focusArea": "Smash Technique",
        "drills": [],
        "objective": "Develop powerful smash"
      },
      {
        "weekNumber": 6,
        "focusArea": "Defense",
        "drills": [],
        "objective": "Improve defensive positioning"
      },
      {
        "weekNumber": 7,
        "focusArea": "Combination Play",
        "drills": [],
        "objective": "Link multiple shots"
      },
      {
        "weekNumber": 8,
        "focusArea": "Match Practice",
        "drills": [],
        "objective": "Apply skills in game situations"
      }
    ]
  }')

CURRICULUM_ID=$(echo $CURRICULUM_RESPONSE | grep -oE '"id":"[^"]*"' | sed -n '1p' | cut -d'"' -f4)

if [ -z "$CURRICULUM_ID" ]; then
  echo -e "${RED}❌ Failed to create curriculum plan${NC}"
  echo "Response: $CURRICULUM_RESPONSE"
else
  echo -e "${GREEN}✓ Curriculum plan created with ID: $CURRICULUM_ID${NC}"
fi
echo ""

# Test 2: Get curriculum plans by student ID
echo -e "${YELLOW}5. Fetching curriculum plans for student...${NC}"
GET_CURRICULUM_RESPONSE=$(curl -s -X GET "$BASE_URL/curriculum?studentId=$STUDENT_ID" \
  -H "Authorization: Bearer $TOKEN")

echo $GET_CURRICULUM_RESPONSE | grep -q '"id"'
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Successfully retrieved curriculum plans${NC}"
else
  echo -e "${RED}❌ Failed to retrieve curriculum plans${NC}"
  echo "Response: $GET_CURRICULUM_RESPONSE"
fi
echo ""

# Test 3: Update the curriculum plan
if [ ! -z "$CURRICULUM_ID" ]; then
  echo -e "${YELLOW}6. Updating curriculum plan...${NC}"
  UPDATE_CURRICULUM_RESPONSE=$(curl -s -X PATCH "$BASE_URL/curriculum/$CURRICULUM_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "isArchived": false
    }')

  echo $UPDATE_CURRICULUM_RESPONSE | grep -q '"id"'
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully updated curriculum plan${NC}"
  else
    echo -e "${RED}❌ Failed to update curriculum plan${NC}"
    echo "Response: $UPDATE_CURRICULUM_RESPONSE"
  fi
  echo ""
fi

# Test 4: Create a training log
echo -e "${YELLOW}7. Creating training log...${NC}"
TRAINING_LOG_RESPONSE=$(curl -s -X POST "$BASE_URL/training-logs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "'$STUDENT_ID'",
    "weekNumber": 3,
    "cycleKey": "Jan-Feb 2026",
    "sessionNotes": "Student showed good progress in footwork drills. Need to focus more on proper stance.",
    "isCompleted": true
  }')

TRAINING_LOG_ID=$(echo $TRAINING_LOG_RESPONSE | grep -oE '"id":"[^"]*"' | sed -n '1p' | cut -d'"' -f4)

if [ -z "$TRAINING_LOG_ID" ]; then
  echo -e "${RED}❌ Failed to create training log${NC}"
  echo "Response: $TRAINING_LOG_RESPONSE"
else
  echo -e "${GREEN}✓ Training log created with ID: $TRAINING_LOG_ID${NC}"
fi
echo ""

# Test 5: Get training logs by student ID
echo -e "${YELLOW}8. Fetching training logs for student...${NC}"
GET_LOGS_RESPONSE=$(curl -s -X GET "$BASE_URL/training-logs?studentId=$STUDENT_ID" \
  -H "Authorization: Bearer $TOKEN")

echo $GET_LOGS_RESPONSE | grep -q '"id"'
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Successfully retrieved training logs${NC}"
else
  echo -e "${RED}❌ Failed to retrieve training logs${NC}"
  echo "Response: $GET_LOGS_RESPONSE"
fi
echo ""

# Test 6: Get training logs by cycle key
echo -e "${YELLOW}9. Fetching training logs by cycle key...${NC}"
GET_LOGS_BY_CYCLE_RESPONSE=$(curl -s -X GET "$BASE_URL/training-logs?cycleKey=Jan-Feb%202026" \
  -H "Authorization: Bearer $TOKEN")

echo $GET_LOGS_BY_CYCLE_RESPONSE | grep -q '"id"'
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Successfully retrieved training logs by cycle${NC}"
else
  echo -e "${YELLOW}⚠ No training logs found for cycle (this is okay)${NC}"
fi
echo ""

# Test 7: Update training log
if [ ! -z "$TRAINING_LOG_ID" ]; then
  echo -e "${YELLOW}10. Updating training log...${NC}"
  UPDATE_LOG_RESPONSE=$(curl -s -X PATCH "$BASE_URL/training-logs/$TRAINING_LOG_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "sessionNotes": "Updated notes: Student mastered basic footwork patterns.",
      "isCompleted": true
    }')

  echo $UPDATE_LOG_RESPONSE | grep -q '"id"'
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully updated training log${NC}"
  else
    echo -e "${RED}❌ Failed to update training log${NC}"
    echo "Response: $UPDATE_LOG_RESPONSE"
  fi
  echo ""
fi

echo "=========================================="
echo -e "${GREEN}All tests completed!${NC}"
echo "=========================================="
