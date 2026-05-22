(function () {
    'use strict';

    const API_URL = '/api/research-lab';
    const TICK_INTERVAL_MS = 8500;

    const metricLabels = {
        dissolve: 'Dissolve',
        taste: 'Taste',
        mouthfeel: 'Texture',
        dose: 'Dose',
        heat: 'Heat',
        make: 'Make',
        claims: 'Claims',
    };

    const metricColors = {
        dissolve: '#44d7b6',
        taste: '#f5b56b',
        mouthfeel: '#ffb1c5',
        dose: '#ff3b30',
        heat: '#d7ed69',
        make: '#b890ff',
        claims: '#8fb8ff',
    };

    const bootstrapStations = [
        { id: 'central-rail', name: 'Central Sample Rail', color: '#d7ed69', x: 39, y: 38, w: 24, h: 22 },
        { id: 'encapsulation', name: 'Encapsulation Bench', color: '#ff3b30', x: 10, y: 7, w: 24, h: 20 },
        { id: 'coffee', name: 'Coffee Matrix Bar', color: '#c58b59', x: 42, y: 6, w: 23, h: 22 },
        { id: 'claims', name: 'Claims Gate', color: '#8fb8ff', x: 75, y: 42, w: 20, h: 18 },
        { id: 'evidence', name: 'Evidence Desk', color: '#44d7b6', x: 6, y: 36, w: 24, h: 23 },
        { id: 'sensory', name: 'Sensory Booth', color: '#f5b56b', x: 76, y: 6, w: 20, h: 22 },
        { id: 'pilot', name: 'Pilot Mixer', color: '#b890ff', x: 43, y: 64, w: 28, h: 22 },
    ];

    const bootstrapAgents = [
        ['mira', 'Dr. Mira Solvay', 'Encapsulation Scientist', 'encapsulation', '#ff3b30', 24, 17],
        ['theo', 'Dr. Theo Roast', 'Coffee Matrix Chemist', 'coffee', '#c58b59', 51, 17],
        ['ava', 'Dr. Ava Palate', 'Sensory Scientist', 'sensory', '#f5b56b', 86, 17],
        ['max', 'Dr. Max Flux', 'Creatine Evidence Lead', 'evidence', '#44d7b6', 18, 48],
        ['nina', 'Dr. Nina Claims', 'Regulatory Scientist', 'claims', '#8fb8ff', 85, 52],
        ['jules', 'Jules Batch', 'Manufacturing Engineer', 'pilot', '#b890ff', 57, 75],
        ['pipette', 'Pipette', 'Lab Assistant Agent', 'central-rail', '#d7ed69', 51, 50],
    ];

    const defaultCharacterProfile = {
        skin: '#c99b78',
        hair: '#171a1c',
        coat: '#f4f1e9',
        sleeve: '#ece8dd',
        trousers: '#15191d',
        shoes: '#101214',
        accent: null,
        glasses: '#d6f5ff',
        hairStyle: 'cap',
        accessory: 'none',
        detail: 'badge',
    };

    const characterProfiles = {
        mira: {
            asset: 'assets/lab/characters/mira-solvay.svg',
            skin: '#b8795d',
            hair: '#191416',
            coat: '#f7f2e9',
            sleeve: '#efe8db',
            trousers: '#252b31',
            shoes: '#101214',
            accent: '#ff3b30',
            glasses: '#bcefff',
            hairStyle: 'bob',
            accessory: 'goggles-vial',
            detail: 'capsule',
        },
        theo: {
            asset: 'assets/lab/characters/theo-roast.svg',
            accent: '#c58b59',
        },
        ava: {
            asset: 'assets/lab/characters/ava-palate.svg',
            accent: '#f5b56b',
        },
        max: {
            asset: 'assets/lab/characters/max-flux.svg',
            accent: '#44d7b6',
        },
        nina: {
            asset: 'assets/lab/characters/nina-claims.svg',
            accent: '#8fb8ff',
        },
        jules: {
            asset: 'assets/lab/characters/jules-batch.svg',
            accent: '#b890ff',
        },
        pipette: {
            asset: 'assets/lab/characters/pipette.svg',
            accent: '#d7ed69',
        },
    };

    const state = {
        data: null,
        selectedAgentId: 'mira',
        isRunning: true,
        timer: null,
        isBusy: false,
    };

    const els = {};

    function $(id) {
        return document.getElementById(id);
    }

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value === null || value === undefined ? '' : String(value);
        return div.innerHTML;
    }

    function safeToken(value, fallback) {
        const token = String(value || '');
        return /^[a-z0-9-]+$/i.test(token) ? token : fallback;
    }

    function safeHex(value, fallback) {
        const color = String(value || '');
        return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color) ? color : fallback;
    }

    function safeCharacterAsset(value) {
        const asset = String(value || '');
        return /^assets\/lab\/characters\/[a-z0-9-]+\.svg$/i.test(asset) ? asset : '';
    }

    function resolveCharacterProfile(agent) {
        const custom = characterProfiles[agent.id] || {};
        const profile = {
            ...defaultCharacterProfile,
            ...custom,
            ...(agent.character || {}),
        };
        profile.accent = profile.accent || agent.color || defaultCharacterProfile.accent;
        return profile;
    }

    function characterStyle(profile) {
        return [
            ['--char-skin', safeHex(profile.skin, defaultCharacterProfile.skin)],
            ['--char-hair', safeHex(profile.hair, defaultCharacterProfile.hair)],
            ['--char-coat', safeHex(profile.coat, defaultCharacterProfile.coat)],
            ['--char-sleeve', safeHex(profile.sleeve, defaultCharacterProfile.sleeve)],
            ['--char-trousers', safeHex(profile.trousers, defaultCharacterProfile.trousers)],
            ['--char-shoes', safeHex(profile.shoes, defaultCharacterProfile.shoes)],
            ['--char-accent', safeHex(profile.accent, '#ff3b30')],
            ['--char-glasses', safeHex(profile.glasses, defaultCharacterProfile.glasses)],
        ]
            .map(([name, value]) => `${name}: ${value}`)
            .join('; ');
    }

    function labCharacterMarkup(agent, variant = 'world') {
        const safeName = escapeHtml(agent.name);
        const profile = resolveCharacterProfile(agent);
        const hairStyle = safeToken(profile.hairStyle, defaultCharacterProfile.hairStyle);
        const accessory = safeToken(profile.accessory, defaultCharacterProfile.accessory);
        const detail = safeToken(profile.detail, defaultCharacterProfile.detail);
        const asset = safeCharacterAsset(profile.asset);
        if (asset) {
            return `
                <span class="lab-character lab-character-${variant} lab-character-sprite" style="${characterStyle(profile)}" aria-label="${safeName}">
                    <span class="lab-character-shadow"></span>
                    <img class="lab-character-image" src="${asset}" alt="" decoding="async" draggable="false" />
                </span>
            `;
        }
        return `
            <span class="lab-character lab-character-${variant} character-hair-${hairStyle} character-accessory-${accessory} character-detail-${detail}" style="${characterStyle(profile)}" aria-label="${safeName}">
                <span class="lab-character-shadow"></span>
                <span class="lab-character-head"></span>
                <span class="lab-character-hair"></span>
                <span class="lab-character-face"></span>
                <span class="lab-character-glasses"></span>
                <span class="lab-character-body">
                    <span class="lab-character-lapel"></span>
                    <span class="lab-character-badge"></span>
                </span>
                <span class="lab-character-arm left"></span>
                <span class="lab-character-arm right"></span>
                <span class="lab-character-leg left"></span>
                <span class="lab-character-leg right"></span>
                <span class="lab-character-tool"></span>
            </span>
        `;
    }

    function formatClock(value) {
        return `Tick ${String(value || 0).padStart(3, '0')}`;
    }

    function formatTime(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '--:--';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, Number(value) || 0));
    }

    function stableSeed(value) {
        return String(value)
            .split('')
            .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    }

    function motionFor(agentId, labClock = 0) {
        const seed = stableSeed(agentId);
        const walkDuration = 920 + (seed % 9) * 170;
        const stepDuration = 620 + (seed % 6) * 120;
        return {
            walkDuration,
            stepDuration,
            travelDuration: 1800 + (seed % 8) * 260,
            delay: -((seed * 41 + labClock * 97) % walkDuration),
            stepDelay: -((seed * 67 + labClock * 53) % stepDuration),
        };
    }

    function createBootstrapState() {
        const timestamp = new Date().toISOString();
        const currentExperiment = {
            title: 'Hot coffee disappearance run',
            stationId: 'coffee',
            leadAgentId: 'theo',
            supportAgentId: 'mira',
            hypothesisId: 'FUSE-POR-01',
            evidenceLevel: 'Simulation',
            progress: 38,
        };
        const agents = bootstrapAgents.map(([id, name, role, stationId, color, x, y]) => ({
            id,
            name,
            role,
            stationId,
            color,
            x,
            y,
            targetStationId: stationId,
            intent: id === 'theo' || id === 'mira' ? currentExperiment.title : 'Working independently at station.',
            reflection: `${name} is operating inside the FUSE research world.`,
            motion: motionFor(id),
            needs: { focus: 70, evidence: 64, social: 48, caution: 58 },
        }));

        return {
            version: 2,
            mode: 'living research world',
            labClock: 0,
            labDay: 47,
            mission:
                'Find a manufacturable way to make creatine monohydrate dissolve quickly in hot coffee while keeping the coffee experience clean, dose-accurate, and evidence-gated.',
            guardrail:
                'Agent findings are internal hypotheses until wet-lab and legal review upgrade the evidence level.',
            stations: bootstrapStations,
            labObjects: [],
            agents,
            hypotheses: [
                {
                    id: 'FUSE-POR-01',
                    name: 'Porous Monohydrate Agglomerate',
                    summary: 'Fast wetting route under active review.',
                    evidenceLevel: 'Simulation',
                    scores: { dissolve: 72, taste: 75, mouthfeel: 68, dose: 91, heat: 86, make: 76, claims: 84 },
                },
            ],
            currentExperiment,
            conversations: [
                {
                    id: 'bootstrap-conversation',
                    timestamp,
                    from: 'theo',
                    to: 'mira',
                    hypothesisId: 'FUSE-POR-01',
                    topic: currentExperiment.title,
                    lines: [
                        { speakerId: 'theo', text: 'Checking coffee clarity against the latest cup run.' },
                        { speakerId: 'mira', text: 'I am tuning the carrier so wetting improves without grit.' },
                    ],
                },
            ],
            memories: [],
            reflections: [],
            batchResults: [],
            disputes: [
                {
                    id: 'bootstrap-dispute',
                    timestamp,
                    title: 'Does faster wetting disturb crema before the powder disappears?',
                    hypothesisId: 'FUSE-POR-01',
                    status: 'open',
                },
            ],
            experimentQueue: [],
            dailyDiscovery: {
                status: 'waiting',
                headline: 'Daily autonomous discovery has not run yet.',
                provider: 'deterministic',
                topInsight: 'Waiting for the first daily AI synthesis.',
            },
            weeklyReview: {
                status: 'waiting',
                headline: 'Weekly GPT-5.5 development review has not run yet.',
            },
        };
    }

    function getAgent(agentId) {
        return (state.data?.agents || []).find(agent => agent.id === agentId);
    }

    function getStation(stationId) {
        return (state.data?.stations || []).find(station => station.id === stationId);
    }

    function getHypothesis(hypothesisId) {
        return (state.data?.hypotheses || []).find(hypothesis => hypothesis.id === hypothesisId);
    }

    function scoreAverage(scores) {
        const values = Object.values(scores || {});
        if (!values.length) return 0;
        return Math.round(
            values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length
        );
    }

    function setBusy(isBusy) {
        state.isBusy = isBusy;
        ['advanceWorld', 'resetWorld'].forEach(id => {
            if (els[id]) els[id].disabled = isBusy;
        });
    }

    async function requestState(action = 'state', body = null) {
        const options = body
            ? {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action, ...body }),
              }
            : { method: 'GET' };

        const url = body ? API_URL : `${API_URL}?action=${encodeURIComponent(action)}`;
        const response = await fetch(url, options);
        const payload = await response.json();
        if (!response.ok || !payload.success) {
            throw new Error(payload.error || 'Research lab world request failed');
        }
        state.data = payload.data;
        if (!getAgent(state.selectedAgentId)) {
            state.selectedAgentId = state.data.agents?.[0]?.id || 'mira';
        }
        render();
        return payload.data;
    }

    async function advanceWorld() {
        if (state.isBusy) return;
        setBusy(true);
        try {
            await requestState('tick', { action: 'tick' });
        } catch (error) {
            showError(error);
        } finally {
            setBusy(false);
        }
    }

    async function resetWorld() {
        if (state.isBusy) return;
        setBusy(true);
        try {
            await requestState('reset', { action: 'reset' });
        } catch (error) {
            showError(error);
        } finally {
            setBusy(false);
        }
    }

    function showError(error) {
        console.error('[ResearchWorld]', error);
        els.worldMode.textContent = 'World paused: API error';
        document.body.classList.add('world-error');
    }

    function startTimer() {
        stopTimer();
        if (!state.isRunning) return;
        state.timer = window.setInterval(() => {
            advanceWorld();
        }, TICK_INTERVAL_MS);
    }

    function stopTimer() {
        if (state.timer) {
            window.clearInterval(state.timer);
            state.timer = null;
        }
    }

    function toggleWorld() {
        state.isRunning = !state.isRunning;
        els.toggleWorld.textContent = state.isRunning ? 'Pause' : 'Resume';
        els.worldMode.textContent = state.isRunning
            ? state.data?.mode || 'World running'
            : 'Paused';
        startTimer();
    }

    function renderStations() {
        els.stationGrid.innerHTML = (state.data.stations || [])
            .map(station => {
                const active = station.id === state.data.currentExperiment?.stationId;
                return `
                    <article
                        class="station-room${active ? ' is-active' : ''}"
                        style="--x: ${station.x}; --y: ${station.y}; --w: ${station.w}; --h: ${station.h}; --station-color: ${escapeHtml(station.color)}"
                    >
                        <strong>${escapeHtml(station.name)}</strong>
                        <small>${escapeHtml(station.purpose)}</small>
                    </article>
                `;
            })
            .join('');
    }

    function renderAgents() {
        const activeConversation = state.data.conversations?.[0];
        const speakingIds = new Set();
        if (activeConversation) {
            speakingIds.add(activeConversation.from);
            speakingIds.add(activeConversation.to);
        }

        els.agentCount.textContent = String(state.data.agents.length);
        els.agentRoster.innerHTML = state.data.agents
            .map(agent => {
                const selected = agent.id === state.selectedAgentId;
                return `
                    <button
                        class="agent-card${selected ? ' is-selected' : ''}"
                        type="button"
                        data-agent="${escapeHtml(agent.id)}"
                        style="--agent-color: ${escapeHtml(agent.color)}"
                    >
                        <span class="agent-avatar">${labCharacterMarkup(agent, 'portrait')}</span>
                        <span>
                            <strong>${escapeHtml(agent.name)}</strong>
                            <span>${escapeHtml(agent.role)}</span>
                            <em class="agent-intent">${escapeHtml(agent.intent)}</em>
                        </span>
                    </button>
                `;
            })
            .join('');

        els.agentRoster.querySelectorAll('[data-agent]').forEach(button => {
            button.addEventListener('click', () => {
                state.selectedAgentId = button.getAttribute('data-agent');
                render();
            });
        });

        const renderedAgents = state.data.agents
            .map(agent => {
                const target = getStation(agent.targetStationId) || getStation(agent.stationId);
                const x = clamp(agent.x, 4, 96);
                const y = clamp(agent.y, 4, 96);
                const pathX = target ? target.x + target.w / 2 - x : 0;
                const pathY = target ? target.y + target.h / 2 - y : 0;
                const pathLength = clamp(Math.hypot(pathX, pathY) * 7.2, 46, 240);
                const pathAngle = Math.atan2(pathY, pathX);
                const line = activeConversation?.lines?.find(item => item.speakerId === agent.id);
                const isSpeaking = speakingIds.has(agent.id) && line;
                const active = state.data.currentExperiment?.leadAgentId === agent.id;
                const seed = stableSeed(agent.id);
                const motion = agent.motion || {};
                const fallbackMotion = motionFor(agent.id, state.data.labClock);
                const walkDuration = clamp(motion.walkDuration || fallbackMotion.walkDuration, 700, 2600);
                const stepDuration = clamp(motion.stepDuration || fallbackMotion.stepDuration, 520, 1500);
                const travelDuration = clamp(
                    motion.travelDuration || fallbackMotion.travelDuration,
                    1400,
                    4200
                );
                const walkDelay = clamp(motion.delay || -(seed * 37), -1600, 0);
                const stepDelay = clamp(motion.stepDelay || -(seed * 53), -1200, 0);
                const facing = pathX < -1 ? -1 : 1;

                return `
                    <div
                        class="world-agent${active ? ' is-active' : ''}${isSpeaking ? ' is-speaking' : ''}"
                        style="--x: ${x}; --y: ${y}; --depth: ${Math.round(y)}; --agent-color: ${escapeHtml(agent.color)}; --path-length: ${pathLength}px; --path-angle: ${pathAngle}rad; --walk-duration: ${walkDuration}ms; --step-duration: ${stepDuration}ms; --travel-duration: ${travelDuration}ms; --walk-delay: ${walkDelay}ms; --step-delay: ${stepDelay}ms; --facing: ${facing}"
                    >
                        <span class="world-agent-core">${labCharacterMarkup(agent, 'world')}</span>
                        <span class="agent-label">${escapeHtml(agent.name.replace(/^Dr\\.\\s+/, '').split(' ')[0])}</span>
                    </div>
                `;
            })
            .join('');

        els.agentLayer.innerHTML = `${renderInteractionLink(activeConversation)}${renderedAgents}`;
    }

    function renderInteractionLink(conversation) {
        if (!conversation) return '';
        const from = getAgent(conversation.from);
        const to = getAgent(conversation.to);
        if (!from || !to) return '';

        const x1 = clamp(from.x, 4, 96);
        const y1 = clamp(from.y, 4, 96);
        const x2 = clamp(to.x, 4, 96);
        const y2 = clamp(to.y, 4, 96);
        const mx = (x1 + x2) / 2;
        const my = Math.max(9, Math.min(86, (y1 + y2) / 2 - 5));
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = clamp(Math.hypot(dx, dy), 6, 42);
        const angle = Math.atan2(dy, dx);
        const fromName = from.name.replace(/^Dr\.\s+/, '').split(' ')[0];
        const toName = to.name.replace(/^Dr\.\s+/, '').split(' ')[0];

        return `
            <div
                class="interaction-link"
                style="--x1: ${x1}; --y1: ${y1}; --mx: ${mx}; --my: ${my}; --distance: ${distance}; --link-angle: ${angle}rad; --agent-color: ${escapeHtml(from.color)}"
                aria-label="${escapeHtml(from.name)} talking with ${escapeHtml(to.name)}"
            >
                <span class="interaction-line"></span>
                <span class="interaction-chip">${escapeHtml(fromName)} &lt;-&gt; ${escapeHtml(toName)}</span>
            </div>
        `;
    }

    function renderHypotheses() {
        const hypotheses = [...(state.data.hypotheses || [])].sort(
            (a, b) => scoreAverage(b.scores) - scoreAverage(a.scores)
        );
        const leading = hypotheses[0];
        els.leadScore.textContent = leading ? `${scoreAverage(leading.scores)}/100` : '--';

        els.hypothesisList.innerHTML = hypotheses
            .map((hypothesis, index) => {
                const rows = Object.entries(metricLabels)
                    .map(([key, label]) => {
                        const value = clamp(hypothesis.scores[key], 0, 100);
                        return `
                            <div class="score-row">
                                <span>${escapeHtml(label)}</span>
                                <span class="score-track"><i style="--score: ${value}%; --score-color: ${metricColors[key]}"></i></span>
                                <span>${value}</span>
                            </div>
                        `;
                    })
                    .join('');
                return `
                    <article class="hypothesis-card${index === 0 ? ' is-leading' : ''}">
                        <div class="hypothesis-meta">
                            <span>${escapeHtml(hypothesis.id)}</span>
                            <span>${escapeHtml(hypothesis.evidenceLevel)}</span>
                        </div>
                        <strong>${escapeHtml(hypothesis.name)}</strong>
                        <p>${escapeHtml(hypothesis.summary)}</p>
                        <div class="score-grid">${rows}</div>
                    </article>
                `;
            })
            .join('');
    }

    function renderSelectedAgent() {
        const agent = getAgent(state.selectedAgentId) || state.data.agents[0];
        const station = getStation(agent?.stationId);
        if (!agent) return;

        els.selectedAgentName.textContent = agent.name;
        els.selectedAgentStation.textContent = station?.name || '--';

        const needs = Object.entries(agent.needs || {})
            .map(([label, value]) => {
                const safeValue = clamp(value, 0, 100);
                return `
                    <div class="need-row">
                        <span>${escapeHtml(label)}</span>
                        <span class="need-track"><i style="--need: ${safeValue}%"></i></span>
                        <strong>${safeValue}</strong>
                    </div>
                `;
            })
            .join('');
        const planSteps = (agent.activePlan?.steps || [])
            .map(step => {
                return `
                    <li>
                        <span>L${escapeHtml(step.level)}</span>
                        <strong>${escapeHtml(step.status)}</strong>
                        <p>${escapeHtml(step.label)}</p>
                    </li>
                `;
            })
            .join('');
        const retrieved = (agent.retrievedMemories || [])
            .map(memory => {
                return `
                    <li>
                        <span>${escapeHtml(memory.type || 'memory')} ${escapeHtml(memory.retrievalScore || 0)}</span>
                        <p>${escapeHtml(memory.summary)}</p>
                    </li>
                `;
            })
            .join('');
        const scratch = agent.scratch || {};

        els.selectedAgentDetail.innerHTML = `
            <article class="selected-detail" style="--agent-color: ${escapeHtml(agent.color)}">
                <strong>${escapeHtml(agent.role)}</strong>
                <p>${escapeHtml(agent.intent)}</p>
                <p>${escapeHtml(agent.reflection)}</p>
                <div class="agent-scratch">
                    <span>${escapeHtml(scratch.specialty || 'Research specialty')}</span>
                    <p>${escapeHtml(scratch.directive || 'Working from current lab objective.')}</p>
                </div>
                <div class="need-grid">${needs}</div>
                <div class="cognition-block">
                    <span>Retrieved memories</span>
                    <ul>${retrieved || '<li><p>No relevant memories retrieved yet.</p></li>'}</ul>
                </div>
                <div class="cognition-block">
                    <span>Current plan</span>
                    <ul>${planSteps || '<li><p>No active plan assigned.</p></li>'}</ul>
                </div>
            </article>
        `;
    }

    function renderConversations() {
        const conversations = state.data.conversations || [];
        els.conversationCount.textContent = String(conversations.length);
        els.conversationFeed.innerHTML = conversations.length
            ? conversations
                  .slice(0, 5)
                  .map(conversation => {
                      const from = getAgent(conversation.from);
                      const to = getAgent(conversation.to);
                      const hypothesis = getHypothesis(conversation.hypothesisId);
                      const lines = (conversation.lines || [])
                          .map(line => {
                              const speaker = getAgent(line.speakerId);
                              return `<p><strong>${escapeHtml(speaker?.name || 'Agent')}</strong> ${escapeHtml(line.text)}</p>`;
                          })
                          .join('');
                      return `
                        <article class="conversation-item">
                            <div class="conversation-meta">
                                <span>${escapeHtml(formatTime(conversation.timestamp))}</span>
                                <span>${escapeHtml(from?.name || conversation.from)} -> ${escapeHtml(to?.name || conversation.to)}</span>
                                <span>${escapeHtml(hypothesis?.id || 'LAB')}</span>
                            </div>
                            <div class="conversation-lines">${lines}</div>
                        </article>
                    `;
                  })
                  .join('')
            : '<p class="is-empty">No active conversations yet.</p>';
    }

    function renderMemories() {
        const memories = state.data.memories || [];
        els.memoryCount.textContent = String(memories.length);
        els.memoryFeed.innerHTML = memories.length
            ? memories
                  .slice(0, 8)
                  .map(memory => {
                      const agent = getAgent(memory.agentId);
                      return `
                        <article class="memory-item">
                            <div class="memory-meta">
                                <span>${escapeHtml(formatTime(memory.timestamp))}</span>
                                <span>${escapeHtml(memory.type || 'memory')}</span>
                                <span>${escapeHtml(memory.evidenceLevel)}</span>
                                <span>importance ${escapeHtml(memory.importance)}</span>
                            </div>
                            <strong>${escapeHtml(agent?.name || 'Lab memory')}</strong>
                            <p>${escapeHtml(memory.summary)}</p>
                        </article>
                    `;
                  })
                  .join('')
            : '<p class="is-empty">The world is waiting for its first memory.</p>';
    }

    function renderQueue() {
        const queue = state.data.experimentQueue || [];
        els.queueCount.textContent = String(queue.length);
        els.experimentQueue.innerHTML = queue.length
            ? queue
                  .slice(0, 7)
                  .map(item => {
                      return `
                        <article class="queue-item">
                            <div>
                                <strong>${escapeHtml(item.title)}</strong>
                                <p>${escapeHtml(item.reason)}</p>
                            </div>
                            <em>${escapeHtml(item.priority || item.owner)}</em>
                        </article>
                    `;
                  })
                  .join('')
            : '<p class="is-empty">No queued experiments.</p>';
    }

    function renderDailyDiscovery() {
        const discovery = state.data.dailyDiscovery || {};
        els.dailyProvider.textContent = discovery.model || discovery.provider || 'Deterministic';

        const findings = (discovery.agentFindings || [])
            .slice(0, 4)
            .map(item => {
                const agent = getAgent(item.agentId);
                return `
                    <li>
                        <span>${escapeHtml(agent?.name || item.agentId)} · ${escapeHtml(item.confidence || 'watch')}</span>
                        <p>${escapeHtml(item.finding)}</p>
                    </li>
                `;
            })
            .join('');
        const nextTest = discovery.nextPhysicalTest;

        els.dailyDiscoveryDetail.innerHTML = `
            <article class="daily-discovery-card">
                <strong>${escapeHtml(discovery.headline || 'Daily discovery has not run yet.')}</strong>
                <p>${escapeHtml(discovery.topInsight || 'The lab is waiting for the next daily synthesis run.')}</p>
                ${
                    nextTest
                        ? `<div class="daily-test">
                            <span>Next physical test</span>
                            <strong>${escapeHtml(nextTest.title)}</strong>
                            <p>${escapeHtml(nextTest.successCriteria)}</p>
                        </div>`
                        : ''
                }
                <ul>${findings || '<li><p>No model-backed findings recorded yet.</p></li>'}</ul>
            </article>
        `;
    }

    function renderWeeklyReview() {
        const review = state.data.weeklyReview || {};
        els.weeklyProvider.textContent = review.model || review.provider || 'Waiting';

        const tests = (review.requiredRealWorldTests || [])
            .slice(0, 3)
            .map(test => {
                return `
                    <li>
                        <span>${escapeHtml(test.title)}</span>
                        <p>${escapeHtml(test.passCriteria)}</p>
                    </li>
                `;
            })
            .join('');

        els.weeklyReviewDetail.innerHTML = `
            <article class="weekly-review-card">
                <div class="weekly-score">
                    <span>${escapeHtml(review.developmentRecommendation || 'waiting')}</span>
                    <strong>${escapeHtml(review.readinessScore ?? '--')}</strong>
                </div>
                <strong>${escapeHtml(review.headline || 'Weekly development review has not run yet.')}</strong>
                <p>${escapeHtml(review.rationale || 'The lab is waiting for its first weekly GPT-5.5 readiness review.')}</p>
                <div class="weekly-decision">
                    <span>Sergio decision</span>
                    <p>${escapeHtml(review.sergioDecisionNeeded || 'No decision queued yet.')}</p>
                </div>
                <ul>${tests || '<li><p>No required physical tests recorded yet.</p></li>'}</ul>
            </article>
        `;
    }

    function renderTopline() {
        const current = state.data.currentExperiment || {};
        const station = getStation(current.stationId);
        const hypothesis = getHypothesis(current.hypothesisId);
        const dispute = state.data.disputes?.[0];

        els.worldMode.textContent = state.isRunning ? state.data.mode : 'Paused';
        els.labDay.textContent = `Day ${escapeHtml(state.data.labDay || 47)}`;
        els.labClock.textContent = formatClock(state.data.labClock);
        els.missionText.textContent = state.data.mission;
        els.activeExperiment.textContent = current.title || 'Loading';
        els.evidenceGate.textContent = current.evidenceLevel || 'Hypothesis';
        els.dailyRun.textContent = state.data.dailyDiscovery?.lastRunDate || 'Waiting';
        els.weeklyRun.textContent = state.data.weeklyReview?.lastRunDate || 'Waiting';
        els.activeDispute.textContent = dispute ? dispute.title : 'None';
        els.guardrailText.textContent = state.data.guardrail;
        els.experimentProgress.style.setProperty(
            '--progress',
            `${clamp(current.progress, 0, 100)}%`
        );

        if (station && hypothesis) {
            els.activeExperiment.textContent = `${current.title} at ${station.name} for ${hypothesis.id}`;
        }
    }

    function render() {
        if (!state.data) return;
        renderTopline();
        renderStations();
        renderAgents();
        renderHypotheses();
        renderSelectedAgent();
        renderConversations();
        renderMemories();
        renderQueue();
        renderDailyDiscovery();
        renderWeeklyReview();
    }

    function cacheElements() {
        [
            'worldMode',
            'missionText',
            'advanceWorld',
            'toggleWorld',
            'resetWorld',
            'labDay',
            'labClock',
            'dailyRun',
            'agentCount',
            'agentRoster',
            'activeExperiment',
            'evidenceGate',
            'activeDispute',
            'stationGrid',
            'agentLayer',
            'experimentProgress',
            'guardrailText',
            'leadScore',
            'hypothesisList',
            'selectedAgentName',
            'selectedAgentStation',
            'selectedAgentDetail',
            'conversationCount',
            'conversationFeed',
            'memoryCount',
            'memoryFeed',
            'queueCount',
            'experimentQueue',
            'dailyProvider',
            'dailyDiscoveryDetail',
            'weeklyRun',
            'weeklyProvider',
            'weeklyReviewDetail',
        ].forEach(id => {
            els[id] = $(id);
        });
    }

    function bindEvents() {
        els.advanceWorld.addEventListener('click', advanceWorld);
        els.toggleWorld.addEventListener('click', toggleWorld);
        els.resetWorld.addEventListener('click', resetWorld);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopTimer();
            } else {
                startTimer();
            }
        });
    }

    async function init() {
        cacheElements();
        bindEvents();
        state.data = createBootstrapState();
        render();
        startTimer();
        try {
            await requestState('state');
        } catch (error) {
            showError(error);
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
