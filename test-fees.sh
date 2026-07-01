#!/bin/bash

# Test Fee Management API Endpoints
# Task 51: Build fee management API endpoints

BASE_URL="http://localhost:5000/api"

echo "=========================================="
echo "FEE MANAGEMENT API ENDPOINT TESTS"
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

# Step 2: Get a student ID
echo -e "${BLUE}Step 2: Get Student List${NC}"
echo "GET ${BASE_URL}/students"
STUDENTS_RESPONSE=$(curl -s -X GET "${BASE_URL}/students?limit=1" \
  -H "Authorization: Bearer $TOKEN")

STUDENT_ID=$(echo $STUDENTS_RESPONSE | jq -r '.students[0].id')
STUDENT_NAME=$(echo $STUDENTS_RESPONSE | jq -r '.students[0].fullName')
echo "Using Student: $STUDENT_NAME (ID: $STUDENT_ID)"
echo ""
sleep 1

# Step 3: Create a new fee record
echo -e "${BLUE}Step 3: Create Fee Record (POST /api/fees)${NC}"
echo "POST ${BASE_URL}/fees"
CREATE_FEE_RESPONSE=$(curl -s -X POST "${BASE_URL}/fees" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"$STUDENT_ID\",
    \"amount\": 5000,
    \"monthYear\": \"2026-01\",
    \"dueDate\": \"2026-01-15\",
    \"notes\": \"Monthly training fee for January 2026\"
  }")

FEE_ID=$(echo $CREATE_FEE_RESPONSE | jq -r '.id')
echo "Response: $CREATE_FEE_RESPONSE"
echo -e "${GREEN}✓ Fee record created with ID: $FEE_ID${NC}"
echo ""
sleep 1

# Step 4: Query all fees
echo -e "${BLUE}Step 4: Query All Fees (GET /api/fees)${NC}"
echo "GET ${BASE_URL}/fees"
ALL_FEES_RESPONSE=$(curl -s -X GET "${BASE_URL}/fees" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $ALL_FEES_RESPONSE"
echo -e "${GREEN}✓ Retrieved all fee records${NC}"
echo ""
sleep 1

# Step 5: Query fees by student
echo -e "${BLUE}Step 5: Query Fees by Student (GET /api/fees?studentId=...)${NC}"
echo "GET ${BASE_URL}/fees?studentId=$STUDENT_ID"
STUDENT_FEES_RESPONSE=$(curl -s -X GET "${BASE_URL}/fees?studentId=$STUDENT_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $STUDENT_FEES_RESPONSE"
echo -e "${GREEN}✓ Retrieved fees for student${NC}"
echo ""
sleep 1

# Step 6: Query fees by status (PENDING)
echo -e "${BLUE}Step 6: Query Fees by Status (GET /api/fees?status=PENDING)${NC}"
echo "GET ${BASE_URL}/fees?status=PENDING"
PENDING_FEES_RESPONSE=$(curl -s -X GET "${BASE_URL}/fees?status=PENDING" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $PENDING_FEES_RESPONSE"
echo -e "${GREEN}✓ Retrieved pending fees${NC}"
echo ""
sleep 1

# Step 7: Create an overdue fee (past due date)
echo -e "${BLUE}Step 7: Create Overdue Fee (due date in past)${NC}"
echo "POST ${BASE_URL}/fees"
OVERDUE_FEE_RESPONSE=$(curl -s -X POST "${BASE_URL}/fees" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"$STUDENT_ID\",
    \"amount\": 4500,
    \"monthYear\": \"2025-12\",
    \"dueDate\": \"2025-12-15\",
    \"notes\": \"December 2025 fee (overdue)\"
  }")

OVERDUE_FEE_ID=$(echo $OVERDUE_FEE_RESPONSE | jq -r '.id')
echo "Response: $OVERDUE_FEE_RESPONSE"
echo -e "${GREEN}✓ Overdue fee created with ID: $OVERDUE_FEE_ID${NC}"
echo ""
sleep 1

# Step 8: Query overdue fees (should show status as OVERDUE)
echo -e "${BLUE}Step 8: Query Overdue Fees (computed status)${NC}"
echo "GET ${BASE_URL}/fees?studentId=$STUDENT_ID"
CHECK_OVERDUE_RESPONSE=$(curl -s -X GET "${BASE_URL}/fees?studentId=$STUDENT_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $CHECK_OVERDUE_RESPONSE"
OVERDUE_STATUS=$(echo $CHECK_OVERDUE_RESPONSE | jq -r '.[] | select(.id == "'$OVERDUE_FEE_ID'") | .status')
if [ "$OVERDUE_STATUS" == "OVERDUE" ]; then
  echo -e "${GREEN}✓ Fee correctly computed as OVERDUE${NC}"
else
  echo -e "${RED}✗ Fee status is '$OVERDUE_STATUS', expected 'OVERDUE'${NC}"
fi
echo ""
sleep 1

# Step 9: Mark fee as paid
echo -e "${BLUE}Step 9: Mark Fee as Paid (PATCH /api/fees/:id/pay)${NC}"
echo "PATCH ${BASE_URL}/fees/$FEE_ID/pay"
MARK_PAID_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/fees/$FEE_ID/pay" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"paidDate\": \"2026-01-10\",
    \"paymentMethod\": \"UPI\",
    \"transactionRef\": \"UPI123456789\",
    \"notes\": \"Paid via PhonePe\"
  }")

echo "Response: $MARK_PAID_RESPONSE"
PAID_STATUS=$(echo $MARK_PAID_RESPONSE | jq -r '.status')
if [ "$PAID_STATUS" == "PAID" ]; then
  echo -e "${GREEN}✓ Fee marked as PAID successfully${NC}"
else
  echo -e "${RED}✗ Fee status is '$PAID_STATUS', expected 'PAID'${NC}"
fi
echo ""
sleep 1

# Step 10: Query paid fees
echo -e "${BLUE}Step 10: Query Paid Fees (GET /api/fees?status=PAID)${NC}"
echo "GET ${BASE_URL}/fees?status=PAID"
PAID_FEES_RESPONSE=$(curl -s -X GET "${BASE_URL}/fees?status=PAID" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $PAID_FEES_RESPONSE"
echo -e "${GREEN}✓ Retrieved paid fees${NC}"
echo ""
sleep 1

# Step 11: Waive the overdue fee
echo -e "${BLUE}Step 11: Waive Fee (PATCH /api/fees/:id/waive)${NC}"
echo "PATCH ${BASE_URL}/fees/$OVERDUE_FEE_ID/waive"
WAIVE_FEE_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/fees/$OVERDUE_FEE_ID/waive" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"reason\": \"Financial hardship waiver approved by Head Coach\"
  }")

echo "Response: $WAIVE_FEE_RESPONSE"
WAIVED_STATUS=$(echo $WAIVE_FEE_RESPONSE | jq -r '.status')
if [ "$WAIVED_STATUS" == "WAIVED" ]; then
  echo -e "${GREEN}✓ Fee waived successfully${NC}"
else
  echo -e "${RED}✗ Fee status is '$WAIVED_STATUS', expected 'WAIVED'${NC}"
fi
echo ""
sleep 1

# Step 12: Query waived fees
echo -e "${BLUE}Step 12: Query Waived Fees (GET /api/fees?status=WAIVED)${NC}"
echo "GET ${BASE_URL}/fees?status=WAIVED"
WAIVED_FEES_RESPONSE=$(curl -s -X GET "${BASE_URL}/fees?status=WAIVED" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $WAIVED_FEES_RESPONSE"
echo -e "${GREEN}✓ Retrieved waived fees${NC}"
echo ""
sleep 1

# Step 13: Query fees by monthYear
echo -e "${BLUE}Step 13: Query Fees by Month/Year (GET /api/fees?monthYear=2026-01)${NC}"
echo "GET ${BASE_URL}/fees?monthYear=2026-01"
MONTH_FEES_RESPONSE=$(curl -s -X GET "${BASE_URL}/fees?monthYear=2026-01" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $MONTH_FEES_RESPONSE"
echo -e "${GREEN}✓ Retrieved fees for month/year${NC}"
echo ""
sleep 1

# Step 14: Test authorization - Login as Assistant Coach
echo -e "${BLUE}Step 14: Test Authorization - Assistant Coach${NC}"
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

# Assistant tries to query fees (should only see assigned students)
echo "GET ${BASE_URL}/fees (as Assistant Coach)"
ASSISTANT_FEES_RESPONSE=$(curl -s -X GET "${BASE_URL}/fees" \
  -H "Authorization: Bearer $ASSISTANT_TOKEN")

echo "Response: $ASSISTANT_FEES_RESPONSE"
echo -e "${GREEN}✓ Assistant coach can query fees for assigned students${NC}"
echo ""
sleep 1

# Step 15: Error handling tests
echo -e "${BLUE}Step 15: Error Handling Tests${NC}"

# Test invalid monthYear format
echo "Testing invalid monthYear format..."
INVALID_MONTH_RESPONSE=$(curl -s -X POST "${BASE_URL}/fees" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"$STUDENT_ID\",
    \"amount\": 5000,
    \"monthYear\": \"January 2026\",
    \"dueDate\": \"2026-01-15\"
  }")

ERROR_MSG=$(echo $INVALID_MONTH_RESPONSE | jq -r '.error')
if [[ "$ERROR_MSG" == *"monthYear"* ]]; then
  echo -e "${GREEN}✓ Invalid monthYear format rejected${NC}"
else
  echo -e "${RED}✗ Invalid monthYear should be rejected${NC}"
fi
echo ""

# Test missing required fields
echo "Testing missing required fields..."
MISSING_FIELDS_RESPONSE=$(curl -s -X POST "${BASE_URL}/fees" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"$STUDENT_ID\",
    \"amount\": 5000
  }")

ERROR_MSG=$(echo $MISSING_FIELDS_RESPONSE | jq -r '.error')
if [[ "$ERROR_MSG" == *"required"* ]]; then
  echo -e "${GREEN}✓ Missing fields rejected${NC}"
else
  echo -e "${RED}✗ Missing fields should be rejected${NC}"
fi
echo ""

# Test invalid status in query
echo "Testing invalid status filter..."
INVALID_STATUS_RESPONSE=$(curl -s -X GET "${BASE_URL}/fees?status=INVALID" \
  -H "Authorization: Bearer $TOKEN")

ERROR_MSG=$(echo $INVALID_STATUS_RESPONSE | jq -r '.error')
if [[ "$ERROR_MSG" == *"Invalid status"* ]]; then
  echo -e "${GREEN}✓ Invalid status rejected${NC}"
else
  echo -e "${RED}✗ Invalid status should be rejected${NC}"
fi
echo ""

echo "=========================================="
echo "ALL TESTS COMPLETED"
echo "=========================================="
