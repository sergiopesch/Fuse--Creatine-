# Testing Protocols

> Systematic procedures for validating FUSE formulations. Document everything.

## Testing Hierarchy

1. **Bench Tests** — Quick, in-house validation
2. **Lab Tests** — Third-party verification
3. **User Tests** — Real-world feedback
4. **Scale Tests** — Manufacturing validation

---

## Bench Test Protocols

### BT-001: Dissolution Time Test

**Purpose:** Measure time for complete visual dissolution in hot coffee

**Equipment:**
- Clear glass mug (transparent for observation)
- Digital thermometer
- Digital timer (phone works)
- Tripod + camera for video documentation
- Measuring spoon (5g calibrated)
- Fresh coffee (standardised: medium roast, drip method)

**Procedure:**
1. Brew 200ml coffee, measure temperature (target: 85°C ± 2°C)
2. Position camera for overhead view
3. Start timer visible in frame
4. Add 5g test powder to center of liquid
5. Do NOT stir
6. Record until no visible particles remain
7. Stop timer, note final time
8. Document any residue, clumping, or surface behavior

**Success Criteria:**
- Full dissolution: <3 seconds
- No visible clumps: Pass/Fail
- No stirring required: Pass/Fail
- Surface behavior: Document (foam, film, etc.)

**Variations:**
- Test at 75°C, 85°C, 95°C (temperature range)
- Test in espresso vs drip vs French press
- Test with/without milk

---

### BT-002: Taste Neutrality Test (Blind Panel)

**Purpose:** Verify FUSE doesn't alter coffee taste

**Equipment:**
- 10+ taste testers (regular coffee drinkers)
- Identical cups (opaque, labelled A/B)
- Fresh coffee (same batch split)
- FUSE sample
- Score sheets
- Blindfolds or screen

**Procedure:**
1. Prepare two identical coffees from same pot
2. Add FUSE to Cup A, nothing to Cup B
3. Randomise presentation order per tester
4. Tester tastes both, rates: taste difference (1-10), texture (1-10), preference (A/B/same)
5. Ask: "Can you identify which has creatine?"
6. Record all responses
7. Reveal and document reactions

**Success Criteria:**
- <20% correct identification rate (random chance)
- Average taste difference score: <3/10
- No texture complaints

**Analysis:**
- Calculate identification rate
- Note any patterns in feedback
- Document specific complaints if any

---

### BT-003: Heat Stability Spot Test

**Purpose:** Quick check for visible degradation in heat

**Equipment:**
- Clear glass beaker
- Hot plate
- Thermometer
- Timer
- Test samples (encapsulated vs raw creatine)

**Procedure:**
1. Heat 100ml water to 90°C
2. Add 5g test sample
3. Maintain temperature for 10 minutes
4. Observe every 2 minutes: colour change, precipitation, smell
5. Cool to room temperature
6. Compare visual appearance to control (room temp dissolution)

**Success Criteria:**
- No colour change: Pass
- No precipitation: Pass
- No off-smell: Pass

**Note:** This is visual only. Lab testing (HPLC) required for actual degradation measurement.

---

### BT-004: Repeatability Test

**Purpose:** Ensure consistent dissolution across multiple tests

**Equipment:**
- Same as BT-001
- 10 identical sample packets

**Procedure:**
1. Run BT-001 protocol 10 consecutive times
2. Use fresh coffee for each test
3. Record all times

**Success Criteria:**
- Mean dissolution time: <3 seconds
- Standard deviation: <0.5 seconds
- No outliers >4 seconds

---

## Lab Test Protocols

### LT-001: Creatine Recovery Analysis (HPLC)

**Purpose:** Quantify creatine vs creatinine after heat exposure

**Lab Partner:** [To be identified - UK accredited]

**Sample Preparation:**
1. Control: Raw creatine in room temp water
2. Test A: Raw creatine in 85°C water, held 10 min
3. Test B: Encapsulated creatine in 85°C water, held 10 min
4. Test C: FUSE in actual coffee, held 10 min

**Analysis Request:**
- Creatine monohydrate concentration (mg/ml)
- Creatinine concentration (mg/ml)
- Calculate recovery percentage

**Target Results:**
- >95% creatine recovery in all test conditions

**Timeline:** 2-3 weeks for results

---

### LT-002: Certificate of Analysis (CoA)

**Purpose:** Third-party verification of raw material quality

**Required For:**
- Each new batch of creatine monohydrate
- Encapsulation materials
- Final FUSE product

**Standard Tests:**
- Identity confirmation
- Purity (>99.9% creatine)
- Heavy metals (<10ppm total)
- Microbial limits
- Moisture content

---

## User Test Protocols

### UT-001: In-Home Trial

**Purpose:** Real-world usage feedback

**Participants:** 10-20 beta testers

**Duration:** 2 weeks

**Protocol:**
1. Ship 14-day supply of FUSE samples
2. Provide daily log (paper or digital)
3. Questions: dissolution time, taste impact, ease of use, would recommend
4. Exit survey with NPS question
5. Optional: video diary of first use

**Success Criteria:**
- Average satisfaction: >8/10
- NPS: >50
- "Would recommend": >80%

---

### UT-002: Café Environment Test

**Purpose:** Test in real coffee shop conditions

**Locations:** 3-5 different cafes/styles

**Protocol:**
1. Order coffee (various types)
2. Add FUSE discreetly
3. Document: coffee type, temp, dissolution behavior
4. Rate experience
5. Photo/video document

**Variables:**
- Espresso-based drinks
- Filter coffee
- Different milk types
- Hot vs iced

---

## Documentation Standards

### Required for Every Test
- Date and time
- Tester name/ID
- Exact materials used (batch numbers)
- Environmental conditions (temp, humidity)
- Step-by-step execution notes
- Raw data
- Photos/video when possible
- Pass/Fail assessment
- Notes and observations

### File Naming Convention
```
[Test-ID]_[Date]_[Batch]_[Tester].md

Example: BT-001_20260127_B001_SP.md
```

### Storage
- All raw data in `/research/testing/data/`
- All videos in cloud backup (Google Drive or similar)
- Summary results in batch-notes.md

---

## Testing Schedule

### Phase 1: Bench Testing (Jan-Feb 2026)
- [ ] BT-001: Dissolution baseline
- [ ] BT-002: Taste panel (5 people minimum)
- [ ] BT-003: Heat stability visual
- [ ] BT-004: Repeatability (10 tests)

### Phase 2: Lab Testing (Feb-Mar 2026)
- [ ] LT-001: HPLC analysis
- [ ] LT-002: CoA for raw materials

### Phase 3: User Testing (Mar 2026)
- [ ] UT-001: In-home trial
- [ ] UT-002: Café environment

### Phase 4: Scale Testing (Pre-Launch)
- [ ] Manufacturing line trials
- [ ] Packaging stability
- [ ] Shelf-life acceleration

---

*Status: Protocols Defined, Execution Pending*
*Owner: Research Agent + Product Agent*
*Last updated: 2026-01-26*
