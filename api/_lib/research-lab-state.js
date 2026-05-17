const { Redis } = require('@upstash/redis');

const STATE_KEY = 'research-lab:state:v1';
const MAX_EVENTS = 90;
const MAX_MEMORIES = 80;
const MAX_REPLAY_FRAMES = 48;
const MAX_CHATS = 36;
const MAX_PAPERS = 30;
const PAPER_TIMEOUT_MS = 6500;

const redis =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? Redis.fromEnv()
        : null;

let memoryState = null;

const scientists = [
    {
        id: 'mira',
        name: 'Dr. Mira Solvay',
        role: 'Encapsulation Scientist',
        speciality: 'micronisation, granulation, wetting systems, instant dispersion',
        personality: 'Precise, skeptical, relentlessly practical.',
        station: 'Encapsulation Bench',
        color: '#ff3b30',
        x: 20,
        y: 55,
    },
    {
        id: 'theo',
        name: 'Dr. Theo Roast',
        role: 'Coffee Matrix Chemist',
        speciality: 'espresso chemistry, acidity, heat, crema, milk coffee interactions',
        personality: 'Calm, sensory-aware, protective of the coffee ritual.',
        station: 'Coffee Matrix Bar',
        color: '#c58b59',
        x: 73,
        y: 33,
    },
    {
        id: 'ava',
        name: 'Dr. Ava Palate',
        role: 'Sensory & Oral Perception Scientist',
        speciality: 'tongue feel, bitterness thresholds, aroma release, aftertaste, mouth coating',
        personality: 'Exacting, poetic about flavour, impossible to fool with grit.',
        station: 'Sensory Tongue Lab',
        color: '#f5b56b',
        x: 62,
        y: 70,
    },
    {
        id: 'max',
        name: 'Dr. Max Flux',
        role: 'Absorption Scientist',
        speciality: 'creatine uptake evidence, dose integrity, kinetics, bioavailability claims',
        personality: 'Evidence-first, blocks overclaiming, likes clean pharmacokinetics.',
        station: 'Absorption Evidence Desk',
        color: '#44d7b6',
        x: 42,
        y: 26,
    },
    {
        id: 'nina',
        name: 'Dr. Nina Claims',
        role: 'Regulatory Scientist',
        speciality: 'sports nutrition claims, substantiation, labels, compliance risk',
        personality: 'Friendly until a claim outruns the evidence.',
        station: 'Claims Gate',
        color: '#8fb8ff',
        x: 84,
        y: 58,
    },
    {
        id: 'jules',
        name: 'Jules Batch',
        role: 'Manufacturing Engineer',
        speciality: 'pilot batches, flow, dose uniformity, packaging, moisture stability',
        personality: 'Turns elegant science into something that can ship.',
        station: 'Pilot Mixer',
        color: '#b890ff',
        x: 30,
        y: 78,
    },
    {
        id: 'pipette',
        name: 'Pipette',
        role: 'Lab Assistant Agent',
        speciality: 'sample routing, bench timing, evidence labels, instrument logs',
        personality: 'Fast, literal, tireless, and obsessed with clean timestamps.',
        station: 'Central Sample Rail',
        color: '#e2f06f',
        x: 50,
        y: 50,
    },
];

const evidenceSources = [
    {
        title: 'Creatine monohydrate remains the evidence baseline',
        source: 'International Society of Sports Nutrition position stand',
        url: 'https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0173-z',
        type: 'Evidence-backed',
        confidence: 93,
    },
    {
        title: 'Dietary supplement claims need truthful, substantiated language',
        source: 'FDA dietary supplement labeling guidance',
        url: 'https://www.fda.gov/food/dietary-supplements-guidance-documents-regulatory-information/dietary-supplement-labeling-guide-chapter-vi-claims',
        type: 'Regulatory control',
        confidence: 88,
    },
    {
        title: 'Coffee matrix testing must separate flavour preservation from solubility',
        source: 'Internal FUSE research protocol',
        url: '/research/testing/protocols.md',
        type: 'Needs wet-lab validation',
        confidence: 66,
    },
    {
        title: 'Encapsulation decisions require FTO review before formulation investment',
        source: 'FUSE R&D team context',
        url: '/teams/rnd/context.md',
        type: 'Regulatory control',
        confidence: 91,
    },
];

const experimentTemplates = [
    {
        kind: 'Hot coffee dispersion',
        station: 'Coffee Matrix Bar',
        scientistId: 'theo',
        metric: 'dissolutionSpeed',
        evidenceGate: 'Simulation result',
        message: 'runs a 92C espresso dispersion check and logs visible sediment at 60 seconds.',
    },
    {
        kind: 'Tongue feel panel',
        station: 'Sensory Tongue Lab',
        scientistId: 'ava',
        metric: 'mouthfeelCleanliness',
        evidenceGate: 'Needs sensory panel',
        message:
            'scores tongue coating, grit detection, bitterness lift, aroma masking, and aftertaste duration.',
    },
    {
        kind: 'Encapsulation screen',
        station: 'Encapsulation Bench',
        scientistId: 'mira',
        metric: 'doseIntegrity',
        evidenceGate: 'Hypothesis',
        message: 'tests a carrier ratio for fast wetting without clumping in black coffee.',
    },
    {
        kind: 'Creatine evidence review',
        station: 'Absorption Evidence Desk',
        scientistId: 'max',
        metric: 'absorptionEvidence',
        evidenceGate: 'Evidence-backed',
        message: 'separates proven creatine monohydrate evidence from delivery-system hypotheses.',
    },
    {
        kind: 'Claims gate',
        station: 'Claims Gate',
        scientistId: 'nina',
        metric: 'regulatorySafety',
        evidenceGate: 'Regulatory control',
        message:
            'blocks public “maximum absorption” language until direct comparative evidence exists.',
    },
    {
        kind: 'Pilot batch review',
        station: 'Pilot Mixer',
        scientistId: 'jules',
        metric: 'manufacturability',
        evidenceGate: 'Simulation result',
        message: 'checks powder flow, dose uniformity, moisture risk, and packaging feasibility.',
    },
    {
        kind: 'Sample relay',
        station: 'Central Sample Rail',
        scientistId: 'pipette',
        metric: 'heatStability',
        evidenceGate: 'Needs wet-lab validation',
        message:
            'moves a heated coffee sample to stability logging and flags any unsupported conclusion.',
    },
];

const cognitionBlueprint = {
    model: 'Generative research society',
    loop: ['perceive', 'retrieve', 'plan', 'reflect', 'execute'],
    router: 'Plan-Execute lab router with read-only ask and controlled intervention modes',
    memoryPolicy:
        'Events become scored memories; high-importance clusters trigger reflections and update future plans.',
    replayPolicy: 'Every lab tick stores a compact replay frame for later audit and debugging.',
};

const labEnvironmentModules = [
    {
        id: 'coffee-matrix',
        name: 'Coffee Matrix Space',
        capability: 'observe',
        tools: ['measure dispersion', 'compare crema', 'score aroma masking'],
    },
    {
        id: 'evidence-gate',
        name: 'Evidence Gate',
        capability: 'intervene',
        tools: ['downgrade claim', 'request human review', 'attach source'],
    },
    {
        id: 'social-space',
        name: 'Scientist Social Space',
        capability: 'observe',
        tools: ['route sample', 'share memory', 'raise collaboration edge'],
    },
];

const schedulePlans = {
    mira: ['Carrier screen', 'Dissolution review', 'Reflection on dose integrity'],
    theo: ['Espresso matrix run', 'Aroma check', 'Crema preservation review'],
    ava: ['Tongue feel panel', 'Bitterness threshold review', 'Aftertaste reflection'],
    max: ['Evidence retrieval', 'Absorption claim audit', 'Source triage'],
    nina: ['Claims boundary review', 'Label language audit', 'Compliance intervention'],
    jules: ['Pilot batch feasibility', 'Moisture risk review', 'Manufacturing route'],
    pipette: ['Sample relay', 'Timestamp cleanup', 'Replay capture'],
};

const routeStations = [
    'Central Sample Rail',
    'Encapsulation Bench',
    'Coffee Matrix Bar',
    'Sensory Tongue Lab',
    'Absorption Evidence Desk',
    'Claims Gate',
    'Pilot Mixer',
];

const collaboratorByMetric = {
    dissolutionSpeed: 'mira',
    tastePreservation: 'ava',
    mouthfeelCleanliness: 'theo',
    doseIntegrity: 'jules',
    absorptionEvidence: 'nina',
    heatStability: 'jules',
    manufacturability: 'mira',
    regulatorySafety: 'max',
};

const chatScripts = {
    'theo:mira': [
        'I can see less grit when the carrier wets before the crema breaks.',
        'Good. I will keep the ratio below the clumping threshold.',
    ],
    'ava:theo': [
        'The coffee aroma survives, but the finish is still too long.',
        'I will rerun it hotter and watch the acidity drift.',
    ],
    'max:nina': [
        'The monohydrate evidence is solid; the delivery claim is still internal.',
        'Then no public absorption language until direct comparative data exists.',
    ],
    'jules:pipette': [
        'Send the heated sample through the batch bay before it cools.',
        'Sample routed. Timestamp, temperature, and batch ID are attached.',
    ],
    'ava:pipette': [
        'Bring me the sample with the highest tongue-cleanliness score.',
        'Routing the cleanest cup to the sensory booths now.',
    ],
    'mira:jules': [
        'This screen only matters if manufacturing can dose it evenly.',
        'I will flag flow risk before we scale anything.',
    ],
    'nina:pipette': [
        'Tag unsupported conclusions before they enter the feed.',
        'Every hypothesis is labelled before it leaves the rail.',
    ],
};

const initialFormulas = [
    {
        id: 'FUSE-CM-001',
        name: 'Micronised Monohydrate Control',
        status: 'control',
        summary: 'Evidence baseline for dose integrity, with visible sediment risk in coffee.',
        scores: {
            dissolutionSpeed: 58,
            tastePreservation: 72,
            mouthfeelCleanliness: 54,
            doseIntegrity: 95,
            absorptionEvidence: 91,
            heatStability: 86,
            manufacturability: 88,
            regulatorySafety: 94,
        },
        evidenceLevel: 'Evidence-backed',
    },
    {
        id: 'FUSE-IF-014',
        name: 'Instant Fusion Carrier Screen',
        status: 'active',
        summary:
            'Coffee-compatible dispersion system under taste, tongue feel, and sediment testing.',
        scores: {
            dissolutionSpeed: 79,
            tastePreservation: 76,
            mouthfeelCleanliness: 73,
            doseIntegrity: 86,
            absorptionEvidence: 64,
            heatStability: 81,
            manufacturability: 69,
            regulatorySafety: 82,
        },
        evidenceLevel: 'Simulation result',
    },
    {
        id: 'FUSE-LATTE-021',
        name: 'Milk Coffee Compatibility Blend',
        status: 'watch',
        summary: 'Optimised for oat milk and latte systems, still sensitive in black coffee.',
        scores: {
            dissolutionSpeed: 74,
            tastePreservation: 83,
            mouthfeelCleanliness: 80,
            doseIntegrity: 82,
            absorptionEvidence: 61,
            heatStability: 77,
            manufacturability: 65,
            regulatorySafety: 84,
        },
        evidenceLevel: 'Hypothesis',
    },
    {
        id: 'FUSE-ESP-033',
        name: 'Espresso Crema Shield',
        status: 'explore',
        summary:
            'Designed to preserve aroma and crema while hiding bitterness from carrier systems.',
        scores: {
            dissolutionSpeed: 70,
            tastePreservation: 86,
            mouthfeelCleanliness: 69,
            doseIntegrity: 78,
            absorptionEvidence: 58,
            heatStability: 83,
            manufacturability: 62,
            regulatorySafety: 80,
        },
        evidenceLevel: 'Hypothesis',
    },
];

function nowIso() {
    return new Date().toISOString();
}

function averageScore(scores) {
    const values = Object.values(scores);
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function enrichFormula(formula) {
    return {
        ...formula,
        overall: averageScore(formula.scores),
    };
}

function clampPercent(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
}

function cognitionSignal(scientist, labClock, isActive = false) {
    const seed = labClock + scientist.id.length + scientist.station.length;
    return {
        focus: clampPercent(62 + Math.sin(seed / 2.1) * 18 + (isActive ? 12 : 0)),
        energy: clampPercent(68 + Math.cos(seed / 2.8) * 16 - (isActive ? 5 : 0)),
        evidenceNeed: clampPercent(38 + Math.sin(seed / 3.2) * 20 + (isActive ? 16 : 0)),
        collaborationNeed: clampPercent(42 + Math.cos(seed / 3.8) * 18),
    };
}

function planForScientist(scientistId, labClock) {
    const plan = schedulePlans[scientistId] || ['Observe lab', 'Update memory', 'Review result'];
    return plan[labClock % plan.length];
}

function nextLocationForScientist(scientist, labClock, isActive) {
    if (isActive) return scientist.station;
    const index = (labClock + scientist.id.length + scientist.station.length) % routeStations.length;
    const candidate = routeStations[index];
    if (candidate !== scientist.station) return candidate;
    return routeStations[(index + 2) % routeStations.length];
}

function createAgentStates(labClock = 0, activeScientistId = 'mira') {
    return scientists.map(scientist => {
        const isActive = scientist.id === activeScientistId;
        const signal = cognitionSignal(scientist, labClock, isActive);
        return {
            id: scientist.id,
            mood:
                signal.evidenceNeed > 68
                    ? 'evidence-hungry'
                    : signal.energy < 58
                      ? 'conserving'
                      : isActive
                        ? 'locked-in'
                        : 'observing',
            currentPlan: planForScientist(scientist.id, labClock),
            currentAction: isActive ? 'executing active experiment' : 'observing and retrieving',
            nextLocation: nextLocationForScientist(scientist, labClock, isActive),
            needs: signal,
            reflection: `${scientist.name} is balancing ${planForScientist(scientist.id, labClock).toLowerCase()} against evidence-gated claims.`,
        };
    });
}

function createSocialGraph(timestamp) {
    return [
        {
            from: 'mira',
            to: 'theo',
            trust: 76,
            topic: 'carrier ratios in hot coffee',
            lastInteraction: timestamp,
        },
        {
            from: 'ava',
            to: 'theo',
            trust: 82,
            topic: 'flavour and mouthfeel tradeoffs',
            lastInteraction: timestamp,
        },
        {
            from: 'max',
            to: 'nina',
            trust: 88,
            topic: 'evidence-backed claim boundaries',
            lastInteraction: timestamp,
        },
        {
            from: 'jules',
            to: 'pipette',
            trust: 74,
            topic: 'pilot sample routing',
            lastInteraction: timestamp,
        },
    ];
}

function buildMemoryFromEvent(event, index = 0) {
    return {
        id: `mem-${event.id || `${event.scientistId}-${index}`}`,
        timestamp: event.timestamp || nowIso(),
        scientistId: event.scientistId || 'mira',
        type: event.type === 'Reflection' ? 'thought' : 'event',
        formulaId: event.formulaId || null,
        location:
            scientists.find(scientist => scientist.id === event.scientistId)?.station ||
            'Central Table',
        importance: clampPercent(58 + (event.type === 'Regulatory control' ? 20 : 0) + index * 4),
        poignancy: clampPercent(48 + (event.type === 'Needs wet-lab validation' ? 24 : 0)),
        summary: event.message || 'Lab state changed.',
        evidence: [event.id].filter(Boolean),
    };
}

function createMemoryStream(events) {
    return (events || []).map((event, index) => buildMemoryFromEvent(event, index));
}

function createReplayFrames(startedAt) {
    return [
        {
            tick: 0,
            timestamp: startedAt,
            mode: 'boot',
            scientistId: 'mira',
            station: 'Central Table',
            action: 'initialize memory stream',
            outcome: 'Control formula and claims guardrails loaded.',
        },
    ];
}

function normalizePair(a, b) {
    return [a, b].sort().join(':');
}

function buildChatTurn(fromId, toId, labClock, timestamp, topic) {
    const pairKey = normalizePair(fromId, toId);
    const script = chatScripts[pairKey] || [
        'Can you cross-check this observation against your station data?',
        'Yes. I will compare it with the latest memory stream before the next tick.',
    ];
    const firstSpeaker = pairKey.split(':')[0];
    const ordered = firstSpeaker === fromId ? script : [...script].reverse();
    return {
        id: `chat-${labClock}-${fromId}-${toId}-${Date.now()}`,
        timestamp,
        from: fromId,
        to: toId,
        topic,
        lines: [
            {
                speakerId: fromId,
                text: ordered[labClock % ordered.length],
            },
            {
                speakerId: toId,
                text: ordered[(labClock + 1) % ordered.length],
            },
        ],
    };
}

function buildReflection(scientist, memories, labClock) {
    const recent = (memories || []).filter(memory => memory.scientistId === scientist.id).slice(0, 3);
    if (!recent.length) return null;
    const signal = recent.map(memory => memory.summary.split('.')[0]).join('; ');
    return {
        id: `ref-${labClock}-${scientist.id}-${Date.now()}`,
        timestamp: nowIso(),
        scientistId: scientist.id,
        type: 'Reflection',
        formulaId: recent[0].formulaId,
        message: `${scientist.name} reflects: ${signal}. Next plan should protect evidence quality before speed.`,
    };
}

function updateSocialGraph(graph, template, timestamp) {
    const collaboratorId = collaboratorByMetric[template.metric] || 'pipette';
    const nextGraph = Array.isArray(graph) ? [...graph] : createSocialGraph(timestamp);
    const existingIndex = nextGraph.findIndex(
        edge =>
            (edge.from === template.scientistId && edge.to === collaboratorId) ||
            (edge.from === collaboratorId && edge.to === template.scientistId)
    );
    const edge = {
        from: template.scientistId,
        to: collaboratorId,
        trust: 70 + ((template.metric.length + template.scientistId.length) % 24),
        topic: `${template.kind.toLowerCase()} via ${template.station}`,
        lastInteraction: timestamp,
    };
    if (existingIndex >= 0) {
        nextGraph[existingIndex] = {
            ...nextGraph[existingIndex],
            trust: clampPercent(nextGraph[existingIndex].trust + 2),
            topic: edge.topic,
            lastInteraction: timestamp,
        };
    } else if (template.scientistId !== collaboratorId) {
        nextGraph.unshift(edge);
    }
    return nextGraph.slice(0, 12);
}

function migrateState(state) {
    if (!state || typeof state !== 'object') return createInitialState();
    const events = Array.isArray(state.events) ? state.events : [];
    const activeScientistId = state.activeExperiment?.scientistId || 'mira';
    const socialGraph = state.socialGraph || createSocialGraph(state.startedAt || nowIso());
    const primaryEdge = socialGraph[0] || { from: 'mira', to: 'theo', topic: 'boot sequence' };
    const timestamp = state.updatedAt || state.startedAt || nowIso();
    return {
        ...state,
        version: 2,
        scientists: scientists.map(scientist => ({
            ...scientist,
            ...(state.scientists || []).find(item => item.id === scientist.id),
        })),
        formulas: (state.formulas || initialFormulas).map(enrichFormula),
        cognition: state.cognition || cognitionBlueprint,
        environmentModules: state.environmentModules || labEnvironmentModules,
        agentStates: state.agentStates || createAgentStates(state.labClock || 0, activeScientistId),
        socialGraph,
        chatMessages: (
            state.chatMessages?.length
                ? state.chatMessages
                : [
                      buildChatTurn(
                          primaryEdge.from,
                          primaryEdge.to,
                          state.labClock || 0,
                          timestamp,
                          primaryEdge.topic
                      ),
                  ]
        ).slice(0, MAX_CHATS),
        memoryStream: (state.memoryStream || createMemoryStream(events)).slice(0, MAX_MEMORIES),
        replayFrames:
            state.replayFrames ||
            createReplayFrames(state.startedAt || state.updatedAt || nowIso()).slice(
                0,
                MAX_REPLAY_FRAMES
            ),
    };
}

function createInitialState() {
    const startedAt = nowIso();
    const formulas = initialFormulas.map(enrichFormula).sort((a, b) => b.overall - a.overall);
    const events = [
        {
            id: 'evt-boot',
            timestamp: startedAt,
            scientistId: 'mira',
            type: 'Evidence-backed',
            formulaId: 'FUSE-CM-001',
            message:
                'sets creatine monohydrate as the control before testing any coffee-compatible delivery system.',
        },
        {
            id: 'evt-palate',
            timestamp: startedAt,
            scientistId: 'ava',
            type: 'Needs sensory panel',
            formulaId: 'FUSE-IF-014',
            message:
                'opens the tongue-feel protocol: grit, bitterness, aroma masking, and aftertaste get separate scores.',
        },
        {
            id: 'evt-claims',
            timestamp: startedAt,
            scientistId: 'nina',
            type: 'Regulatory control',
            formulaId: 'FUSE-IF-014',
            message:
                'marks “maximum absorption” as an internal research target, not a public claim.',
        },
    ];
    return {
        version: 2,
        labClock: 0,
        startedAt,
        updatedAt: startedAt,
        mode: 'evidence-gated simulation',
        mission:
            'Discover a coffee-compatible creatine delivery system that disperses fast, protects taste, and stays honest about absorption evidence.',
        guardrails: [
            'Do not treat simulations as clinical proof.',
            'Creatine monohydrate is the evidence baseline unless new direct data proves otherwise.',
            'Taste, tongue feel, coffee aroma, and grit must be scored separately.',
            'Absorption language must stay internal until direct comparative evidence exists.',
        ],
        scientists,
        formulas,
        evidenceSources,
        cognition: cognitionBlueprint,
        environmentModules: labEnvironmentModules,
        agentStates: createAgentStates(0, 'mira'),
        socialGraph: createSocialGraph(startedAt),
        chatMessages: [
            buildChatTurn(
                'mira',
                'theo',
                0,
                startedAt,
                'control formula and coffee matrix alignment'
            ),
        ],
        memoryStream: createMemoryStream(events),
        replayFrames: createReplayFrames(startedAt),
        papers: [],
        activeExperiment: {
            id: 'EXP-000',
            kind: 'Lab boot sequence',
            station: 'Central Table',
            formulaId: 'FUSE-IF-014',
            scientistId: 'mira',
            evidenceGate: 'Hypothesis',
            progress: 38,
        },
        events,
    };
}

async function getState() {
    if (redis) {
        try {
            const stored = await redis.get(STATE_KEY);
            if (stored) {
                return migrateState(typeof stored === 'string' ? JSON.parse(stored) : stored);
            }
        } catch (error) {
            console.warn('[ResearchLab] Redis read failed:', error.message);
        }
    }

    if (!memoryState) {
        memoryState = createInitialState();
    }
    memoryState = migrateState(memoryState);
    return memoryState;
}

async function saveState(state) {
    const nextState = migrateState({ ...state, updatedAt: nowIso() });
    if (redis) {
        try {
            await redis.set(STATE_KEY, JSON.stringify(nextState));
        } catch (error) {
            console.warn('[ResearchLab] Redis write failed:', error.message);
        }
    }
    memoryState = nextState;
    return nextState;
}

function chooseFormula(state, labClock) {
    const nonControls = state.formulas.filter(formula => formula.status !== 'control');
    return nonControls[labClock % nonControls.length] || state.formulas[0];
}

function boundedScore(value) {
    return Math.max(34, Math.min(98, Math.round(value)));
}

function tickFormula(formula, metric, labClock) {
    const current = formula.scores[metric] || 60;
    const wave = Math.sin((labClock + formula.id.length + metric.length) / 2.7);
    const nudge = wave > 0.55 ? 2 : wave < -0.55 ? -1 : 1;
    const scores = {
        ...formula.scores,
        [metric]: boundedScore(current + nudge),
    };
    return enrichFormula({
        ...formula,
        scores,
        evidenceLevel:
            metric === 'absorptionEvidence' && scores[metric] < 75
                ? 'Needs wet-lab validation'
                : formula.evidenceLevel,
    });
}

function buildTickEvent(state, template, formula) {
    const scientist = scientists.find(item => item.id === template.scientistId) || scientists[0];
    return {
        id: `evt-${state.labClock + 1}-${template.scientistId}-${Date.now()}`,
        timestamp: nowIso(),
        scientistId: scientist.id,
        type: template.evidenceGate,
        formulaId: formula.id,
        message: `${scientist.name} ${template.message}`,
    };
}

async function advanceLabState(reason = 'scheduled') {
    const state = await getState();
    const labClock = (state.labClock || 0) + 1;
    const template = experimentTemplates[labClock % experimentTemplates.length];
    const formula = chooseFormula(state, labClock);
    const formulas = state.formulas
        .map(item =>
            item.id === formula.id
                ? tickFormula(item, template.metric, labClock)
                : enrichFormula(item)
        )
        .sort((a, b) => b.overall - a.overall);
    const updatedFormula = formulas.find(item => item.id === formula.id) || formula;
    const event = buildTickEvent({ ...state, labClock: labClock - 1 }, template, updatedFormula);
    const memory = buildMemoryFromEvent(event);
    const memories = [memory, ...(state.memoryStream || [])].slice(0, MAX_MEMORIES);
    const scientist = scientists.find(item => item.id === template.scientistId) || scientists[0];
    const reflectionEvent =
        labClock % 3 === 0 || memory.importance >= 82
            ? buildReflection(scientist, memories, labClock)
            : null;
    const reflectionMemories = reflectionEvent
        ? [buildMemoryFromEvent(reflectionEvent), ...memories].slice(0, MAX_MEMORIES)
        : memories;
    const events = [event, ...(reflectionEvent ? [reflectionEvent] : []), ...(state.events || [])];
    const progress = 18 + ((labClock * 17) % 76);
    const timestamp = event.timestamp;
    const collaboratorId = collaboratorByMetric[template.metric] || 'pipette';
    const chatTurn = buildChatTurn(
        template.scientistId,
        collaboratorId,
        labClock,
        timestamp,
        `${template.kind.toLowerCase()} for ${updatedFormula.id}`
    );

    return saveState({
        ...state,
        labClock,
        formulas,
        activeExperiment: {
            id: `EXP-${String(labClock).padStart(3, '0')}`,
            kind: template.kind,
            station: template.station,
            formulaId: updatedFormula.id,
            scientistId: template.scientistId,
            evidenceGate: event.type,
            progress,
            reason,
        },
        agentStates: createAgentStates(labClock, template.scientistId).map(agentState =>
            agentState.id === template.scientistId && reflectionEvent
                ? {
                      ...agentState,
                      reflection: reflectionEvent.message,
                      currentAction: `executing ${template.kind.toLowerCase()}`,
                  }
                : agentState
        ),
        socialGraph: updateSocialGraph(state.socialGraph, template, timestamp),
        chatMessages: [chatTurn, ...(state.chatMessages || [])].slice(0, MAX_CHATS),
        memoryStream: reflectionMemories,
        replayFrames: [
            {
                tick: labClock,
                timestamp,
                mode: 'plan-execute',
                scientistId: template.scientistId,
                station: template.station,
                action: template.kind,
                formulaId: updatedFormula.id,
                plan: planForScientist(template.scientistId, labClock),
                outcome: event.message,
            },
            ...(state.replayFrames || []),
        ].slice(0, MAX_REPLAY_FRAMES),
        events: events.slice(0, MAX_EVENTS),
    });
}

function normalizePaper(item) {
    const title = Array.isArray(item.title)
        ? item.title[0]
        : item.title || 'Untitled research record';
    const dateParts =
        item.published?.['date-parts'] ||
        item['published-print']?.['date-parts'] ||
        item['published-online']?.['date-parts'];
    const year = Array.isArray(dateParts) && dateParts[0] ? dateParts[0][0] : null;
    return {
        id: item.DOI || item.URL || title,
        title,
        source: item['container-title']?.[0] || item.publisher || 'Crossref',
        url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : null),
        year,
        type: item.type || 'journal-article',
        evidenceLevel: 'Needs review',
    };
}

async function fetchCrossrefPapers(query = 'creatine monohydrate coffee solubility') {
    const mailto = process.env.RESEARCH_CONTACT_EMAIL || process.env.CEO_EMAIL || '';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PAPER_TIMEOUT_MS);
    const url = new URL('https://api.crossref.org/works');
    url.searchParams.set('query.bibliographic', query.slice(0, 160));
    url.searchParams.set('rows', '6');
    url.searchParams.set('sort', 'published');
    url.searchParams.set('order', 'desc');
    if (mailto) url.searchParams.set('mailto', mailto);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': `FUSE-Research-Lab/1.0${mailto ? ` (mailto:${mailto})` : ''}`,
            },
        });
        if (!response.ok) {
            throw new Error(`Crossref request failed: ${response.status}`);
        }
        const payload = await response.json();
        return (payload.message?.items || []).map(normalizePaper);
    } finally {
        clearTimeout(timeout);
    }
}

async function refreshPapers(query) {
    const state = await getState();
    const papers = await fetchCrossrefPapers(query);
    const seen = new Set();
    const merged = [...papers, ...(state.papers || [])].filter(paper => {
        if (seen.has(paper.id)) return false;
        seen.add(paper.id);
        return true;
    });
    const event = {
        id: `evt-paper-${Date.now()}`,
        timestamp: nowIso(),
        scientistId: 'max',
        type: 'Evidence-backed',
        message: `Dr. Max Flux fetched ${papers.length} research records for evidence triage. Records still need human review before claims change.`,
    };
    return saveState({
        ...state,
        papers: merged.slice(0, MAX_PAPERS),
        memoryStream: [buildMemoryFromEvent(event), ...(state.memoryStream || [])].slice(
            0,
            MAX_MEMORIES
        ),
        events: [event, ...(state.events || [])].slice(0, MAX_EVENTS),
    });
}

async function resetState() {
    const state = createInitialState();
    return saveState(state);
}

module.exports = {
    getState,
    saveState,
    advanceLabState,
    refreshPapers,
    resetState,
    createInitialState,
};
