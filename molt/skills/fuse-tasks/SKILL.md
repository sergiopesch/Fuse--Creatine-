---
name: fuse-tasks
description: Manage FUSE Creatine tasks and decisions — create tasks, approve decisions, track progress
metadata: {"moltbot":{"requires":{"env":["FUSE_API_URL","FUSE_ADMIN_TOKEN"]},"primaryEnv":"FUSE_ADMIN_TOKEN"}}
---

# FUSE Tasks

You help the CEO manage tasks and approve decisions for the FUSE Creatine agent teams.

## API endpoints

### Read operations (public)
```
GET {FUSE_API_URL}/api/agents?action=tasks
GET {FUSE_API_URL}/api/agents?action=tasks&teamId={teamId}&status={status}
GET {FUSE_API_URL}/api/agents?action=decisions
GET {FUSE_API_URL}/api/agents?action=decisions&status=pending
```

### Write operations (authenticated)
```
# Create task
POST {FUSE_API_URL}/api/agents?action=task
Authorization: Bearer {FUSE_ADMIN_TOKEN}
Body: {
  "title": "...",
  "description": "...",
  "priority": "low|medium|high|critical",
  "teamId": "developer|design|communications|legal|marketing|gtm|sales",
  "assignedAgents": ["agent-id-1"]
}

# Update task status
PUT {FUSE_API_URL}/api/agents?action=task-status
Authorization: Bearer {FUSE_ADMIN_TOKEN}
Body: {"taskId": "...", "status": "pending|in_progress|completed|cancelled"}

# Approve/reject decision
PUT {FUSE_API_URL}/api/agents?action=decision
Authorization: Bearer {FUSE_ADMIN_TOKEN}
Body: {"decisionId": "...", "status": "approved|rejected|deferred"}

# Broadcast message to teams
POST {FUSE_API_URL}/api/agents?action=broadcast
Authorization: Bearer {FUSE_ADMIN_TOKEN}
Body: {"message": "...", "priority": "info|important|urgent", "recipients": ["teamId1"]}
```

## What the CEO typically asks

- "Any pending decisions?" → Fetch decisions with status=pending
- "Approve all pending" → Approve each pending decision
- "Create a task for marketing to..." → POST task with teamId=marketing
- "What's the developer team working on?" → Fetch tasks with teamId=developer
- "Cancel task X" → PUT task-status with status=cancelled
- "Send a message to all teams" → POST broadcast

## Response format

- For pending decisions: show title, priority, requesting team — ask CEO to approve/reject
- For tasks: show title, status, priority, team
- For task creation: confirm with task ID
- For broadcasts: confirm delivery and recipients
