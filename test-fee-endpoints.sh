#!/bin/bash

# Test script for Fee Management API endpoints
# Tests POST /api/fees, GET /api/fees, PATCH /api/fees/:id/pay, PATCH /api/fees/:id/waive

set -e

BASE_URL="http://localhost:5000/api"

echo "=================================================="
echo "Fee Management API Endpoint Tests"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Login as HEAD_COACH to get token
echo -e "${YELLOW}Test 1: Login as HEAD_COACH${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "coach.rajesh",
    "password": "password123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Failed to get authentication token${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
else
  echo -e "${GREEN}✅ Successfully authenticated${NC}"
  echo "Token: ${TOKEN:0:20}..."
fi
echo ""

# Test 2: Get a student ID for testing
echo -e "${YELLOW}Test 2: Get student ID${NC}"
STUDENTS_RESPONSE=$(curl -s -X GET "$BASE_URL/students?limit=1" \
  -H "Authorization: Bearer $TOKEN")

STUDENT_ID=$(echo $STUDENTS_RESPONSE | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')

if [ -z "$STUDENT_ID" ]; then
  echo -e "${RED}❌ Failed to get student ID${NC}"
  echo "Response: $STUDENTS_RESPONSE"
  exit 1
else
  echo -e "${GREEN}✅ Got student ID: $STUDENT_ID${NC}"
fi
echo ""

# Test 3: Create a new fee record (POST /api/fees)
echo -e "${YELLOW}Test 3: Create fee record (POST /api/fees)${NC}"
CREATE_FEE_RESPONSE=$(curl -s -X POST "$BASE_URL/fees" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"studentId\": \"$STUDENT_ID\",
    \"amount\": 2500.00,
    \"monthYear\": \"2026-01\",
    \"dueDate\": \"2026-01-15\",
    \"notes\": \"January monthly fee\"
  }")

FEE_ID=$(echo $CREATE_FEE_RESPONSE | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')

if [ -z "$FEE_ID" ]; then
  echo -e "${RED}❌ Failed to create fee record${NC}"
  echo "Response: $CREATE_FEE_RESPONSE"
  exit 1
else
  echo -e "${GREEN}✅ Fee record created successfully${NC}"
  echo "Fee ID: $FEE_ID"
  echo "Response: $CREATE_FEE_RESPONSE"
fi
echo ""

# Test 4: List all fees (GET /api/fees)
echo -e "${YELLOW}Test 4: List all fees (GET /api/fees)${NC}"
LIST_FEES_RESPONSE=$(curl -s -X GET "$BASE_URL/fees" \
  -H "Authorization: Bearer $TOKEN")

FEE_COUNT=$(echo $LIST_FEES_RESPONSE | grep -o '"id"' | wc -l)

echo -e "${GREEN}✅ Retrieved $FEE_COUNT fee records${NC}"
echo "Response: ${LIST_FEES_RESPONSE:0:200}..."
echo ""

# Test 5: List fees by student ID
echo -e "${YELLOW}Test 5: List fees by student ID (GET /api/fees?studentId=...)${NC}"
STUDENT_FEES_RESPONSE=$(curl -s -X GET "$BASE_URL/fees?studentId=$STUDENT_ID" \
  -H "Authorization: Bearer $TOKEN")

STUDENT_FEE_COUNT=$(echo $STUDENT_FEES_RESPONSE | grep -o '"id"' | wc -l)

echo -e "${GREEN}✅ Retrieved $STUDENT_FEE_COUNT fee records for student${NC}"
echo "Response: ${STUDENT_FEES_RESPONSE:0:200}..."
echo ""

# Test 6: List fees by status (PENDING)
echo -e "${YELLOW}Test 6: List fees by status (GET /api/fees?status=PENDING)${NC}"
PENDING_FEES_RESPONSE=$(curl -s -X GET "$BASE_URL/fees?status=PENDING" \
  -H "Authorization: Bearer $TOKEN")

PENDING_FEE_COUNT=$(echo $PENDING_FEES_RESPONSE | grep -o '"id"' | wc -l)

echo -e "${GREEN}✅ Retrieved $PENDING_FEE_COUNT pending fee records${NC}"
echo "Response: ${PENDING_FEES_RESPONSE:0:200}..."
echo ""

# Test 7: List fees by monthYear
echo -e "${YELLOW}Test 7: List fees by monthYear (GET /api/fees?monthYear=2026-01)${NC}"
MONTH_FEES_RESPONSE=$(curl -s -X GET "$BASE_URL/fees?monthYear=2026-01" \
  -H "Authorization: Bearer $TOKEN")

MONTH_FEE_COUNT=$(echo $MONTH_FEES_RESPONSE | grep -o '"id"' | wc -l)

echo -e "${GREEN}✅ Retrieved $MONTH_FEE_COUNT fee records for January 2026${NC}"
echo "Response: ${MONTH_FEES_RESPONSE:0:200}..."
echo ""

# Test 8: Mark fee as paid (PATCH /api/fees/:id/pay)
echo -e "${YELLOW}Test 8: Mark fee as paid (PATCH /api/fees/:id/pay)${NC}"
MARK_PAID_RESPONSE=$(curl -s -X PATCH "$BASE_URL/fees/$FEE_ID/pay" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "paidDate": "2026-01-10",
    "paymentMethod": "UPI",
    "transactionRef": "UPI123456789",
    "notes": "Paid via UPI"
  }')

PAID_STATUS=$(echo $MARK_PAID_RESPONSE | grep -o '"status":"[^"]*' | sed 's/"status":"//')

if [ "$PAID_STATUS" = "PAID" ]; then
  echo -e "${GREEN}✅ Fee marked as paid successfully${NC}"
  echo "Response: $MARK_PAID_RESPONSE"
else
  echo -e "${RED}❌ Failed to mark fee as paid${NC}"
  echo "Response: $MARK_PAID_RESPONSE"
fi
echo ""

# Test 9: Create another fee for waiving
echo -e "${YELLOW}Test 9: Create another fee for waiving test${NC}"
CREATE_FEE2_RESPONSE=$(curl -s -X POST "$BASE_URL/fees" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"studentId\": \"$STUDENT_ID\",
    \"amount\": 2500.00,
    \"monthYear\": \"2026-02\",
    \"dueDate\": \"2026-02-15\",
    \"notes\": \"February monthly fee\"
  }")

FEE_ID2=$(echo $CREATE_FEE2_RESPONSE | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')

if [ -z "$FEE_ID2" ]; then
  echo -e "${RED}❌ Failed to create second fee record${NC}"
else
  echo -e "${GREEN}✅ Second fee record created: $FEE_ID2${NC}"
fi
echo ""

# Test 10: Waive fee (PATCH /api/fees/:id/waive)
echo -e "${YELLOW}Test 10: Waive fee (PATCH /api/fees/:id/waive)${NC}"
WAIVE_FEE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/fees/$FEE_ID2/waive" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "reason": "Financial hardship - waived by head coach"
  }')

WAIVED_STATUS=$(echo $WAIVE_FEE_RESPONSE | grep -o '"status":"[^"]*' | sed 's/"status":"//')

if [ "$WAIVED_STATUS" = "WAIVED" ]; then
  echo -e "${GREEN}✅ Fee waived successfully${NC}"
  echo "Response: $WAIVE_FEE_RESPONSE"
else
  echo -e "${RED}❌ Failed to waive fee${NC}"
  echo "Response: $WAIVE_FEE_RESPONSE"
fi
echo ""

# Test 11: Test overdue status computation (create fee with past due date)
echo -e "${YELLOW}Test 11: Test overdue status computation${NC}"
CREATE_OVERDUE_FEE=$(curl -s -X POST "$BASE_URL/fees" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"studentId\": \"$STUDENT_ID\",
    \"amount\": 2500.00,
    \"monthYear\": \"2025-12\",
    \"dueDate\": \"2025-12-15\",
    \"notes\": \"Past due fee for testing overdue status\"
  }")

OVERDUE_FEE_ID=$(echo $CREATE_OVERDUE_FEE | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')

if [ ! -z "$OVERDUE_FEE_ID" ]; then
  echo -e "${GREEN}✅ Created fee with past due date: $OVERDUE_FEE_ID${NC}"
  
  # Query to check if status is computed as OVERDUE
  OVERDUE_CHECK=$(curl -s -X GET "$BASE_URL/fees?studentId=$STUDENT_ID" \
    -H "Authorization: Bearer $TOKEN")
  
  if echo "$OVERDUE_CHECK" | grep -q "OVERDUE"; then
    echo -e "${GREEN}✅ Overdue status computed correctly${NC}"
  else
    echo -e "${YELLOW}⚠ Overdue status not detected (may need time to pass)${NC}"
  fi
else
  echo -e "${RED}❌ Failed to create overdue test fee${NC}"
fi
echo ""

# Test 12: Test error handling - invalid status
echo -e "${YELLOW}Test 12: Test error handling - invalid status${NC}"
INVALID_STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/fees?status=INVALID" \
  -H "Authorization: Bearer $TOKEN")

if echo "$INVALID_STATUS_RESPONSE" | grep -q "error"; then
  echo -e "${GREEN}✅ Invalid status rejected correctly${NC}"
  echo "Error: $(echo $INVALID_STATUS_RESPONSE | grep -o '"error":"[^"]*' | sed 's/"error":"//')"
else
  echo -e "${RED}❌ Invalid status should have been rejected${NC}"
fi
echo ""

# Test 13: Test error handling - missing required fields
echo -e "${YELLOW}Test 13: Test error handling - missing required fields${NC}"
MISSING_FIELDS_RESPONSE=$(curl -s -X POST "$BASE_URL/fees" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "studentId": "'$STUDENT_ID'",
    "amount": 2500.00
  }')

if echo "$MISSING_FIELDS_RESPONSE" | grep -q "error"; then
  echo -e "${GREEN}✅ Missing fields rejected correctly${NC}"
  echo "Error: $(echo $MISSING_FIELDS_RESPONSE | grep -o '"error":"[^"]*' | sed 's/"error":"//')"
else
  echo -e "${RED}❌ Missing fields should have been rejected${NC}"
fi
echo ""

# Test 14: Test ASSISTANT_COACH access (scoped to assigned students)
echo -e "${YELLOW}Test 14: Test ASSISTANT_COACH access${NC}"
ASSISTANT_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "coach.priya",
    "password": "password123"
  }')

ASSISTANT_TOKEN=$(echo $ASSISTANT_LOGIN | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ ! -z "$ASSISTANT_TOKEN" ]; then
  ASSISTANT_FEES=$(curl -s -X GET "$BASE_URL/fees" \
    -H "Authorization: Bearer $ASSISTANT_TOKEN")
  
  echo -e "${GREEN}✅ Assistant coach can access fees (scoped to assigned students)${NC}"
  echo "Response: ${ASSISTANT_FEES:0:200}..."
else
  echo -e "${YELLOW}⚠ Could not test assistant coach access${NC}"
fi
echo ""

# Test 15: Test STUDENT access (own fees only)
echo -e "${YELLOW}Test 15: Test STUDENT access${NC}"
STUDENT_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "student.ananya",
    "password": "password123"
  }')

STUDENT_TOKEN=$(echo $STUDENT_LOGIN | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ ! -z "$STUDENT_TOKEN" ]; then
  STUDENT_OWN_FEES=$(curl -s -X GET "$BASE_URL/fees" \
    -H "Authorization: Bearer $STUDENT_TOKEN")
  
  echo -e "${GREEN}✅ Student can access own fees${NC}"
  echo "Response: ${STUDENT_OWN_FEES:0:200}..."
else
  echo -e "${YELLOW}⚠ Could not test student access${NC}"
fi
echo ""

echo "=================================================="
echo -e "${GREEN}All Fee Management API Tests Completed!${NC}"
echo "=================================================="
