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

    function labCharacterMarkup(agent, variant = 'world') {
        const safeName = escapeHtml(agent.name);
        return `
            <span class="lab-character lab-character-${variant}" aria-label="${safeName}">
                <span class="lab-character-shadow"></span>
                <span class="lab-character-head"></span>
                <span class="lab-character-hair"></span>
                <span class="lab-character-body">
                    <span class="lab-character-lapel"></span>
                    <span class="lab-character-badge"></span>
                </span>
                <span class="lab-character-arm left"></span>
                <span class="lab-character-arm right"></span>
                <span class="lab-character-leg left"></span>
                <span class="lab-character-leg right"></span>
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

        els.agentLayer.innerHTML = state.data.agents
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
                const walkDuration = clamp(motion.walkDuration || 760 + (seed % 7) * 115, 620, 1600);
                const stepDuration = clamp(motion.stepDuration || 520 + (seed % 5) * 95, 420, 1200);
                const walkDelay = clamp(motion.delay || -(seed * 37), -1600, 0);
                const stepDelay = clamp(motion.stepDelay || -(seed * 53), -1200, 0);
                const walkAmplitude = 2.4 + (seed % 5) * 0.42;
                const facing = pathX < -1 ? -1 : 1;

                return `
                    <div
                        class="world-agent${active ? ' is-active' : ''}${isSpeaking ? ' is-speaking' : ''}"
                        style="--x: ${x}; --y: ${y}; --depth: ${Math.round(y)}; --agent-color: ${escapeHtml(agent.color)}; --path-length: ${pathLength}px; --path-angle: ${pathAngle}rad; --walk-duration: ${walkDuration}ms; --step-duration: ${stepDuration}ms; --walk-delay: ${walkDelay}ms; --step-delay: ${stepDelay}ms; --walk-bob: ${walkAmplitude}px; --facing: ${facing}"
                    >
                        <span class="world-agent-core">${labCharacterMarkup(agent, 'world')}</span>
                        <span class="agent-label">${escapeHtml(agent.name.replace(/^Dr\\.\\s+/, '').split(' ')[0])}</span>
                        ${
                            isSpeaking
                                ? `<span class="agent-bubble">${escapeHtml(line.text)}</span>`
                                : ''
                        }
                    </div>
                `;
            })
            .join('');
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

        els.selectedAgentDetail.innerHTML = `
            <article class="selected-detail" style="--agent-color: ${escapeHtml(agent.color)}">
                <strong>${escapeHtml(agent.role)}</strong>
                <p>${escapeHtml(agent.intent)}</p>
                <p>${escapeHtml(agent.reflection)}</p>
                <div class="need-grid">${needs}</div>
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
                            <em>${escapeHtml(item.owner)}</em>
                        </article>
                    `;
                  })
                  .join('')
            : '<p class="is-empty">No queued experiments.</p>';
    }

    function renderTopline() {
        const current = state.data.currentExperiment || {};
        const station = getStation(current.stationId);
        const hypothesis = getHypothesis(current.hypothesisId);
        const dispute = state.data.disputes?.[0];

        els.worldMode.textContent = state.isRunning ? state.data.mode : 'Paused';
        els.labClock.textContent = formatClock(state.data.labClock);
        els.missionText.textContent = state.data.mission;
        els.activeExperiment.textContent = current.title || 'Loading';
        els.evidenceGate.textContent = current.evidenceLevel || 'Hypothesis';
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
    }

    function cacheElements() {
        [
            'worldMode',
            'missionText',
            'advanceWorld',
            'toggleWorld',
            'resetWorld',
            'labClock',
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
        try {
            await requestState('state');
            startTimer();
        } catch (error) {
            showError(error);
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
