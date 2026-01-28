# Agent Architecture Review: Best Practices Analysis

**Review Date:** 2026-01-28
**Reference:** [Agent-Native Architecture Guide](https://every.to/guides/agent-native)
**Codebase:** FUSE Agent Ecosystem

---

## Executive Summary

The FUSE agent architecture demonstrates **strong alignment** with agent-native best practices in several key areas, while having **specific gaps** that should be addressed to achieve full agent-native capability. This document provides a detailed comparison against the canonical patterns.

### Overall Assessment

| Category | Score | Status |
|----------|-------|--------|
| Orchestration Patterns | 9/10 | Excellent |
| Tool Granularity | 8/10 | Good |
| Human-in-the-Loop | 10/10 | Excellent |
| Error Handling | 9/10 | Excellent |
| Memory/State Management | 7/10 | Good (gaps identified) |
| Parity | 6/10 | Needs improvement |
| Emergent Capability | 7/10 | Good (limited by tool scope) |
| Agent-to-UI Communication | 5/10 | Needs improvement |

---

## 1. Orchestration Patterns

### Best Practice (Article)
> "The agent receives an outcome description, not a choreographed sequence. It operates in a loop, making decisions, handling unexpected cases, and continuing until the objective is achieved."

### Current Implementation

**Location:** `api/_lib/agent-loop.js:48-226`

The implementation follows the observe-act-evaluate loop pattern correctly:

```javascript
// Lines 92-208: Core loop implementation
for (let iteration = 0; iteration < maxIterations; iteration++) {
  // 1. Call Claude API with tools
  response = await callClaudeAPI(apiKey, model, systemPrompt, messages, AGENT_TOOLS);

  // 2. Process tool use blocks
  const toolUseBlocks = content.filter(b => b.type === 'tool_use');

  // 3. Execute tools and feed results back
  for (const toolUse of toolUseBlocks) {
    const toolResult = executeAgentTool(toolUse.name, toolUse.input, teamId, stateContext);
    // ...
  }

  // 4. Check completion
  if (toolUse.name === 'signal_completion') {
    completionSignaled = true;
    break;
  }
}
```

### Strengths
- Implements proper observe-act-evaluate loop (not single-shot)
- Explicit completion signaling via `signal_completion` tool
- Configurable max iterations (default: 6)
- Rich context injection via `buildTeamContext()`
- Tool results fed back into conversation

### Concerns
- **MAX_ITERATIONS = 6** may be too low for complex multi-step tasks
- No mid-session consolidation for context limits

### Recommendation
Consider dynamic iteration limits based on task complexity, or implement context summarization for longer loops.

---

## 2. Tool Granularity

### Best Practice (Article)
> "Tools should be atomic primitives... Decision logic belongs in prompts, not bundled into tools."

### Current Implementation

**Location:** `api/_lib/agent-tools.js:19-216`

**11 Tools Defined:**

| Tool | Type | Granularity Assessment |
|------|------|----------------------|
| `get_system_state` | Observation | Atomic - selective sections |
| `get_tasks` | Observation | Atomic - filtered query |
| `get_decisions` | Observation | Atomic - filtered query |
| `get_team_info` | Observation | Atomic - single entity |
| `get_recent_activity` | Observation | Atomic - filtered query |
| `create_task` | Action | Atomic - single create |
| `update_task_status` | Action | Atomic - single update |
| `create_decision_request` | Action | Atomic - single create |
| `send_message` | Action | Atomic - single send |
| `report_progress` | Action | Atomic - single report |
| `signal_completion` | Control | Atomic - explicit signal |

### Strengths
- Tools represent single conceptual actions
- No workflow bundles (e.g., no `analyze_and_report()`)
- Clean separation: observation vs. action vs. control
- Design principles documented in file header (lines 8-13)

### Concerns
- **Missing primitives:** No file/document operations, no search, no external API access
- **Limited CRUD:** Tasks have full CRUD, but decisions lack update/delete

### Recommendation
Add missing CRUD operations for decisions:
- `update_decision_status` (for closing decisions)
- `delete_decision` (for cleanup)

Consider adding primitive tools for broader capability:
- `search_knowledge_base`
- `read_document`
- `write_document`

---

## 3. Human-in-the-Loop Patterns

### Best Practice (Article)
> "Match approval requirements to stakes and reversibility."

| Stakes | Reversibility | Pattern |
|--------|---------------|---------|
| Low | Easy | Auto-apply |
| Low | Hard | Quick confirm |
| High | Easy | Suggest + apply |
| High | Hard | Explicit approval |

### Current Implementation

**Location:** `api/_lib/world-controller.js:14-108`

The implementation provides **exceptional** human control:

```javascript
// World States (line 14-19)
WORLD_STATES = {
  PAUSED: 'paused',        // Everything stopped
  MANUAL: 'manual',        // Owner triggers every action
  SEMI_AUTO: 'semi_auto',  // Selective automation
  AUTONOMOUS: 'autonomous' // Full autonomy
}

// Team Automation Levels (line 22-27)
AUTOMATION_LEVELS = {
  STOPPED: 'stopped',
  MANUAL: 'manual',
  SUPERVISED: 'supervised',
  AUTONOMOUS: 'autonomous'
}
```

**Implemented Controls:**
- Global pause/resume (`pauseWorld()`, `resumeWorld()`)
- Per-team pause controls
- Decision request tool for high-stakes escalation
- Credit protection with auto-stop (`checkCreditLimits()`)
- Emergency stop with confirmation code
- Action queue with approval flow
- Automation windows for semi-auto mode

### Strengths
- Four-tier world state machine
- Four-tier team automation levels
- Granular action type controls
- Credit-based hard stops
- Emergency stop with confirmation safeguard
- Comprehensive audit logging

### Assessment
**This is a reference implementation** of human-in-the-loop patterns. The multi-level control hierarchy (world → team → action) provides exactly the right granularity.

---

## 4. Error Handling & Resilience

### Best Practice (Article)
> "Track progress at task level... Resume from checkpoints after interruption."

### Current Implementation

**Location:** `api/_lib/circuit-breaker.js:1-444`

```javascript
// Circuit Breaker States
CircuitState = {
  CLOSED: 'CLOSED',      // Normal operation
  OPEN: 'OPEN',          // Requests rejected
  HALF_OPEN: 'HALF_OPEN' // Testing recovery
}

// Configuration
CONFIG = {
  FAILURE_THRESHOLD: 5,
  SUCCESS_THRESHOLD: 2,
  RESET_TIMEOUT_MS: 30000,
  REQUEST_TIMEOUT_MS: 10000,
  MAX_RETRIES: 3
}
```

**Implemented Patterns:**
- Circuit breaker with three states
- Exponential backoff with jitter
- Per-service circuit isolation
- Resilient fetch wrapper combining all patterns
- Statistics tracking per circuit

**Agent Loop Error Handling** (`agent-loop.js:96-103`):
```javascript
try {
  response = await callClaudeAPI(...);
} catch (error) {
  result.completionSummary = `API error on iteration ${iteration + 1}: ${error.message}`;
  break;
}
```

### Strengths
- Production-grade circuit breaker implementation
- Proper backoff calculation with jitter
- Tool-level try/catch with graceful degradation
- Cost tracking failures don't break loops

### Gap: No Checkpointing
The article recommends:
> "Save full agent state when backgrounded: agent type, message history, iteration count, task list, custom state, timestamp"

**Current state:** No checkpoint/resume capability exists. If a loop fails, work restarts from scratch.

### Recommendation
Implement checkpointing:
```javascript
// Proposed checkpoint structure
{
  sessionId: string,
  teamId: string,
  iteration: number,
  messages: array,
  stateContext: object,
  toolCalls: array,
  timestamp: ISO8601
}
```

---

## 5. Memory & State Management

### Best Practice (Article)
> "The context.md pattern maintains portable working memory... Agents read this at session start and update it as state changes."

### Current Implementation

**Location:** `api/_lib/agent-state.js:144-188`

```javascript
const state = {
  teams: {},           // Team definitions
  tasks: [],           // Global task list
  decisions: [],       // Pending decisions
  communications: [],  // Inter-team messages
  activities: [],      // Activity feed (200 max)
  orchestration: {
    teamStatuses: {},
    worldState: 'paused',
    executionInProgress: false
  }
};
```

**Context Injection:** `context-builder.js:27-52`
```javascript
function buildTeamContext(teamId, teamPrompt, ctx) {
  sections.push(buildIdentitySection(teamId, teamPrompt));
  sections.push(buildSystemStateSection(ctx));
  sections.push(buildCurrentWorkSection(teamId, ctx));
  sections.push(buildCrossTeamSection(teamId, ctx));
  sections.push(buildRecentActivitySection(ctx));
  sections.push(buildBudgetSection(ctx));
  sections.push(buildGuidelinesSection());
  return sections.join('\n\n');
}
```

### Strengths
- Unified state manager (single source of truth)
- Context injection maps to article's "context.md" pattern
- Bounded collections (activities: 200, tasks: 100)
- State sync from agent loop results

### Gaps

**1. No Persistent Context Files**
The article recommends file-based context that agents can read/update:
```
{entity_type}/{entity_id}/
├── {entity}.json
├── {content_type}.md
├── agent_log.md
└── {sessionId}.checkpoint
```

**Current:** All state is in-memory. DynamoDB repos exist but aren't wired up.

**2. No Agent Reasoning History**
Agents don't persist their reasoning across sessions. Each invocation starts fresh.

**3. No User Preference Learning**
The context builder doesn't include learned user preferences.

### Recommendations

1. **Enable DynamoDB persistence** for durability
2. **Add context file storage** (S3 or filesystem)
3. **Implement agent memory** - reasoning history, learned patterns
4. **Add user preference section** to context builder

---

## 6. Parity (Agent ↔ UI Capability)

### Best Practice (Article)
> "Agents must accomplish anything users can do through the UI... Pick any UI action and verify the agent can achieve that outcome."

### Assessment

**UI Actions Available (based on codebase):**

| UI Action | Agent Capability | Gap |
|-----------|-----------------|-----|
| View dashboard | `get_system_state` | None |
| Create task | `create_task` | None |
| Update task | `update_task_status` | None |
| Delete task | - | **Missing tool** |
| Approve decision | - | **Missing tool** |
| Reject decision | - | **Missing tool** |
| Send message | `send_message` | None |
| View activities | `get_recent_activity` | None |
| Pause team | - | **Missing tool** |
| Set automation | - | **Missing tool** |

### Critical Gaps

1. **No decision resolution tools** - Agents can create decisions but can't resolve them
2. **No task deletion** - `removeTask()` exists in state but no tool exposes it
3. **No world control tools** - Agents can't pause/resume (intentional? should be documented)

### Recommendation
Either:
- Add missing tools for full parity, OR
- Document that world control is owner-only by design (legitimate architectural choice)

---

## 7. Emergent Capability

### Best Practice (Article)
> "Agents accomplish unanticipated tasks by composing tools flexibly."

### Assessment

**Current Tool Set Supports:**
- Task management workflows
- Cross-team coordination
- Progress reporting
- Decision escalation

**Cannot Support (tool gaps):**
- Research/information gathering
- Document creation/editing
- External service integration
- Data analysis
- File management

### The Test
> "Describe an outcome within your domain that you didn't explicitly build for. Can the agent figure out how to accomplish it in a loop?"

**Example:** "Create a competitive analysis report"
- Current agents cannot research competitors (no search/web tools)
- Cannot write documents (no file tools)
- Can only create a task for a human to do it

### Recommendation
To unlock emergent capability, add:
1. `search_web` - research capability
2. `read_file` / `write_file` - document handling
3. `call_api` - external service integration

---

## 8. Agent-to-UI Communication

### Best Practice (Article)
> "Silent agents feel broken. Communicate in real-time."

```javascript
AgentEvent types:
- thinking(String)
- toolCall(name, input)
- toolResult(output)
- textResponse(String)
- statusChange(Status)
```

### Current Implementation

**Location:** `agent-loop.js:64-84` (result accumulator)

```javascript
const result = {
  success: false,
  completed: false,
  iterations: 0,
  activities: [],
  tasksCreated: [],
  decisionsCreated: [],
  messagesSent: [],
  toolCalls: [],
  completionSummary: null,
  textResponses: [],
  usage: {...}
};
```

### Gap: No Real-Time Streaming

The agent loop batches all results and returns them at the end. There's no streaming of:
- Thinking progress
- Tool execution status
- Partial results

### Recommendation
Implement event emitter pattern:
```javascript
// Proposed
const emitter = new EventEmitter();
emitter.on('thinking', msg => broadcast(msg));
emitter.on('toolCall', ({name, input}) => broadcast({type: 'tool', name}));
emitter.on('progress', pct => broadcast({type: 'progress', pct}));
```

Or use Server-Sent Events (SSE) for the orchestration endpoint.

---

## 9. Anti-Patterns Audit

### Article's Anti-Patterns Checklist

| Anti-Pattern | Present? | Notes |
|--------------|----------|-------|
| Agent as Router | No | Agents take action |
| Build Traditional, Then Add Agent | No | Agent-native design |
| Request/Response Instead of Loops | No | Proper loop implementation |
| Over-Constrained Tools | No | Flexible inputs |
| Happy Path in Code | Partial | Some validation in tools |
| Workflow-Shaped Tools | No | Atomic tools |
| Orphan UI Actions | **Yes** | See Parity section |
| Heuristic Completion | No | Explicit `signal_completion` |

### Status: 1 Anti-Pattern Detected
- **Orphan UI Actions:** Decision approval/rejection not available to agents

---

## 10. Specific File Reference Summary

| Component | File | Key Lines |
|-----------|------|-----------|
| Agent Loop | `api/_lib/agent-loop.js` | 48-226 |
| Tools | `api/_lib/agent-tools.js` | 19-216, 231-262 |
| State Manager | `api/_lib/agent-state.js` | 144-188, 357-381 |
| Context Builder | `api/_lib/context-builder.js` | 27-52 |
| Circuit Breaker | `api/_lib/circuit-breaker.js` | 57-262 |
| World Controller | `api/_lib/world-controller.js` | 14-108, 546-589 |

---

## Prioritized Recommendations

### High Priority (Foundation)

1. **Add missing CRUD tools** for full parity
   - `delete_task`
   - `update_decision` / `resolve_decision`

2. **Enable persistence** - Wire up DynamoDB repositories

3. **Implement checkpointing** for resilience

### Medium Priority (Capability)

4. **Add primitive tools** for emergent capability
   - File read/write
   - Web search (optional)

5. **Add real-time events** for UI communication

6. **Implement context summarization** for long loops

### Lower Priority (Enhancement)

7. **Add agent memory/learning** - Cross-session context

8. **Document architectural decisions** - Why certain controls are owner-only

---

## Conclusion

The FUSE agent architecture is **well-designed** with strong foundations in:
- Loop-based orchestration
- Atomic tool design
- Human-in-the-loop controls
- Error resilience

The main gaps are:
- **Parity:** Missing tools for UI actions agents can't perform
- **Emergent capability:** Limited by tool scope
- **Persistence:** In-memory state risks data loss
- **Real-time communication:** No streaming to UI

Addressing the high-priority items will bring the architecture to full agent-native capability while maintaining the excellent safety controls already in place.
