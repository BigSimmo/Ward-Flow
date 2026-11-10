# Aboriginal cultural safety review: preparation pack

_Created 2026-11-10 - audit item M122 (sources: the Cultural Safety Charter, D-6); drafted on branch `claude/project-thread-bnphlk` (from `main` `29352cd0`); Documentation owns._

**Status:** preparation pack only. **The review has not been held** and cannot be held by this
team: it needs Aboriginal mental health staff and community consultation, as the
[Cultural Safety Charter](ABORIGINAL-CULTURAL-SAFETY-CHARTER.md) requires. D-6 defers it while
Ward Flow holds invented data; it stays a condition before real use. This pack does not re-ask
Josh about timing (D-6, R16). It gets the material ready for when he brings it back.

**Done when:** a dated review record (section 5) is filed, and a D entry settles the charter
wording in section 3.

## 1. Who the charter names

From [charter section 4](ABORIGINAL-CULTURAL-SAFETY-CHARTER.md#4-formal-elder--community-consultation-gate):
Derbarl Yerrigan Health Service; WACHS Aboriginal Health Strategy Directorate; Aboriginal Health
Council of Western Australia; an independent Aboriginal lived experience advisory panel. Add the
pilot site's Aboriginal mental health staff and Aboriginal mental health liaison officers.
Engaging outside reviewers may involve payment for their time; that is Josh's call and a spending
approval.

## 2. What to show them

All with synthetic data. Prepare a short walk-through on the built app:

| Topic                                       | Where it is today                                                                                                                 | Question for the review                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Aboriginal or Torres Strait Islander status | Stored on the record, **not displayed** (H-24)                                                                                    | Should it show, where, to whom, and with what wording?                                       |
| Cultural support requested                  | `culturalSupportRequested` on the record: "Aboriginal liaison officer" or "Other cultural support" (`ward-patient-care-plans.ts`) | Is the choice right? Who is notified, and is a "notified" record needed (charter section 3)? |
| AMHW or liaison officer prompt              | Only the request above was found in source; no separate "notified" prompt at intake or transport                                  | Is a prompt needed at intake, referral or transport?                                         |
| Interpreter and language                    | `interpreterLanguage`, `interpreterRequired`, record only                                                                         | Are Aboriginal languages and Kriol handled well?                                             |
| Distance from home and country              | Road time shown as "Distance only, not suitability" (D-71 item 6); catchment on the record                                        | See section 3                                                                                |
| Synthetic patients                          | Charter section 2; seed guard tests                                                                                               | Are the invented Aboriginal patients free of stereotypes?                                    |
| Retention for Aboriginal patients           | Indefinite for some (PIRDS 1.1.2, [retention plan](../RETENTION-AND-BACKUP.md#retention-plan))                                    | Any concern about long retention?                                                            |
| Legal status and involuntary transport      | Shown as typed, never calculated (D-93)                                                                                           | Any wording that feels unsafe?                                                               |

## 3. The charter wording to reconcile

The charter (section 3) says coordination logic "must prioritise keeping the person as close to
country and family support networks as clinically safe". D-71 says no ward is suggested, ranked,
capped or pre-selected, and candidate wards use a fixed order, not catchment.

These conflict if "prioritise" means the app ranks wards. Options for the review and Josh:

| Option | What it means                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| A      | **Recorded fact.** The record shows the person's home community or country and that it matters to them. People weigh it. No ranking. |
| B      | **Filter.** A coordinator can choose to see only wards within a distance of home. The list order stays fixed (D-71).                 |
| C      | Ranking by distance from country. **Conflicts with D-71 and the never-build rule**; listed only to rule it out.                      |

**Drafter's recommendation: A, with B if the review asks for it.** Either keeps D-71. The charter
wording then changes from "coordination logic must prioritise" to "the record shows, and people
weigh". That wording change needs Josh's ruling as a D entry.

## 4. Before the review

1. Josh brings the review back (D-6) and names a convenor.
2. Book the reviewers; agree payment if any (spending approval).
3. Walk the cultural support request and the AMHW prompt gap in section 2 on the built app.
4. Send this pack and a walk-through recording on synthetic data, with no real names.

## 5. Review record

| Item                                  | Detail |
| ------------------------------------- | ------ |
| Date and place                        |        |
| Convenor (role)                       |        |
| Organisations and roles present       |        |
| What was shown                        |        |
| Findings                              |        |
| Charter wording outcome (A, B, other) |        |
| D entry                               |        |
| Changes to make before real data      |        |
