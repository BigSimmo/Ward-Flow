# Dry run: "every named symbol implies its own screen" check

**TIP used (ward master line):** `a387cdbdfb3ef7cb688c7fb7359e08ea25f32b65`
(`git rev-parse codex/task-ward-flow-live-state-20260831` at time of this run)

**Document checked:** `docs/ward-flow/plans/2026-09-11-third-edition-build-master-plan-v2.md`, §6.1–§6.16
(read live from the working tree, since that document itself is current).

## The three numbers

| Claims reached (identifiers checked) | Flags raised (not in own directory) | Flags that are FALSE |
| ------------------------------------ | ----------------------------------- | -------------------- |
| **37**                               | **9**                               | **9 (100%)**         |

Zero of the nine flags the proposed check would raise are real defects. Every one fires on a
sentence that either (a) explicitly denies the symbol is built from/imported on that screen,
(b) explicitly lists the symbol under "Not built" or "must never exist," (c) explicitly frames
the symbol as a future task in a lane that hasn't started, or (d) uses the symbol only to
describe a shared/derived data relationship with another screen's module.

## Method note

Backticked tokens excluded per the brief: file paths, route paths, `--css-tokens`, test file
names, HTML/`data-*`, and plain-English words. Two borderline exclusions worth naming: `` `catchment` ``
in §6.5 (a plain word, not a distinctive identifier) and `` `gp` `` in §6.12 (two-letter string
value, not camelCase/snake_case). `` `history` `` in §6.12 was kept because it's backticked as
a property access (`` `.history` ``) — it turned out to be both extremely common as an English
word across the repo _and_ actually present in `referrals/`, so it didn't change the count either
way; flagged here so the check's author can decide whether property-access tokens are in scope.

## Per-section tables

### §6.1 Command · `coordinator/`

| Identifier        | Classification                                            | Files                                                                          | Verdict                                                                                                                                                                                   |
| ----------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `edPressure`      | IN OWN DIRECTORY                                          | `coordinator/coordinator-screen.tsx`, `pressure-strip.tsx`, `flow-diagram.tsx` | no flag                                                                                                                                                                                   |
| `edHomeTotals`    | OUTSIDE MODULE-OWN-DIR (in `ed/`)                         | `ed/ed-home-derivations.ts`, `ed/ed-home.tsx`                                  | **FALSE flag** — sentence says the pressure strip is "not built from... `edHomeTotals`" (explicit denial, not a claim)                                                                    |
| `edHomeSummaries` | ELSEWHERE IN MODULE (`ed/`, top-level `ward-pressure.ts`) | `ed/ed-home-derivations.ts`, `ed/ed-home.tsx`, `ward-pressure.ts`              | **FALSE flag** — sentence says Command's own `edPressure` "is a projection of `edHomeSummaries`": a data-flow relationship to another screen's shared computation, not an ownership claim |
| `withDeadline`    | NOWHERE                                                   | —                                                                              | **FALSE flag** — listed verbatim under "**Not built:**"                                                                                                                                   |
| `waitingInEd`     | NOWHERE                                                   | —                                                                              | **FALSE flag** — listed under "Not built... as identifiers, ever" (must never exist anywhere)                                                                                             |
| `dueWithin2h`     | NOWHERE                                                   | —                                                                              | **FALSE flag** — same "ever" prohibition as `waitingInEd`                                                                                                                                 |

### §6.2 Delays · `delays/`

| Identifier             | Classification   | Files                                                      | Verdict |
| ---------------------- | ---------------- | ---------------------------------------------------------- | ------- |
| `legalDeadlineMinutes` | IN OWN DIRECTORY | `delays/delays-derivations.ts`, `delays/delays-screen.tsx` | no flag |
| `DELAY_OWNERS`         | IN OWN DIRECTORY | `delays/delays-derivations.ts`, `delays/delays-screen.tsx` | no flag |

### §6.3 Movement · `movements/`, `tracker/`

| Identifier             | Classification   | Files                                                                  | Verdict |
| ---------------------- | ---------------- | ---------------------------------------------------------------------- | ------- |
| `totalsReconciliation` | IN OWN DIRECTORY | `movements/movements-derivations.ts`, `movements/movements-screen.tsx` | no flag |

### §6.4 Capacity · `capacity/`

| Identifier | Classification   | Files                                                              | Verdict |
| ---------- | ---------------- | ------------------------------------------------------------------ | ------- |
| `sexMix`   | IN OWN DIRECTORY | `capacity/capacity-derivations.ts`, `capacity/capacity-screen.tsx` | no flag |

### §6.5 Ward · `ward/`, `ward-table/`, `wards/`

No qualifying identifiers. The only backticked tokens (`` `Where to refer` ``, `` `catchment` ``,
`` `Accepted, pulled or en route here` ``) are quoted UI prose or a plain word, excluded per the
brief.

### §6.6 Bed board · `board/`

| Identifier          | Classification                                                                                              | Files                                                                                           | Verdict                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `patientId`         | ELSEWHERE IN MODULE (`patients/`, `referrals/`, `search/`, `shell/ward-facade.ts`, top-level `ward-*.ts`)   | e.g. `patients/person-screen.tsx`, `referrals/referral-intake.tsx`, `search/patient-search.tsx` | **FALSE flag** — confirmed `patientId` does not appear anywhere in `board/ward-board.tsx` or `board/ward-daily-sheet.tsx`; the sentence describes a data-model join fact ("the seed sets it on one occupant... so 'who is in the bed' is **not buildable** against this seed") — it is explaining why the board _can't_ fully resolve identity, not claiming board owns the field |
| `leaveBeds`         | IN OWN DIRECTORY                                                                                            | `board/ward-board.tsx`                                                                          | no flag                                                                                                                                                                                                                                                                                                                                                                           |
| `capacityBreakdown` | IN OWN DIRECTORY                                                                                            | `board/ward-board.tsx`                                                                          | no flag                                                                                                                                                                                                                                                                                                                                                                           |
| `arrivedAt`         | IN OWN DIRECTORY                                                                                            | `board/ward-board.tsx`                                                                          | no flag                                                                                                                                                                                                                                                                                                                                                                           |
| `Admission`         | IN OWN DIRECTORY                                                                                            | `board/ward-board.tsx` (imported type, used throughout)                                         | no flag                                                                                                                                                                                                                                                                                                                                                                           |
| `TransportJob`      | ELSEWHERE IN MODULE (`delays/`, `movements/`, `officer/`, `tracker/`, top-level `ward-derivations.ts` etc.) | confirmed absent from both `board/` files                                                       | **FALSE flag** — sentence uses `TransportJob` only to contrast its `undefined`-shaped `arrivedAt` against `Admission`'s `null`-shaped one; verified the board's "pulled" logic reads only `Admission.state`, never `TransportJob`                                                                                                                                                 |

### §6.7 Emergency department · `ed/`

| Identifier       | Classification   | Files                                         | Verdict |
| ---------------- | ---------------- | --------------------------------------------- | ------- |
| `edHomeTotals`   | IN OWN DIRECTORY | `ed/ed-home-derivations.ts`, `ed/ed-home.tsx` | no flag |
| `worstEdSummary` | IN OWN DIRECTORY | `ed/ed-home-derivations.ts`, `ed/ed-home.tsx` | no flag |

### §6.8 Community team · `community/`, §6.9 Patient search · `search/`, §6.11 Search hub · `hub/`

No qualifying identifiers in any of these three sections — every backticked token is a drawing
heading, a facet list, or prose (e.g. `` `Selected person` ``, `` `Everything · Accepted...` ``).

### §6.10 Patient · `patients/`

| Identifier        | Classification   | Files                                                         | Verdict                                                                                                   |
| ----------------- | ---------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `eligibility`     | IN OWN DIRECTORY | `patients/person-screen.tsx` (plus widely imported elsewhere) | no flag — matches the document's own claim that the screen imports this export from `ward-eligibility.ts` |
| `candidateReason` | IN OWN DIRECTORY | `patients/person-screen.tsx`                                  | no flag                                                                                                   |

### §6.12 Raise a referral · `referrals/`

| Identifier                        | Classification   | Files                                                                                                               | Verdict                                                                                                                                                    |
| --------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HISTORY_FIELDS`                  | IN OWN DIRECTORY | `referrals/referral-intake.tsx`                                                                                     | no flag                                                                                                                                                    |
| `history` (from `` `.history` ``) | IN OWN DIRECTORY | `referrals/referral-destination-options.ts`, `referral-duplicate.ts`, `referral-intake.tsx`, `referrals.module.css` | no flag, but see method note — this word also matches dozens of unrelated files repo-wide ("History" tabs, calculators, care-plan) purely as English prose |

### §6.13 Statistics · `statistics/`

| Identifier          | Classification                                              | Files                                                                                                                                                               | Verdict                                                                                                                                                                                          |
| ------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pulledAt`          | IN OWN DIRECTORY                                            | `statistics/statistics-claims-register.ts`, `statistics-compare-screen.tsx`, `statistics-derivations.ts`                                                            | no flag                                                                                                                                                                                          |
| `arrivedAt`         | IN OWN DIRECTORY                                            | `statistics/statistics-compare-screen.tsx`, `statistics-derivations.ts`, `statistics-ward-screen.tsx`                                                               | no flag                                                                                                                                                                                          |
| `leftAt`            | IN OWN DIRECTORY                                            | `statistics/statistics-compare-screen.tsx`, `statistics-ward-screen.tsx`                                                                                            | no flag                                                                                                                                                                                          |
| `Instant`           | IN OWN DIRECTORY                                            | `statistics/statistics-claims-register.ts`, `statistics-demonstration.ts`, `statistics-derivations.ts`, `statistics-ed-screen.tsx`                                  | no flag                                                                                                                                                                                          |
| `dailyFlow`         | NOWHERE (own dir, module, and full `src`/`tests` all empty) | —                                                                                                                                                                   | **FALSE flag** — this sits under "**Tasks (lane D writes them in full)**," i.e. it is proposed work in a lane whose status is "not started; lane held" — the document never claims it exists yet |
| `pullToArrival`     | IN OWN DIRECTORY                                            | `statistics/statistics-derivations.ts`, `statistics-screen.tsx`                                                                                                     | no flag                                                                                                                                                                                          |
| `referralToBedJoin` | IN OWN DIRECTORY                                            | `statistics/statistics-derivations.ts`, `statistics-screen.tsx`                                                                                                     | no flag                                                                                                                                                                                          |
| `wardStatistics`    | IN OWN DIRECTORY                                            | `statistics/statistics-claims-register.ts`, `statistics-derivations.ts`, `statistics-screen.tsx`, `statistics-ward-screen.tsx`                                      | no flag                                                                                                                                                                                          |
| `unitId`            | IN OWN DIRECTORY                                            | `statistics/statistics-claims-register.ts`, `statistics-compare-screen.tsx`, `statistics-screen.tsx`, `statistics-service-screen.tsx`, `statistics-ward-screen.tsx` | no flag                                                                                                                                                                                          |

### §6.14 Ward statistics · `statistics/`

| Identifier         | Classification                                                                            | Files                                                                                                                                                                                                                              | Verdict                               |
| ------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `psychiatric_ward` | IN OWN DIRECTORY (but not in `statistics-ward-screen.tsx` itself — see observation below) | `statistics/statistics-claims-register.ts`, `statistics-service-screen.tsx`                                                                                                                                                        | no flag under a directory-level check |
| `acceptedUnitId`   | IN OWN DIRECTORY (but not in `statistics-ward-screen.tsx` itself)                         | `statistics/statistics-claims-register.ts`, `statistics-compare-screen.tsx`, `statistics-ed-screen.tsx`, `statistics-overview-screen.tsx`, `statistics-screen.tsx`, `statistics-service-screen.tsx`                                | no flag under a directory-level check |
| `Movement`         | IN OWN DIRECTORY                                                                          | `statistics/statistics-claims-register.ts`, `statistics-compare-screen.tsx`, `statistics-decline-reporting.ts`, `statistics-derivations.ts`, `statistics-ed-screen.tsx`, `statistics-overview-screen.tsx`, `statistics-screen.tsx` | no flag                               |
| `referredUnitIds`  | IN OWN DIRECTORY (but not in `statistics-ward-screen.tsx` itself)                         | `statistics/statistics-claims-register.ts`, `statistics-derivations.ts`                                                                                                                                                            | no flag under a directory-level check |

**Observation on §6.14 specifically:** I confirmed directly that `acceptedUnitId`,
`referredUnitIds`, and `psychiatric_ward` are all absent from `statistics/statistics-ward-screen.tsx`
itself — they live in `statistics-derivations.ts`, `statistics-claims-register.ts`,
`statistics-ed-screen.tsx`, and `statistics-service-screen.tsx`. Because §6.13–§6.16 share one
directory (`statistics/`) across four different screens, a directory-scoped check cannot tell
"used on the right screen within the shared directory" from "used on one of the other three
screens sharing that directory." I did not treat this as a flag, because the check as specified
in the brief operates at the directory (not per-file) grain — but it means the check's real
blind spot inside lane D is invisible at this grain, and would need per-screen-file matching to
catch a genuine cross-screen misattribution within `statistics/`.

### §6.15 Community team statistics · `statistics/`

No qualifying identifiers — the section's only backticked-adjacent content is quoted prose
("Where this team sits", "People currently in a hospital bed").

### §6.16 Emergency department statistics · `statistics/`

| Identifier        | Classification                                            | Files                                                                  | Verdict                                                                                                                                                                                                                                                                                                                                          |
| ----------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `openedAt`        | IN OWN DIRECTORY                                          | `statistics/statistics-claims-register.ts`, `statistics-ed-screen.tsx` | no flag                                                                                                                                                                                                                                                                                                                                          |
| `edHomeSummaries` | ELSEWHERE IN MODULE (`ed/`, top-level `ward-pressure.ts`) | `ed/ed-home-derivations.ts`, `ed/ed-home.tsx`, `ward-pressure.ts`      | **FALSE flag** — sentence explicitly says the ED-statistics screen "imports nothing from `edHomeSummaries`" (explicit denial — this is the third time in the document this exact module gets named specifically to deny an association, per the document's own aside: "the fifth time that module was hung on a screen that does not import it") |

## What the check would need to be usable (observation, not a ruling)

1. **A polarity marker.** Every false flag above comes from a sentence that names the symbol to
   _deny_ an association ("not built from," "imports nothing from," "as identifiers, ever") or to
   describe a _derivation_ between two screens' owned computations ("is a projection of"), not to
   _claim_ residency. A check with no way to tell affirmative claims from negations or
   cross-references will always fire on this document's corrections section, because that section
   exists specifically to record what a screen does _not_ do.
2. **A "not yet built" state.** `dailyFlow` sits under an explicit "Tasks (lane D writes them in
   full)" heading in a lane marked "not started." Any identifier named only in a task list for
   unstarted work will read as a phantom flag until the check can see that heading.
3. **A shared-directory allow-list, or per-file matching.** §6.13–§6.16 all point at `statistics/`.
   A directory-level check can't refute a symbol landing on the _wrong one_ of those four screens;
   only matching against the specific screen file (`statistics-ward-screen.tsx` vs.
   `statistics-ed-screen.tsx`, etc.) would catch that class of error, and three identifiers in
   §6.14 above only pass because the check currently can't see that granularity.
4. **An allow-list for cross-screen shared derivations** (`edHomeSummaries` twice, `edHomeTotals`
   once) would need either a documented "these screens legitimately reference each other's
   modules" list, or the check would need to resolve the sentence's grammatical subject before
   deciding what "the section names X" is meant to prove.

## PROVEN BY READING / NOT CHECKED / QUESTIONS

**PROVEN BY READING:** every classification and file list above, by direct `git grep -w` against
the pinned TIP plus targeted `git show <TIP>:<path> | grep` spot-checks (confirmed `patientId` and
`TransportJob` absent from both files in `board/`; confirmed `acceptedUnitId`, `referredUnitIds`,
`psychiatric_ward` absent from `statistics-ward-screen.tsx` specifically; confirmed board's
"pulled" logic reads only `Admission.state`).

**NOT CHECKED:** whether the plan document's prose claims themselves are true against the code
(that is a separate exercise from this dry run, which only tests the _proposed check's_ behaviour);
whether identical identifier names in different files are the same symbol (I did not open every
file to confirm, e.g., that `unitId` in `statistics-service-screen.tsx` and `unitId` in
`statistics-ward-screen.tsx` are the same parameter shape — only that the token occurs there).

**QUESTIONS for the check's author:**

1. Is a 100%-false-positive rate on this one section enough on its own to shelve the "check
   whether or not the sentence names a file" design, or is there a narrower version (e.g. only
   flag sentences containing an affirmative verb like "renders," "exists," "wired to") worth
   dry-running next?
2. Should `history`/`catchment`-style common-English backticked words be in scope at all, or
   should the extraction step require camelCase/UPPER_SNAKE shape strictly (which would have
   dropped `history` and `gp` automatically without a human judgment call)?
