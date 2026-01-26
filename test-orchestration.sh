#!/bin/bash
# FUSE Orchestration Test Script
# Tests each team's orchestration with minimal tokens

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_TOKEN="${ADMIN_TOKEN:-your-admin-token-here}"

echo "=== FUSE Orchestration Test ==="
echo "Base URL: $BASE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test function
test_team() {
    local team_id=$1
    local team_name=$2

    echo -e "${YELLOW}Testing $team_name ($team_id)...${NC}"

    # 1. Check initial status (should be paused)
    echo "  1. Checking status..."
    status=$(curl -s "$BASE_URL/api/orchestrate?teamId=$team_id")
    if echo "$status" | grep -q '"status":"paused"'; then
        echo -e "     ${GREEN}✓ Team is paused (default state)${NC}"
    else
        echo -e "     ${RED}✗ Team status unexpected${NC}"
    fi

    # 2. Start orchestration
    echo "  2. Starting orchestration..."
    start_result=$(curl -s -X POST "$BASE_URL/api/orchestrate" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -d "{\"teamId\":\"$team_id\",\"action\":\"start\"}")

    if echo "$start_result" | grep -q '"success":true'; then
        echo -e "     ${GREEN}✓ Orchestration started${NC}"
    else
        echo -e "     ${RED}✗ Failed to start: $start_result${NC}"
        return 1
    fi

    # 3. Execute one cycle (minimal tokens)
    echo "  3. Executing orchestration cycle..."
    exec_result=$(curl -s -X POST "$BASE_URL/api/orchestrate" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -d "{\"teamId\":\"$team_id\",\"action\":\"execute\",\"task\":\"Brief status check\"}")

    if echo "$exec_result" | grep -q '"success":true'; then
        tokens=$(echo "$exec_result" | grep -o '"outputTokens":[0-9]*' | grep -o '[0-9]*')
        echo -e "     ${GREEN}✓ Execution complete (tokens: ${tokens:-unknown})${NC}"
    else
        echo -e "     ${RED}✗ Execution failed: $exec_result${NC}"
    fi

    # 4. Stop orchestration
    echo "  4. Stopping orchestration..."
    stop_result=$(curl -s -X POST "$BASE_URL/api/orchestrate" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -d "{\"teamId\":\"$team_id\",\"action\":\"stop\"}")

    if echo "$stop_result" | grep -q '"success":true'; then
        echo -e "     ${GREEN}✓ Orchestration stopped${NC}"
    else
        echo -e "     ${RED}✗ Failed to stop${NC}"
    fi

    echo ""
}

# Test all teams
echo "=== Testing All Teams ==="
echo ""

test_team "developer" "Developer Team"
test_team "design" "Design Team"
test_team "communications" "Communications Team"
test_team "legal" "Legal Team"
test_team "marketing" "Marketing Team"
test_team "gtm" "Go-to-Market Team"
test_team "sales" "Sales Team"

# Get final status
echo "=== Final Status ==="
curl -s "$BASE_URL/api/orchestrate?action=status" | python3 -m json.tool 2>/dev/null || \
    curl -s "$BASE_URL/api/orchestrate?action=status"

echo ""
echo "=== Test Complete ==="
