# 11 Nov 2026, Held arrival support lines and under 18 notice (items 4 and 15, held PR)

Changed on top of `main` at `5b08a5e`. Each raise is under 1 KB, within the 5 KB per-screen allowance in HOW-WE-WORK section 6:

| Screen                                  | Old   | New   | Raise |
| --------------------------------------- | ----- | ----- | ----- |
| Referrals `/ward-flow/referrals`        | 583.6 | 584.3 | 0.7   |
| ED `/ward-flow/ed`                      | 535.4 | 536.0 | 0.6   |
| Ward `/ward-flow/ward/rph-adult-secure` | 613.8 | 614.7 | 0.9   |
| Movement `/ward-flow/movements/WF-001`  | 609.8 | 610.9 | 1.1   |
| Bed meeting `/ward-flow/bed-meeting`    | 592.2 | 593.3 | 1.1   |

Measured on a local production build before merging `main`: referrals 583.7, ED 534.5, ward 613.5, movement 609.0, bed meeting 591.1, and each limit was then the measurement plus about 0.4. After merging `main` at `5b08a5e`, each limit is main's new limit plus the same raise, so it sits 0.6 to 2.2 KB above those older measurements. Hosted CI's build after the merge is the measurement that counts.

Hosted CI's build after the merge (e0e6112) measured home 575.6, referrals 583.8, ED 535.2, ward 614.0, movement 609.7, capacity 654.5, ED desk 667.0, bed meeting 592.1 and statistics 632.6. Home and capacity were 0.2 KB over main's limits, so four more limits are main's limit plus a small raise, each the CI measurement plus about 0.6 for the review fixes that followed:

| Screen                             | Main  | New   | Raise |
| ---------------------------------- | ----- | ----- | ----- |
| Home `/ward-flow`                  | 575.4 | 576.2 | 0.8   |
| Capacity `/ward-flow/capacity`     | 654.3 | 655.1 | 0.8   |
| ED desk `/ward-flow/ed/arm-ed`     | 667.4 | 667.6 | 0.2   |
| Statistics `/ward-flow/statistics` | 632.6 | 633.2 | 0.6   |

Hosted CI's build after merging `main` at `b393351` (9b9ded4 plus main) measured home 576.1, referrals 584.3, capacity 655.0 and statistics 633.1. Referrals hit its limit, and the other three sat 0.1 KB under theirs, so each is now the CI measurement plus about 0.5. Total raises on main's limits stay under 2 KB per screen:

| Screen                             | Main  | New   | Raise |
| ---------------------------------- | ----- | ----- | ----- |
| Home `/ward-flow`                  | 575.4 | 576.6 | 1.2   |
| Referrals `/ward-flow/referrals`   | 583.6 | 584.8 | 1.2   |
| Capacity `/ward-flow/capacity`     | 654.3 | 655.5 | 1.2   |
| Statistics `/ward-flow/statistics` | 632.6 | 633.6 | 1.0   |

After merging `main` at `35c7ccd`, which raised five of these screens by 0.3 to 0.4 KB, each limit is main's new limit plus this PR's same total raise (0.2 to 1.2 KB). No raise grew.

Why it changed: item 4 adds the `RECORD_CHIEF_PSYCHIATRIST_NOTIFIED` event, its storage check and history words to the shared engine, and item 15 adds the interpreter, Aboriginal liaison and advocate lines to the arrival checklist.

Trim tried: the new event lives in its own small file and the notice renders only inside the bed drawer. No other safe trim was found.
