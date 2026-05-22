const { createRedisClient } = require('./redis-client');
const { generateDailyDiscovery, generateWeeklyReview } = require('./research-lab-brain');

const STATE_KEY = 'research-world:state:v3';
const MAX_MEMORIES = 72;
const MAX_CONVERSATIONS = 24;
const MAX_DISPUTES = 12;
const MAX_BATCH_RESULTS = 36;
const MAX_REFLECTIONS = 24;
const REFLECTION_IMPORTANCE_THRESHOLD = 185;
const DAILY_DISCOVERY_TICKS = 3;
const MISSION =
    'Find a manufacturable way to make creatine monohydrate dissolve quickly in hot coffee while keeping the coffee experience clean, dose-accurate, and evidence-gated.';
const GUARDRAIL =
    'Agent findings are internal hypotheses until wet-lab and legal review upgrade the evidence level.';
const DEFAULT_LAB_CONTROLS = {
    dailyEnabled: true,
    weeklyEnabled: true,
    modelSynthesisEnabled: true,
    dailyModel: 'gpt-5-mini',
    weeklyModel: 'gpt-5.5',
    weeklyReasoning: 'high',
};

const redis = createRedisClient();

let memoryState = null;

const stations = [
    {
        id: 'central-rail',
        name: 'Central Sample Rail',
        purpose: 'Routes samples and evidence between teams',
        color: '#d7ed69',
        x: 39,
        y: 38,
        w: 24,
        h: 22,
    },
    {
        id: 'encapsulation',
        name: 'Encapsulation Bench',
        purpose: 'Carrier structure, wetting, agglomeration',
        color: '#ff3b30',
        x: 10,
        y: 7,
        w: 24,
        h: 20,
    },
    {
        id: 'coffee',
        name: 'Coffee Matrix Bar',
        purpose: 'Espresso, black coffee, milk coffee stress tests',
        color: '#c58b59',
        x: 42,
        y: 6,
        w: 23,
        h: 22,
    },
    {
        id: 'claims',
        name: 'Claims Gate',
        purpose: 'Substantiation, label language, public claim control',
        color: '#8fb8ff',
        x: 75,
        y: 42,
        w: 20,
        h: 18,
    },
    {
        id: 'evidence',
        name: 'Evidence Desk',
        purpose: 'Creatine monohydrate evidence and absorption boundaries',
        color: '#44d7b6',
        x: 6,
        y: 36,
        w: 24,
        h: 23,
    },
    {
        id: 'sensory',
        name: 'Sensory Booth',
        purpose: 'Grit, bitterness, aroma, tongue coating',
        color: '#f5b56b',
        x: 76,
        y: 6,
        w: 20,
        h: 22,
    },
    {
        id: 'pilot',
        name: 'Pilot Mixer',
        purpose: 'Dose uniformity, moisture risk, scale-up path',
        color: '#b890ff',
        x: 43,
        y: 64,
        w: 28,
        h: 22,
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
        scratch: {
            specialty: 'porous food-grade matrices',
            riskBias: 'rejects brittle IP routes and over-compressed particles',
            directive: 'make monohydrate wet fast before it can clump',
        },
    },
    {
        id: 'theo',
        name: 'Dr. Theo Roast',
        role: 'Coffee Matrix Chemist',
        stationId: 'coffee',
        color: '#c58b59',
        intent: 'Protect espresso aroma, crema, acidity, and heat stability.',
        scratch: {
            specialty: 'hot coffee matrix compatibility',
            riskBias: 'rejects anything that damages crema, aroma, or acidity',
            directive: 'test disappearance in black coffee, espresso, and milk coffee',
        },
    },
    {
        id: 'ava',
        name: 'Dr. Ava Palate',
        role: 'Sensory Scientist',
        stationId: 'sensory',
        color: '#f5b56b',
        intent: 'Reject grit, chalk, bitterness, and tongue coating.',
        scratch: {
            specialty: 'mouthfeel and aftertaste screening',
            riskBias: 'treats trace grit as a product failure until panel data says otherwise',
            directive: 'separate clean experience from unsupported zero-grit language',
        },
    },
    {
        id: 'max',
        name: 'Dr. Max Flux',
        role: 'Creatine Evidence Lead',
        stationId: 'evidence',
        color: '#44d7b6',
        intent: 'Separate proven creatine evidence from delivery hypotheses.',
        scratch: {
            specialty: 'creatine evidence boundaries',
            riskBias: 'blocks absorption superiority claims without direct comparative data',
            directive: 'keep monohydrate dose integrity central to every experiment',
        },
    },
    {
        id: 'nina',
        name: 'Dr. Nina Claims',
        role: 'Regulatory Scientist',
        stationId: 'claims',
        color: '#8fb8ff',
        intent: 'Block any product claim that outruns evidence.',
        scratch: {
            specialty: 'UK/EU supplement claims control',
            riskBias: 'downgrades any claim not supported by standardized evidence',
            directive: 'keep all discovery outputs internal until Legal upgrades them',
        },
    },
    {
        id: 'jules',
        name: 'Jules Batch',
        role: 'Manufacturing Engineer',
        stationId: 'pilot',
        color: '#b890ff',
        intent: 'Turn promising bench ideas into doseable, stable pilot batches.',
        scratch: {
            specialty: 'pilot-scale powder handling',
            riskBias: 'rejects beautiful bench samples that cannot survive packing',
            directive: 'prefer low-compression, dose-uniform, moisture-tolerant routes',
        },
    },
    {
        id: 'pipette',
        name: 'Pipette',
        role: 'Lab Assistant Agent',
        stationId: 'central-rail',
        color: '#d7ed69',
        intent: 'Move samples, timestamp evidence, and keep the audit trail clean.',
        scratch: {
            specialty: 'sample logistics and audit trails',
            riskBias: 'treats missing metadata as a failed experiment',
            directive: 'capture who did what, with which batch, and why it matters',
        },
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

const baseLabObjects = [
    {
        id: 'chamber-01',
        type: 'BiosynthesisChamber',
        stationId: 'pilot',
        status: 'idle',
        temperatureC: 22,
        pressurePsi: 14.7,
        stirRateRpm: 0,
        fluidTurbidity: 0,
        validActions: ['initialize_batch', 'set_temperature', 'set_rpm', 'discharge_chamber'],
    },
    {
        id: 'analysis-console-01',
        type: 'AnalysisConsole',
        stationId: 'evidence',
        status: 'ready',
        screenText: 'Awaiting batch telemetry.',
        validActions: ['query_analysis', 'print_lab_report', 'calibrate_sensors'],
    },
    {
        id: 'dispenser-matrix-a',
        type: 'IngredientDispenser',
        stationId: 'encapsulation',
        status: 'available',
        material: 'porous hydrophilic carrier matrix',
        remainingCapacityG: 2500,
        purityGrade: 'food_supplement_candidate',
        validActions: ['dispense_material'],
    },
    {
        id: 'coffee-bar-01',
        type: 'CoffeeMatrixBar',
        stationId: 'coffee',
        status: 'ready',
        matrix: 'black coffee',
        validActions: ['pull_espresso', 'prepare_black_coffee', 'prepare_milk_coffee'],
    },
];

function nowIso() {
    return new Date().toISOString();
}

function average(scores) {
    const values = Object.values(scores);
    if (!values.length) return 0;
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

function agentSeed(agentId) {
    return String(agentId)
        .split('')
        .reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function pairKey(firstId, secondId) {
    return [firstId, secondId].sort().join(':');
}

function getAgentBlueprint(agentId) {
    return agentBlueprints.find(agent => agent.id === agentId) || agentBlueprints[0];
}

function tokenize(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter(token => token.length > 2);
}

function keywordRelevance(memory, query) {
    const queryTokens = tokenize(query);
    if (!queryTokens.length) return 0;

    const memoryTokens = new Set(
        tokenize(
            [
                memory.summary,
                memory.type,
                memory.evidenceLevel,
                memory.hypothesisId,
                JSON.stringify(memory.metadata || {}),
            ].join(' ')
        )
    );
    const matches = queryTokens.filter(token => memoryTokens.has(token)).length;
    return matches / queryTokens.length;
}

function normalizeScoredItems(items, key) {
    if (!items.length) return {};
    const values = items.map(item => item[key]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return items.reduce((scores, item) => {
        scores[item.id] = max === min ? 0.5 : (item[key] - min) / (max - min);
        return scores;
    }, {});
}

function retrieveMemories(memories, query, labClock, agentId = null, count = 4) {
    const candidates = (memories || [])
        .filter(memory => !agentId || memory.agentId === agentId || memory.type === 'reflection')
        .map(memory => {
            const createdTick = Number(memory.createdTick || 0);
            const recency = Math.pow(0.91, Math.max(0, labClock - createdTick));
            const importance = Number(memory.importance || 0);
            const relevance = keywordRelevance(memory, query);
            return {
                ...memory,
                _recency: recency,
                _importance: importance,
                _relevance: relevance,
            };
        });

    if (!candidates.length) return [];

    const recency = normalizeScoredItems(candidates, '_recency');
    const importance = normalizeScoredItems(candidates, '_importance');
    const relevance = normalizeScoredItems(candidates, '_relevance');

    return candidates
        .map(memory => ({
            ...memory,
            retrievalScore: Number(
                (
                    (recency[memory.id] || 0) * 0.25 +
                    (importance[memory.id] || 0) * 0.35 +
                    (relevance[memory.id] || 0) * 0.4
                ).toFixed(3)
            ),
        }))
        .sort((a, b) => b.retrievalScore - a.retrievalScore)
        .slice(0, count)
        .map(({ _recency, _importance, _relevance, ...memory }) => memory);
}

function buildAgentQuery(agent, experiment) {
    return [
        agent.role,
        agent.scratch?.specialty,
        experiment.title,
        experiment.hypothesisId,
        experiment.dispute,
        experiment.metric,
    ].join(' ');
}

function buildProtocol(template, labClock) {
    const variation = labClock % 5;
    const heatTarget = template.stationId === 'coffee' ? 82 : template.metric === 'heat' ? 88 : 58;
    const compression = template.hypothesisId === 'FUSE-POR-01' ? 22 + variation * 3 : 38 + variation * 4;
    const wettingAidPct = template.hypothesisId === 'FUSE-WET-02' ? 0.12 + variation * 0.03 : 0;
    const effervescentPct = template.hypothesisId === 'FUSE-EFF-03' ? 0.35 + variation * 0.05 : 0;

    return {
        batchId: `B-${String(400 + labClock).padStart(3, '0')}`,
        temperatureC: clamp(heatTarget + ((labClock % 3) - 1) * 4, 35, 92),
        stirRateRpm: clamp(420 + variation * 110 + (template.metric === 'dissolve' ? 160 : 0), 280, 1200),
        carrierRatioPct: clamp(8 + variation * 2 + (template.hypothesisId === 'FUSE-POR-01' ? 4 : 0), 4, 24),
        compressionKpa: compression,
        wettingAidPct: Number(wettingAidPct.toFixed(2)),
        effervescentPct: Number(effervescentPct.toFixed(2)),
        coffeeMatrix: template.stationId === 'sensory' ? 'latte' : 'black coffee',
        creatineDoseG: 3,
    };
}

function simulateBatch(template, protocol, labClock) {
    const porosityBonus = Math.max(0, 32 - protocol.compressionKpa) * 0.09;
    const wettingBonus = protocol.wettingAidPct * 18 + protocol.effervescentPct * 10;
    const heatPenalty = Math.max(0, protocol.temperatureC - 82) * 0.08;
    const agitationBonus = Math.min(8, protocol.stirRateRpm / 180);
    const gritScore = clamp(44 - porosityBonus * 6 - wettingBonus + heatPenalty * 5 + (labClock % 4), 3, 92);
    const dissolutionSeconds = Number(
        Math.max(1.8, 9.4 - porosityBonus - wettingBonus * 0.14 - agitationBonus * 0.28).toFixed(1)
    );
    const tasteCleanliness = clamp(
        78 - protocol.wettingAidPct * 42 - protocol.effervescentPct * 34 - heatPenalty * 2,
        20,
        96
    );
    const doseUniformity = clamp(91 - Math.abs(protocol.carrierRatioPct - 14) * 1.5, 48, 98);
    const bioavailabilityIndex = clamp(
        82 + (100 - gritScore) * 0.08 + doseUniformity * 0.04 - protocol.effervescentPct * 8,
        68,
        96
    );

    return {
        batchId: protocol.batchId,
        hypothesisId: template.hypothesisId,
        status: gritScore > 58 ? 'needs reformulation' : 'candidate signal',
        metrics: {
            dissolutionSeconds,
            gritScore,
            tasteCleanliness,
            doseUniformity,
            bioavailabilityIndex,
            yieldG: clamp(410 + (labClock % 7) * 8 - protocol.carrierRatioPct, 330, 470),
            purityPct: clamp(98 - heatPenalty - protocol.effervescentPct * 3, 88, 99),
        },
        protocol,
        completedAt: nowIso(),
    };
}

function buildLabObjects(experiment, batchResult) {
    return baseLabObjects.map(object => {
        if (object.id === 'chamber-01') {
            return {
                ...object,
                status: 'processing',
                currentBatchId: batchResult.batchId,
                temperatureC: batchResult.protocol.temperatureC,
                pressurePsi: Number((14.7 + batchResult.protocol.temperatureC / 24).toFixed(1)),
                stirRateRpm: batchResult.protocol.stirRateRpm,
                fluidTurbidity: batchResult.metrics.gritScore,
            };
        }
        if (object.id === 'analysis-console-01') {
            return {
                ...object,
                status: 'reporting',
                lastReportedMetrics: batchResult.metrics,
                screenText: `${batchResult.batchId}: ${batchResult.metrics.dissolutionSeconds}s dissolve, grit ${batchResult.metrics.gritScore}/100, status ${batchResult.status}.`,
            };
        }
        if (object.id === 'coffee-bar-01') {
            return {
                ...object,
                status: experiment.stationId === 'coffee' ? 'active' : 'ready',
                matrix: batchResult.protocol.coffeeMatrix,
            };
        }
        return object;
    });
}

function buildPlan(agent, experiment, hypothesis, retrievedMemories, labClock) {
    const memoryIds = retrievedMemories.map(memory => memory.id);
    return {
        id: `plan-${labClock}-${agent.id}`,
        generatedBy: agent.id,
        rootDirective: agent.scratch?.directive || agent.intent,
        retrievedMemoryIds: memoryIds,
        steps: [
            {
                level: 1,
                label: `Advance ${hypothesis.id} without exceeding evidence boundaries`,
                status: 'active',
            },
            {
                level: 2,
                label: `Run ${experiment.title.toLowerCase()} against ${hypothesis.name}`,
                status: 'active',
            },
            {
                level: 3,
                label: `Query ${memoryIds.length || 'no'} relevant memory nodes before changing parameters`,
                status: memoryIds.length ? 'complete' : 'watching',
            },
            {
                level: 4,
                label: `MoveTo(${experiment.stationId}) -> Interact(${experiment.metric}_screen)`,
                status: 'queued',
            },
        ],
    };
}

function buildReflectionMemory(agent, retrievedMemories, experiment, labClock, timestamp) {
    const importanceTotal = retrievedMemories.reduce(
        (sum, memory) => sum + Number(memory.importance || 0),
        0
    );
    if (importanceTotal < REFLECTION_IMPORTANCE_THRESHOLD || labClock % 2 !== 0) {
        return null;
    }

    const strongest = retrievedMemories[0];
    const insight = strongest
        ? `${agent.name} is abstracting from ${strongest.id}: ${experiment.metric} progress only matters if claims, sensory quality, and dose integrity remain aligned.`
        : `${agent.name} is forming a new research hypothesis from the current experiment.`;

    return {
        id: `ref-${labClock}-${agent.id}`,
        timestamp,
        createdTick: labClock,
        lastRetrievedTick: labClock,
        type: 'reflection',
        agentId: agent.id,
        hypothesisId: experiment.hypothesisId,
        evidenceLevel: 'Internal reflection',
        importance: clamp(72 + retrievedMemories.length * 4),
        summary: insight,
        metadata: {
            sourceMemoryIds: retrievedMemories.map(memory => memory.id),
            triggerImportance: importanceTotal,
            anchor: experiment.title,
        },
    };
}

function createAgents(labClock = 0, currentExperiment = experimentTemplates[0], memories = []) {
    return agentBlueprints.map((agent, index) => {
        const seed = agentSeed(agent.id);
        const active =
            agent.id === currentExperiment.leadAgentId ||
            agent.id === currentExperiment.supportAgentId;
        const cadence = 2 + (seed % 4);
        const patrolStep = Math.floor((labClock + seed) / cadence);
        const targetStationId = active
            ? currentExperiment.stationId
            : stations[(patrolStep + index + seed) % stations.length].id;
        const home = stationCenter(agent.stationId);
        const target = stationCenter(targetStationId);
        const phase = ((labClock + seed) % cadence) / cadence;
        const pull = active ? 0.82 : 0.18 + phase * 0.68;
        const drift = active ? 0 : Math.sin(labClock * 0.73 + seed) * (0.8 + (seed % 4) * 0.28);
        const needsSeed = labClock + index * 7;
        const walkDuration = 920 + (seed % 9) * 170;
        const stepDuration = 620 + (seed % 6) * 120;
        const travelDuration = 1800 + (seed % 8) * 260;
        const retrievedMemories = retrieveMemories(
            memories,
            buildAgentQuery(agent, currentExperiment),
            labClock,
            agent.id,
            3
        );

        return {
            ...agent,
            scratch: { ...(agent.scratch || {}) },
            x: clamp(home.x + (target.x - home.x) * pull + drift, 4, 96),
            y: clamp(
                home.y +
                    (target.y - home.y) * pull +
                    Math.cos(labClock * 0.61 + seed) * (0.7 + (seed % 5) * 0.24),
                4,
                96
            ),
            targetStationId,
            intent: active ? currentExperiment.title : agent.intent,
            reflection: buildAgentReflection(agent, currentExperiment, active, retrievedMemories),
            retrievedMemories: retrievedMemories.map(memory => ({
                id: memory.id,
                type: memory.type,
                summary: memory.summary,
                retrievalScore: memory.retrievalScore,
                importance: memory.importance,
            })),
            activePlan:
                currentExperiment.plan?.generatedBy === agent.id
                    ? currentExperiment.plan
                    : null,
            motion: {
                cadence,
                phase: Number(phase.toFixed(2)),
                walkDuration,
                stepDuration,
                travelDuration,
                delay: -((seed * 37 + labClock * 113) % walkDuration),
                stepDelay: -((seed * 53 + labClock * 71) % stepDuration),
            },
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

function buildAgentReflection(agent, experiment, active, retrievedMemories = []) {
    const topMemory = retrievedMemories[0];
    if (active) {
        const memoryClause = topMemory
            ? ` Retrieved ${topMemory.id} (${topMemory.retrievalScore}) before acting.`
            : ' No strong prior memory was retrieved, so this becomes a baseline run.';
        return `${agent.name} is working the ${experiment.title.toLowerCase()} while checking that the conclusion stays inside its evidence level.${memoryClause}`;
    }
    return `${agent.name} is watching for conflicts between formulation progress, sensory quality, manufacturability, and claims control.`;
}

function createExperiment(labClock) {
    const template = experimentTemplates[labClock % experimentTemplates.length];
    const protocol = buildProtocol(template, labClock);
    const batchResult = simulateBatch(template, protocol, labClock);
    return {
        id: `EXP-${String(labClock).padStart(3, '0')}`,
        ...template,
        progress: 22 + ((labClock * 17) % 74),
        startedAt: nowIso(),
        protocol,
        batchResult,
        plan: null,
    };
}

function createInitialState() {
    const currentExperiment = createExperiment(0);
    const timestamp = nowIso();
    const leadAgent = getAgentBlueprint(currentExperiment.leadAgentId);
    const bootMemory = {
        id: 'mem-boot',
        timestamp,
        createdTick: 0,
        lastRetrievedTick: 0,
        type: 'observation',
        agentId: 'pipette',
        evidenceLevel: 'Internal simulation',
        importance: 72,
        summary:
            'The lab world booted with legal claim boundaries, formulation hypotheses, station roles, and genagents-style memory retrieval loaded.',
        metadata: {
            claimBoundaries,
            stationCount: stations.length,
            agentCount: agentBlueprints.length,
        },
    };
    const retrieved = retrieveMemories(
        [bootMemory],
        buildAgentQuery(leadAgent, currentExperiment),
        0,
        leadAgent.id,
        3
    );
    currentExperiment.plan = buildPlan(
        leadAgent,
        currentExperiment,
        hypotheses[0],
        retrieved,
        0
    );
    const agents = createAgents(0, currentExperiment, [bootMemory]);
    return {
        version: 3,
        mode: 'living research world',
        labClock: 0,
        labDay: 47,
        mission: MISSION,
        guardrail: GUARDRAIL,
        stations,
        labObjects: buildLabObjects(currentExperiment, currentExperiment.batchResult),
        agents,
        hypotheses: hypotheses.map(item => ({ ...item, scores: { ...item.scores } })),
        currentExperiment,
        conversations: [buildConversation(currentExperiment, timestamp, 0)],
        memories: [bootMemory],
        reflections: [],
        batchResults: [currentExperiment.batchResult],
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
        dailyDiscovery: {
            status: 'waiting',
            lastRunDate: null,
            headline: 'Daily autonomous discovery has not run yet.',
        },
        weeklyReview: {
            status: 'waiting',
            lastRunDate: null,
            headline: 'Weekly GPT-5.5 development review has not run yet.',
        },
        labControls: { ...DEFAULT_LAB_CONTROLS },
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
        createdTick: labClock,
        lastRetrievedTick: labClock,
        type: 'observation',
        agentId: experiment.leadAgentId,
        hypothesisId: experiment.hypothesisId,
        evidenceLevel: experiment.evidenceLevel,
        importance: clamp(
            58 +
                labClock * 3 +
                (experiment.evidenceLevel.includes('control') ? 18 : 0) +
                (experiment.batchResult.metrics.gritScore > 55 ? 12 : 0)
        ),
        summary: `${experiment.title} produced ${experiment.batchResult.batchId}: ${experiment.batchResult.metrics.dissolutionSeconds}s dissolve, grit ${experiment.batchResult.metrics.gritScore}/100, ${hypothesis.id} now ${average(hypothesis.scores)}/100 overall.`,
        metadata: {
            batch: experiment.batchResult,
            dispute: experiment.dispute,
            scores: hypothesis.scores,
        },
    };
}

function buildActionMemory(experiment, labClock, timestamp) {
    return {
        id: `act-${labClock}-${experiment.leadAgentId}`,
        timestamp,
        createdTick: labClock,
        lastRetrievedTick: labClock,
        type: 'action',
        agentId: experiment.leadAgentId,
        hypothesisId: experiment.hypothesisId,
        evidenceLevel: 'Internal operation',
        importance: clamp(44 + experiment.progress / 2),
        summary: `${getAgentBlueprint(experiment.leadAgentId).name} executed ${experiment.plan?.steps?.[3]?.label || experiment.title} using ${experiment.batchResult.batchId}.`,
        metadata: {
            objectIds: ['chamber-01', 'analysis-console-01'],
            validActions: ['initialize_batch', 'set_temperature', 'set_rpm', 'query_analysis'],
            planId: experiment.plan?.id,
        },
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

function buildExperimentQueue(labClock, rankedHypotheses = hypotheses) {
    const ranking = [...rankedHypotheses].sort((a, b) => average(b.scores) - average(a.scores));
    return experimentTemplates.slice(0, 7).map((template, index) => {
        const shifted = experimentTemplates[(labClock + index + 1) % experimentTemplates.length];
        const relatedHypothesis =
            ranking.find(hypothesis => hypothesis.id === shifted.hypothesisId) || ranking[index % ranking.length];
        return {
            id: `queue-${labClock}-${index}`,
            title: shifted.title,
            owner: shifted.leadAgentId.toUpperCase(),
            reason: shifted.dispute,
            hypothesisId: shifted.hypothesisId,
            priority: index === 0 ? 'next' : average(relatedHypothesis?.scores || {}) >= 82 ? 'candidate' : 'watch',
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

function normalizeBoolean(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}

function normalizeModel(value, fallback) {
    const model = String(value || '').trim();
    return /^[a-zA-Z0-9._-]+$/.test(model) ? model.slice(0, 80) : fallback;
}

function normalizeReasoning(value, fallback) {
    const effort = String(value || '').trim();
    return ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'].includes(effort)
        ? effort
        : fallback;
}

function normalizeLabControls(candidate = {}) {
    return {
        dailyEnabled: normalizeBoolean(candidate.dailyEnabled, DEFAULT_LAB_CONTROLS.dailyEnabled),
        weeklyEnabled: normalizeBoolean(
            candidate.weeklyEnabled,
            DEFAULT_LAB_CONTROLS.weeklyEnabled
        ),
        modelSynthesisEnabled: normalizeBoolean(
            candidate.modelSynthesisEnabled,
            DEFAULT_LAB_CONTROLS.modelSynthesisEnabled
        ),
        dailyModel: normalizeModel(candidate.dailyModel, DEFAULT_LAB_CONTROLS.dailyModel),
        weeklyModel: normalizeModel(candidate.weeklyModel, DEFAULT_LAB_CONTROLS.weeklyModel),
        weeklyReasoning: normalizeReasoning(
            candidate.weeklyReasoning,
            DEFAULT_LAB_CONTROLS.weeklyReasoning
        ),
    };
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
        labObjects: Array.isArray(candidate.labObjects)
            ? candidate.labObjects
            : base.labObjects,
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
        reflections: Array.isArray(candidate.reflections)
            ? candidate.reflections.slice(0, MAX_REFLECTIONS)
            : base.reflections,
        batchResults: Array.isArray(candidate.batchResults)
            ? candidate.batchResults.slice(0, MAX_BATCH_RESULTS)
            : base.batchResults,
        disputes: Array.isArray(candidate.disputes)
            ? candidate.disputes.slice(0, MAX_DISPUTES)
            : base.disputes,
        experimentQueue: Array.isArray(candidate.experimentQueue)
            ? candidate.experimentQueue
            : base.experimentQueue,
        currentExperiment: candidate.currentExperiment || base.currentExperiment,
        dailyDiscovery: candidate.dailyDiscovery || base.dailyDiscovery,
        weeklyReview: candidate.weeklyReview || base.weeklyReview,
        labControls: normalizeLabControls(candidate.labControls || base.labControls),
        labDay: Number(candidate.labDay || base.labDay || 47),
    };

    if (!next.currentExperiment.batchResult || !next.currentExperiment.protocol) {
        next.currentExperiment = createExperiment(Number(next.labClock || 0));
    }

    if (!next.currentExperiment.plan) {
        const leadAgent = getAgentBlueprint(next.currentExperiment.leadAgentId);
        const activeHypothesis =
            next.hypotheses.find(item => item.id === next.currentExperiment.hypothesisId) ||
            next.hypotheses[0];
        const retrieved = retrieveMemories(
            next.memories,
            buildAgentQuery(leadAgent, next.currentExperiment),
            next.labClock,
            leadAgent.id,
            3
        );
        next.currentExperiment.plan = buildPlan(
            leadAgent,
            next.currentExperiment,
            activeHypothesis,
            retrieved,
            next.labClock
        );
    }

    next.labObjects = buildLabObjects(next.currentExperiment, next.currentExperiment.batchResult);
    next.agents = createAgents(next.labClock, next.currentExperiment, next.memories);

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
    const leadAgent = getAgentBlueprint(currentExperiment.leadAgentId);
    const retrievedForPlan = retrieveMemories(
        previous.memories,
        buildAgentQuery(leadAgent, currentExperiment),
        labClock,
        leadAgent.id,
        4
    );
    currentExperiment.plan = buildPlan(
        leadAgent,
        currentExperiment,
        activeHypothesis,
        retrievedForPlan,
        labClock
    );
    const memory = buildMemory(currentExperiment, activeHypothesis, labClock, timestamp);
    const actionMemory = buildActionMemory(currentExperiment, labClock, timestamp);
    const candidateMemories = [memory, actionMemory, ...(previous.memories || [])];
    const reflection = buildReflectionMemory(
        leadAgent,
        retrieveMemories(
            candidateMemories,
            buildAgentQuery(leadAgent, currentExperiment),
            labClock,
            leadAgent.id,
            5
        ),
        currentExperiment,
        labClock,
        timestamp
    );
    const newMemories = reflection
        ? [reflection, memory, actionMemory, ...(previous.memories || [])].slice(0, MAX_MEMORIES)
        : [memory, actionMemory, ...(previous.memories || [])].slice(0, MAX_MEMORIES);
    const reflections = reflection
        ? [reflection, ...(previous.reflections || [])].slice(0, MAX_REFLECTIONS)
        : previous.reflections || [];
    const agents = createAgents(labClock, currentExperiment, newMemories);
    const conversation = buildConversation(currentExperiment, timestamp, labClock);
    const dispute = buildDispute(currentExperiment, labClock, timestamp);

    const state = {
        ...previous,
        labClock,
        labDay: 47 + Math.floor(labClock / DAILY_DISCOVERY_TICKS),
        agents,
        hypotheses: hypothesesNext,
        labObjects: buildLabObjects(currentExperiment, currentExperiment.batchResult),
        currentExperiment,
        conversations: [conversation, ...(previous.conversations || [])].slice(
            0,
            MAX_CONVERSATIONS
        ),
        memories: newMemories,
        reflections,
        batchResults: [currentExperiment.batchResult, ...(previous.batchResults || [])].slice(
            0,
            MAX_BATCH_RESULTS
        ),
        disputes: [dispute, ...(previous.disputes || [])].slice(0, MAX_DISPUTES),
        experimentQueue: buildExperimentQueue(labClock, hypothesesNext),
        updatedAt: timestamp,
        lastSource: source,
    };

    return saveState(state);
}

async function runDailyDiscovery(source = 'daily-cron', options = {}) {
    const controls = normalizeLabControls((await getState()).labControls);
    if (!options.force && !controls.dailyEnabled) {
        const state = normalizeState(await getState());
        return saveState({
            ...state,
            dailyDiscovery: {
                ...state.dailyDiscovery,
                status: 'disabled',
                headline: 'Daily discovery is disabled from the admin backend.',
                lastSkippedAt: nowIso(),
            },
            updatedAt: nowIso(),
            lastSource: source,
        });
    }

    const summaries = [];
    let state = null;

    for (let index = 0; index < DAILY_DISCOVERY_TICKS; index += 1) {
        state = await advanceLabState(source);
        summaries.push({
            tick: state.labClock,
            experiment: state.currentExperiment.title,
            batchId: state.currentExperiment.batchResult.batchId,
            status: state.currentExperiment.batchResult.status,
            evidenceLevel: state.currentExperiment.evidenceLevel,
        });
    }

    const brainDiscovery = await generateDailyDiscovery(state, summaries, controls);
    const timestamp = nowIso();
    const brainMemory = {
        id: `daily-${state.labClock}-${Date.now()}`,
        timestamp,
        createdTick: state.labClock,
        lastRetrievedTick: state.labClock,
        type: 'reflection',
        agentId: 'max',
        evidenceLevel: 'Internal AI synthesis',
        importance: brainDiscovery.status === 'model-backed' ? 92 : 74,
        summary: brainDiscovery.topInsight,
        metadata: {
            provider: brainDiscovery.provider,
            model: brainDiscovery.model,
            headline: brainDiscovery.headline,
            nextPhysicalTest: brainDiscovery.nextPhysicalTest,
            risk: brainDiscovery.risk,
            decisionNeeded: brainDiscovery.decisionNeeded,
        },
    };

    const dailyDiscovery = {
        status: brainDiscovery.status,
        provider: brainDiscovery.provider,
        model: brainDiscovery.model,
        lastRunDate: new Date().toISOString().slice(0, 10),
        lastRunAt: timestamp,
        tickCount: DAILY_DISCOVERY_TICKS,
        headline: brainDiscovery.headline,
        topInsight: brainDiscovery.topInsight,
        agentFindings: brainDiscovery.agentFindings,
        nextPhysicalTest: brainDiscovery.nextPhysicalTest,
        rankedActions: brainDiscovery.rankedActions,
        risk: brainDiscovery.risk,
        decisionNeeded: brainDiscovery.decisionNeeded,
        reason: brainDiscovery.reason,
        responseId: brainDiscovery.responseId,
        experiments: summaries,
    };

    return saveState({
        ...state,
        dailyDiscovery,
        memories: [brainMemory, ...(state.memories || [])].slice(0, MAX_MEMORIES),
        reflections: [brainMemory, ...(state.reflections || [])].slice(0, MAX_REFLECTIONS),
        updatedAt: timestamp,
        lastSource: source,
    });
}

async function runWeeklyReview(source = 'weekly-cron', options = {}) {
    const state = normalizeState(await getState());
    const controls = normalizeLabControls(state.labControls);
    if (!options.force && !controls.weeklyEnabled) {
        return saveState({
            ...state,
            weeklyReview: {
                ...state.weeklyReview,
                status: 'disabled',
                headline: 'Weekly GPT-5.5 development review is disabled from the admin backend.',
                lastSkippedAt: nowIso(),
            },
            updatedAt: nowIso(),
            lastSource: source,
        });
    }

    const weeklyReview = await generateWeeklyReview(state, controls);
    const timestamp = nowIso();
    const reviewMemory = {
        id: `weekly-${state.labClock}-${Date.now()}`,
        timestamp,
        createdTick: state.labClock,
        lastRetrievedTick: state.labClock,
        type: 'reflection',
        agentId: 'max',
        evidenceLevel: 'Internal development review',
        importance: weeklyReview.status === 'model-backed' ? 98 : 82,
        summary: `${weeklyReview.developmentRecommendation?.toUpperCase() || 'REVIEW'}: ${weeklyReview.rationale}`,
        metadata: {
            provider: weeklyReview.provider,
            model: weeklyReview.model,
            reasoningEffort: weeklyReview.reasoningEffort,
            headline: weeklyReview.headline,
            readinessScore: weeklyReview.readinessScore,
            confidence: weeklyReview.confidence,
            requiredRealWorldTests: weeklyReview.requiredRealWorldTests,
            nextSpendDecision: weeklyReview.nextSpendDecision,
            sergioDecisionNeeded: weeklyReview.sergioDecisionNeeded,
        },
    };

    const review = {
        ...weeklyReview,
        lastRunDate: new Date().toISOString().slice(0, 10),
        lastRunAt: timestamp,
    };

    return saveState({
        ...state,
        weeklyReview: review,
        memories: [reviewMemory, ...(state.memories || [])].slice(0, MAX_MEMORIES),
        reflections: [reviewMemory, ...(state.reflections || [])].slice(0, MAX_REFLECTIONS),
        updatedAt: timestamp,
        lastSource: source,
    });
}

async function updateLabControls(patch = {}) {
    const state = normalizeState(await getState());
    const labControls = normalizeLabControls({
        ...state.labControls,
        ...patch,
    });
    return saveState({
        ...state,
        labControls,
        updatedAt: nowIso(),
        lastSource: 'admin-controls',
    });
}

async function getLabAdminState() {
    const state = normalizeState(await getState());
    return {
        labClock: state.labClock,
        labDay: state.labDay,
        mode: state.mode,
        updatedAt: state.updatedAt,
        lastSource: state.lastSource,
        controls: state.labControls,
        currentExperiment: {
            id: state.currentExperiment?.id,
            title: state.currentExperiment?.title,
            evidenceLevel: state.currentExperiment?.evidenceLevel,
            batchId: state.currentExperiment?.batchResult?.batchId,
        },
        dailyDiscovery: state.dailyDiscovery,
        weeklyReview: state.weeklyReview,
        memoryCount: state.memories?.length || 0,
        batchCount: state.batchResults?.length || 0,
    };
}

module.exports = {
    getState,
    advanceLabState,
    resetState,
    runDailyDiscovery,
    runWeeklyReview,
    updateLabControls,
    getLabAdminState,
    retrieveMemories,
};
