(function () {
    'use strict';

    const API_URL = '/api/research-lab';
    const metricLabels = {
        dissolutionSpeed: 'Dissolve',
        tastePreservation: 'Taste',
        mouthfeelCleanliness: 'Tongue',
        doseIntegrity: 'Dose',
        absorptionEvidence: 'Absorb',
        heatStability: 'Heat',
        manufacturability: 'Make',
        regulatorySafety: 'Claims',
    };

    const metricColors = {
        dissolutionSpeed: '#44d7b6',
        tastePreservation: '#f5b56b',
        mouthfeelCleanliness: '#ffb1c5',
        doseIntegrity: '#ff3b30',
        absorptionEvidence: '#8fb8ff',
        heatStability: '#e2f06f',
        manufacturability: '#b890ff',
        regulatorySafety: '#ffffff',
    };

    const scientistSpriteOrder = ['mira', 'theo', 'ava', 'max', 'nina', 'jules', 'pipette'];

    const stationCoordinates = {
        'Encapsulation Bench': { x: 22, y: 47 },
        'Coffee Matrix Bar': { x: 73, y: 29 },
        'Sensory Tongue Lab': { x: 69, y: 70 },
        'Absorption Evidence Desk': { x: 39, y: 24 },
        'Claims Gate': { x: 84, y: 53 },
        'Pilot Mixer': { x: 28, y: 75 },
        'Central Sample Rail': { x: 50, y: 52 },
    };

    const fallbackState = {
        version: 1,
        labClock: 0,
        mode: 'evidence-gated simulation',
        mission:
            'Discover a coffee-compatible creatine delivery system that disperses fast, protects taste, and stays honest about absorption evidence.',
        guardrails: [
            'Simulations inform hypotheses; wet-lab validation controls claims.',
            'Taste, tongue feel, aroma, and grit are scored separately.',
            'Absorption language stays internal until direct comparative evidence exists.',
        ],
        scientists: [
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
                speciality:
                    'tongue feel, bitterness thresholds, aroma release, aftertaste, mouth coating',
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
                speciality:
                    'creatine uptake evidence, dose integrity, kinetics, bioavailability claims',
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
        ],
        formulas: [
            {
                id: 'FUSE-IF-014',
                name: 'Instant Fusion Carrier Screen',
                status: 'active',
                summary: 'Coffee-compatible dispersion system under taste and sediment testing.',
                overall: 76,
                evidenceLevel: 'Simulation result',
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
            },
        ],
        papers: [],
        activeExperiment: {
            id: 'EXP-000',
            kind: 'Lab boot sequence',
            station: 'Central Table',
            scientistId: 'mira',
            formulaId: 'FUSE-IF-014',
            evidenceGate: 'Hypothesis',
            progress: 38,
        },
        events: [
            {
                id: 'evt-local',
                timestamp: new Date().toISOString(),
                scientistId: 'mira',
                type: 'Hypothesis',
                formulaId: 'FUSE-IF-014',
                message: 'Local simulation is running while the live research API initializes.',
            },
        ],
        cognition: {
            model: 'Generative research society',
            loop: ['perceive', 'retrieve', 'plan', 'reflect', 'execute'],
            router: 'Plan-Execute lab router with read-only ask and controlled intervention modes',
        },
        agentStates: [],
        socialGraph: [],
        memoryStream: [],
        replayFrames: [],
    };

    const state = {
        data: fallbackState,
        selectedScientistId: 'ava',
        localTick: 0,
        isFetchingPapers: false,
    };

    const els = {};

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(value);
        return div.innerHTML;
    }

    function initials(name) {
        return String(name || 'A')
            .split(/\s+/)
            .filter(Boolean)
            .slice(-2)
            .map(part => part.charAt(0))
            .join('')
            .toUpperCase();
    }

    function formatTime(value) {
        if (!value) return '--';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '--';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function formulaAverage(scores) {
        const values = Object.values(scores || {});
        if (!values.length) return 0;
        return Math.round(
            values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length
        );
    }

    function getScientist(id) {
        return (state.data.scientists || []).find(scientist => scientist.id === id);
    }

    function getAgentState(id) {
        return (
            (state.data.agentStates || []).find(agentState => agentState.id === id) ||
            buildClientAgentState(getScientist(id), 0)
        );
    }

    function spriteClass(scientistId) {
        const index = scientistSpriteOrder.indexOf(scientistId);
        return `sprite-${index >= 0 ? index : 0}`;
    }

    function getFormula(id) {
        return (state.data.formulas || []).find(formula => formula.id === id);
    }

    function eventColor(type) {
        if (type === 'Evidence-backed') return '#44d7b6';
        if (type === 'Regulatory control') return '#8fb8ff';
        if (type === 'Needs sensory panel') return '#f5b56b';
        if (type === 'Needs wet-lab validation') return '#e2f06f';
        return '#ff3b30';
    }

    function shortName(scientistId) {
        const scientist = getScientist(scientistId);
        if (!scientist) return scientistId || 'Lab';
        return scientist.name.replace(/^Dr\.\s+/, '').split(' ')[0];
    }

    function buildClientAgentState(scientist, index) {
        if (!scientist) return null;
        const active = state.data.activeExperiment?.scientistId === scientist.id;
        const seed = Number(state.data.labClock || 0) + index + scientist.id.length;
        return {
            id: scientist.id,
            mood: active ? 'locked-in' : 'observing',
            currentPlan: active
                ? state.data.activeExperiment?.kind || 'Active experiment'
                : 'retrieve relevant memories',
            currentAction: active ? 'executing active experiment' : 'observing lab state',
            nextLocation: scientist.station,
            needs: {
                focus: Math.min(100, 58 + (active ? 18 : 0) + (seed % 17)),
                energy: Math.max(38, 76 - (seed % 19)),
                evidenceNeed: Math.min(100, 44 + (active ? 20 : 0) + (seed % 13)),
                collaborationNeed: 46 + (seed % 22),
            },
            reflection: `${scientist.name} is maintaining a local plan until the live state arrives.`,
        };
    }

    function effectiveAgentStates() {
        const agentStates = state.data.agentStates || [];
        if (agentStates.length) return agentStates;
        return (state.data.scientists || [])
            .map((scientist, index) => buildClientAgentState(scientist, index))
            .filter(Boolean);
    }

    function barRow(label, value) {
        const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
        return `
            <div class="need-row">
                <span>${escapeHtml(label)}</span>
                <span class="need-track"><i style="--need-value: ${safeValue}%"></i></span>
                <strong>${safeValue}</strong>
            </div>
        `;
    }

    function stationPoint(station, fallback) {
        return stationCoordinates[station] || fallback || { x: 50, y: 50 };
    }

    function agentMapPoint(scientist, agentState, index) {
        const active = state.data.activeExperiment || {};
        const destination = stationPoint(
            agentState?.nextLocation || scientist.station,
            stationPoint(scientist.station)
        );
        const home = stationPoint(scientist.station, { x: scientist.x || 50, y: scientist.y || 50 });
        const isActive = active.scientistId === scientist.id;
        const phase = (state.localTick + index) % 6;
        const routeRatio = isActive ? 0.7 : 0.18 + phase * 0.05;
        const x = Math.max(
            7,
            Math.min(93, home.x + (destination.x - home.x) * routeRatio + Math.sin(phase) * 1.4)
        );
        const y = Math.max(
            9,
            Math.min(91, home.y + (destination.y - home.y) * routeRatio + Math.cos(phase) * 1.2)
        );
        return { x, y, home, destination };
    }

    function renderScientists() {
        const scientists = state.data.scientists || [];
        els.agentCount.textContent = String(scientists.length);
        els.scientistList.innerHTML = scientists
            .map(scientist => {
                const selected = scientist.id === state.selectedScientistId ? ' is-selected' : '';
                return `
                    <button class="scientist-card${selected}" type="button" data-scientist="${escapeHtml(scientist.id)}" style="--agent-color: ${escapeHtml(scientist.color)}">
                        <span class="scientist-avatar scientist-portrait ${spriteClass(scientist.id)}" aria-hidden="true"></span>
                        <span>
                            <strong>${escapeHtml(scientist.name)}</strong>
                            <span>${escapeHtml(scientist.role)} at ${escapeHtml(scientist.station)}</span>
                        </span>
                    </button>
                `;
            })
            .join('');

        els.scientistList.querySelectorAll('[data-scientist]').forEach(button => {
            button.addEventListener('click', () => {
                state.selectedScientistId = button.getAttribute('data-scientist');
                render();
            });
        });
    }

    function renderWorldAgents() {
        const active = state.data.activeExperiment || {};
        els.agentStage.innerHTML = (state.data.scientists || [])
            .map((scientist, index) => {
                const agentState = getAgentState(scientist.id) || {};
                const point = agentMapPoint(scientist, agentState, index);
                const x = point.x;
                const y = point.y;
                const isActive = active.scientistId === scientist.id;
                const plan = agentState.currentPlan || active.kind || 'observing';
                return `
                    <span
                        class="world-agent sandbox-agent ${spriteClass(scientist.id)}${isActive ? ' is-active' : ''}"
                        data-name="${escapeHtml(scientist.name)}"
                        style="--agent-color: ${escapeHtml(scientist.color)}; --agent-x: ${x}; --agent-y: ${y}; --home-x: ${point.home.x}; --home-y: ${point.home.y}; --dest-x: ${point.destination.x}; --dest-y: ${point.destination.y}; --depth-scale: ${0.78 + y / 210}; animation-delay: -${index * 0.55}s"
                    >
                        <span class="agent-route"></span>
                        <span class="agent-shadow"></span>
                        <span class="agent-sprite" aria-hidden="true"></span>
                        <span class="agent-pin">${escapeHtml(initials(scientist.name))}</span>
                        <span class="agent-nameplate">${escapeHtml(shortName(scientist.id))}</span>
                        <span class="agent-thought">${escapeHtml(plan)}</span>
                    </span>
                `;
            })
            .join('');

        document.querySelectorAll('.station').forEach(station => {
            station.classList.toggle(
                'is-active',
                station.getAttribute('data-station') === active.station
            );
        });
        document.querySelectorAll('.map-room').forEach(room => {
            room.classList.toggle(
                'is-active',
                room.getAttribute('data-station') === active.station
            );
        });
    }

    function renderFormulas() {
        const formulas = (state.data.formulas || [])
            .map(formula => ({
                ...formula,
                overall: formula.overall || formulaAverage(formula.scores),
            }))
            .sort((a, b) => b.overall - a.overall);

        els.bestScore.textContent = formulas[0] ? `${formulas[0].overall}/100` : '--';
        els.formulaList.innerHTML = formulas
            .map(formula => {
                const metricRows = Object.entries(metricLabels)
                    .map(([key, label]) => {
                        const value = Math.max(
                            0,
                            Math.min(100, Number(formula.scores?.[key] || 0))
                        );
                        return `
                            <div class="metric-row">
                                <span>${escapeHtml(label)}</span>
                                <span class="metric-track"><i style="--metric-value: ${value}%; --metric-color: ${metricColors[key]}"></i></span>
                                <span>${value}</span>
                            </div>
                        `;
                    })
                    .join('');

                return `
                    <article class="formula-card">
                        <div class="formula-topline">
                            <div>
                                <strong>${escapeHtml(formula.name)}</strong>
                                <span>${escapeHtml(formula.id)} - ${escapeHtml(formula.evidenceLevel)}</span>
                            </div>
                            <div class="formula-score">${formula.overall}</div>
                        </div>
                        <span>${escapeHtml(formula.summary)}</span>
                        <div class="formula-bars">${metricRows}</div>
                    </article>
                `;
            })
            .join('');
    }

    function renderEvents() {
        const events = state.data.events || [];
        els.eventList.innerHTML = events
            .slice(0, 18)
            .map(event => {
                const scientist = getScientist(event.scientistId);
                const formula = getFormula(event.formulaId);
                return `
                    <article class="event-item">
                        <span class="event-dot" style="--event-color: ${eventColor(event.type)}"></span>
                        <div>
                            <div class="event-meta">
                                <span>${escapeHtml(formatTime(event.timestamp))}</span>
                                <span>${escapeHtml(event.type)}</span>
                                <span>${escapeHtml(formula?.id || event.formulaId || 'LAB')}</span>
                            </div>
                            <strong>${escapeHtml(scientist?.name || 'FUSE Lab')}</strong>
                            <span>${escapeHtml(event.message)}</span>
                        </div>
                    </article>
                `;
            })
            .join('');
    }

    function renderPapers() {
        const papers = state.data.papers || [];
        if (!papers.length) {
            els.paperList.innerHTML = `
                <article class="paper-item">
                    <strong>Research queue ready</strong>
                    <span>Fetch papers to pull Crossref metadata into the evidence queue. Every record still needs review before it can support a claim.</span>
                </article>
            `;
            return;
        }

        els.paperList.innerHTML = papers
            .slice(0, 8)
            .map(paper => {
                const link = paper.url
                    ? `<a href="${escapeHtml(paper.url)}" target="_blank" rel="noopener noreferrer">Open record</a>`
                    : '';
                return `
                    <article class="paper-item">
                        <strong>${escapeHtml(paper.title)}</strong>
                        <span>${escapeHtml(paper.source)}${paper.year ? ` - ${escapeHtml(paper.year)}` : ''} - ${escapeHtml(paper.evidenceLevel || 'Needs review')}</span>
                        ${link}
                    </article>
                `;
            })
            .join('');
    }

    function renderSocietyLayer() {
        if (!els.memoryStreamList) return;
        const cognition = state.data.cognition || fallbackState.cognition || {};
        const loop = cognition.loop || ['perceive', 'retrieve', 'plan', 'reflect', 'execute'];
        const agentStates = effectiveAgentStates();
        const memories = state.data.memoryStream || [];
        const socialGraph = state.data.socialGraph || [];
        const replayFrames = state.data.replayFrames || [];

        els.routerSummary.textContent = cognition.router ? 'Router online' : 'Plan-Execute';
        els.cognitionLoop.innerHTML = loop
            .map(step => `<span>${escapeHtml(step)}</span>`)
            .join('');

        els.planList.innerHTML = agentStates.length
            ? agentStates
                  .slice(0, 5)
                  .map(agentState => {
                      const scientist = getScientist(agentState.id);
                      return `
                        <article class="plan-item" style="--agent-color: ${escapeHtml(scientist?.color || '#44d7b6')}">
                            <strong>${escapeHtml(shortName(agentState.id))}</strong>
                            <span>${escapeHtml(agentState.currentPlan || 'Observing lab')}</span>
                            <small>${escapeHtml(agentState.mood || 'observing')}</small>
                        </article>
                    `;
                  })
                  .join('')
            : '<article class="plan-item"><strong>Boot</strong><span>Waiting for agent plans.</span></article>';

        els.memoryStreamList.innerHTML = memories.length
            ? memories
                  .slice(0, 5)
                  .map(memory => `
                    <article class="memory-item">
                        <strong>${escapeHtml(shortName(memory.scientistId))} - ${escapeHtml(memory.type || 'event')}</strong>
                        <span>${escapeHtml(memory.summary || 'Memory captured.')}</span>
                        <small>Importance ${escapeHtml(memory.importance || '--')} / Poignancy ${escapeHtml(memory.poignancy || '--')}</small>
                    </article>
                `)
                  .join('')
            : '<article class="memory-item"><strong>Memory stream ready</strong><span>Lab events will be retained here.</span></article>';

        els.socialGraphList.innerHTML = socialGraph.length
            ? socialGraph
                  .slice(0, 4)
                  .map(edge => `
                    <article class="social-edge">
                        <strong>${escapeHtml(shortName(edge.from))} -> ${escapeHtml(shortName(edge.to))}</strong>
                        <span>${escapeHtml(edge.topic || 'shared context')}</span>
                        <small>Trust ${escapeHtml(edge.trust || '--')}</small>
                    </article>
                `)
                  .join('')
            : '<article class="social-edge"><strong>Social space ready</strong><span>No active collaboration edge yet.</span></article>';

        els.replayList.innerHTML = replayFrames.length
            ? replayFrames
                  .slice(0, 4)
                  .map(frame => `
                    <article class="replay-frame">
                        <strong>Tick ${String(frame.tick || 0).padStart(3, '0')}</strong>
                        <span>${escapeHtml(frame.action || frame.mode || 'Replay captured')}</span>
                        <small>${escapeHtml(shortName(frame.scientistId))} @ ${escapeHtml(frame.station || 'Lab')}</small>
                    </article>
                `)
                  .join('')
            : '<article class="replay-frame"><strong>Replay ready</strong><span>Frames are captured after each tick.</span></article>';
    }

    function renderSelectedScientist() {
        const scientist =
            getScientist(state.selectedScientistId) || (state.data.scientists || [])[0];
        if (!scientist) {
            els.selectedScientist.innerHTML = '<p>No scientist selected.</p>';
            return;
        }
        const agentState = getAgentState(scientist.id) || {};
        const needs = agentState.needs || {};
        const memories = (state.data.memoryStream || [])
            .filter(memory => memory.scientistId === scientist.id)
            .slice(0, 2);
        els.selectedStation.textContent = scientist.station;
        els.selectedScientist.innerHTML = `
            <div class="selected-visual" style="--agent-color: ${escapeHtml(scientist.color)}">
                <span class="selected-avatar selected-sprite ${spriteClass(scientist.id)}" aria-hidden="true"></span>
            </div>
            <h2>${escapeHtml(scientist.name)}</h2>
            <p><strong>${escapeHtml(scientist.role)}</strong></p>
            <p>${escapeHtml(scientist.personality)}</p>
            <p>${escapeHtml(scientist.speciality)}</p>
            <div class="agent-cognition">
                <strong>${escapeHtml(agentState.currentPlan || 'Observing lab')}</strong>
                <span>${escapeHtml(agentState.reflection || 'No reflection captured yet.')}</span>
                <div class="need-grid">
                    ${barRow('Focus', needs.focus)}
                    ${barRow('Energy', needs.energy)}
                    ${barRow('Evidence', needs.evidenceNeed)}
                    ${barRow('Social', needs.collaborationNeed)}
                </div>
            </div>
            <div class="selected-memory">
                ${memories
                    .map(memory => `<span>${escapeHtml(memory.summary || 'Memory captured.')}</span>`)
                    .join('')}
            </div>
            <div class="selected-tags">
                <span>${escapeHtml(scientist.station)}</span>
                <span>${escapeHtml(agentState.mood || 'Evidence gated')}</span>
                <span>Memory stream</span>
            </div>
        `;
    }

    function renderExperiment() {
        const active = state.data.activeExperiment || {};
        const progress = Math.max(0, Math.min(100, Number(active.progress || 0)));
        els.labMode.textContent = state.data.mode || 'Evidence-gated simulation';
        els.labClock.textContent = `Tick ${String(state.data.labClock || 0).padStart(3, '0')}`;
        els.activeExperiment.textContent = active.kind || 'Lab idle';
        els.evidenceGate.textContent = active.evidenceGate || 'Hypothesis';
        els.experimentProgress.style.width = `${progress}%`;
        els.missionText.textContent = state.data.mission || fallbackState.mission;
        els.guardrailText.textContent =
            (state.data.guardrails || fallbackState.guardrails)[
                (state.data.labClock || 0) %
                    (state.data.guardrails || fallbackState.guardrails).length
            ] || fallbackState.guardrails[0];
        els.lastUpdated.textContent = formatTime(state.data.updatedAt || new Date().toISOString());
    }

    function render() {
        renderExperiment();
        renderScientists();
        renderWorldAgents();
        renderFormulas();
        renderEvents();
        renderPapers();
        renderSocietyLayer();
        renderSelectedScientist();
    }

    function localAdvance() {
        const data =
            typeof structuredClone === 'function'
                ? structuredClone(state.data)
                : JSON.parse(JSON.stringify(state.data));
        const scientists = data.scientists || [];
        const formulas = data.formulas || [];
        const scientist = scientists[(state.localTick + 2) % scientists.length] || scientists[0];
        const formula = formulas[(state.localTick + 1) % formulas.length] || formulas[0];
        const metricKeys = Object.keys(metricLabels);
        const metric = metricKeys[state.localTick % metricKeys.length];
        const score = Number(formula?.scores?.[metric] || 60);

        if (formula?.scores) {
            formula.scores[metric] = Math.max(
                34,
                Math.min(98, score + (state.localTick % 3 === 0 ? 2 : 1))
            );
            formula.overall = formulaAverage(formula.scores);
        }

        data.labClock = Number(data.labClock || 0) + 1;
        data.updatedAt = new Date().toISOString();
        data.activeExperiment = {
            id: `LOCAL-${String(data.labClock).padStart(3, '0')}`,
            kind:
                scientist?.station === 'Sensory Tongue Lab'
                    ? 'Tongue feel panel'
                    : 'Bench simulation',
            station: scientist?.station || 'Central Table',
            formulaId: formula?.id,
            scientistId: scientist?.id,
            evidenceGate:
                metric === 'absorptionEvidence' ? 'Needs wet-lab validation' : 'Simulation result',
            progress: 20 + ((state.localTick * 19) % 74),
        };
        data.events = [
            {
                id: `local-${Date.now()}`,
                timestamp: data.updatedAt,
                scientistId: scientist?.id,
                type: data.activeExperiment.evidenceGate,
                formulaId: formula?.id,
                message: `${scientist?.name || 'FUSE Lab'} advances a local visitor simulation and marks the result as non-claim evidence.`,
            },
            ...(data.events || []),
        ].slice(0, 90);
        const latestEvent = data.events[0];
        const localMemory = {
            id: `mem-${latestEvent.id}`,
            timestamp: latestEvent.timestamp,
            scientistId: latestEvent.scientistId,
            type: 'event',
            formulaId: latestEvent.formulaId,
            location: scientist?.station || 'Central Table',
            importance: 64 + (state.localTick % 5),
            poignancy: latestEvent.type === 'Needs wet-lab validation' ? 78 : 54,
            summary: latestEvent.message,
            evidence: [latestEvent.id],
        };
        data.memoryStream = [localMemory, ...(data.memoryStream || [])].slice(0, 80);
        data.agentStates = (data.scientists || []).map(agent => {
            const isActive = agent.id === scientist?.id;
            return {
                id: agent.id,
                mood: isActive ? 'locked-in' : 'observing',
                currentPlan: isActive ? data.activeExperiment.kind : 'retrieve relevant memories',
                currentAction: isActive ? 'executing local experiment' : 'observing lab state',
                nextLocation: agent.station,
                needs: {
                    focus: Math.min(100, 62 + (isActive ? 18 : 0) + ((state.localTick + agent.id.length) % 12)),
                    energy: Math.max(35, 76 - ((state.localTick + agent.id.length) % 18)),
                    evidenceNeed: Math.min(100, 44 + (isActive ? 20 : 0)),
                    collaborationNeed: 48 + ((state.localTick + agent.station.length) % 22),
                },
                reflection: isActive
                    ? `${agent.name} turns this tick into a memory before the next plan.`
                    : `${agent.name} is waiting for a relevant event to retrieve.`,
            };
        });
        data.socialGraph = [
            {
                from: scientist?.id,
                to: 'pipette',
                trust: 76 + (state.localTick % 8),
                topic: `${data.activeExperiment.kind} sample routing`,
                lastInteraction: data.updatedAt,
            },
            ...(data.socialGraph || []),
        ].slice(0, 12);
        data.replayFrames = [
            {
                tick: data.labClock,
                timestamp: data.updatedAt,
                mode: 'local-plan-execute',
                scientistId: scientist?.id,
                station: scientist?.station,
                action: data.activeExperiment.kind,
                formulaId: formula?.id,
                plan: data.activeExperiment.kind,
                outcome: latestEvent.message,
            },
            ...(data.replayFrames || []),
        ].slice(0, 48);

        state.localTick += 1;
        state.data = data;
        render();
    }

    async function loadState() {
        try {
            const response = await fetch(`${API_URL}?action=state`, {
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) throw new Error(`State fetch failed: ${response.status}`);
            const payload = await response.json();
            if (payload.success && payload.data) {
                state.data = payload.data;
                if (!getScientist(state.selectedScientistId)) {
                    state.selectedScientistId = payload.data.scientists?.[0]?.id || 'ava';
                }
                render();
            }
        } catch (error) {
            console.warn('[ResearchLab] using local fallback state:', error.message);
            render();
        }
    }

    async function fetchPapers() {
        if (state.isFetchingPapers) return;
        state.isFetchingPapers = true;
        els.fetchPapersBtn.textContent = 'Fetching...';
        els.fetchPapersBtn.disabled = true;

        const query = els.paperQuery.value.trim() || 'creatine monohydrate coffee solubility';
        try {
            const response = await fetch(
                `${API_URL}?action=papers&q=${encodeURIComponent(query)}`,
                {
                    headers: { Accept: 'application/json' },
                }
            );
            const payload = await response.json();
            if (payload.data?.state) {
                state.data = payload.data.state;
            }
            render();
        } catch (error) {
            console.warn('[ResearchLab] paper fetch failed:', error.message);
        } finally {
            state.isFetchingPapers = false;
            els.fetchPapersBtn.textContent = 'Fetch papers';
            els.fetchPapersBtn.disabled = false;
        }
    }

    function bindDom() {
        [
            'labMode',
            'missionText',
            'agentCount',
            'scientistList',
            'labClock',
            'activeExperiment',
            'localTickBtn',
            'labWorld',
            'agentStage',
            'evidenceGate',
            'experimentProgress',
            'guardrailText',
            'formulaList',
            'bestScore',
            'eventList',
            'lastUpdated',
            'fetchPapersBtn',
            'paperQuery',
            'paperList',
            'selectedStation',
            'selectedScientist',
            'routerSummary',
            'cognitionLoop',
            'planList',
            'memoryStreamList',
            'socialGraphList',
            'replayList',
        ].forEach(id => {
            els[id] = document.getElementById(id);
        });

        els.localTickBtn.addEventListener('click', localAdvance);
        els.fetchPapersBtn.addEventListener('click', fetchPapers);
        els.paperQuery.addEventListener('keydown', event => {
            if (event.key === 'Enter') fetchPapers();
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        bindDom();
        render();
        loadState();
        window.setInterval(localAdvance, 11000);
        window.setInterval(loadState, 60000);
    });
})();
