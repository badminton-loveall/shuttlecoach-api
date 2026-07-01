# Skill Assessment API - Live Demo

## Quick Test Commands

### 1. Login and Get Token
```bash
TOKEN=$(curl -s -X POST "http://localhost:5000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "headcoach", "password": "password123"}' | jq -r '.token')
echo "Token: ${TOKEN:0:30}..."
```

### 2. Create New Assessment (Current Cycle)
```bash
curl -X POST "http://localhost:5000/api/assessments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "55555555-5555-5555-5555-555555555555",
    "cycleKey": "Jul-Aug 2026",
    "scores": {
      "forehand": {"Clear": 2, "Drop": 2, "Smash": 3, "Drive": 2, "NetShot": 2, "Lift": 2, "CrossDrop": 1, "Slice": 1, "Push": 2, "Tap": 2},
      "backhand": {"Clear": 1, "Drop": 1, "Smash": 2, "Drive": 2, "NetShot": 2, "Lift": 2, "CrossDrop": 1, "Slice": 1, "Push": 2, "Tap": 1},
      "return": {"ForehandReturn": 2, "BackhandReturn": 2, "ShortReturn": 2, "LongReturn": 2, "CrossReturn": 1, "StraightReturn": 2, "DropReturn": 2, "SmashReturn": 2, "DriveReturn": 2, "NetReturn": 2},
      "service": {"ShortServe": 3, "LongServe": 3, "FlickServe": 2, "DriveServe": 2, "BackhandShort": 2, "BackhandLong": 2, "ForehandShort": 3, "ForehandLong": 3, "DoubleShort": 2, "DoubleLong": 2},
      "overhead": {"Smash": 3, "JumpSmash": 2, "Clear": 2, "Drop": 2, "SliceDrop": 1, "HalfSmash": 2, "RoundTheHead": 2, "BackhandClear": 1, "BackhandDrop": 1, "BlockSmash": 2},
      "rally": {"Consistency": 2, "Footwork": 2, "Positioning": 2, "Recovery": 2, "Anticipation": 2, "Shot Selection": 2, "Court Coverage": 2, "Endurance": 3, "Speed": 2, "Agility": 2}
    }
  }' | jq
```

### 3. Query Assessments by Student
```bash
curl -X GET "http://localhost:5000/api/assessments?studentId=44444444-4444-4444-4444-444444444444" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 4. Query Assessments by Cycle
```bash
curl -X GET "http://localhost:5000/api/assessments?cycleKey=Nov-Dec%202024" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 5. Get Single Assessment
```bash
ASSESSMENT_ID=$(curl -s -X GET "http://localhost:5000/api/assessments?studentId=44444444-4444-4444-4444-444444444444" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')

curl -X GET "http://localhost:5000/api/assessments/$ASSESSMENT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 6. Update Assessment (Current Cycle)
```bash
curl -X PATCH "http://localhost:5000/api/assessments/$ASSESSMENT_ID" \
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
  }' | jq
```

### 7. Try to Create Assessment for Past Cycle (Should Fail with 403)
```bash
curl -X POST "http://localhost:5000/api/assessments" \
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
  }' | jq

# Expected Output:
# {
#   "error": "Cannot create assessment for past cycles. Past cycle snapshots are locked."
# }
# HTTP Status: 403
```

### 8. Try to Update Past Cycle Assessment (Should Fail with 403)
```bash
PAST_ASSESSMENT_ID=$(curl -s -X GET "http://localhost:5000/api/assessments?cycleKey=Nov-Dec%202024" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')

curl -X PATCH "http://localhost:5000/api/assessments/$PAST_ASSESSMENT_ID" \
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
  }' | jq

# Expected Output:
# {
#   "error": "Cannot update assessment for past cycles. Past cycle snapshots are locked."
# }
# HTTP Status: 403
```

## Expected Responses

### Successful CREATE (201)
```json
{
  "id": "uuid",
  "studentId": "uuid",
  "cycleKey": "Jul-Aug 2026",
  "recordedBy": "headcoach",
  "recordedAt": "2026-07-01T00:06:48.697Z",
  "scores": { ... },
  "isLocked": false
}
```

### Successful GET List (200)
```json
[
  {
    "id": "uuid",
    "studentId": "uuid",
    "cycleKey": "Jul-Aug 2026",
    "recordedBy": "headcoach",
    "recordedAt": "2026-07-01T00:06:48.697Z",
    "scores": { ... },
    "isLocked": false
  }
]
```

### Past Cycle Error (403)
```json
{
  "error": "Cannot create assessment for past cycles. Past cycle snapshots are locked."
}
```

## Features Demonstrated

✅ **POST /api/assessments** - Create new snapshot with coach metadata
✅ **GET /api/assessments** - Query with studentId/cycleKey filters  
✅ **GET /api/assessments/:id** - Fetch single assessment
✅ **PATCH /api/assessments/:id** - Update current cycle assessments
✅ **Past Cycle Locking** - Reject POST/PATCH for past cycles (403 Forbidden)
✅ **JSONB Storage** - 60 skills across 6 categories stored efficiently
✅ **Coach Metadata** - Automatic capture of recordedBy from JWT token
✅ **Role-Based Access** - HEAD_COACH and ASSISTANT_COACH can create/update
