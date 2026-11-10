# Planted-defect sample: first dated score (M87)

_Dated 10 November 2026, audit item M87. Testing owns. Rerun quarterly._

Evidence boundary: one local run of `node scripts/ward-flow/mutation-sample.mjs --root <copy>` on branch `claude/project-thread-bnphlk` (from main 29352cd0), against a copy of the checkout so no planted defect was visible to anyone else. Each defect ran against every node unit test that imports its file directly (56 test files for `ward-eligibility.ts`, 9 for `ward-access-scope.ts`; DOM and browser tests left out). The full suite might kill more. No new tool: it uses the repository's own Vitest.

## Score: 6 of 10 planted defects caught

| Id  | File                   | Planted defect                                                      | Result       |
| --- | ---------------------- | ------------------------------------------------------------------- | ------------ |
| E1  | `ward-eligibility.ts`  | Voluntary patients need an authorised (involuntary) bed             | caught       |
| E2  | `ward-eligibility.ts`  | A bed count goes stale one minute early (`<=` to `<`)               | **survived** |
| E3  | `ward-eligibility.ts`  | A ward with 0 free beds is reported as having one (`<= 0` to `< 0`) | **survived** |
| E4  | `ward-eligibility.ts`  | Female-only and male-only wards swap                                | caught       |
| E5  | `ward-eligibility.ts`  | An undesignated ward refuses everyone                               | caught       |
| S1  | `ward-access-scope.ts` | An expired break-glass grant still opens the record for a day       | caught       |
| S2  | `ward-access-scope.ts` | Any ward-sent referral counts as this ward's own                    | **survived** |
| S3  | `ward-access-scope.ts` | Other wards' waitlists leak into a scoped movement                  | caught       |
| S4  | `ward-access-scope.ts` | A decided referral drops out at the window edge (`<=` to `<`)       | **survived** |
| S5  | `ward-access-scope.ts` | A referral with no visible destination is kept instead of hidden    | caught       |

## Surviving defects to review

Each needs a test that fails on the planted defect. None changes a clinical rule; the tests pin what the code already does.

1. **E2, stale-count boundary.** No test sets a bed count exactly `staleAfterMinutes` old.
2. **E3, zero-bed wording.** No direct importer checks the "has no free bed" sentence for a ward at exactly 0.
3. **S2, a ward's own sent referral.** The origin-ward check in the referral scope is not pinned: a ward could see another ward's sent referral as its own. Privacy-relevant; review first.
4. **S4, decided-referral window edge.** No test sits exactly on the window boundary.

## Still to do (a person or a later PR)

- ~~One agent PR reviews the four survivors above and adds a test for each (M87 part b).~~ Done 10 Nov 2026: `tests/ward-mutation-survivors.test.ts` has one test per survivor. Planting E2, E3, S2 and S4 one at a time in an isolated worktree made that file fail each time, and it passes unmutated. The full sample was not rerun, so the dated score above stands until the next quarterly run.
- Josh: approve a quarterly scheduled run (a workflow that runs this script on a hosted runner uses CI minutes). Until then a person reruns it each quarter and adds a dated file here.
- Every PR adding a tier 1 test says which planted defect it was shown to fail on (the line in `.github/pull_request_template.md`).
