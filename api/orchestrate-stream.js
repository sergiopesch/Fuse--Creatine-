/**
 * Orchestrate Stream - Server-Sent Events for Real-Time Agent Communication
 * ==========================================================================
 *
 * Provides real-time streaming of agent loop events to the UI.
 * Following the agent-native architecture guide:
 * - Silent agents feel broken
 * - Communicate in real-time
 *
 * Event Types:
 * - thinking(message)
 * - tool_call(name, input)
 * - tool_result(name, success)
 * - task_created(task)
 * - decision_created(decision)
 * - message_sent(message)
 * - iteration_started/completed
 * - loop_started/completed
 * - error(message)
 */

const { runAgentLoop } = require('./_lib/agent-loop');
const { buildStateContext, getTeamPrompt, syncFromAgentLoop } = require('./_lib/agent-state');
const { checkCreditLimits } = require('./_lib/world-controller');
const { authenticate } = require('./_lib/security');

// =============================================================================
// SSE HELPERS
// =============================================================================

/**
 * Format an event for SSE transmission
 */
function formatSSE(event, data) {
  const lines = [];
  if (event) lines.push(`event: ${event}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  lines.push(''); // Empty line to end the event
  return lines.join('\n') + '\n';
}

/**
 * Send an SSE event
 */
function sendEvent(res, event, data) {
  if (!res.writableEnded) {
    res.write(formatSSE(event, data));
  }
}

/**
 * Send a heartbeat to keep connection alive
 */
function sendHeartbeat(res) {
  if (!res.writableEnded) {
    res.write(`: heartbeat\n\n`);
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

module.exports = async (req, res) => {
  // Only allow POST for triggering, GET for SSE stream
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Authenticate
  const authResult = authenticate(req);
  if (!authResult.authenticated) {
    return res.status(401).json({ error: 'Unauthorized', message: authResult.error });
  }

  // Handle POST to start a streaming orchestration
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST to start streaming.' });
  }

  const { teamId, task, apiKey } = req.body;

  // Validate required fields
  if (!teamId) {
    return res.status(400).json({ error: 'teamId is required' });
  }
  if (!task) {
    return res.status(400).json({ error: 'task is required' });
  }
  if (!apiKey) {
    return res.status(400).json({ error: 'apiKey is required' });
  }

  // Get team prompt
  const teamPrompt = getTeamPrompt(teamId);
  if (!teamPrompt) {
    return res.status(404).json({ error: `Unknown team: ${teamId}` });
  }

  // Check credit limits
  const creditStatus = checkCreditLimits();
  if (!creditStatus.canProceed) {
    return res.status(402).json({
      error: 'Credit limit reached',
      message: creditStatus.message,
      creditStatus,
    });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection event
  sendEvent(res, 'connected', {
    message: 'SSE stream established',
    teamId,
    timestamp: new Date().toISOString(),
  });

  // Set up heartbeat interval
  const heartbeatInterval = setInterval(() => {
    sendHeartbeat(res);
  }, 15000); // Every 15 seconds

  // Clean up on connection close
  req.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  try {
    // Build state context
    const stateContext = buildStateContext(creditStatus);

    // Create event handler for real-time updates
    const onEvent = (event) => {
      sendEvent(res, event.type, {
        ...event,
        timestamp: new Date().toISOString(),
      });
    };

    // Send starting event
    onEvent({
      type: 'orchestration_started',
      teamId,
      teamName: teamPrompt.name,
      task: task.substring(0, 200),
    });

    // Run the agent loop with streaming events
    const result = await runAgentLoop(teamId, task, teamPrompt, stateContext, {
      apiKey,
      clientIp: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
      onEvent,
    });

    // Sync results back to state
    syncFromAgentLoop(result, stateContext);

    // Send final result
    sendEvent(res, 'orchestration_completed', {
      success: result.success,
      completed: result.completed,
      iterations: result.iterations,
      tasksCreated: result.tasksCreated?.length || 0,
      decisionsCreated: result.decisionsCreated?.length || 0,
      messagesSent: result.messagesSent?.length || 0,
      toolCalls: result.toolCalls?.length || 0,
      summary: result.completionSummary,
      sessionId: result.sessionId,
      usage: result.usage,
    });

  } catch (error) {
    console.error('[orchestrate-stream] Error:', error);

    sendEvent(res, 'error', {
      message: error.message,
      code: error.code || 'EXECUTION_ERROR',
    });

  } finally {
    // Clean up and close stream
    clearInterval(heartbeatInterval);

    sendEvent(res, 'stream_end', {
      message: 'Stream completed',
      timestamp: new Date().toISOString(),
    });

    res.end();
  }
};
