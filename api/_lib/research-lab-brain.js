const { recordUsage } = require('./cost-tracker');

const DEFAULT_MODEL = 'gpt-5-mini';
const DEFAULT_WEEKLY_MODEL = 'gpt-5.5';
const API_TIMEOUT_MS = 18000;
const WEEKLY_API_TIMEOUT_MS = 45000;

const LAB_BRAIN_SYSTEM = `You are the FUSE Bio-Synthesis Laboratory daily research brain.

You coordinate seven internal AI research agents investigating coffee-compatible creatine monohydrate formats.

Rules:
- Treat every output as an internal hypothesis, never as wet-lab truth.
- Do not make public claims. Do not claim final <3s dissolution, zero grit, absorption superiority, GMP, Made in Britain, or medical benefits.
- Stay inside UK/EU supplement claim boundaries. Creatine evidence may be discussed internally, but delivery-system claims need validation.
- Prefer manufacturable, low-IP-risk, dose-accurate monohydrate routes unless the data strongly suggests otherwise.
- Generate concrete value for Sergio: what changed, what to test physically next, what risk needs review, and what decision is needed.
- Return only valid JSON matching the requested schema.`;

function getModel(overrideModel = '') {
    return (
        String(overrideModel || '').trim() ||
        process.env.FUSE_LAB_AI_MODEL?.trim() ||
        process.env.FUSE_CHAT_MODEL?.trim() ||
        DEFAULT_MODEL
    );
}

function getWeeklyModel(overrideModel = '') {
    return String(overrideModel || '').trim() || process.env.FUSE_LAB_WEEKLY_MODEL?.trim() || DEFAULT_WEEKLY_MODEL;
}

function getWeeklyReasoningEffort(overrideEffort = '') {
    const effort = String(overrideEffort || '').trim() || process.env.FUSE_LAB_WEEKLY_REASONING?.trim() || 'high';
    return ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'].includes(effort)
        ? effort
        : 'high';
}

function getApiKey() {
    return process.env.OPENAI_API_KEY?.trim() || '';
}

function isEnabled(runtimeEnabled = true) {
    if (runtimeEnabled === false) return false;
    if (process.env.FUSE_LAB_AI_ENABLED === 'false') return false;
    return getApiKey().startsWith('sk-');
}

function extractResponseText(data) {
    if (typeof data?.output_text === 'string' && data.output_text.trim()) {
        return data.output_text.trim();
    }

    const parts = [];
    for (const item of data?.output || []) {
        if (item.type !== 'message') continue;
        for (const content of item.content || []) {
            if (typeof content.text === 'string') parts.push(content.text);
        }
    }
    return parts.join('\n').trim();
}

function compactStateForBrain(state, summaries) {
    return {
        labClock: state.labClock,
        labDay: state.labDay,
        mission: state.mission,
        currentExperiment: {
            title: state.currentExperiment?.title,
            hypothesisId: state.currentExperiment?.hypothesisId,
            evidenceLevel: state.currentExperiment?.evidenceLevel,
            batchResult: state.currentExperiment?.batchResult,
        },
        hypotheses: (state.hypotheses || []).map(hypothesis => ({
            id: hypothesis.id,
            name: hypothesis.name,
            evidenceLevel: hypothesis.evidenceLevel,
            scores: hypothesis.scores,
            summary: hypothesis.summary,
        })),
        recentBatches: (state.batchResults || []).slice(0, 8).map(batch => ({
            batchId: batch.batchId,
            hypothesisId: batch.hypothesisId,
            status: batch.status,
            metrics: batch.metrics,
            protocol: batch.protocol,
        })),
        recentMemories: (state.memories || []).slice(0, 10).map(memory => ({
            id: memory.id,
            type: memory.type,
            agentId: memory.agentId,
            hypothesisId: memory.hypothesisId,
            evidenceLevel: memory.evidenceLevel,
            importance: memory.importance,
            summary: memory.summary,
        })),
        openDisputes: (state.disputes || []).slice(0, 5).map(dispute => ({
            title: dispute.title,
            hypothesisId: dispute.hypothesisId,
            status: dispute.status,
        })),
        dailyTicks: summaries,
        claimBoundaries: state.claimBoundaries,
    };
}

function discoverySchema() {
    return {
        type: 'object',
        additionalProperties: false,
        required: [
            'headline',
            'topInsight',
            'agentFindings',
            'nextPhysicalTest',
            'rankedActions',
            'risk',
            'decisionNeeded',
        ],
        properties: {
            headline: { type: 'string' },
            topInsight: { type: 'string' },
            agentFindings: {
                type: 'array',
                minItems: 3,
                maxItems: 7,
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['agentId', 'finding', 'confidence', 'evidenceLevel'],
                    properties: {
                        agentId: {
                            type: 'string',
                            enum: ['mira', 'theo', 'ava', 'max', 'nina', 'jules', 'pipette'],
                        },
                        finding: { type: 'string' },
                        confidence: {
                            type: 'string',
                            enum: ['low', 'medium', 'high'],
                        },
                        evidenceLevel: { type: 'string' },
                    },
                },
            },
            nextPhysicalTest: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'protocol', 'successCriteria'],
                properties: {
                    title: { type: 'string' },
                    protocol: { type: 'string' },
                    successCriteria: { type: 'string' },
                },
            },
            rankedActions: {
                type: 'array',
                minItems: 2,
                maxItems: 5,
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['priority', 'owner', 'action'],
                    properties: {
                        priority: {
                            type: 'string',
                            enum: ['critical', 'high', 'medium', 'low'],
                        },
                        owner: { type: 'string' },
                        action: { type: 'string' },
                    },
                },
            },
            risk: { type: 'string' },
            decisionNeeded: { type: 'string' },
        },
    };
}

function weeklyReviewSchema() {
    return {
        type: 'object',
        additionalProperties: false,
        required: [
            'headline',
            'developmentRecommendation',
            'confidence',
            'readinessScore',
            'rationale',
            'evidenceFor',
            'evidenceAgainst',
            'requiredRealWorldTests',
            'legalClaimsRisk',
            'manufacturingRisk',
            'nextSpendDecision',
            'sergioDecisionNeeded',
        ],
        properties: {
            headline: { type: 'string' },
            developmentRecommendation: {
                type: 'string',
                enum: ['continue', 'pause', 'pivot', 'kill'],
            },
            confidence: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
            },
            readinessScore: {
                type: 'integer',
                minimum: 0,
                maximum: 100,
            },
            rationale: { type: 'string' },
            evidenceFor: {
                type: 'array',
                minItems: 2,
                maxItems: 6,
                items: { type: 'string' },
            },
            evidenceAgainst: {
                type: 'array',
                minItems: 2,
                maxItems: 6,
                items: { type: 'string' },
            },
            requiredRealWorldTests: {
                type: 'array',
                minItems: 2,
                maxItems: 5,
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['title', 'why', 'passCriteria'],
                    properties: {
                        title: { type: 'string' },
                        why: { type: 'string' },
                        passCriteria: { type: 'string' },
                    },
                },
            },
            legalClaimsRisk: { type: 'string' },
            manufacturingRisk: { type: 'string' },
            nextSpendDecision: { type: 'string' },
            sergioDecisionNeeded: { type: 'string' },
        },
    };
}

function fallbackDiscovery(state, summaries, reason = 'OpenAI lab brain unavailable') {
    const leading = [...(state.hypotheses || [])].sort(
        (a, b) =>
            Object.values(b.scores || {}).reduce((sum, value) => sum + value, 0) -
            Object.values(a.scores || {}).reduce((sum, value) => sum + value, 0)
    )[0];

    return {
        status: 'fallback',
        provider: 'deterministic',
        model: null,
        reason,
        headline: `${summaries.length} autonomous lab experiments completed; ${leading?.id || 'the lead route'} remains the highest-scoring internal candidate.`,
        topInsight:
            'Prioritise physical reconstitution engineering around monohydrate dose integrity before considering more complex carriers.',
        agentFindings: [
            {
                agentId: 'mira',
                finding: 'Keep compression low enough to preserve porous wetting behaviour.',
                confidence: 'medium',
                evidenceLevel: 'Internal simulation',
            },
            {
                agentId: 'nina',
                finding: 'All speed and sensory language remains internal until standardized testing exists.',
                confidence: 'high',
                evidenceLevel: 'Claims control',
            },
            {
                agentId: 'jules',
                finding: 'The next useful step is a simple pilotable cube or agglomerate screen.',
                confidence: 'medium',
                evidenceLevel: 'Manufacturing hypothesis',
            },
        ],
        nextPhysicalTest: {
            title: 'Porous monohydrate hot-water dissolution screen',
            protocol:
                'Prepare low-compression monohydrate/carrier samples at three carrier ratios and test dissolution in hot water before coffee.',
            successCriteria:
                'Fast breakup, visible clarity improvement, dose uniformity retained, and no unsupported public claim created.',
        },
        rankedActions: [
            {
                priority: 'high',
                owner: 'R&D',
                action: 'Run the simplest hot-water dissolution screen before coffee sensory work.',
            },
            {
                priority: 'high',
                owner: 'Legal',
                action: 'Keep FTO review ahead of any encapsulation route investment.',
            },
        ],
        risk: 'The simulation can over-rank speed without accounting for real sensory grit and IP constraints.',
        decisionNeeded:
            'Sergio should decide whether the next physical prototype focuses on porous monohydrate only or includes a wetting-aid comparison arm.',
    };
}

function fallbackWeeklyReview(state, reason = 'OpenAI weekly lab brain unavailable') {
    const leading = [...(state.hypotheses || [])].sort(
        (a, b) =>
            Object.values(b.scores || {}).reduce((sum, value) => sum + value, 0) -
            Object.values(a.scores || {}).reduce((sum, value) => sum + value, 0)
    )[0];

    return {
        status: 'fallback',
        provider: 'deterministic',
        model: null,
        reason,
        headline: `${leading?.id || 'The lead route'} remains worth controlled development, but only through physical validation gates.`,
        developmentRecommendation: 'continue',
        confidence: 'medium',
        readinessScore: 62,
        rationale:
            'The internal simulation favours the porous monohydrate route because it preserves dose integrity and avoids premature complexity, but the decisive risks are sensory grit, FTO, and manufacturability.',
        evidenceFor: [
            'Monohydrate dose integrity remains the strongest evidence-backed baseline.',
            'The porous agglomerate route is simpler and lower-risk than complex encapsulation routes.',
        ],
        evidenceAgainst: [
            'No wet-lab dissolution or sensory data has upgraded the simulation signal yet.',
            'Public speed and zero-grit claims remain blocked until standardized evidence exists.',
        ],
        requiredRealWorldTests: [
            {
                title: 'Hot-water dissolution screen',
                why: 'Separates physical breakup performance from coffee sensory noise.',
                passCriteria: 'Fast visible breakup, no persistent sediment, dose uniformity retained.',
            },
            {
                title: 'Black coffee sensory screen',
                why: 'Checks whether the best physical route damages taste, aroma, or mouthfeel.',
                passCriteria: 'No unacceptable grit, chalk, bitterness, or tongue coating in blinded review.',
            },
        ],
        legalClaimsRisk:
            'High until standardized dissolution, sensory, and FTO evidence exists; all outputs must stay internal.',
        manufacturingRisk:
            'Medium: low-compression porous structures may be fragile under moisture and packing conditions.',
        nextSpendDecision:
            'Approve a small prototype test budget only after Legal confirms the FTO path for the chosen carrier route.',
        sergioDecisionNeeded:
            'Decide whether the next spend goes into a simple porous monohydrate prototype or a broader route comparison.',
    };
}

async function callOpenAIJson({
    model,
    instructions,
    input,
    schema,
    schemaName,
    endpoint,
    reasoningEffort = 'minimal',
    maxOutputTokens = 1600,
    timeoutMs = API_TIMEOUT_MS,
}) {
    const apiKey = getApiKey();
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                instructions,
                input: [{ role: 'user', content: JSON.stringify(input) }],
                reasoning: { effort: reasoningEffort },
                text: {
                    verbosity: 'low',
                    format: {
                        type: 'json_schema',
                        name: schemaName,
                        strict: true,
                        schema,
                    },
                },
                max_output_tokens: maxOutputTokens,
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const body = await response.text().catch(() => 'Unable to read error body');
            throw new Error(`OpenAI API error ${response.status}: ${body}`);
        }

        const data = await response.json();
        const parsed = JSON.parse(extractResponseText(data));

        try {
            const usage = data.usage || {};
            recordUsage({
                provider: 'openai',
                model,
                inputTokens: usage.input_tokens || 0,
                outputTokens: usage.output_tokens || 0,
                endpoint,
                clientIp: 'cron',
                success: true,
                latencyMs: Date.now() - startedAt,
            });
        } catch (_error) {
            // Cost tracking must not break lab reviews.
        }

        return {
            parsed,
            responseId: data.id || null,
        };
    } finally {
        clearTimeout(timeout);
    }
}

async function generateDailyDiscovery(state, summaries, options = {}) {
    if (!isEnabled(options.modelSynthesisEnabled)) {
        return fallbackDiscovery(
            state,
            summaries,
            'Set OPENAI_API_KEY and leave FUSE_LAB_AI_ENABLED unset or true to enable model-backed discovery.'
        );
    }

    const model = getModel(options.dailyModel);

    try {
        const result = await callOpenAIJson({
            model,
            instructions: LAB_BRAIN_SYSTEM,
            input: compactStateForBrain(state, summaries),
            schema: discoverySchema(),
            schemaName: 'fuse_lab_daily_discovery',
            endpoint: '/api/research-lab-daily',
            reasoningEffort: 'minimal',
            maxOutputTokens: 1600,
            timeoutMs: API_TIMEOUT_MS,
        });

        return {
            ...result.parsed,
            status: 'model-backed',
            provider: 'openai',
            model,
            responseId: result.responseId,
        };
    } catch (error) {
        return fallbackDiscovery(state, summaries, error.message);
    }
}

async function generateWeeklyReview(state, options = {}) {
    if (!isEnabled(options.modelSynthesisEnabled)) {
        return fallbackWeeklyReview(
            state,
            'Set OPENAI_API_KEY and leave FUSE_LAB_AI_ENABLED unset or true to enable model-backed weekly review.'
        );
    }

    const model = getWeeklyModel(options.weeklyModel);
    const reasoningEffort = getWeeklyReasoningEffort(options.weeklyReasoning);

    try {
        const result = await callOpenAIJson({
            model,
            instructions: `${LAB_BRAIN_SYSTEM}

This is the weekly Development Readiness Review. Decide whether FUSE should continue, pause, pivot, or kill the current product-development direction. Be rigorous about physical validation, IP/FTO, regulatory claims, manufacturing feasibility, and whether the next spend is justified.`,
            input: compactStateForBrain(state, state.dailyDiscovery?.experiments || []),
            schema: weeklyReviewSchema(),
            schemaName: 'fuse_lab_weekly_development_review',
            endpoint: '/api/research-lab-weekly',
            reasoningEffort,
            maxOutputTokens: 2200,
            timeoutMs: WEEKLY_API_TIMEOUT_MS,
        });

        return {
            ...result.parsed,
            status: 'model-backed',
            provider: 'openai',
            model,
            reasoningEffort,
            responseId: result.responseId,
        };
    } catch (error) {
        return fallbackWeeklyReview(state, error.message);
    }
}

module.exports = {
    generateDailyDiscovery,
    generateWeeklyReview,
    fallbackDiscovery,
    fallbackWeeklyReview,
    isEnabled,
    getModel,
    getWeeklyModel,
};
