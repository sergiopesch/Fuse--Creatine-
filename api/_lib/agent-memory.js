/**
 * Agent Memory - Cross-Session Learning & Context
 * ================================================
 *
 * Implements persistent memory for agents following the agent-native guide:
 * - Learn from interactions over time
 * - Remember owner preferences
 * - Track patterns and context
 * - Provide relevant context injection
 *
 * Memory Types:
 * - Preferences: Owner's stated or inferred preferences
 * - Patterns: Learned behavioral patterns
 * - Context: Relevant background information
 * - Interactions: Key interaction summaries
 */

const fs = require('fs').promises;
const path = require('path');

// =============================================================================
// CONFIGURATION
// =============================================================================

const MEMORY_DIR = process.env.AGENT_MEMORY_DIR || path.join(process.cwd(), '.agent-memory');
const MAX_PREFERENCES = 50;
const MAX_PATTERNS = 50;
const MAX_CONTEXT = 30;
const MAX_INTERACTIONS = 100;

// =============================================================================
// MEMORY STRUCTURE
// =============================================================================

/**
 * Default memory structure for a team
 */
function createDefaultMemory(teamId) {
  return {
    teamId,
    preferences: [],    // Owner preferences learned over time
    patterns: [],       // Behavioral patterns observed
    context: [],        // Relevant background context
    interactions: [],   // Key interaction summaries
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };
}

// =============================================================================
// FILE OPERATIONS
// =============================================================================

/**
 * Get memory file path for a team
 */
function getMemoryPath(teamId) {
  return path.join(MEMORY_DIR, `${teamId}.memory.json`);
}

/**
 * Ensure memory directory exists
 */
async function ensureMemoryDir() {
  try {
    await fs.mkdir(MEMORY_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.error('[agent-memory] Failed to create memory directory:', error.message);
    }
  }
}

/**
 * Load team memory from file
 */
async function loadMemory(teamId) {
  await ensureMemoryDir();
  const filePath = getMemoryPath(teamId);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Return default memory for new teams
      return createDefaultMemory(teamId);
    }
    console.error('[agent-memory] Failed to load memory:', error.message);
    return createDefaultMemory(teamId);
  }
}

/**
 * Save team memory to file
 */
async function saveMemory(memory) {
  await ensureMemoryDir();
  const filePath = getMemoryPath(memory.teamId);

  memory.updatedAt = new Date().toISOString();

  try {
    await fs.writeFile(filePath, JSON.stringify(memory, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('[agent-memory] Failed to save memory:', error.message);
    return false;
  }
}

// =============================================================================
// MEMORY OPERATIONS
// =============================================================================

/**
 * Add a preference to team memory
 *
 * @param {string} teamId - Team ID
 * @param {string} preference - Preference statement
 * @param {string} source - Where this preference was learned from
 */
async function addPreference(teamId, preference, source = 'inferred') {
  const memory = await loadMemory(teamId);

  // Check for duplicates (fuzzy match)
  const exists = memory.preferences.some(p =>
    p.text.toLowerCase().includes(preference.toLowerCase().substring(0, 30)) ||
    preference.toLowerCase().includes(p.text.toLowerCase().substring(0, 30))
  );

  if (!exists) {
    memory.preferences.unshift({
      text: preference,
      source,
      addedAt: new Date().toISOString(),
      confidence: source === 'explicit' ? 1.0 : 0.7,
    });

    // Enforce limit
    if (memory.preferences.length > MAX_PREFERENCES) {
      memory.preferences = memory.preferences.slice(0, MAX_PREFERENCES);
    }

    await saveMemory(memory);
  }

  return memory;
}

/**
 * Add a learned pattern to team memory
 *
 * @param {string} teamId - Team ID
 * @param {string} pattern - Pattern description
 * @param {number} occurrences - How many times this pattern was observed
 */
async function addPattern(teamId, pattern, occurrences = 1) {
  const memory = await loadMemory(teamId);

  // Check for existing pattern
  const existingIndex = memory.patterns.findIndex(p =>
    p.text.toLowerCase() === pattern.toLowerCase()
  );

  if (existingIndex >= 0) {
    // Update existing pattern
    memory.patterns[existingIndex].occurrences += occurrences;
    memory.patterns[existingIndex].lastSeen = new Date().toISOString();
  } else {
    // Add new pattern
    memory.patterns.unshift({
      text: pattern,
      occurrences,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    });
  }

  // Sort by occurrences and enforce limit
  memory.patterns.sort((a, b) => b.occurrences - a.occurrences);
  if (memory.patterns.length > MAX_PATTERNS) {
    memory.patterns = memory.patterns.slice(0, MAX_PATTERNS);
  }

  await saveMemory(memory);
  return memory;
}

/**
 * Add context to team memory
 *
 * @param {string} teamId - Team ID
 * @param {string} context - Context information
 * @param {string} category - Category (e.g., 'project', 'stakeholder', 'constraint')
 */
async function addContext(teamId, context, category = 'general') {
  const memory = await loadMemory(teamId);

  // Check for duplicates
  const exists = memory.context.some(c => c.text === context);

  if (!exists) {
    memory.context.unshift({
      text: context,
      category,
      addedAt: new Date().toISOString(),
    });

    // Enforce limit
    if (memory.context.length > MAX_CONTEXT) {
      memory.context = memory.context.slice(0, MAX_CONTEXT);
    }

    await saveMemory(memory);
  }

  return memory;
}

/**
 * Record an interaction summary
 *
 * @param {string} teamId - Team ID
 * @param {object} interaction - { task, outcome, toolsUsed, duration }
 */
async function recordInteraction(teamId, interaction) {
  const memory = await loadMemory(teamId);

  memory.interactions.unshift({
    ...interaction,
    timestamp: new Date().toISOString(),
  });

  // Enforce limit
  if (memory.interactions.length > MAX_INTERACTIONS) {
    memory.interactions = memory.interactions.slice(0, MAX_INTERACTIONS);
  }

  await saveMemory(memory);
  return memory;
}

/**
 * Get memory for context injection
 * Returns a simplified view suitable for prompt injection
 *
 * @param {string} teamId - Team ID
 * @param {object} options - { maxPreferences, maxPatterns, maxContext }
 */
async function getMemoryForContext(teamId, options = {}) {
  const memory = await loadMemory(teamId);
  const {
    maxPreferences = 5,
    maxPatterns = 5,
    maxContext = 3,
  } = options;

  return {
    preferences: memory.preferences
      .slice(0, maxPreferences)
      .map(p => p.text),
    patterns: memory.patterns
      .slice(0, maxPatterns)
      .map(p => p.text),
    context: memory.context
      .slice(0, maxContext)
      .map(c => c.text),
  };
}

/**
 * Get full memory for a team
 */
async function getFullMemory(teamId) {
  return loadMemory(teamId);
}

/**
 * Clear all memory for a team
 */
async function clearMemory(teamId) {
  const filePath = getMemoryPath(teamId);

  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[agent-memory] Failed to clear memory:', error.message);
    }
    return false;
  }
}

/**
 * Remove a specific preference
 */
async function removePreference(teamId, preferenceText) {
  const memory = await loadMemory(teamId);
  const originalLength = memory.preferences.length;

  memory.preferences = memory.preferences.filter(
    p => p.text.toLowerCase() !== preferenceText.toLowerCase()
  );

  if (memory.preferences.length < originalLength) {
    await saveMemory(memory);
    return true;
  }

  return false;
}

/**
 * Remove a specific context item
 */
async function removeContext(teamId, contextText) {
  const memory = await loadMemory(teamId);
  const originalLength = memory.context.length;

  memory.context = memory.context.filter(
    c => c.text.toLowerCase() !== contextText.toLowerCase()
  );

  if (memory.context.length < originalLength) {
    await saveMemory(memory);
    return true;
  }

  return false;
}

// =============================================================================
// LEARNING FROM INTERACTIONS
// =============================================================================

/**
 * Analyze interaction and extract learnings
 * Call this after each agent loop to potentially learn from the interaction
 *
 * @param {string} teamId - Team ID
 * @param {object} loopResult - Result from agent loop
 * @param {string} task - Original task
 */
async function learnFromInteraction(teamId, loopResult, task) {
  const learnings = [];

  // Record the interaction
  await recordInteraction(teamId, {
    task: task.substring(0, 200),
    outcome: loopResult.completed ? 'completed' : 'incomplete',
    toolsUsed: loopResult.toolCalls?.map(tc => tc.tool) || [],
    iterations: loopResult.iterations,
    tasksCreated: loopResult.tasksCreated?.length || 0,
    decisionsCreated: loopResult.decisionsCreated?.length || 0,
  });

  // Learn patterns from tool usage
  if (loopResult.toolCalls && loopResult.toolCalls.length > 0) {
    // Find frequently used tools
    const toolCounts = {};
    loopResult.toolCalls.forEach(tc => {
      toolCounts[tc.tool] = (toolCounts[tc.tool] || 0) + 1;
    });

    for (const [tool, count] of Object.entries(toolCounts)) {
      if (count >= 2) {
        await addPattern(teamId, `Often uses ${tool} tool for tasks`, count);
        learnings.push(`Observed frequent use of ${tool}`);
      }
    }
  }

  // Learn from task completion patterns
  if (loopResult.completed && loopResult.iterations <= 3) {
    await addPattern(teamId, 'Efficient task completion (≤3 iterations)', 1);
    learnings.push('Noted efficient completion pattern');
  }

  // Learn from cross-team coordination
  if (loopResult.messagesSent && loopResult.messagesSent.length > 0) {
    const targetTeams = [...new Set(loopResult.messagesSent.map(m => m.toTeam))];
    for (const targetTeam of targetTeams) {
      await addPattern(teamId, `Coordinates with ${targetTeam} team`, 1);
      learnings.push(`Noted coordination with ${targetTeam}`);
    }
  }

  return learnings;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Core operations
  loadMemory,
  saveMemory,
  getFullMemory,
  clearMemory,

  // Memory additions
  addPreference,
  addPattern,
  addContext,
  recordInteraction,

  // Memory removals
  removePreference,
  removeContext,

  // Context injection
  getMemoryForContext,

  // Learning
  learnFromInteraction,

  // Constants
  MEMORY_DIR,
  MAX_PREFERENCES,
  MAX_PATTERNS,
  MAX_CONTEXT,
  MAX_INTERACTIONS,
};
