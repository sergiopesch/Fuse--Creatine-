/**
 * FUSE Orchestrator Chat API
 * ==========================
 *
 * The primary interface for interacting with the AI agent system.
 * Users chat with the main orchestrator, which can then delegate
 * work to specialized teams.
 *
 * This is different from /api/chat (customer support) - this is
 * for the company owner/operator to interact with the AI teams.
 *
 * Features:
 * - Conversational interface with the main orchestrator
 * - Real-time delegation to specialized teams
 * - Multi-turn conversation support
 * - Streaming support (SSE) for long-running operations
 */

const {
  authenticate,
  checkRateLimit,
  setSecurityHeaders,
  getCorsOrigin,
  getClientIp,
  getRequestHost,
  addAuditEntry,
} = require('./_lib/security');

const { recordUsage } = require('./_lib/cost-tracker');
const { runOrchestratorLoop } = require('./_lib/orchestrator-agent');

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  RATE_LIMIT: 30, // Requests per minute
  MAX_MESSAGE_LENGTH: 4000, // Characters
  MAX_HISTORY_LENGTH: 20, // Messages
};

// =============================================================================
// MAIN HANDLER
// =============================================================================

module.exports = async (req, res) => {
  const clientIp = getClientIp(req);
  const origin = getCorsOrigin(req.headers.origin, getRequestHost(req));

  setSecurityHeaders(res, origin, 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validate origin
  if (req.headers.origin && !origin) {
    return res.status(403).json({ error: 'Origin not allowed', code: 'CORS_ERROR' });
  }

  try {
    switch (req.method) {
      case 'GET':
        return handleGet(req, res);
      case 'POST':
        return await handlePost(req, res, clientIp);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[Orchestrator Chat] Error:', error);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

// =============================================================================
// GET HANDLER - Health check / info
// =============================================================================

function handleGet(req, res) {
  return res.status(200).json({
    success: true,
    service: 'FUSE Orchestrator Chat',
    description: 'Chat interface for the main AI orchestrator. Send POST requests with messages to interact.',
    usage: {
      method: 'POST',
      body: {
        message: 'Your message to the orchestrator (required)',
        conversationHistory: 'Array of previous messages (optional)',
      },
    },
    capabilities: [
      'Delegate work to specialized teams (developer, design, marketing, etc.)',
      'Coordinate multi-team workflows',
      'Answer questions about the company and teams',
      'Create tasks and decisions',
      'Report on system status',
    ],
  });
}

// =============================================================================
// POST HANDLER - Chat with orchestrator
// =============================================================================

async function handlePost(req, res, clientIp) {
  // Authenticate
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return res.status(503).json({
      error: 'Orchestrator not configured',
      code: 'NOT_CONFIGURED',
    });
  }

  const authResult = authenticate(req, adminToken);
  if (!authResult.authenticated) {
    addAuditEntry({
      action: 'ORCHESTRATOR_CHAT_AUTH_FAILED',
      ip: clientIp,
      success: false,
      reason: authResult.error,
    });
    return res.status(401).json({ error: authResult.error, code: 'UNAUTHORIZED' });
  }

  // Rate limit
  const rateLimit = await checkRateLimit(
    `orchestrator-chat:${clientIp}`,
    CONFIG.RATE_LIMIT,
    60000
  );

  if (rateLimit.limited) {
    return res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMITED',
      retryAfter: Math.ceil(rateLimit.retryAfterMs / 1000),
    });
  }

  // Check API key
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    return res.status(503).json({
      error: 'Anthropic API key not configured',
      code: 'NOT_CONFIGURED',
    });
  }

  // Validate request body
  const { message, conversationHistory = [], stream = false } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      error: 'Message is required',
      code: 'VALIDATION_ERROR',
    });
  }

  if (message.length > CONFIG.MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      error: `Message too long. Maximum ${CONFIG.MAX_MESSAGE_LENGTH} characters.`,
      code: 'VALIDATION_ERROR',
    });
  }

  // Validate conversation history
  const validHistory = validateConversationHistory(conversationHistory);

  // If streaming requested, use SSE
  if (stream) {
    return handleStreamingChat(req, res, message, validHistory, apiKey, clientIp);
  }

  // Non-streaming request
  const startTime = Date.now();

  try {
    const result = await runOrchestratorLoop(message, validHistory, {
      apiKey,
      clientIp,
      onEvent: (event) => {
        // Log events for debugging
        if (process.env.DEBUG_ORCHESTRATOR === 'true') {
          console.log('[Orchestrator Event]', event.type, event);
        }
      },
    });

    const latencyMs = Date.now() - startTime;

    // Record usage
    recordUsage({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      inputTokens: result.usage?.inputTokens || 0,
      outputTokens: result.usage?.outputTokens || 0,
      endpoint: '/api/orchestrator-chat',
      clientIp,
      success: result.success,
      latencyMs,
    });

    addAuditEntry({
      action: 'ORCHESTRATOR_CHAT',
      ip: clientIp,
      success: result.success,
      delegations: result.delegations?.length || 0,
      iterations: result.iterations,
    });

    return res.status(200).json({
      success: result.success,
      message: result.userResponse,
      role: 'assistant',
      metadata: {
        delegations: result.delegations || [],
        decisionsCreated: result.decisionsCreated || [],
        iterations: result.iterations,
        usage: result.usage,
        latencyMs,
      },
    });

  } catch (error) {
    console.error('[Orchestrator Chat] Error:', error);

    recordUsage({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      inputTokens: 0,
      outputTokens: 0,
      endpoint: '/api/orchestrator-chat',
      clientIp,
      success: false,
      latencyMs: Date.now() - startTime,
    });

    return res.status(500).json({
      error: 'Orchestration failed',
      code: 'ORCHESTRATION_ERROR',
      details: error.message,
    });
  }
}

// =============================================================================
// STREAMING HANDLER (SSE)
// =============================================================================

async function handleStreamingChat(req, res, message, conversationHistory, apiKey, clientIp) {
  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (type, data) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('connected', { message: 'Orchestrator connected' });

  const startTime = Date.now();

  try {
    const result = await runOrchestratorLoop(message, conversationHistory, {
      apiKey,
      clientIp,
      onEvent: (event) => {
        // Stream events to client
        sendEvent(event.type, event);
      },
    });

    const latencyMs = Date.now() - startTime;

    // Send final result
    sendEvent('completed', {
      success: result.success,
      message: result.userResponse,
      delegations: result.delegations || [],
      decisionsCreated: result.decisionsCreated || [],
      iterations: result.iterations,
      usage: result.usage,
      latencyMs,
    });

    // Record usage
    recordUsage({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      inputTokens: result.usage?.inputTokens || 0,
      outputTokens: result.usage?.outputTokens || 0,
      endpoint: '/api/orchestrator-chat (stream)',
      clientIp,
      success: result.success,
      latencyMs,
    });

    addAuditEntry({
      action: 'ORCHESTRATOR_CHAT_STREAM',
      ip: clientIp,
      success: result.success,
      delegations: result.delegations?.length || 0,
      iterations: result.iterations,
    });

  } catch (error) {
    console.error('[Orchestrator Chat Stream] Error:', error);
    sendEvent('error', { message: error.message });
  }

  sendEvent('stream_end', {});
  res.end();
}

// =============================================================================
// HELPERS
// =============================================================================

function validateConversationHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(
      msg =>
        msg &&
        typeof msg === 'object' &&
        typeof msg.content === 'string' &&
        (msg.role === 'user' || msg.role === 'assistant') &&
        msg.content.trim().length > 0 &&
        msg.content.length <= CONFIG.MAX_MESSAGE_LENGTH
    )
    .slice(-CONFIG.MAX_HISTORY_LENGTH)
    .map(msg => ({
      role: msg.role,
      content: msg.content.trim(),
    }));
}
