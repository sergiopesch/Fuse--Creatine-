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
                const shift =
                    active.scientistId === scientist.id ? 4 : (state.localTick + index) % 5;
                const x = Math.max(
                    7,
                    Math.min(
                        93,
                        Number(scientist.x || 50) + Math.sin(state.localTick + index) * shift
                    )
                );
                const y = Math.max(
                    9,
                    Math.min(
                        91,
                        Number(scientist.y || 50) + Math.cos(state.localTick + index) * shift
                    )
                );
                return `
                    <span
                        class="world-agent ${spriteClass(scientist.id)}"
                        data-name="${escapeHtml(scientist.name)}"
                        style="--agent-color: ${escapeHtml(scientist.color)}; --agent-x: ${x}; --agent-y: ${y}; --depth-scale: ${0.78 + y / 210}; animation-delay: -${index * 0.55}s"
                    >
                        <span class="agent-route"></span>
                        <span class="agent-shadow"></span>
                        <span class="agent-sprite" aria-hidden="true"></span>
                        <span class="agent-pin">${escapeHtml(initials(scientist.name))}</span>
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

    function renderSelectedScientist() {
        const scientist =
            getScientist(state.selectedScientistId) || (state.data.scientists || [])[0];
        if (!scientist) {
            els.selectedScientist.innerHTML = '<p>No scientist selected.</p>';
            return;
        }
        els.selectedStation.textContent = scientist.station;
        els.selectedScientist.innerHTML = `
            <div class="selected-visual" style="--agent-color: ${escapeHtml(scientist.color)}">
                <span class="selected-avatar selected-sprite ${spriteClass(scientist.id)}" aria-hidden="true"></span>
            </div>
            <h2>${escapeHtml(scientist.name)}</h2>
            <p><strong>${escapeHtml(scientist.role)}</strong></p>
            <p>${escapeHtml(scientist.personality)}</p>
            <p>${escapeHtml(scientist.speciality)}</p>
            <div class="selected-tags">
                <span>${escapeHtml(scientist.station)}</span>
                <span>Evidence gated</span>
                <span>24/7 agent loop</span>
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
