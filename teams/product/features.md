# Product Features — FUSE Creatine

## Core Product: FUSE Creatine Monohydrate

### Feature: Instant Dissolution

**Description**: Micro-encapsulated creatine that dissolves in hot coffee in under 3 seconds without stirring.

**Technical Requirement**: Encapsulation method must achieve <3s dissolution at 60-85°C.

**Status**: Validated in research, pending formulation lock.

### Feature: Zero Taste Impact

**Description**: No grit, no chalky texture, no taste alteration to coffee.

**Technical Requirement**: Carrier matrix must be coffee-neutral. No detectable flavor at 3-5g serving.

**Status**: Target defined, pending prototype testing.

### Feature: Heat Stability

**Description**: Creatine remains bioavailable after exposure to hot coffee temperatures.

**Technical Requirement**: <5% degradation to creatinine at 60-85°C within 15 minutes.

**Status**: Validated by research (see `research/science/creatine-stability.md`).

### Feature: Precise Dosing

**Description**: Single-serve sachets with exactly 3g or 5g creatine monohydrate.

**Technical Requirement**: Manufacturing precision ±5%.

**Status**: Specification defined.

## Website Features

### Feature: Waitlist Signup

**Description**: Email capture with modal signup flow.

**Status**: ✅ Live

### Feature: CEO Dashboard

**Description**: Executive overview of all 9 teams, task queue, and metrics.

**Status**: ✅ Live, being enhanced with queue integration.

### Feature: Research Lab World

**Description**: Living scientist-agent lab for formulation hypotheses, social research interactions, evidence gates, and experiment queues.

**Status**: ✅ Live. Legacy standalone Agent Command Center page retired.

### Feature: Daily Formulation Discovery Board

**Description**: One daily synthesis call ranks the current formulation route and updates a four-card board for dissolution speed, taste neutrality, manufacturing path, and Legal/IP safety.

**Technical Requirement**: Daily output must remain internal, evidence-gated, and tied to next physical test, scorecard movement, and Sergio decision needed.

**Status**: ✅ Live in Research Lab World.

### Feature: Progress-Governed Daily Lab Loop

**Description**: The lab advances every day through deterministic ticks, then assesses progress signs before deciding whether to spend a model-backed synthesis call.

**Technical Requirement**: Progress signs include route score movement, new batch telemetry, blocked evidence gates, Sergio decision signals, and next-test clarity. If signals stay below threshold, the lab records progress without model spend.

**Status**: ✅ Live in Research Lab World.

### Feature: Discovery Replay Simulation

**Description**: Research Lab World replays the latest internal finding as station beacons and scientist-agent beats so Sergio can see how the route moved through formulation, coffee, sensory, evidence, manufacturing, and claims review.

**Technical Requirement**: Replay must clearly label outputs as internal simulation hypotheses until wet-lab and Legal review upgrades them.

**Status**: ✅ Live in Research Lab World.
