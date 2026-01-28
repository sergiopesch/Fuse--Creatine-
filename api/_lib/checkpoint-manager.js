/**
 * Checkpoint Manager - Agent Loop Resilience
 * ==========================================
 *
 * Implements checkpointing for agent loops to enable resume after failures.
 * Following the agent-native architecture guide:
 * - Save full agent state when backgrounded
 * - Resume from checkpoints after interruption
 *
 * Checkpoint structure:
 * {
 *   sessionId: string,
 *   teamId: string,
 *   task: string,
 *   iteration: number,
 *   messages: array,
 *   stateContext: object,
 *   toolCalls: array,
 *   result: object,
 *   createdAt: ISO8601,
 *   updatedAt: ISO8601,
 *   status: 'running' | 'completed' | 'failed' | 'interrupted'
 * }
 */

const fs = require('fs').promises;
const path = require('path');

// =============================================================================
// CONFIGURATION
// =============================================================================

const CHECKPOINT_DIR = process.env.AGENT_CHECKPOINT_DIR || path.join(process.cwd(), '.agent-checkpoints');
const CHECKPOINT_RETENTION_HOURS = 24; // Keep checkpoints for 24 hours
const MAX_CHECKPOINTS_PER_TEAM = 10;

// =============================================================================
// CHECKPOINT OPERATIONS
// =============================================================================

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get the checkpoint file path for a session
 */
function getCheckpointPath(sessionId) {
  return path.join(CHECKPOINT_DIR, `${sessionId}.json`);
}

/**
 * Ensure checkpoint directory exists
 */
async function ensureCheckpointDir() {
  try {
    await fs.mkdir(CHECKPOINT_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.error('[checkpoint] Failed to create checkpoint directory:', error.message);
    }
  }
}

/**
 * Save a checkpoint
 *
 * @param {object} checkpoint - The checkpoint data
 * @returns {Promise<string>} The session ID
 */
async function saveCheckpoint(checkpoint) {
  await ensureCheckpointDir();

  const sessionId = checkpoint.sessionId || generateSessionId();
  const filePath = getCheckpointPath(sessionId);

  const data = {
    ...checkpoint,
    sessionId,
    updatedAt: new Date().toISOString(),
    createdAt: checkpoint.createdAt || new Date().toISOString(),
  };

  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return sessionId;
  } catch (error) {
    console.error('[checkpoint] Failed to save checkpoint:', error.message);
    throw error;
  }
}

/**
 * Load a checkpoint by session ID
 *
 * @param {string} sessionId - The session ID to load
 * @returns {Promise<object|null>} The checkpoint data or null if not found
 */
async function loadCheckpoint(sessionId) {
  const filePath = getCheckpointPath(sessionId);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    console.error('[checkpoint] Failed to load checkpoint:', error.message);
    throw error;
  }
}

/**
 * Delete a checkpoint
 *
 * @param {string} sessionId - The session ID to delete
 */
async function deleteCheckpoint(sessionId) {
  const filePath = getCheckpointPath(sessionId);

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[checkpoint] Failed to delete checkpoint:', error.message);
    }
  }
}

/**
 * Update checkpoint status
 *
 * @param {string} sessionId - The session ID
 * @param {string} status - New status
 * @param {object} updates - Additional updates
 */
async function updateCheckpointStatus(sessionId, status, updates = {}) {
  const checkpoint = await loadCheckpoint(sessionId);
  if (!checkpoint) {
    console.warn(`[checkpoint] Cannot update non-existent checkpoint: ${sessionId}`);
    return null;
  }

  checkpoint.status = status;
  checkpoint.updatedAt = new Date().toISOString();
  Object.assign(checkpoint, updates);

  await saveCheckpoint(checkpoint);
  return checkpoint;
}

/**
 * Get all checkpoints for a team
 *
 * @param {string} teamId - The team ID
 * @returns {Promise<object[]>} Array of checkpoint summaries
 */
async function getTeamCheckpoints(teamId) {
  await ensureCheckpointDir();

  try {
    const files = await fs.readdir(CHECKPOINT_DIR);
    const checkpoints = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const content = await fs.readFile(path.join(CHECKPOINT_DIR, file), 'utf-8');
        const checkpoint = JSON.parse(content);

        if (checkpoint.teamId === teamId) {
          checkpoints.push({
            sessionId: checkpoint.sessionId,
            teamId: checkpoint.teamId,
            task: checkpoint.task?.substring(0, 100),
            iteration: checkpoint.iteration,
            status: checkpoint.status,
            createdAt: checkpoint.createdAt,
            updatedAt: checkpoint.updatedAt,
          });
        }
      } catch {
        // Skip invalid files
      }
    }

    // Sort by updated time, most recent first
    checkpoints.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return checkpoints;
  } catch (error) {
    console.error('[checkpoint] Failed to list checkpoints:', error.message);
    return [];
  }
}

/**
 * Get resumable checkpoints (running or interrupted)
 *
 * @param {string} teamId - Optional team ID filter
 * @returns {Promise<object[]>} Array of resumable checkpoint summaries
 */
async function getResumableCheckpoints(teamId = null) {
  await ensureCheckpointDir();

  try {
    const files = await fs.readdir(CHECKPOINT_DIR);
    const checkpoints = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const content = await fs.readFile(path.join(CHECKPOINT_DIR, file), 'utf-8');
        const checkpoint = JSON.parse(content);

        // Only include running or interrupted checkpoints
        if (!['running', 'interrupted'].includes(checkpoint.status)) continue;

        // Filter by team if specified
        if (teamId && checkpoint.teamId !== teamId) continue;

        checkpoints.push({
          sessionId: checkpoint.sessionId,
          teamId: checkpoint.teamId,
          task: checkpoint.task?.substring(0, 100),
          iteration: checkpoint.iteration,
          status: checkpoint.status,
          toolCalls: checkpoint.toolCalls?.length || 0,
          createdAt: checkpoint.createdAt,
          updatedAt: checkpoint.updatedAt,
        });
      } catch {
        // Skip invalid files
      }
    }

    // Sort by updated time, most recent first
    checkpoints.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return checkpoints;
  } catch (error) {
    console.error('[checkpoint] Failed to list resumable checkpoints:', error.message);
    return [];
  }
}

/**
 * Clean up old checkpoints
 *
 * @param {number} maxAgeHours - Maximum age in hours (default: CHECKPOINT_RETENTION_HOURS)
 */
async function cleanupOldCheckpoints(maxAgeHours = CHECKPOINT_RETENTION_HOURS) {
  await ensureCheckpointDir();

  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

  try {
    const files = await fs.readdir(CHECKPOINT_DIR);
    let deleted = 0;

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(CHECKPOINT_DIR, file);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const checkpoint = JSON.parse(content);

        const updatedAt = new Date(checkpoint.updatedAt).getTime();

        // Delete if old AND completed or failed
        if (updatedAt < cutoff && ['completed', 'failed'].includes(checkpoint.status)) {
          await fs.unlink(filePath);
          deleted++;
        }
      } catch {
        // If we can't read it, check file age and delete if old
        try {
          const stats = await fs.stat(filePath);
          if (stats.mtimeMs < cutoff) {
            await fs.unlink(filePath);
            deleted++;
          }
        } catch {
          // Skip
        }
      }
    }

    if (deleted > 0) {
      console.log(`[checkpoint] Cleaned up ${deleted} old checkpoint(s)`);
    }
  } catch (error) {
    console.error('[checkpoint] Failed to cleanup checkpoints:', error.message);
  }
}

/**
 * Enforce maximum checkpoints per team
 *
 * @param {string} teamId - The team ID
 */
async function enforceTeamCheckpointLimit(teamId) {
  const checkpoints = await getTeamCheckpoints(teamId);

  if (checkpoints.length > MAX_CHECKPOINTS_PER_TEAM) {
    // Delete oldest completed/failed checkpoints first
    const toDelete = checkpoints
      .filter(cp => ['completed', 'failed'].includes(cp.status))
      .slice(MAX_CHECKPOINTS_PER_TEAM);

    for (const cp of toDelete) {
      await deleteCheckpoint(cp.sessionId);
    }
  }
}

// =============================================================================
// CHECKPOINT WRAPPER FOR AGENT LOOP
// =============================================================================

/**
 * Create a checkpoint-enabled wrapper for agent loop state
 */
function createCheckpointState(teamId, task, teamPrompt, stateContext) {
  const sessionId = generateSessionId();

  return {
    sessionId,
    teamId,
    task,
    teamPrompt: {
      name: teamPrompt.name,
      agents: teamPrompt.agents,
    },
    stateContext: {
      // Only persist essential state context
      teams: stateContext.teams,
      worldState: stateContext.worldState,
      creditStatus: stateContext.creditStatus,
      // Tasks and decisions are in main state
    },
    iteration: 0,
    messages: [],
    toolCalls: [],
    textResponses: [],
    result: null,
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Update checkpoint after each iteration
 */
async function checkpointAfterIteration(checkpoint, iteration, messages, toolCalls, textResponses) {
  checkpoint.iteration = iteration;
  checkpoint.messages = messages;
  checkpoint.toolCalls = toolCalls;
  checkpoint.textResponses = textResponses;
  checkpoint.updatedAt = new Date().toISOString();

  await saveCheckpoint(checkpoint);
}

/**
 * Finalize checkpoint when loop completes
 */
async function finalizeCheckpoint(checkpoint, result, status = 'completed') {
  checkpoint.result = result;
  checkpoint.status = status;
  checkpoint.updatedAt = new Date().toISOString();

  await saveCheckpoint(checkpoint);

  // Cleanup old checkpoints for this team
  await enforceTeamCheckpointLimit(checkpoint.teamId);
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Core operations
  generateSessionId,
  saveCheckpoint,
  loadCheckpoint,
  deleteCheckpoint,
  updateCheckpointStatus,

  // Queries
  getTeamCheckpoints,
  getResumableCheckpoints,

  // Maintenance
  cleanupOldCheckpoints,
  enforceTeamCheckpointLimit,

  // Agent loop helpers
  createCheckpointState,
  checkpointAfterIteration,
  finalizeCheckpoint,

  // Constants
  CHECKPOINT_DIR,
  CHECKPOINT_RETENTION_HOURS,
  MAX_CHECKPOINTS_PER_TEAM,
};
