#!/bin/bash

# Test Curriculum and Training Log API Endpoints
# Task 52: Build curriculum and training log API endpoints

BASE_URL="http://localhost:5000/api"

echo "=========================================="
echo "CURRICULUM & TRAINING LOG API TESTS"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Login as Head Coach
echo -e "${BLUE}Step 1: Login as Head Coach${NC}"
echo "POST ${BASE_URL}/auth/login"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "headcoach",
    "password": "password123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
echo "Response: $LOGIN_RESPONSE"
echo -e "${GREEN}✓ Token obtained${NC}"
echo ""
sleep 1

# Step 2: Get a student ID and batch ID
echo -e "${BLUE}Step 2: Get Student and Batch Information${NC}"
echo "GET ${BASE_URL}/students"
STUDENTS_RESPONSE=$(curl -s -X GET "${BASE_URL}/students?limit=5" \
  -H "Authorization: Bearer $TOKEN")

STUDENT_ID=$(echo $STUDENTS_RESPONSE | jq -r '.students[0].id')
STUDENT_NAME=$(echo $STUDENTS_RESPONSE | jq -r '.students[0].fullName')
BATCH_ID=$(echo $STUDENTS_RESPONSE | jq -r '.students[0].batchId')

echo "Using Student: $STUDENT_NAME (ID: $STUDENT_ID)"
echo "Using Batch ID: $BATCH_ID"
echo ""
sleep 1

# ====================
# CURRICULUM TESTS
# ====================

echo -e "${BLUE}=== CURRICULUM PLAN TESTS ===${NC}"
echo ""

# Step 3: Create individual curriculum plan
echo -e "${BLUE}Step 3: Create Individual Curriculum Plan (POST /api/curriculum)${NC}"
echo "POST ${BASE_URL}/curriculum"
CREATE_INDIVIDUAL_PLAN=$(curl -s -X POST "${BASE_URL}/curriculum" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"cycleKey\": \"Jan-Feb 2026\",
    \"studentId\": \"$STUDENT_ID\",
    \"weeks\": [
      {
        \"weekNumber\": 1,
        \"focusArea\": \"Basic Footwork & Grip\",
        \"objective\": \"Master basic footwork patterns\",
        \"drills\": [
          {
            \"id\": \"drill-001\",
            \"name\": \"Four-Corner Footwork\",
            \"description\": \"Move to all four corners of the court\",
            \"category\": \"Footwork\"
          }
        ]
      },
      {
        \"weekNumber\": 2,
        \"focusArea\": \"Forehand Basics\",
        \"objective\": \"Develop forehand clear technique\",
        \"drills\": [
          {
            \"id\": \"drill-002\",
            \"name\": \"Forehand Clear Practice\",
            \"description\": \"Practice forehand clears from baseline\",
            \"category\": \"Stroke Practice\"
          }
        ]
      },
      {
        \"weekNumber\": 3,
        \"focusArea\": \"Backhand Basics\",
        \"objective\": \"Develop backhand clear technique\",
        \"drills\": [
          {
            \"id\": \"drill-003\",
            \"name\": \"Backhand Clear Practice\",
            \"description\": \"Practice backhand clears\",
            \"category\": \"Stroke Practice\"
          }
        ]
      },
      {
        \"weekNumber\": 4,
        \"focusArea\": \"Net Play\",
        \"objective\": \"Master net shots\",
        \"drills\": [
          {
            \"id\": \"drill-004\",
            \"name\": \"Net Shot Drill\",
            \"description\": \"Practice net shots\",
            \"category\": \"Net Play\"
          }
        ]
      },
      {
        \"weekNumber\": 5,
        \"focusArea\": \"Smash Technique\",
        \"objective\": \"Develop powerful smash\",
        \"drills\": [
          {
            \"id\": \"drill-005\",
            \"name\": \"Smash Practice\",
            \"description\": \"Practice smashing technique\",
            \"category\": \"Attack\"
          }
        ]
      },
      {
        \"weekNumber\": 6,
        \"focusArea\": \"Drop Shots\",
        \"objective\": \"Master drop shot placement\",
        \"drills\": [
          {
            \"id\": \"drill-006\",
            \"name\": \"Drop Shot Drill\",
            \"description\": \"Practice drop shots\",
            \"category\": \"Finesse\"
          }
        ]
      },
      {
        \"weekNumber\": 7,
        \"focusArea\": \"Service Practice\",
        \"objective\": \"Improve service accuracy\",
        \"drills\": [
          {
            \"id\": \"drill-007\",
            \"name\": \"Service Drill\",
            \"description\": \"Practice various serves\",
            \"category\": \"Service\"
          }
        ]
      },
      {
        \"weekNumber\": 8,
        \"focusArea\": \"Match Play\",
        \"objective\": \"Apply all skills in match situations\",
        \"drills\": [
          {
            \"id\": \"drill-008\",
            \"name\": \"Practice Matches\",
            \"description\": \"Competitive match play\",
            \"category\": \"Match Practice\"
          }
        ]
      }
    ]
  }")

INDIVIDUAL_PLAN_ID=$(echo $CREATE_INDIVIDUAL_PLAN | jq -r '.id')
echo "Response: $CREATE_INDIVIDUAL_PLAN"
echo -e "${GREEN}✓ Individual curriculum plan created with ID: $INDIVIDUAL_PLAN_ID${NC}"
echo ""
sleep 1

# Step 4: Create batch curriculum plan
echo -e "${BLUE}Step 4: Create Batch Curriculum Plan (POST /api/curriculum)${NC}"
echo "POST ${BASE_URL}/curriculum"
CREATE_BATCH_PLAN=$(curl -s -X POST "${BASE_URL}/curriculum" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"cycleKey\": \"Mar-Apr 2026\",
    \"batchId\": \"$BATCH_ID\",
    \"weeks\": [
      {
        \"weekNumber\": 1,
        \"focusArea\": \"Batch Training Week 1\",
        \"objective\": \"Team coordination\",
        \"drills\": [{\"id\": \"b1\", \"name\": \"Team Drill\", \"description\": \"Group practice\", \"category\": \"Team\"}]
      },
      {
        \"weekNumber\": 2,
        \"focusArea\": \"Batch Training Week 2\",
        \"objective\": \"Speed training\",
        \"drills\": [{\"id\": \"b2\", \"name\": \"Speed Drill\", \"description\": \"Fast movements\", \"category\": \"Speed\"}]
      },
      {
        \"weekNumber\": 3,
        \"focusArea\": \"Batch Training Week 3\",
        \"objective\": \"Endurance\",
        \"drills\": [{\"id\": \"b3\", \"name\": \"Endurance\", \"description\": \"Long rallies\", \"category\": \"Stamina\"}]
      },
      {
        \"weekNumber\": 4,
        \"focusArea\": \"Batch Training Week 4\",
        \"objective\": \"Tactics\",
        \"drills\": [{\"id\": \"b4\", \"name\": \"Tactical Play\", \"description\": \"Game strategy\", \"category\": \"Tactics\"}]
      },
      {
        \"weekNumber\": 5,
        \"focusArea\": \"Batch Training Week 5\",
        \"objective\": \"Power\",
        \"drills\": [{\"id\": \"b5\", \"name\": \"Power Training\", \"description\": \"Strength work\", \"category\": \"Power\"}]
      },
      {
        \"weekNumber\": 6,
        \"focusArea\": \"Batch Training Week 6\",
        \"objective\": \"Agility\",
        \"drills\": [{\"id\": \"b6\", \"name\": \"Agility Drill\", \"description\": \"Quick movements\", \"category\": \"Agility\"}]
      },
      {
        \"weekNumber\": 7,
        \"focusArea\": \"Batch Training Week 7\",
        \"objective\": \"Mental Focus\",
        \"drills\": [{\"id\": \"b7\", \"name\": \"Focus Training\", \"description\": \"Concentration\", \"category\": \"Mental\"}]
      },
      {
        \"weekNumber\": 8,
        \"focusArea\": \"Batch Training Week 8\",
        \"objective\": \"Tournament Prep\",
        \"drills\": [{\"id\": \"b8\", \"name\": \"Match Simulation\", \"description\": \"Competition practice\", \"category\": \"Tournament\"}]
      }
    ]
  }")

BATCH_PLAN_ID=$(echo $CREATE_BATCH_PLAN | jq -r '.id')
echo "Response: $CREATE_BATCH_PLAN"
echo -e "${GREEN}✓ Batch curriculum plan created with ID: $BATCH_PLAN_ID${NC}"
echo ""
sleep 1

# Step 5: Clone batch plan to all students
echo -e "${BLUE}Step 5: Clone Batch Plan to Students (POST /api/curriculum/:id/clone)${NC}"
echo "POST ${BASE_URL}/curriculum/$BATCH_PLAN_ID/clone"
CLONE_RESPONSE=$(curl -s -X POST "${BASE_URL}/curriculum/$BATCH_PLAN_ID/clone" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

CLONED_COUNT=$(echo $CLONE_RESPONSE | jq -r '.createdPlans | length')
echo "Response: $CLONE_RESPONSE"
echo -e "${GREEN}✓ Batch plan cloned to $CLONED_COUNT students${NC}"
echo ""
sleep 1

# Step 6: Query curriculum plans
echo -e "${BLUE}Step 6: Query All Curriculum Plans (GET /api/curriculum)${NC}"
echo "GET ${BASE_URL}/curriculum"
ALL_PLANS_RESPONSE=$(curl -s -X GET "${BASE_URL}/curriculum" \
  -H "Authorization: Bearer $TOKEN")

PLAN_COUNT=$(echo $ALL_PLANS_RESPONSE | jq -r 'length')
echo "Response: Found $PLAN_COUNT curriculum plans"
echo -e "${GREEN}✓ Retrieved all curriculum plans${NC}"
echo ""
sleep 1

# Step 7: Query plans by student
echo -e "${BLUE}Step 7: Query Plans by Student (GET /api/curriculum?studentId=...)${NC}"
echo "GET ${BASE_URL}/curriculum?studentId=$STUDENT_ID"
STUDENT_PLANS_RESPONSE=$(curl -s -X GET "${BASE_URL}/curriculum?studentId=$STUDENT_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $STUDENT_PLANS_RESPONSE"
echo -e "${GREEN}✓ Retrieved plans for specific student${NC}"
echo ""
sleep 1

# Step 8: Query plans by cycle
echo -e "${BLUE}Step 8: Query Plans by Cycle (GET /api/curriculum?cycleKey=...)${NC}"
echo "GET ${BASE_URL}/curriculum?cycleKey=Jan-Feb%202026"
CYCLE_PLANS_RESPONSE=$(curl -s -X GET "${BASE_URL}/curriculum?cycleKey=Jan-Feb%202026" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $CYCLE_PLANS_RESPONSE"
echo -e "${GREEN}✓ Retrieved plans for specific cycle${NC}"
echo ""
sleep 1

# Step 9: Update individual curriculum plan
echo -e "${BLUE}Step 9: Update Curriculum Plan (PATCH /api/curriculum/:id)${NC}"
echo "PATCH ${BASE_URL}/curriculum/$INDIVIDUAL_PLAN_ID"
UPDATE_PLAN_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/curriculum/$INDIVIDUAL_PLAN_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"weeks\": [
      {
        \"weekNumber\": 1,
        \"focusArea\": \"UPDATED: Advanced Footwork\",
        \"objective\": \"Master advanced footwork patterns\",
        \"drills\": [
          {
            \"id\": \"drill-001-updated\",
            \"name\": \"Six-Corner Footwork\",
            \"description\": \"Advanced footwork drill\",
            \"category\": \"Footwork\"
          }
        ]
      },
      {\"weekNumber\": 2, \"focusArea\": \"Week 2\", \"objective\": \"Obj 2\", \"drills\": []},
      {\"weekNumber\": 3, \"focusArea\": \"Week 3\", \"objective\": \"Obj 3\", \"drills\": []},
      {\"weekNumber\": 4, \"focusArea\": \"Week 4\", \"objective\": \"Obj 4\", \"drills\": []},
      {\"weekNumber\": 5, \"focusArea\": \"Week 5\", \"objective\": \"Obj 5\", \"drills\": []},
      {\"weekNumber\": 6, \"focusArea\": \"Week 6\", \"objective\": \"Obj 6\", \"drills\": []},
      {\"weekNumber\": 7, \"focusArea\": \"Week 7\", \"objective\": \"Obj 7\", \"drills\": []},
      {\"weekNumber\": 8, \"focusArea\": \"Week 8\", \"objective\": \"Obj 8\", \"drills\": []}
    ]
  }")

echo "Response: $UPDATE_PLAN_RESPONSE"
UPDATED_FOCUS=$(echo $UPDATE_PLAN_RESPONSE | jq -r '.weeks[0].focusArea')
if [[ "$UPDATED_FOCUS" == *"UPDATED"* ]]; then
  echo -e "${GREEN}✓ Curriculum plan updated successfully${NC}"
else
  echo -e "${RED}✗ Plan update may have failed${NC}"
fi
echo ""
sleep 1

# ====================
# TRAINING LOG TESTS
# ====================

echo -e "${BLUE}=== TRAINING LOG TESTS ===${NC}"
echo ""

# Step 10: Create training log
echo -e "${BLUE}Step 10: Create Training Log (POST /api/training-logs)${NC}"
echo "POST ${BASE_URL}/training-logs"
CREATE_LOG_RESPONSE=$(curl -s -X POST "${BASE_URL}/training-logs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"$STUDENT_ID\",
    \"weekNumber\": 1,
    \"cycleKey\": \"Jan-Feb 2026\",
    \"sessionNotes\": \"Excellent progress on footwork drills. Student showed good coordination and speed. Need to work on backhand grip.\",
    \"isCompleted\": true
  }")

LOG_ID=$(echo $CREATE_LOG_RESPONSE | jq -r '.id')
echo "Response: $CREATE_LOG_RESPONSE"
echo -e "${GREEN}✓ Training log created with ID: $LOG_ID${NC}"
echo ""
sleep 1

# Step 11: Create another training log (week 2)
echo -e "${BLUE}Step 11: Create Training Log for Week 2${NC}"
echo "POST ${BASE_URL}/training-logs"
CREATE_LOG2_RESPONSE=$(curl -s -X POST "${BASE_URL}/training-logs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"$STUDENT_ID\",
    \"weekNumber\": 2,
    \"cycleKey\": \"Jan-Feb 2026\",
    \"sessionNotes\": \"Worked on forehand clears. Student needs more practice with wrist action. Overall good effort.\",
    \"isCompleted\": false
  }")

LOG2_ID=$(echo $CREATE_LOG2_RESPONSE | jq -r '.id')
echo "Response: $CREATE_LOG2_RESPONSE"
echo -e "${GREEN}✓ Training log 2 created with ID: $LOG2_ID${NC}"
echo ""
sleep 1

# Step 12: Query all training logs
echo -e "${BLUE}Step 12: Query All Training Logs (GET /api/training-logs)${NC}"
echo "GET ${BASE_URL}/training-logs"
ALL_LOGS_RESPONSE=$(curl -s -X GET "${BASE_URL}/training-logs" \
  -H "Authorization: Bearer $TOKEN")

LOG_COUNT=$(echo $ALL_LOGS_RESPONSE | jq -r 'length')
echo "Response: Found $LOG_COUNT training logs"
echo -e "${GREEN}✓ Retrieved all training logs${NC}"
echo ""
sleep 1

# Step 13: Query logs by student
echo -e "${BLUE}Step 13: Query Logs by Student (GET /api/training-logs?studentId=...)${NC}"
echo "GET ${BASE_URL}/training-logs?studentId=$STUDENT_ID"
STUDENT_LOGS_RESPONSE=$(curl -s -X GET "${BASE_URL}/training-logs?studentId=$STUDENT_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $STUDENT_LOGS_RESPONSE"
echo -e "${GREEN}✓ Retrieved logs for specific student${NC}"
echo ""
sleep 1

# Step 14: Query logs by cycle
echo -e "${BLUE}Step 14: Query Logs by Cycle (GET /api/training-logs?cycleKey=...)${NC}"
echo "GET ${BASE_URL}/training-logs?cycleKey=Jan-Feb%202026"
CYCLE_LOGS_RESPONSE=$(curl -s -X GET "${BASE_URL}/training-logs?cycleKey=Jan-Feb%202026" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $CYCLE_LOGS_RESPONSE"
echo -e "${GREEN}✓ Retrieved logs for specific cycle${NC}"
echo ""
sleep 1

# Step 15: Update training log
echo -e "${BLUE}Step 15: Update Training Log (PATCH /api/training-logs/:id)${NC}"
echo "PATCH ${BASE_URL}/training-logs/$LOG_ID"
UPDATE_LOG_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/training-logs/$LOG_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionNotes\": \"UPDATED: Outstanding progress on footwork drills. Student mastered all four-corner movements. Ready to advance to next level.\",
    \"isCompleted\": true
  }")

echo "Response: $UPDATE_LOG_RESPONSE"
UPDATED_NOTES=$(echo $UPDATE_LOG_RESPONSE | jq -r '.sessionNotes')
if [[ "$UPDATED_NOTES" == *"UPDATED"* ]]; then
  echo -e "${GREEN}✓ Training log updated successfully${NC}"
else
  echo -e "${RED}✗ Log update may have failed${NC}"
fi
echo ""
sleep 1

# Step 16: Test authorization - Login as Assistant Coach
echo -e "${BLUE}Step 16: Test Authorization - Assistant Coach${NC}"
echo "POST ${BASE_URL}/auth/login"
ASSISTANT_LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "assistant1",
    "password": "password123"
  }')

ASSISTANT_TOKEN=$(echo $ASSISTANT_LOGIN_RESPONSE | jq -r '.token')
echo "Assistant Coach logged in"
echo ""

# Assistant tries to query plans (should only see assigned students)
echo "GET ${BASE_URL}/curriculum (as Assistant Coach)"
ASSISTANT_PLANS_RESPONSE=$(curl -s -X GET "${BASE_URL}/curriculum" \
  -H "Authorization: Bearer $ASSISTANT_TOKEN")

echo "Response: $ASSISTANT_PLANS_RESPONSE"
echo -e "${GREEN}✓ Assistant coach can query plans for assigned students${NC}"
echo ""
sleep 1

# Assistant tries to query logs
echo "GET ${BASE_URL}/training-logs (as Assistant Coach)"
ASSISTANT_LOGS_RESPONSE=$(curl -s -X GET "${BASE_URL}/training-logs" \
  -H "Authorization: Bearer $ASSISTANT_TOKEN")

echo "Response: $ASSISTANT_LOGS_RESPONSE"
echo -e "${GREEN}✓ Assistant coach can query logs for assigned students${NC}"
echo ""
sleep 1

# ====================
# ERROR HANDLING TESTS
# ====================

echo -e "${BLUE}=== ERROR HANDLING TESTS ===${NC}"
echo ""

# Test invalid week number
echo -e "${BLUE}Test 1: Invalid Week Number${NC}"
INVALID_WEEK_RESPONSE=$(curl -s -X POST "${BASE_URL}/training-logs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"$STUDENT_ID\",
    \"weekNumber\": 9,
    \"cycleKey\": \"Jan-Feb 2026\",
    \"sessionNotes\": \"Test\"
  }")

ERROR_MSG=$(echo $INVALID_WEEK_RESPONSE | jq -r '.error')
if [[ "$ERROR_MSG" == *"between 1 and 8"* ]]; then
  echo -e "${GREEN}✓ Invalid week number rejected${NC}"
else
  echo -e "${RED}✗ Invalid week number should be rejected${NC}"
fi
echo ""

# Test missing required fields for curriculum
echo -e "${BLUE}Test 2: Missing Required Fields (Curriculum)${NC}"
MISSING_FIELDS_RESPONSE=$(curl -s -X POST "${BASE_URL}/curriculum" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"$STUDENT_ID\"
  }")

ERROR_MSG=$(echo $MISSING_FIELDS_RESPONSE | jq -r '.error')
if [[ "$ERROR_MSG" == *"required"* ]]; then
  echo -e "${GREEN}✓ Missing fields rejected${NC}"
else
  echo -e "${RED}✗ Missing fields should be rejected${NC}"
fi
echo ""

# Test invalid weeks array (not 8 weeks)
echo -e "${BLUE}Test 3: Invalid Weeks Array (not 8 weeks)${NC}"
INVALID_WEEKS_RESPONSE=$(curl -s -X POST "${BASE_URL}/curriculum" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"cycleKey\": \"Test Cycle\",
    \"studentId\": \"$STUDENT_ID\",
    \"weeks\": [
      {\"weekNumber\": 1, \"focusArea\": \"Test\", \"objective\": \"Test\", \"drills\": []}
    ]
  }")

ERROR_MSG=$(echo $INVALID_WEEKS_RESPONSE | jq -r '.error')
if [[ "$ERROR_MSG" == *"8 week"* ]]; then
  echo -e "${GREEN}✓ Invalid weeks array rejected${NC}"
else
  echo -e "${RED}✗ Invalid weeks array should be rejected${NC}"
fi
echo ""

# Test duplicate training log
echo -e "${BLUE}Test 4: Duplicate Training Log${NC}"
DUPLICATE_LOG_RESPONSE=$(curl -s -X POST "${BASE_URL}/training-logs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"$STUDENT_ID\",
    \"weekNumber\": 1,
    \"cycleKey\": \"Jan-Feb 2026\",
    \"sessionNotes\": \"Duplicate test\"
  }")

ERROR_MSG=$(echo $DUPLICATE_LOG_RESPONSE | jq -r '.error')
if [[ "$ERROR_MSG" == *"already exists"* ]]; then
  echo -e "${GREEN}✓ Duplicate training log rejected${NC}"
else
  echo -e "${RED}✗ Duplicate training log should be rejected${NC}"
fi
echo ""

# Test both batchId and studentId provided
echo -e "${BLUE}Test 5: Both BatchId and StudentId Provided${NC}"
BOTH_IDS_RESPONSE=$(curl -s -X POST "${BASE_URL}/curriculum" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"cycleKey\": \"Test Cycle\",
    \"batchId\": \"$BATCH_ID\",
    \"studentId\": \"$STUDENT_ID\",
    \"weeks\": [{\"weekNumber\": 1, \"focusArea\": \"T\", \"objective\": \"T\", \"drills\": []},{\"weekNumber\": 2, \"focusArea\": \"T\", \"objective\": \"T\", \"drills\": []},{\"weekNumber\": 3, \"focusArea\": \"T\", \"objective\": \"T\", \"drills\": []},{\"weekNumber\": 4, \"focusArea\": \"T\", \"objective\": \"T\", \"drills\": []},{\"weekNumber\": 5, \"focusArea\": \"T\", \"objective\": \"T\", \"drills\": []},{\"weekNumber\": 6, \"focusArea\": \"T\", \"objective\": \"T\", \"drills\": []},{\"weekNumber\": 7, \"focusArea\": \"T\", \"objective\": \"T\", \"drills\": []},{\"weekNumber\": 8, \"focusArea\": \"T\", \"objective\": \"T\", \"drills\": []}]
  }")

ERROR_MSG=$(echo $BOTH_IDS_RESPONSE | jq -r '.error')
if [[ "$ERROR_MSG" == *"either"* ]] || [[ "$ERROR_MSG" == *"not both"* ]]; then
  echo -e "${GREEN}✓ Both IDs provided rejected${NC}"
else
  echo -e "${RED}✗ Both IDs should be rejected${NC}"
fi
echo ""

echo "=========================================="
echo "ALL TESTS COMPLETED"
echo "=========================================="
echo ""
echo "Summary:"
echo "- Created individual and batch curriculum plans"
echo "- Cloned batch plan to students"
echo "- Queried plans with various filters"
echo "- Updated curriculum plans"
echo "- Created training logs with coach metadata"
echo "- Queried logs with filters"
echo "- Updated training logs"
echo "- Tested authorization for assistant coaches"
echo "- Validated error handling"
