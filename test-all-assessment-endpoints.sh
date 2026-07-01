#!/bin/bash

# Comprehensive Assessment Endpoints Test
API_URL="http://localhost:5000/api"

echo "=== Assessment API Endpoint Tests ==="
echo ""

# Login
TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "headcoach", "password": "password123"}' | jq -r '.token')

echo "✓ Logged in as headcoach"
echo ""

# Test 1: GET all assessments
echo "Test 1: GET /api/assessments (all assessments)"
curl -s -X GET "$API_URL/assessments" \
  -H "Authorization: Bearer $TOKEN" | jq 'length'
echo ""

# Test 2: GET assessments by studentId
echo "Test 2: GET /api/assessments?studentId=<id>"
curl -s -X GET "$API_URL/assessments?studentId=44444444-4444-4444-4444-444444444444" \
  -H "Authorization: Bearer $TOKEN" | jq 'length'
echo ""

# Test 3: GET assessments by cycleKey
echo "Test 3: GET /api/assessments?cycleKey=Nov-Dec%202024"
curl -s -X GET "$API_URL/assessments?cycleKey=Nov-Dec%202024" \
  -H "Authorization: Bearer $TOKEN" | jq 'length'
echo ""

# Test 4: GET single assessment
echo "Test 4: GET /api/assessments/:id"
ASSESSMENT_ID=$(curl -s -X GET "$API_URL/assessments?studentId=44444444-4444-4444-4444-444444444444" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')
curl -s -X GET "$API_URL/assessments/$ASSESSMENT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '{id, studentId, cycleKey, recordedBy}'
echo ""

# Test 5: POST new assessment (current cycle - should succeed)
echo "Test 5: POST /api/assessments (current cycle - should succeed)"
curl -s -w "\nStatus: %{http_code}" -X POST "$API_URL/assessments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "66666666-6666-6666-6666-666666666666",
    "cycleKey": "Jul-Aug 2026",
    "scores": {
      "forehand": {"Clear": 2, "Drop": 2, "Smash": 2, "Drive": 2, "NetShot": 2, "Lift": 2, "CrossDrop": 2, "Slice": 2, "Push": 2, "Tap": 2},
      "backhand": {"Clear": 2, "Drop": 2, "Smash": 2, "Drive": 2, "NetShot": 2, "Lift": 2, "CrossDrop": 2, "Slice": 2, "Push": 2, "Tap": 2},
      "return": {"ForehandReturn": 2, "BackhandReturn": 2, "ShortReturn": 2, "LongReturn": 2, "CrossReturn": 2, "StraightReturn": 2, "DropReturn": 2, "SmashReturn": 2, "DriveReturn": 2, "NetReturn": 2},
      "service": {"ShortServe": 2, "LongServe": 2, "FlickServe": 2, "DriveServe": 2, "BackhandShort": 2, "BackhandLong": 2, "ForehandShort": 2, "ForehandLong": 2, "DoubleShort": 2, "DoubleLong": 2},
      "overhead": {"Smash": 2, "JumpSmash": 2, "Clear": 2, "Drop": 2, "SliceDrop": 2, "HalfSmash": 2, "RoundTheHead": 2, "BackhandClear": 2, "BackhandDrop": 2, "BlockSmash": 2},
      "rally": {"Consistency": 2, "Footwork": 2, "Positioning": 2, "Recovery": 2, "Anticipation": 2, "Shot Selection": 2, "Court Coverage": 2, "Endurance": 2, "Speed": 2, "Agility": 2}
    }
  }' | jq '{id, cycleKey, isLocked}'
echo ""

# Test 6: POST past cycle (should fail with 403)
echo "Test 6: POST /api/assessments (past cycle - should fail with 403)"
curl -s -w "\nStatus: %{http_code}" -X POST "$API_URL/assessments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "77777777-7777-7777-7777-777777777777",
    "cycleKey": "Jan-Feb 2020",
    "scores": {
      "forehand": {"Clear": 1, "Drop": 1, "Smash": 1, "Drive": 1, "NetShot": 1, "Lift": 1, "CrossDrop": 1, "Slice": 1, "Push": 1, "Tap": 1},
      "backhand": {"Clear": 1, "Drop": 1, "Smash": 1, "Drive": 1, "NetShot": 1, "Lift": 1, "CrossDrop": 1, "Slice": 1, "Push": 1, "Tap": 1},
      "return": {"ForehandReturn": 1, "BackhandReturn": 1, "ShortReturn": 1, "LongReturn": 1, "CrossReturn": 1, "StraightReturn": 1, "DropReturn": 1, "SmashReturn": 1, "DriveReturn": 1, "NetReturn": 1},
      "service": {"ShortServe": 1, "LongServe": 1, "FlickServe": 1, "DriveServe": 1, "BackhandShort": 1, "BackhandLong": 1, "ForehandShort": 1, "ForehandLong": 1, "DoubleShort": 1, "DoubleLong": 1},
      "overhead": {"Smash": 1, "JumpSmash": 1, "Clear": 1, "Drop": 1, "SliceDrop": 1, "HalfSmash": 1, "RoundTheHead": 1, "BackhandClear": 1, "BackhandDrop": 1, "BlockSmash": 1},
      "rally": {"Consistency": 1, "Footwork": 1, "Positioning": 1, "Recovery": 1, "Anticipation": 1, "Shot Selection": 1, "Court Coverage": 1, "Endurance": 1, "Speed": 1, "Agility": 1}
    }
  }' | jq '{error}'
echo ""

# Test 7: PATCH current cycle (should succeed)
echo "Test 7: PATCH /api/assessments/:id (current cycle - should succeed)"
curl -s -w "\nStatus: %{http_code}" -X PATCH "$API_URL/assessments/$ASSESSMENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scores": {
      "forehand": {"Clear": 4, "Drop": 4, "Smash": 4, "Drive": 4, "NetShot": 4, "Lift": 4, "CrossDrop": 4, "Slice": 4, "Push": 4, "Tap": 4},
      "backhand": {"Clear": 3, "Drop": 3, "Smash": 3, "Drive": 3, "NetShot": 3, "Lift": 3, "CrossDrop": 3, "Slice": 3, "Push": 3, "Tap": 3},
      "return": {"ForehandReturn": 3, "BackhandReturn": 3, "ShortReturn": 3, "LongReturn": 3, "CrossReturn": 3, "StraightReturn": 3, "DropReturn": 3, "SmashReturn": 3, "DriveReturn": 3, "NetReturn": 3},
      "service": {"ShortServe": 3, "LongServe": 3, "FlickServe": 3, "DriveServe": 3, "BackhandShort": 3, "BackhandLong": 3, "ForehandShort": 3, "ForehandLong": 3, "DoubleShort": 3, "DoubleLong": 3},
      "overhead": {"Smash": 3, "JumpSmash": 3, "Clear": 3, "Drop": 3, "SliceDrop": 3, "HalfSmash": 3, "RoundTheHead": 3, "BackhandClear": 3, "BackhandDrop": 3, "BlockSmash": 3},
      "rally": {"Consistency": 3, "Footwork": 3, "Positioning": 3, "Recovery": 3, "Anticipation": 3, "Shot Selection": 3, "Court Coverage": 3, "Endurance": 3, "Speed": 3, "Agility": 3}
    }
  }' | jq '{id, cycleKey, recordedBy}'
echo ""

# Test 8: PATCH past cycle (should fail with 403)
echo "Test 8: PATCH /api/assessments/:id (past cycle - should fail with 403)"
PAST_ASSESSMENT_ID=$(curl -s -X GET "$API_URL/assessments?cycleKey=Nov-Dec%202024" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')
curl -s -w "\nStatus: %{http_code}" -X PATCH "$API_URL/assessments/$PAST_ASSESSMENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scores": {
      "forehand": {"Clear": 0, "Drop": 0, "Smash": 0, "Drive": 0, "NetShot": 0, "Lift": 0, "CrossDrop": 0, "Slice": 0, "Push": 0, "Tap": 0},
      "backhand": {"Clear": 0, "Drop": 0, "Smash": 0, "Drive": 0, "NetShot": 0, "Lift": 0, "CrossDrop": 0, "Slice": 0, "Push": 0, "Tap": 0},
      "return": {"ForehandReturn": 0, "BackhandReturn": 0, "ShortReturn": 0, "LongReturn": 0, "CrossReturn": 0, "StraightReturn": 0, "DropReturn": 0, "SmashReturn": 0, "DriveReturn": 0, "NetReturn": 0},
      "service": {"ShortServe": 0, "LongServe": 0, "FlickServe": 0, "DriveServe": 0, "BackhandShort": 0, "BackhandLong": 0, "ForehandShort": 0, "ForehandLong": 0, "DoubleShort": 0, "DoubleLong": 0},
      "overhead": {"Smash": 0, "JumpSmash": 0, "Clear": 0, "Drop": 0, "SliceDrop": 0, "HalfSmash": 0, "RoundTheHead": 0, "BackhandClear": 0, "BackhandDrop": 0, "BlockSmash": 0},
      "rally": {"Consistency": 0, "Footwork": 0, "Positioning": 0, "Recovery": 0, "Anticipation": 0, "Shot Selection": 0, "Court Coverage": 0, "Endurance": 0, "Speed": 0, "Agility": 0}
    }
  }' | jq '{error}'
echo ""

echo "=== All Tests Completed ==="
