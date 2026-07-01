#!/bin/bash

# Simple assessment endpoints test
API_URL="http://localhost:5000/api"

# Login
echo "=== Test 1: Login ==="
TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "headcoach", "password": "password123"}' | jq -r '.token')
echo "Token obtained: ${TOKEN:0:20}..."
echo ""

# Get list of all assessments
echo "=== Test 2: GET /api/assessments (list all) ==="
curl -s -X GET "$API_URL/assessments" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Get student ID
STUDENT_ID=$(curl -s -X GET "$API_URL/students?limit=1" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.students[0].id')
echo "=== Test 3: GET /api/assessments?studentId=$STUDENT_ID ==="
curl -s -X GET "$API_URL/assessments?studentId=$STUDENT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Get assessment by ID
ASSESSMENT_ID=$(curl -s -X GET "$API_URL/assessments?studentId=$STUDENT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')
echo "=== Test 4: GET /api/assessments/$ASSESSMENT_ID ==="
curl -s -X GET "$API_URL/assessments/$ASSESSMENT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Try to create assessment for past cycle (should fail)
echo "=== Test 5: POST /api/assessments (past cycle - should fail 403) ==="
curl -s -X POST "$API_URL/assessments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"$STUDENT_ID\",
    \"cycleKey\": \"Jan-Feb 2023\",
    \"scores\": {
      \"forehand\": { \"Clear\": 1, \"Drop\": 1, \"Smash\": 1, \"Drive\": 1, \"NetShot\": 1, \"Lift\": 1, \"CrossDrop\": 1, \"Slice\": 1, \"Push\": 1, \"Tap\": 1 },
      \"backhand\": { \"Clear\": 1, \"Drop\": 1, \"Smash\": 1, \"Drive\": 1, \"NetShot\": 1, \"Lift\": 1, \"CrossDrop\": 1, \"Slice\": 1, \"Push\": 1, \"Tap\": 1 },
      \"return\": { \"ForehandReturn\": 1, \"BackhandReturn\": 1, \"ShortReturn\": 1, \"LongReturn\": 1, \"CrossReturn\": 1, \"StraightReturn\": 1, \"DropReturn\": 1, \"SmashReturn\": 1, \"DriveReturn\": 1, \"NetReturn\": 1 },
      \"service\": { \"ShortServe\": 1, \"LongServe\": 1, \"FlickServe\": 1, \"DriveServe\": 1, \"BackhandShort\": 1, \"BackhandLong\": 1, \"ForehandShort\": 1, \"ForehandLong\": 1, \"DoubleShort\": 1, \"DoubleLong\": 1 },
      \"overhead\": { \"Smash\": 1, \"JumpSmash\": 1, \"Clear\": 1, \"Drop\": 1, \"SliceDrop\": 1, \"HalfSmash\": 1, \"RoundTheHead\": 1, \"BackhandClear\": 1, \"BackhandDrop\": 1, \"BlockSmash\": 1 },
      \"rally\": { \"Consistency\": 1, \"Footwork\": 1, \"Positioning\": 1, \"Recovery\": 1, \"Anticipation\": 1, \"Shot Selection\": 1, \"Court Coverage\": 1, \"Endurance\": 1, \"Speed\": 1, \"Agility\": 1 }
    }
  }" | jq '.'
echo ""

echo "=== All tests completed! ==="
