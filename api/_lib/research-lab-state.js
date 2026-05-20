const { Redis } = require('@upstash/redis');

const STATE_KEY = 'research-world:state:v2';
const MAX_MEMORIES = 72;
const MAX_CONVERSATIONS = 24;
const MAX_DISPUTES = 12;
const MISSION =
    'Find a manufacturable way to make creatine monohydrate dissolve quickly in hot coffee while keeping the coffee experience clean and maximising supplement absorption and performance.';
const GUARDRAIL =
    'Agent findings are internal hypotheses until wet-lab and legal review upgrade the evidence level.';

const redis =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? Redis.fromEnv()
        : null;

let memoryState = null;

const stations = [
    {
        id: 'central-rail',
        name: 'Central Sample Rail',
        purpose: 'Routes samples and evidence between teams',
        color: '#d7ed69',
        x: 39,
        y: 42,
        w: 22,
        h: 16,
    },
    {
        id: 'encapsulation',
        name: 'Encapsulation Bench',
        purpose: 'Carrier structure, wetting, agglomeration',
        color: '#ff3b30',
        x: 7,
        y: 10,
        w: 27,
        h: 25,
    },
    {
        id: 'coffee',
        name: 'Coffee Matrix Bar',
        purpose: 'Espresso, black coffee, milk coffee stress tests',
        color: '#c58b59',
        x: 39,
        y: 8,
        w: 24,
        h: 24,
    },
    {
        id: 'claims',
        name: 'Claims Gate',
        purpose: 'Substantiation, label language, public claim control',
        color: '#8fb8ff',
        x: 69,
        y: 10,
        w: 24,
        h: 25,
    },
    {
        id: 'evidence',
        name: 'Evidence Desk',
        purpose: 'Creatine monohydrate evidence and absorption boundaries',
        color: '#44d7b6',
        x: 8,
        y: 64,
        w: 27,
        h: 24,
    },
    {
        id: 'sensory',
        name: 'Sensory Booth',
        purpose: 'Grit, bitterness, aroma, tongue coating',
        color: '#f5b56b',
        x: 40,
        y: 68,
        w: 23,
        h: 22,
    },
    {
        id: 'pilot',
        name: 'Pilot Mixer',
        purpose: 'Dose uniformity, moisture risk, scale-up path',
        color: '#b890ff',
        x: 70,
        y: 63,
        w: 23,
        h: 25,
    },
];

const agentBlueprints = [
    {
        id: 'mira',
        name: 'Dr. Mira Solvay',
        role: 'Encapsulation Scientist',
        stationId: 'encapsulation',
        color: '#ff3b30',
        intent: 'Design carrier structures that wet quickly without clumping.',
    },
    {
        id: 'theo',
        name: 'Dr. Theo Roast',
        role: 'Coffee Matrix Chemist',
        stationId: 'coffee',
        color: '#c58b59',
        intent: 'Protect espresso aroma, crema, acidity, and heat stability.',
    },
    {
        id: 'ava',
        name: 'Dr. Ava Palate',
        role: 'Sensory Scientist',
        stationId: 'sensory',
        color: '#f5b56b',
        intent: 'Reject grit, chalk, bitterness, and tongue coating.',
    },
    {
        id: 'max',
        name: 'Dr. Max Flux',
        role: 'Creatine Evidence Lead',
        stationId: 'evidence',
        color: '#44d7b6',
        intent: 'Separate proven creatine evidence from delivery hypotheses.',
    },
    {
        id: 'nina',
        name: 'Dr. Nina Claims',
        role: 'Regulatory Scientist',
        stationId: 'claims',
        color: '#8fb8ff',
        intent: 'Block any product claim that outruns evidence.',
    },
    {
        id: 'jules',
        name: 'Jules Batch',
        role: 'Manufacturing Engineer',
        stationId: 'pilot',
        color: '#b890ff',
        intent: 'Turn promising bench ideas into doseable, stable pilot batches.',
    },
    {
        id: 'pipette',
        name: 'Pipette',
        role: 'Lab Assistant Agent',
        stationId: 'central-rail',
        color: '#d7ed69',
        intent: 'Move samples, timestamp evidence, and keep the audit trail clean.',
    },
];

const hypotheses = [
    {
        id: 'FUSE-POR-01',
        name: 'Porous Monohydrate Agglomerate',
        summary:
            'Micronised creatine monohydrate held in a low-compression porous matrix for fast wetting.',
        evidenceLevel: 'Hypothesis',
        scores: {
            dissolve: 72,
            taste: 75,
            mouthfeel: 68,
            dose: 91,
            heat: 86,
            make: 76,
            claims: 84,
        },
    },
    {
        id: 'FUSE-WET-02',
        name: 'Trace Wetting Aid Route',
        summary:
            'Minimal food-suitable wetting support added only if the clean monohydrate route stalls.',
        evidenceLevel: 'Needs legal review',
        scores: {
            dissolve: 78,
            taste: 70,
            mouthfeel: 72,
            dose: 86,
            heat: 80,
            make: 70,
            claims: 66,
        },
    },
    {
        id: 'FUSE-EFF-03',
        name: 'Mild Effervescent Benchmark',
        summary:
            'Fast-breakup reference cube used to benchmark speed, not yet preferred for coffee ritual fit.',
        evidenceLevel: 'Benchmark only',
        scores: {
            dissolve: 91,
            taste: 54,
            mouthfeel: 62,
            dose: 82,
            heat: 74,
            make: 68,
            claims: 58,
        },
    },
    {
        id: 'FUSE-CYC-04',
        name: 'Cyclodextrin Compatibility Screen',
        summary:
            'Molecular-complex route reserved for taste masking questions and FTO-dependent exploration.',
        evidenceLevel: 'FTO constrained',
        scores: {
            dissolve: 67,
            taste: 81,
            mouthfeel: 77,
            dose: 74,
            heat: 78,
            make: 57,
            claims: 52,
        },
    },
];

const experimentTemplates = [
    {
        title: 'Hot coffee disappearance run',
        stationId: 'coffee',
        leadAgentId: 'theo',
        supportAgentId: 'mira',
        hypothesisId: 'FUSE-POR-01',
        metric: 'dissolve',
        evidenceLevel: 'Simulation',
        effect: { dissolve: 3, taste: -1, mouthfeel: 1 },
        dispute: 'Does faster wetting disturb crema before the powder disappears?',
    },
    {
        title: 'Tongue-cleanliness panel',
        stationId: 'sensory',
        leadAgentId: 'ava',
        supportAgentId: 'theo',
        hypothesisId: 'FUSE-POR-01',
        metric: 'mouthfeel',
        evidenceLevel: 'Needs sensory panel',
        effect: { mouthfeel: 3, taste: 1, dissolve: -1 },
        dispute: 'Can the cleanest mouthfeel route still hit the <3 second target?',
    },
    {
        title: 'Carrier ratio screen',
        stationId: 'encapsulation',
        leadAgentId: 'mira',
        supportAgentId: 'jules',
        hypothesisId: 'FUSE-WET-02',
        metric: 'make',
        evidenceLevel: 'Needs legal review',
        effect: { dissolve: 2, make: 2, claims: -2 },
        dispute: 'Any wetting aid must remain suitable for the supplement route.',
    },
    {
        title: 'Dose integrity audit',
        stationId: 'evidence',
        leadAgentId: 'max',
        supportAgentId: 'nina',
        hypothesisId: 'FUSE-POR-01',
        metric: 'dose',
        evidenceLevel: 'Evidence-backed baseline',
        effect: { dose: 1, claims: 2, heat: 1 },
        dispute: 'The monohydrate evidence is strong; the delivery system evidence is not.',
    },
    {
        title: 'Claims boundary review',
        stationId: 'claims',
        leadAgentId: 'nina',
        supportAgentId: 'max',
        hypothesisId: 'FUSE-EFF-03',
        metric: 'claims',
        evidenceLevel: 'Regulatory control',
        effect: { claims: 3, taste: -2, mouthfeel: -1 },
        dispute: 'Speed can be studied internally, but public claims need standardized tests.',
    },
    {
        title: 'Pilot cube feasibility check',
        stationId: 'pilot',
        leadAgentId: 'jules',
        supportAgentId: 'pipette',
        hypothesisId: 'FUSE-POR-01',
        metric: 'make',
        evidenceLevel: 'Manufacturing hypothesis',
        effect: { make: 3, dose: 1, heat: -1 },
        dispute: 'A beautiful bench sample fails if it cannot survive moisture and packing.',
    },
    {
        title: 'FTO constrained taste screen',
        stationId: 'claims',
        leadAgentId: 'nina',
        supportAgentId: 'ava',
        hypothesisId: 'FUSE-CYC-04',
        metric: 'claims',
        evidenceLevel: 'FTO constrained',
        effect: { taste: 2, claims: -3, make: -1 },
        dispute: 'Taste masking is not useful if the IP path is blocked.',
    },
];

const dialogue = {
    'theo:mira': [
        'The cup clears faster when the matrix wets before crema collapse.',
        'Then I will protect the pore structure and lower compression.',
    ],
    'ava:theo': [
        'I am still detecting a finish after the coffee cools.',
        'I will rerun black coffee and latte separately before we blame the carrier.',
    ],
    'jules:mira': [
        'This only matters if the dose can stay uniform at pilot scale.',
        'I will keep the structure simple enough for a sachet line.',
    ],
    'max:nina': [
        'Creatine monohydrate evidence can travel; delivery claims cannot yet.',
        'Good. Keep absorption language internal until direct comparative data exists.',
    ],
    'jules:pipette': [
        'Route the fastest sample through the moisture check before it cools.',
        'Sample logged with timestamp, station, temperature, and evidence level.',
    ],
    'ava:nina': [
        'Clean mouthfeel is not the same as a validated zero-grit claim.',
        'Exactly. It stays internal until a sensory panel supports the wording.',
    ],
    'ava:pipette': [
        'Bring me the cup with the strongest grit objection.',
        'Moving the worst-case sample to the sensory booth now.',
    ],
    'max:mira': [
        'Do not trade dose integrity for a nicer disappearance trick.',
        'Agreed. Monohydrate dose integrity remains the spine of the route.',
    ],
};

const claimBoundaries = [
    'No public <3 second dissolution claim until standardized test data exists.',
    'No zero-grit claim until sensory testing supports it.',
    'No absorption superiority language without direct comparative evidence.',
    'FTO review controls any encapsulation route before formulation investment.',
];

function nowIso() {
    return new Date().toISOString();
}

function average(scores) {
    const values = Object.values(scores);
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function stationCenter(stationId) {
    const station = stations.find(item => item.id === stationId) || stations[0];
    return {
        x: station.x + station.w / 2,
        y: station.y + station.h / 2,
    };
}

function pairKey(firstId, secondId) {
    return [firstId, secondId].sort().join(':');
}

function createAgents(labClock = 0, currentExperiment = experimentTemplates[0]) {
    return agentBlueprints.map((agent, index) => {
        const active =
            agent.id === currentExperiment.leadAgentId ||
            agent.id === currentExperiment.supportAgentId;
        const targetStationId = active
            ? currentExperiment.stationId
            : stations[(labClock + index) % stations.length].id;
        const home = stationCenter(agent.stationId);
        const target = stationCenter(targetStationId);
        const phase = ((labClock + index * 2) % 10) / 10;
        const pull = active ? 0.82 : 0.25 + phase * 0.35;
        const drift = active ? 0 : Math.sin(labClock + index) * 1.8;
        const needsSeed = labClock + index * 7;

        return {
            ...agent,
            x: clamp(home.x + (target.x - home.x) * pull + drift, 4, 96),
            y: clamp(home.y + (target.y - home.y) * pull + Math.cos(labClock + index) * 1.6, 4, 96),
            targetStationId,
            intent: active ? currentExperiment.title : agent.intent,
            reflection: buildAgentReflection(agent, currentExperiment, active),
            needs: {
                focus: clamp(58 + (active ? 24 : 0) + (needsSeed % 13)),
                evidence: clamp(44 + (active ? 28 : 0) + (needsSeed % 11)),
                social: clamp(40 + (needsSeed % 23)),
                caution: clamp(
                    36 +
                        (currentExperiment.evidenceLevel.includes('control') ? 28 : 0) +
                        (needsSeed % 17)
                ),
            },
        };
    });
}

function buildAgentReflection(agent, experiment, active) {
    if (active) {
        return `${agent.name} is working the ${experiment.title.toLowerCase()} while checking that the conclusion stays inside its evidence level.`;
    }
    return `${agent.name} is watching for conflicts between formulation progress, sensory quality, manufacturability, and claims control.`;
}

function createExperiment(labClock) {
    const template = experimentTemplates[labClock % experimentTemplates.length];
    return {
        id: `EXP-${String(labClock).padStart(3, '0')}`,
        ...template,
        progress: 22 + ((labClock * 17) % 74),
        startedAt: nowIso(),
    };
}

function createInitialState() {
    const currentExperiment = createExperiment(0);
    const agents = createAgents(0, currentExperiment);
    const timestamp = nowIso();
    return {
        version: 2,
        mode: 'living research world',
        labClock: 0,
        mission: MISSION,
        guardrail: GUARDRAIL,
        stations,
        agents,
        hypotheses: hypotheses.map(item => ({ ...item, scores: { ...item.scores } })),
        currentExperiment,
        conversations: [buildConversation(currentExperiment, timestamp, 0)],
        memories: [
            {
                id: 'mem-boot',
                timestamp,
                agentId: 'pipette',
                evidenceLevel: 'Internal simulation',
                importance: 72,
                summary:
                    'The lab world booted with legal claim boundaries, formulation hypotheses, and station roles loaded.',
            },
        ],
        disputes: [
            {
                id: 'dispute-boot',
                timestamp,
                title: currentExperiment.dispute,
                hypothesisId: currentExperiment.hypothesisId,
                status: 'open',
            },
        ],
        experimentQueue: buildExperimentQueue(0),
        claimBoundaries,
        updatedAt: timestamp,
    };
}

function buildConversation(experiment, timestamp, labClock) {
    const key = pairKey(experiment.leadAgentId, experiment.supportAgentId);
    const script = dialogue[key] || [
        'Can you challenge this result against your station evidence?',
        'Yes. I will compare it with the latest memory stream before the next run.',
    ];
    const sorted = key.split(':');
    const leadIsFirst = sorted[0] === experiment.leadAgentId;
    const lines = leadIsFirst ? script : [...script].reverse();

    return {
        id: `conv-${labClock}-${experiment.leadAgentId}-${experiment.supportAgentId}`,
        timestamp,
        from: experiment.leadAgentId,
        to: experiment.supportAgentId,
        hypothesisId: experiment.hypothesisId,
        topic: experiment.title,
        lines: [
            {
                speakerId: experiment.leadAgentId,
                text: lines[labClock % lines.length],
            },
            {
                speakerId: experiment.supportAgentId,
                text: lines[(labClock + 1) % lines.length],
            },
        ],
    };
}

function buildMemory(experiment, hypothesis, labClock, timestamp) {
    return {
        id: `mem-${labClock}-${experiment.leadAgentId}`,
        timestamp,
        agentId: experiment.leadAgentId,
        hypothesisId: experiment.hypothesisId,
        evidenceLevel: experiment.evidenceLevel,
        importance: clamp(
            58 + labClock * 3 + (experiment.evidenceLevel.includes('control') ? 18 : 0)
        ),
        summary: `${experiment.title} moved ${hypothesis.id} to ${average(hypothesis.scores)}/100 overall; dispute: ${experiment.dispute}`,
    };
}

function buildDispute(experiment, labClock, timestamp) {
    return {
        id: `dispute-${labClock}`,
        timestamp,
        title: experiment.dispute,
        hypothesisId: experiment.hypothesisId,
        status: labClock % 5 === 0 ? 'needs Sergio review' : 'open',
    };
}

function buildExperimentQueue(labClock) {
    return experimentTemplates.slice(0, 7).map((template, index) => {
        const shifted = experimentTemplates[(labClock + index + 1) % experimentTemplates.length];
        return {
            id: `queue-${labClock}-${index}`,
            title: shifted.title,
            owner: shifted.leadAgentId.toUpperCase(),
            reason: shifted.dispute,
            hypothesisId: shifted.hypothesisId,
        };
    });
}

function applyExperimentEffect(hypothesis, experiment, labClock) {
    const updated = {
        ...hypothesis,
        scores: { ...hypothesis.scores },
    };
    Object.entries(experiment.effect || {}).forEach(([metric, delta]) => {
        const wobble = (labClock + metric.length) % 3 === 0 ? -1 : 1;
        updated.scores[metric] = clamp((updated.scores[metric] || 0) + delta + wobble, 0, 99);
    });
    if (average(updated.scores) >= 82 && updated.evidenceLevel === 'Hypothesis') {
        updated.evidenceLevel = 'Simulation candidate';
    }
    return updated;
}

function parseStoredState(stored) {
    if (!stored) return null;
    if (typeof stored !== 'string') return stored;

    try {
        return JSON.parse(stored);
    } catch (error) {
        console.warn('[Research Lab World] Ignoring unreadable stored state:', error.message);
        return null;
    }
}

function normalizeState(candidate) {
    const base = createInitialState();
    if (!candidate || typeof candidate !== 'object') return base;

    const next = {
        ...base,
        ...candidate,
        version: base.version,
        mode: base.mode,
        mission: MISSION,
        guardrail: GUARDRAIL,
        stations,
        claimBoundaries,
        agents:
            Array.isArray(candidate.agents) && candidate.agents.length > 0
                ? candidate.agents
                : base.agents,
        hypotheses:
            Array.isArray(candidate.hypotheses) && candidate.hypotheses.length > 0
                ? candidate.hypotheses
                : base.hypotheses,
        conversations: Array.isArray(candidate.conversations)
            ? candidate.conversations.slice(0, MAX_CONVERSATIONS)
            : base.conversations,
        memories: Array.isArray(candidate.memories)
            ? candidate.memories.slice(0, MAX_MEMORIES)
            : base.memories,
        disputes: Array.isArray(candidate.disputes)
            ? candidate.disputes.slice(0, MAX_DISPUTES)
            : base.disputes,
        experimentQueue: Array.isArray(candidate.experimentQueue)
            ? candidate.experimentQueue
            : base.experimentQueue,
        currentExperiment: candidate.currentExperiment || base.currentExperiment,
    };

    if (!next.agents.length || !next.hypotheses.length || !next.currentExperiment) {
        return base;
    }

    return next;
}

async function getState() {
    if (redis) {
        try {
            const parsed = parseStoredState(await redis.get(STATE_KEY));
            if (parsed) {
                const stored = normalizeState(parsed);
                memoryState = stored;
                return stored;
            }
        } catch (error) {
            console.warn('[Research Lab World] Redis read failed:', error.message);
        }
    }
    if (!memoryState) {
        memoryState = createInitialState();
        await saveState(memoryState);
    }
    memoryState = normalizeState(memoryState);
    return memoryState;
}

async function saveState(state) {
    memoryState = normalizeState(state);
    if (redis) {
        try {
            await redis.set(STATE_KEY, memoryState);
        } catch (error) {
            console.warn('[Research Lab World] Redis write failed:', error.message);
        }
    }
    return memoryState;
}

async function resetState() {
    const state = createInitialState();
    return saveState(state);
}

async function advanceLabState(source = 'world-loop') {
    const previous = normalizeState(await getState());
    const labClock = Number(previous.labClock || 0) + 1;
    const timestamp = nowIso();
    const currentExperiment = createExperiment(labClock);
    const hypothesesNext = previous.hypotheses.map(hypothesis => {
        if (hypothesis.id !== currentExperiment.hypothesisId) return hypothesis;
        return applyExperimentEffect(hypothesis, currentExperiment, labClock);
    });
    const activeHypothesis =
        hypothesesNext.find(item => item.id === currentExperiment.hypothesisId) ||
        hypothesesNext[0];
    const agents = createAgents(labClock, currentExperiment);
    const conversation = buildConversation(currentExperiment, timestamp, labClock);
    const memory = buildMemory(currentExperiment, activeHypothesis, labClock, timestamp);
    const dispute = buildDispute(currentExperiment, labClock, timestamp);

    const state = {
        ...previous,
        labClock,
        agents,
        hypotheses: hypothesesNext,
        currentExperiment,
        conversations: [conversation, ...(previous.conversations || [])].slice(
            0,
            MAX_CONVERSATIONS
        ),
        memories: [memory, ...(previous.memories || [])].slice(0, MAX_MEMORIES),
        disputes: [dispute, ...(previous.disputes || [])].slice(0, MAX_DISPUTES),
        experimentQueue: buildExperimentQueue(labClock),
        updatedAt: timestamp,
        lastSource: source,
    };

    return saveState(state);
}

module.exports = {
    getState,
    advanceLabState,
    resetState,
};
