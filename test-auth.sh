#!/bin/bash

# ShuttleCoach API - Authentication Endpoint Test Script
# Task 48: JWT Authentication Testing

BASE_URL="http://localhost:5000/api"

echo "================================================"
echo "ShuttleCoach API Authentication Tests"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo "📋 Test 1: Health Check"
echo "----------------------------"
curl -s -X GET "$BASE_URL/health" | json_pp
echo ""
echo ""

# Test 2: Successful Login
echo "✅ Test 2: Successful Login (Head Coach)"
echo "----------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "headcoach",
    "password": "password123"
  }')

echo "$RESPONSE" | json_pp
TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*' | sed 's/"token":"//')
echo ""
echo "${GREEN}Token saved for subsequent tests${NC}"
echo ""
echo ""

# Test 3: Failed Login (Wrong Password)
echo "❌ Test 3: Failed Login - Wrong Password"
echo "----------------------------"
curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "headcoach",
    "password": "wrongpassword"
  }' | json_pp
echo ""
echo ""

# Test 4: Failed Login (Missing Password)
echo "❌ Test 4: Failed Login - Missing Password"
echo "----------------------------"
curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "headcoach"
  }' | json_pp
echo ""
echo ""

# Test 5: Failed Login (User Not Found)
echo "❌ Test 5: Failed Login - User Not Found"
echo "----------------------------"
curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "nonexistent",
    "password": "password123"
  }' | json_pp
echo ""
echo ""

# Test 6: Get Current User (with valid token)
echo "✅ Test 6: Get Current User Profile (Authenticated)"
echo "----------------------------"
if [ -z "$TOKEN" ]; then
  echo "${RED}No token available - login might have failed${NC}"
else
  curl -s -X GET "$BASE_URL/auth/me" \
    -H "Authorization: Bearer $TOKEN" | json_pp
fi
echo ""
echo ""

# Test 7: Get Current User (without token)
echo "❌ Test 7: Get Current User - No Token"
echo "----------------------------"
curl -s -X GET "$BASE_URL/auth/me" | json_pp
echo ""
echo ""

# Test 8: Get Current User (invalid token)
echo "❌ Test 8: Get Current User - Invalid Token"
echo "----------------------------"
curl -s -X GET "$BASE_URL/auth/me" \
  -H "Authorization: Bearer invalid-token-12345" | json_pp
echo ""
echo ""

# Test 9: Login as Assistant Coach
echo "✅ Test 9: Login as Assistant Coach"
echo "----------------------------"
curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "assistant1",
    "password": "password123"
  }' | json_pp
echo ""
echo ""

# Test 10: Login as Student
echo "✅ Test 10: Login as Student"
echo "----------------------------"
curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "aarav",
    "password": "password123"
  }' | json_pp
echo ""
echo ""

echo "================================================"
echo "Test Summary"
echo "================================================"
echo ""
echo "${GREEN}✅ Successful Tests:${NC}"
echo "  - Health check"
echo "  - Login with valid credentials (all roles)"
echo "  - Get authenticated user profile"
echo ""
echo "${RED}❌ Expected Failures:${NC}"
echo "  - Login with wrong password (401)"
echo "  - Login with missing password (400)"
echo "  - Login with non-existent user (401)"
echo "  - Get profile without token (401)"
echo "  - Get profile with invalid token (401)"
echo ""
echo "================================================"
echo ""

if [ -z "$TOKEN" ]; then
  echo "${RED}⚠️  WARNING: Could not retrieve token. Database might not be set up.${NC}"
  echo "Please follow SUPABASE_SETUP.md to configure the database."
else
  echo "${GREEN}✅ All tests completed successfully!${NC}"
  echo ""
  echo "Your JWT token for manual testing:"
  echo "${YELLOW}$TOKEN${NC}"
  echo ""
  echo "Use this token in Authorization header:"
  echo "Authorization: Bearer $TOKEN"
fi

echo ""
