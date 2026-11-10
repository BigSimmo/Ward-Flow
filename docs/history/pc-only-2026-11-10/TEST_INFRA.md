# TEST_INFRA.md: Ward Flow E2E Test Suite Infrastructure

## 1. Overview & Architecture

The Ward Flow Confirmed Issues Swarm E2E Test Suite provides an opaque-box, requirement-driven end-to-end verification harness across all 16 features identified and resolved in the November 2026 audit.

The test infrastructure is designed under four core design pillars:

1. **Opaque-Box Requirement Derivation**: Tests assert against documented behavioral contracts in `PROJECT.md`, `ORIGINAL_REQUEST.md`, and clinical governance rulings (D-5, D-72, aeromedical dual-bed holding), rather than private implementation details.
2. **Progressive & Independent Execution**: Every test file is completely isolated and self-contained. State mutations are performed on freshly instantiated reducer states via deterministic pure functions, with no shared disk state or cross-test contamination.
3. **100% Synthetic Data & Australian Clinical Integrity**: Strict compliance with WA health service terminology (ED, UMRN, Consultant, Registrar, NUM, PLN) and zero live EHR or real patient data.
4. **4-Tier Stratified Verification**:
   - **Tier 1 (Feature Coverage)**: >= 5 distinct happy-path tests for each of Features 1–16 (80+ tests total).
   - **Tier 2 (Boundary & Corner Cases)**: >= 5 edge, boundary, and stress tests for each feature (80+ tests total).
   - **Tier 3 (Cross-Feature Combinations)**: Pairwise and multi-feature interaction tests (aeromedical transit + clearance gate + restrictive practice refusals, downtime packs under active surge alert, etc.).
   - **Tier 4 (Real-World Scenarios)**: 5 comprehensive clinical journeys simulating realistic Western Australian psychiatric bed management workflows.

---

## 2. Test Execution & Runner

### Test Runner Command

The E2E suite executes using the repository's Vitest runner:

```bash
# Run all E2E swarm test suites
node scripts/run-vitest.mjs run tests/e2e-swarm/

# Run a specific tier
node scripts/run-vitest.mjs run tests/e2e-swarm/tier1-features/
node scripts/run-vitest.mjs run tests/e2e-swarm/tier2-boundaries/
node scripts/run-vitest.mjs run tests/e2e-swarm/tier3-combinations/
node scripts/run-vitest.mjs run tests/e2e-swarm/tier4-scenarios/

# Run with verbose reporting
node scripts/run-vitest.mjs run tests/e2e-swarm/ --reporter=verbose
```

### Environment Integration

- All tests adhere to the `NODE_UNIT_TEST_GLOBS` pattern (`tests/**/*.test.ts`) defined in `scripts/unit-test-population.mjs`.
- Tests run under the `node` Vitest project environment with the custom reducer slice setup (`tests/setup/reducer-slices.setup.ts`).
- Timeouts: 30,000ms per test file to prevent false failures under heavy CPU loads.

---

## 3. Directory Layout

The E2E test suite lives exclusively in `tests/e2e-swarm/`:

```
tests/e2e-swarm/
├── helpers/
│   └── test-harness.ts                         # Isolated synthetic factories & state builders
├── tier1-features/
│   ├── feature-01-lock-deadlock.test.ts        # F1: Windows PID 4 Lock Deadlock & Cleanup
│   ├── feature-02-tsconfig-glob.test.ts       # F2: tsconfig.typecheck.json Glob Exclusions
│   ├── feature-03-medical-clearance.test.ts    # F3: Medical Clearance Transfer Gate
│   ├── feature-04-expired-legal-forms.test.ts  # F4: Expired Legal Forms Handover Alert
│   ├── feature-05-legal-countdown.test.ts      # F5: 72-Hour Legal Assessment Timer Retention
│   ├── feature-06-restrictive-transport.test.ts# F6: Restrictive Practice Transport Guard
│   ├── feature-07-downtime-pack.test.ts        # F7: Downtime Pack Inpatient Census & Print CSS
│   ├── feature-08-travel-bands-rfds.test.ts    # F8: WA Travel Bands & RFDS Transit Hold
│   ├── feature-09-broadcast-alert.test.ts      # F9: Alert Stand-Down Modal & Desk Identity
│   ├── feature-10-bed-occupancy.test.ts        # F10: Bed Occupancy Decoupling & Cleaning
│   ├── feature-11-clinical-time.test.ts        # F11: 24h Time & Australian DOB Formatting
│   ├── feature-12-reducer-fallbacks.test.ts    # F12: Reducer Slice Default Clause Hardening
│   ├── feature-13-phone-bundle.test.ts         # F13: Phone Bundle Diet & Code-Splitting
│   ├── feature-14-test-tiering.test.ts         # F14: Test Suite Runtime Tiering Scripts
│   ├── feature-15-directory-cluster.test.ts    # F15: Directory Reorganisation & Stubs
│   └── feature-16-architectural-rulings.test.ts# F16: Governance Rulings (D-5, D-72, Dual-Bed)
├── tier2-boundaries/
│   ├── tier2-boundaries-f01-f04.test.ts        # Edge & boundary conditions for F1–F4
│   ├── tier2-boundaries-f05-f08.test.ts        # Edge & boundary conditions for F5–F8
│   ├── tier2-boundaries-f09-f12.test.ts        # Edge & boundary conditions for F9–F12
│   └── tier2-boundaries-f13-f16.test.ts        # Edge & boundary conditions for F13–F16
├── tier3-combinations/
│   └── tier3-cross-feature-combinations.test.ts# Pairwise cross-feature interactions
└── tier4-scenarios/
    └── tier4-real-world-scenarios.test.ts      # 5 End-to-end psychiatric ward clinical journeys
```

---

## 4. Feature Inventory Coverage Mapping

| Feature # | Feature Name                         | Primary Test File                          | Boundary File                      | Combinations | Real-World Scenario |
| :-------: | ------------------------------------ | ------------------------------------------ | ---------------------------------- | :----------: | :-----------------: |
|     1     | Lock Deadlock & PID 4 Handling       | `feature-01-lock-deadlock.test.ts`         | `tier2-boundaries-f01-f04.test.ts` |   Pairwise   |     Scenario 3      |
|     2     | tsconfig Greedy Glob Exclusion       | `feature-02-tsconfig-glob.test.ts`         | `tier2-boundaries-f01-f04.test.ts` |   Pairwise   |       Tooling       |
|     3     | Medical Clearance Transfer Gate      | `feature-03-medical-clearance.test.ts`     | `tier2-boundaries-f01-f04.test.ts` |   Pairwise   |     Scenario 1      |
|     4     | Expired Legal Forms Handover Alert   | `feature-04-expired-legal-forms.test.ts`   | `tier2-boundaries-f01-f04.test.ts` |   Pairwise   |     Scenario 4      |
|     5     | 72-Hour Legal Assessment Timer       | `feature-05-legal-countdown.test.ts`       | `tier2-boundaries-f05-f08.test.ts` |   Pairwise   |   Scenario 1 & 4    |
|     6     | Restrictive Practice Transport Guard | `feature-06-restrictive-transport.test.ts` | `tier2-boundaries-f05-f08.test.ts` |   Pairwise   |     Scenario 2      |
|     7     | Downtime Pack Census & Print CSS     | `feature-07-downtime-pack.test.ts`         | `tier2-boundaries-f05-f08.test.ts` |   Pairwise   |     Scenario 3      |
|     8     | WA Travel Bands & RFDS Hold          | `feature-08-travel-bands-rfds.test.ts`     | `tier2-boundaries-f05-f08.test.ts` |   Pairwise   |     Scenario 1      |
|     9     | Broadcast Stand-Down & Desk ID       | `feature-09-broadcast-alert.test.ts`       | `tier2-boundaries-f09-f12.test.ts` |   Pairwise   |     Scenario 5      |
|    10     | Bed Occupancy Decoupling & Cleaning  | `feature-10-bed-occupancy.test.ts`         | `tier2-boundaries-f09-f12.test.ts` |   Pairwise   |   Scenario 1 & 3    |
|    11     | 24-Hour Clinical Time & DOB          | `feature-11-clinical-time.test.ts`         | `tier2-boundaries-f09-f12.test.ts` |   Pairwise   |     Scenario 4      |
|    12     | Reducer Slice Default Fallbacks      | `feature-12-reducer-fallbacks.test.ts`     | `tier2-boundaries-f09-f12.test.ts` |   Pairwise   |   Reducer Engine    |
|    13     | Phone Bundle Diet & Code-Split       | `feature-13-phone-bundle.test.ts`          | `tier2-boundaries-f13-f16.test.ts` |   Pairwise   |      Web Shell      |
|    14     | Test Suite Runtime Tiering           | `feature-14-test-tiering.test.ts`          | `tier2-boundaries-f13-f16.test.ts` |   Pairwise   |     CI Pipeline     |
|    15     | Directory Structure Reorganisation   | `feature-15-directory-cluster.test.ts`     | `tier2-boundaries-f13-f16.test.ts` |   Pairwise   |    Architecture     |
|    16     | Architectural Rulings Enforcement    | `feature-16-architectural-rulings.test.ts` | `tier2-boundaries-f13-f16.test.ts` |   Pairwise   |    Scenario 1–5     |

---

## 5. Synthetic Fixtures & State Isolation

All tests construct state through `tests/e2e-swarm/helpers/test-harness.ts`:

- **Deterministic Time**: Fixed time anchor (`NOW_ANCHOR = 1728864000`, 14 Oct 2024 AWST).
- **Synthetic Sites**: Sir Charles Gairdner Hospital (SCGH), Royal Perth Hospital (RPH), Fiona Stanley Hospital (FSH), Hedland Health Campus.
- **Invariants**:
  - No network requests, zero Supabase / live API calls.
  - No global state mutation: each test starts with freshly allocated copies via `seedWardFlowState()`.
  - Pure event dispatching via `wardFlowReducer(state, event)`.
