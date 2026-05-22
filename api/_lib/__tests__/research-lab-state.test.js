const {
    resetState,
    advanceLabState,
    runDailyDiscovery,
    runWeeklyReview,
    updateLabControls,
    retrieveMemories,
} = require('../research-lab-state');

describe('research lab generative agent state', () => {
    beforeEach(async () => {
        await resetState();
    });

    test('initializes agents with scratch identity, affordances, and a plan', async () => {
        const state = await resetState();

        expect(state.version).toBe(3);
        expect(state.labObjects).toHaveLength(4);
        expect(state.currentExperiment.plan).toEqual(
            expect.objectContaining({
                generatedBy: state.currentExperiment.leadAgentId,
                steps: expect.arrayContaining([
                    expect.objectContaining({ level: 1 }),
                    expect.objectContaining({ level: 4 }),
                ]),
            })
        );
        expect(state.agents[0].scratch).toEqual(
            expect.objectContaining({
                specialty: expect.any(String),
                directive: expect.any(String),
            })
        );
    });

    test('advanceLabState writes action and observation memories with batch telemetry', async () => {
        const state = await advanceLabState('unit-test');
        const types = state.memories.slice(0, 3).map(memory => memory.type);

        expect(types).toEqual(expect.arrayContaining(['action', 'observation']));
        expect(state.currentExperiment.batchResult).toEqual(
            expect.objectContaining({
                batchId: expect.stringMatching(/^B-/),
                metrics: expect.objectContaining({
                    dissolutionSeconds: expect.any(Number),
                    gritScore: expect.any(Number),
                    doseUniformity: expect.any(Number),
                }),
            })
        );
        expect(state.labObjects.find(object => object.id === 'analysis-console-01')).toEqual(
            expect.objectContaining({
                status: 'reporting',
                lastReportedMetrics: expect.any(Object),
            })
        );
    });

    test('retrieves memories using relevance, importance, and recency score', async () => {
        const state = await advanceLabState('unit-test');
        const retrieved = retrieveMemories(
            state.memories,
            'coffee grit dose integrity',
            state.labClock,
            null,
            2
        );

        expect(retrieved).toHaveLength(2);
        expect(retrieved[0]).toEqual(
            expect.objectContaining({
                retrievalScore: expect.any(Number),
                summary: expect.any(String),
            })
        );
    });

    test('daily discovery runs multiple autonomous ticks and records a digest', async () => {
        const state = await runDailyDiscovery('unit-test-daily');

        expect(state.labClock).toBe(3);
        expect(state.dailyDiscovery).toEqual(
            expect.objectContaining({
                status: expect.stringMatching(/fallback|model-backed/),
                tickCount: 3,
                topInsight: expect.any(String),
                nextPhysicalTest: expect.objectContaining({
                    title: expect.any(String),
                    successCriteria: expect.any(String),
                }),
                experiments: expect.arrayContaining([
                    expect.objectContaining({
                        batchId: expect.stringMatching(/^B-/),
                        evidenceLevel: expect.any(String),
                    }),
                ]),
            })
        );
        expect(state.memories[0]).toEqual(
            expect.objectContaining({
                type: 'reflection',
                evidenceLevel: 'Internal AI synthesis',
            })
        );
    });

    test('weekly review records development readiness guidance', async () => {
        await runDailyDiscovery('unit-test-daily');
        const state = await runWeeklyReview('unit-test-weekly');

        expect(state.weeklyReview).toEqual(
            expect.objectContaining({
                status: expect.stringMatching(/fallback|model-backed/),
                developmentRecommendation: expect.stringMatching(/continue|pause|pivot|kill/),
                readinessScore: expect.any(Number),
                requiredRealWorldTests: expect.arrayContaining([
                    expect.objectContaining({
                        title: expect.any(String),
                        passCriteria: expect.any(String),
                    }),
                ]),
                sergioDecisionNeeded: expect.any(String),
            })
        );
        expect(state.memories[0]).toEqual(
            expect.objectContaining({
                type: 'reflection',
                evidenceLevel: 'Internal development review',
            })
        );
    });

    test('lab controls can disable scheduled cycles while manual force still runs', async () => {
        let state = await updateLabControls({
            dailyEnabled: false,
            weeklyEnabled: false,
            modelSynthesisEnabled: false,
            weeklyModel: 'gpt-5.5',
        });

        expect(state.labControls).toEqual(
            expect.objectContaining({
                dailyEnabled: false,
                weeklyEnabled: false,
                modelSynthesisEnabled: false,
                weeklyModel: 'gpt-5.5',
            })
        );

        state = await runDailyDiscovery('unit-test-disabled');
        expect(state.dailyDiscovery.status).toBe('disabled');

        state = await runWeeklyReview('unit-test-disabled');
        expect(state.weeklyReview.status).toBe('disabled');

        state = await runWeeklyReview('unit-test-manual', { force: true });
        expect(state.weeklyReview.status).toMatch(/fallback|model-backed/);
    });
});
