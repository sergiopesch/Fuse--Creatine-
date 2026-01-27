/**
 * Agent Loop - Agentic Runtime
 * =============================
 *
 * Implements the observe-act-evaluate loop that makes agents truly agentic.
 * Instead of single-shot text generation, agents iterate with tools until
 * they signal completion or hit the iteration limit.
 *
 * Loop: Call Claude with tools → Execute tool calls → Feed results back → Repeat
 *
 * Implements the guide's principles:
 * - Agents in a loop (not single-shot)
 * - Explicit completion signals (signal_completion tool)
 * - Tool-based action (not just text)
 * - Rich context injection via system prompt
 */

const { AGENT_TOOLS, executeAgentTool } = require('./agent-tools');
const { buildTeamContext } = require('./context-builder');
const { recordUsage, estimateTokens } = require('./cost-tracker');

// =============================================================================
// CONFIGURATION
// =============================================================================

const LOOP_CONFIG = {
  MAX_ITERATIONS: 6,           // Max tool-use cycles per invocation
  MODEL: 'claude-3-5-haiku-latest',
  MAX_TOKENS: 1024,            // Per API call (higher than single-shot for tool reasoning)
  API_TIMEOUT_MS: 20000,       // 20s timeout per API call
  ANTHROPIC_VERSION: '2023-06-01',
};

// =============================================================================
// MAIN AGENT LOOP
// =============================================================================

/**
 * Run an agentic loop for a team.
 *
 * @param {string} teamId - The team to orchestrate
 * @param {string} task - The task/assignment in natural language
 * @param {object} teamPrompt - Team prompt config { name, systemPrompt, agents }
 * @param {object} stateContext - Mutable state context for tools
 * @param {object} options - { apiKey, model, maxIterations, clientIp }
 * @returns {Promise<AgentLoopResult>}
 */
async function runAgentLoop(teamId, task, teamPrompt, stateContext, options = {}) {
  const apiKey = options.apiKey;
  const model = options.model || LOOP_CONFIG.MODEL;
  const maxIterations = options.maxIterations || LOOP_CONFIG.MAX_ITERATIONS;
  const clientIp = options.clientIp || 'internal';

  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    throw new Error('Valid Anthropic API key required (sk-ant-...)');
  }

  // Build context-rich system prompt
  const systemPrompt = buildTeamContext(teamId, teamPrompt, stateContext);

  // Initialize conversation with the assignment
  const messages = [{ role: 'user', content: buildAssignmentPrompt(task, teamPrompt) }];

  // Result accumulator
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
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
      apiCalls: 0,
    },
    teamId,
    teamName: teamPrompt.name,
  };

  // Track activities count before loop to extract new ones after
  const activitiesBefore = (stateContext.activities || []).length;

  // -------------------------------------------------------------------------
  // THE LOOP
  // -------------------------------------------------------------------------
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    result.iterations = iteration + 1;

    // Call Claude API with tools
    let response;
    try {
      response = await callClaudeAPI(apiKey, model, systemPrompt, messages, AGENT_TOOLS);
    } catch (error) {
      // If API call fails, log and stop
      result.completionSummary = `API error on iteration ${iteration + 1}: ${error.message}`;
      break;
    }

    // Track usage
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    result.usage.inputTokens += inputTokens;
    result.usage.outputTokens += outputTokens;
    result.usage.apiCalls += 1;

    // Record cost
    try {
      const costResult = recordUsage({
        provider: 'anthropic',
        model,
        inputTokens,
        outputTokens,
        endpoint: '/api/orchestrate (agentic)',
        clientIp,
        success: true,
        latencyMs: response._latencyMs || 0,
      });
      result.usage.totalCost += costResult?.cost || 0;
    } catch (_e) {
      // Cost tracking failure shouldn't break the loop
    }

    // Process response content blocks
    const content = response.content || [];
    messages.push({ role: 'assistant', content });

    // Extract text responses
    const textBlocks = content.filter(b => b.type === 'text');
    if (textBlocks.length > 0) {
      result.textResponses.push(
        ...textBlocks.map(b => ({
          text: b.text,
          iteration: iteration + 1,
        }))
      );
    }

    // Extract tool use blocks
    const toolUseBlocks = content.filter(b => b.type === 'tool_use');

    // If no tool use, agent is done (pure text response = natural completion)
    if (toolUseBlocks.length === 0) {
      result.completed = true;
      result.completionSummary =
        textBlocks.map(b => b.text).join('\n') || 'Agent completed without explicit summary.';
      break;
    }

    // Execute each tool call
    const toolResults = [];
    let completionSignaled = false;

    for (const toolUse of toolUseBlocks) {
      const toolResult = executeAgentTool(
        toolUse.name,
        toolUse.input || {},
        teamId,
        stateContext
      );

      // Track the tool call
      result.toolCalls.push({
        tool: toolUse.name,
        input: toolUse.input,
        output: toolResult,
        iteration: iteration + 1,
      });

      // Track side effects
      if (toolUse.name === 'create_task' && toolResult.success) {
        result.tasksCreated.push(toolResult.data);
      }
      if (toolUse.name === 'create_decision_request' && toolResult.success) {
        result.decisionsCreated.push(toolResult.data);
      }
      if (toolUse.name === 'send_message' && toolResult.success) {
        result.messagesSent.push(toolResult.data);
      }

      // Check for completion signal
      if (toolUse.name === 'signal_completion') {
        completionSignaled = true;
        result.completed = true;
        result.completionSummary = toolResult.data?.summary || 'Completed';
      }

      // Build tool result message
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(toolResult),
      });
    }

    // Feed tool results back to Claude
    messages.push({ role: 'user', content: toolResults });

    // If completion was signaled, break after feeding results
    if (completionSignaled) {
      break;
    }
  }

  // -------------------------------------------------------------------------
  // POST-LOOP
  // -------------------------------------------------------------------------

  // Extract new activities created during the loop
  const allActivities = stateContext.activities || [];
  result.activities = allActivities.slice(0, allActivities.length - activitiesBefore);

  // If we hit max iterations without completion
  if (!result.completed) {
    result.completionSummary = `Reached maximum iterations (${maxIterations}). Work may be incomplete.`;
  }

  result.success = result.completed || result.toolCalls.length > 0;

  return result;
}

// =============================================================================
// CLAUDE API CALLER
// =============================================================================

/**
 * Call the Claude API with tools.
 *
 * @param {string} apiKey - Anthropic API key
 * @param {string} model - Model ID
 * @param {string} systemPrompt - System prompt
 * @param {Array} messages - Conversation messages
 * @param {Array} tools - Tool definitions
 * @returns {Promise<object>} Claude API response
 */
async function callClaudeAPI(apiKey, model, systemPrompt, messages, tools) {
  const startTime = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOP_CONFIG.API_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': LOOP_CONFIG.ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: LOOP_CONFIG.MAX_TOKENS,
        system: systemPrompt,
        messages,
        tools,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unable to read error body');
      throw new Error(`Claude API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    data._latencyMs = Date.now() - startTime;
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Build the initial assignment prompt for the agent.
 */
function buildAssignmentPrompt(task, teamPrompt) {
  return `## Assignment

${task}

## Your Team

You are leading: ${teamPrompt.agents.join(', ')}

## Instructions

1. Assess the current situation using observation tools if needed.
2. Take concrete action using your tools - create tasks, coordinate with teams, report findings.
3. When finished, call signal_completion with a summary of what you accomplished.

Begin.`;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  runAgentLoop,
  LOOP_CONFIG,
};
