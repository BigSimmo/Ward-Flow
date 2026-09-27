# What the four-way fold made FALSE, not red

**Read-only adversarial review of `codex/task-ward-flow-live-state-20260831` at `34b8a9d7e`.**
Nothing was checked out, merged or modified; every quotation below is `git show <ref>:<path>`.
Recorded 2026-09-07.

## Scope and method

The fold is four merges off first parent `5e8bf85b7`:

| branch tip  | what it brought                                                             |
| ----------- | --------------------------------------------------------------------------- |
| `c75c360f0` | the token-collision scanner, its evidence document, six stylesheet cleanups |
| `ff6e40033` | the delays row's legal-deadline state                                       |
| `c6908fe21` | the four v4 statistics screens + the per-service screen and its mockups     |
| `166b76c05` | the search hub (`/mockups/ward-flow/hub`), its derivations and stylesheet   |

Their file sets intersect in only four places — `data/repo-awareness-snapshot.json`,
`docs/site-map.md`, `tests/ward-nav.test.ts`, `tests/ward-landmarks.test.ts` — i.e. the route
count, which another reviewer owns and which I deliberately did not touch. **So the fold's
textual conflicts were nearly nil, and everything below is a semantic collision instead.**

The six known reds were ignored throughout, as briefed.

Each finding says what I **measured** (opened the file, quoted the line) and what I **inferred**.
Where a claim is merely overtaken by events I say **AGED**, not false.

---

## 1. 🔴 The Delays screen tells a coordinator that a patient who walked out of the emergency department is now in a bed

**Severity: highest. A false clinical statement about a named cohort, on the seed, on first load.**
**Provenance: NOT fold-induced — pre-existing, and the fold neither caused nor repaired it.**

`src/components/ward-management/delays/delays-screen.tsx:236-243`:

```tsx
<WardPanel title="Resolved today" count={`${resolvedToday.length}`}>
  <p className={styles.absent}>
    {resolvedToday.length === 0
      ? "Nobody who was on this screen this morning is in a bed yet."
      : `${resolvedToday.length === 1 ? "One person" : `${resolvedToday.length} people`} who were on this screen earlier are now placed.`}{" "}
    They are kept for the rest of the day so a shift handing over can see what moved, and then they go.
  </p>
</WardPanel>
```

The population it describes is built at `delays-screen.tsx:79-81`:

```tsx
const resolvedToday = movements.filter(
  (movement) => movement.closure !== undefined && dayOf(movement.closure.at) === dayOf(now),
);
```

**It filters on the existence of a closure and never on its outcome.** `src/components/ward-management/ward-model.ts:561-565`:

```ts
export type MovementClosure = {
  at: Instant;
  outcome: "arrived" | "did_not_proceed";
  reason: string;
};
```

**Measured against the seed, not inferred.** `NOW_ANCHOR` is `10 * 60 + 42`
(`src/components/ward-management/ward-sites.ts:7`), so `dayOf` is 0 for everything near it, and
`src/components/ward-management/ward-movements.ts` carries exactly two closures inside that day:

- line 303 — `closure: { at: NOW_ANCHOR - 5, outcome: "arrived", reason: "Handover complete at SCGH Older Adult" }`
- lines 337-341 — `closure: { at: NOW_ANCHOR - 20, outcome: "did_not_proceed", reason: "Patient self-discharged from ED before transport was arranged" }`

So on an untouched load the panel reads **"Resolved today 2"** above the sentence
**"2 people who were on this screen earlier are now placed."** One of those two self-discharged
from an emergency department twenty minutes ago. Half the figure is a false claim about where a
patient physically is, printed on the board a bed coordinator uses to decide who to chase.

**The application already knows this distinction and gets it right one file away** —
`src/components/ward-management/ward-derivations.ts:151-168` splits `left` into `arrived` and
`didNotProceed` and explains at length why `arrived` is computed as the remainder so "no third
outcome can fall between them unnoticed". This screen is the copy that lost the distinction.

**What would have to be true for it to be fine:** `resolvedToday` would have to filter
`closure.outcome === "arrived"`, and the `did_not_proceed` rows would need their own sentence
(they are still "resolved today" in the handover sense — they are just not placed). Note the
zero-branch is already correct and specific ("…is in a bed yet"), which is what makes the
non-zero branch's "are now placed" read as deliberate rather than loose.

**Also, minor, same lines:** at `resolvedToday.length === 1` the sentence renders
_"One person who **were** on this screen earlier"_.

---

## 2. 🔴 The token-alias evidence document arrives asserting two live defects the master line had already repaired — and routes one of them to Ward Lead

**Severity: high. This is the cleanest genuinely fold-induced falsehood I found: a sibling changed underneath a document that measured it.**
**Provenance: fold-induced, both halves.**

Branch `c75c360f0` was cut from `fa268f426`. `docs/ward-flow/evidence/token-alias-bypass-2026-09-06.md`
was measured against that base and is accurate for it. The master line then repaired both of the
document's 🔴 items in commits that are **ancestors of the fold tip but not of branch A**
(verified with `git merge-base --is-ancestor`). The merge carried the document in unchanged.

### 2a. "The hover changes nothing" — it does now

`docs/ward-flow/evidence/token-alias-bypass-2026-09-06.md:51-59`:

> 🔴 **One is a live visible defect, not a latent one** — `patient-typeahead.module.css:312`:
>
> ```css
> .addLink {
>   background: var(--clinical-accent);
> }
> .addLink:hover {
>   background: var(--ward-blue);
> } /* IS --clinical-accent */
> ```
>
> **The hover changes nothing.** The add-patient button gives no feedback, and the rule that exists
> to provide it reads as though it does. Opened and confirmed, not inferred. Owned by Ward Lead.

At the fold tip, `src/components/ward-management/search/patient-typeahead.module.css:326-349`:

```css
/*
 * ⚠️ THIS HOVER PAINTED THE BUTTON THE COLOUR IT ALREADY WAS.
 * …
 * Found 2026-09-06 by Ward Builder Four's cascade detector, …
 */
.addLink:hover {
  background: var(--clinical-accent-strong);
}
```

Fixed in `686a40613` — an ancestor of `34b8a9d7e`, **not** of `c75c360f0`. The repair even credits
the same builder's detector. The document is the only place a reader is told the button is still
dead, and it says so under "Opened and confirmed, not inferred" and "Owned by Ward Lead" — the two
phrases most likely to stop somebody re-deriving it.

### 2b. "`ward-tokens.module.css:317-320` **currently** documents itself against the losing values" — it does not

`docs/ward-flow/evidence/token-alias-bypass-2026-09-06.md:83-89` (excerpted):

> 🔴 **`ward-tokens.module.css:317-320` currently documents itself against the losing values** —
> four contrast figures computed on `#fcfdfe` and `#f7f9fc` instead of `#ffffff` and `#fbfcfd`.
> … **Routed to Ward Lead; not edited here, because that file is shared with several live branches.**

The line reference was exact at branch A's base. `fa268f426:src/components/ward-management/ward-tokens.module.css:317-320`:

```
 *   --ward-ground (retired tint #f4f7fa) against a white panel        1.08:1
 *   --ward-subtle (#f7f9fc) against --ward-canvas (#fcfdfe)           1.04:1
 *   --ward-border (#667085) against the new ground (#fcfdfe)          4.88:1
 *   --ward-border (#667085) against a --ward-subtle row (#f7f9fc)     4.72:1
```

At the fold tip, the same four lines read:

```
 *   --ward-ground (retired tint #f4f7fa) against a white panel        1.08:1
 *   --ward-subtle (#fbfcfd) against --ward-canvas (#ffffff)           1.03:1
 *   --ward-border (#667085) against the ground (#ffffff)              4.97:1
 *   --ward-border (#667085) against a --ward-subtle row (#fbfcfd)     4.84:1
```

…followed at line 322 by an explicit paragraph saying the operands come from `ckb-v2-tokens.css`
and that "the four figures were WRONG until 2026-09-06". Fixed in `3c1dfa90a` — ancestor of the
fold tip, not of branch A.

The word doing the damage is **"currently"**. It converts a dated measurement into a present-tense
claim, and it survives a merge that has no way to notice.

**What would have to be true for it to be fine:** each 🔴 would need to be stamped with the commit
it was measured at (the document already does this well at the top and in its "Re-derive before
quoting" calibration section — the two 🔴 items are the only places that reach into another file
in the present tense).

**What I checked and found still TRUE, so the document is not wholesale stale:** all nine rows of
the alias/bypass table still co-occur in their named files at the tip (I grepped each alias and its
bypassed token in each file). **The count "nine" is not falsified** — only the two 🔴 narratives are.
I did **not** run `scripts/ward-flow/token-collision-scan.mjs`, so I have not re-derived the
verdict count itself; I checked co-presence of the named pairs only, which is weaker than the scan.

---

## 3. 🔴 The new per-service statistics screen states a cause for a missing figure that is wrong for the prototype's main journey

**Severity: high. An absence rendered as a positive claim, on a screen the fold created.**
**Provenance: the sentence is copied from an existing screen; the fold gave it a second home.**

`src/components/ward-management/statistics/statistics-service-screen.tsx:330-335`:

```tsx
<p className={styles.note} data-testid="ward-statistics-service-out-of-area-not-banded">
  <span …>{outOfAreaNotBanded}</span> more
  of {service}&apos;s occupied beds could not be placed in a band at all, because this prototype holds no
  travel time for their home region. The two figures do not share a denominator — neither is a share of
  the other.
</p>
```

`outOfAreaNotBanded` comes from `outOfAreaLedger`. That function has **three** paths into
`notBanded`, and the first of them is not the one the sentence names —
`src/components/ward-management/ward-referrals.ts` (inside `outOfAreaLedger`):

```ts
// Task 17, 2026-08-30: an arrival through the emergency-department pathway records no home
// region yet, and a distance from an unknown home is not a distance. It counts as not banded,
if (admission.homeRegion === null) {
  notBanded += 1;
  continue;
}

const band = travelBand(admission.homeRegion, unit.siteCode);
if (band === undefined) {
  notBanded += 1;
  continue;
}
```

- **Cause A — no home region recorded at all.** `Admission.homeRegion` is
  `HomeRegion | null` (`ward-admissions.ts:370`), and `ward-flow-reducer.ts:1592` writes
  `homeRegion: null` on **every** admission created by the ED→ward pull. The field's own doc
  comment says an ED-pathway admission "records no region until he rules, and **every consumer says
  so in words rather than guessing**". For these patients the screen's sentence is the opposite of
  the truth: it asserts a home region exists and only the travel time is missing.
- **Cause B — the pair is unrecorded, not the region.** `travelBand` is documented as returning
  undefined "when the synthetic fixture records none for **that pair**"
  (`ward-distance.ts:22-25`), and `ward-travel-bands.ts` says outright that the table was authored
  with "at least one site unrecorded inside a recorded region". Worked example: `SYNTHETIC_TRAVEL_BANDS`
  records "Perth Metropolitan" against RPH, SCGH, FSH, ARM and FRE only. East Metro also owns SJGM
  and BTY; North Metro also owns GRY. A Perth Metropolitan patient in a Bentley or Graylands bed
  is `notBanded` while the prototype holds five travel times for that exact region.
- **Cause C — the whole region is unrecorded.** The only case the sentence describes correctly.
  (Seeded regions include "Wheatbelt", "Goldfields-Esperance" and "Peel", none of which appear in
  the table at all, so this case is real too.)

**Measured:** the three code paths, the nullable field, the reducer write site, and the table's
own sparseness. **Inferred, not measured:** the relative size of the three causes on any given
render — I did not execute the app or the ledger.

**The same false sentence already exists at `src/components/ward-management/out-of-area/out-of-area-board.tsx:117-120`**, near-verbatim. So this is a duplication rather than a divergence, and the
fold doubled its reach onto a manager-facing screen. Note that the shared, canonical label for this
bucket does it correctly and states no cause: `NOT_RECORDED_LABEL = "Travel time not recorded"`
(`ward-distance.ts:65`), commented "A gap is named, never guessed at."

**What would have to be true for it to be fine:** either `outOfAreaLedger` returns the three causes
separately, or both screens say "…could not be placed in a band" and stop, which is what the
canonical label already models.

---

## 4. ⚠️ The Delays row reddens the clock for the _lesser_ of the two legal causes and not for a lapsed authority

**Severity: medium-high — latent on today's seed, and colour-only.**
**Provenance: NOT fold-induced. Branch `ff6e40033` edited this file, quoted this line in its new comment, and left it.**

`src/components/ward-management/delays/delays-screen.tsx:432-436`:

```tsx
clock={{
  value: splitDuration(Math.max(now - movement.openedAt, 0)),
  sub: "in ED",
  urgent: cause === "legal_expiring",
}}
```

`delays-derivations.ts` split that one cause into two, and ranks the worse one first:

```ts
  | "legal_breached"
  | "legal_expiring"
```

with `SEVERE_CAUSES` moved out of the screen and into the derivation module precisely because a
hand-written predicate had missed the split — its own doc comment says so:

> This lived as a hand-written predicate in `delays-screen.tsx`. When `legal_expiring` was split
> into `legal_breached` + `legal_expiring`, the ranking gained the worse case and that predicate
> did not — so **the lapsed authority rendered as routine and the merely-approaching one rendered as
> danger.**

**`urgent:` is the second site of that same predicate and it was not moved.** A movement whose
legal authority has already lapsed gets `cause === "legal_breached"`, so `urgent` is `false`; a
movement merely under an hour gets `urgent: true`. `WardRecordRow` renders that flag as
`data-urgent="true"` on the clock span and nothing else (`ward-record-row.tsx:64-69`) — so the
signal is **colour alone**, which is also the one channel a forced-colors or colour-blind reader
loses.

Mitigation, and it is why I rank this below the three above: the branch's new legal state chip
(`delays-screen.tsx:407-419`) is pushed at `level: "urgent"` for breached and expiring alike, so a
lapsed authority does carry an urgent _word_ — `"Form 4A (Transport order) passed its deadline
N min ago"`. The defect is confined to the clock's colour, and the file's own comment
(lines 364-368) already says the ED clock was the wrong figure to redden in the first place.

**Latent on today's data:** `delays-derivations.ts` states that no seeded movement's legal form is
breached or critical against `NOW_ANCHOR`, so neither branch fires until the demonstration clock is
advanced. I did not advance it.

---

## 5. ⚠️ Smaller true-then, false-now items

Each measured; none of the four is fold-induced.

- **`hub-screen.tsx:98-104` — a constant nothing reads, whose comment claims two readers.**

  ```tsx
  /** One word for what a thing is. Used by the row badge and the detail header, from one place, so
   *  the two can never disagree about what to call an emergency department. */
  const KIND_WORD: Record<HubKind, string> = { ward: "Ward", ed: "ED", community: "Community" };
  ```

  `git grep KIND_WORD` over `src` and `tests` at `34b8a9d7e` returns only its own declaration.
  Both named consumers use `KIND_WORD_LONG` instead (lines 366 and 590), and the row badge was
  deliberately removed — the file says so itself at lines 396-406, _"NO KIND BADGE ON THE ROW, AND
  THE MOCKUP HAS ONE."_ So the comment asserts a shared-source-of-truth guarantee between two
  things, one of which does not exist. I did **not** run `typecheck`; if `noUnusedLocals` is on this
  is also a red somebody owns.

- **`delays-screen.tsx:345-347` — "mirrors … exactly" and it never did.**

  ```
  // Wards and departments are always named, never shown as an id (see the doc comment above this
  // function) — mirrors `escalation-board.tsx`'s own `departmentLabel` fallback exactly, rather
  // than inventing a second wording for the same missing-lookup case.
  ```

  Delays renders `No department matches "…"` (line 349). `escalation-board.tsx:172-176` renders
  `No synthetic department matches "…"`, and its success branch appends the site code. **AGED is
  the wrong label here — the escalation-board wording has been byte-identical since the file was
  created in `3ab1f3dcc`, so this comment was false the day it was written.** The wording that
  actually matches is `movements-screen.tsx:204` and `:328`.

- **`hub-screen.tsx:46` — "THIS IS THE ONE PLACE THAT RENDERS THEM"** (Ready beside
  not-yet-cleared). Measured false at the tip: `ward-board.tsx:896`, `capacity-screen.tsx:131` and
  `:535`, `flow-diagram.tsx:615`, `shortlist-panel.tsx:201` and `ed-screen.tsx:2355` each render
  Ready with a "still being made ready" figure beside it. All six predate the hub, so the claim was
  false on arrival rather than falsified by a sibling. The comment also names the wrong pair: the
  function beneath it renders `ready` + `pendingPreparation`, whereas "not-yet-cleared" is `held`,
  a different fact that `hub-derivations.ts:42-51` is careful to keep separate.

- **`statistics-sections.ts:15` — "Why there are three sections and five routes."** The same file
  now defines four sections and six routes; branch C appended a "**A fourth section, added for a
  different audience**" paragraph immediately below rather than editing the heading, and
  `tests/ward-statistics-sections.test.ts:50` asserts four. **AGED**, self-correcting within a
  screenful, and it reaches no user.

---

## 6. What I checked and found SOUND

Recorded because a reviewer's silence reads as "not looked at".

- **The search hub's "About this prototype" panel** (`hub-screen.tsx:790-823`) — every
  hand-written factual claim in it survived checking against `ward-sites.ts`:
  _"one ward here is genuinely both fully locked and not authorised"_ (only `sjgs-adult-secure`:
  `lockedBeds` 8 of `beds` 8, `authorised: false`); _"Two wards read as 'Open' … though their own
  notes call them mixed"_ (`scgh-adult-open` and `fre-adult-open`, both `WARD_LOCKED_BED_SPLITS` 0,
  both named "genuinely mixed" in the fixture's own comment); the Joondalup/Peel vs
  Fremantle/Bentley asymmetry; and the ward/ED/community counts, which are derived from `totals`
  rather than typed. The panel is the best-behaved prose in the fold.
- **`docs/scripts-index.md`** — branch A added one script and bumped `306 files` to `307`.
  `git ls-tree -r scripts/ | wc -l` at the tip is 307; `package.json` has 301 script entries.
  Both correct.
- **`statistics-decline-reporting.ts`** — the malformed-vocabulary readout says
  _"The total is not shown, because a total computed without that reason would be lower than the
  truth rather than uncertain"_ and rethrows anything that is not the vocabulary error. No
  absence-as-zero anywhere in it.
- **`delays-screen.tsx:371-374`, "[`legalDeadlineMinutes`] had no caller anywhere until now"** —
  still true at the tip; the only non-test callers are this file's import and its one call site.
- **The statistics service chooser is a real arrival** — `STATISTICS_SERVICE_CHOOSER_ID` is
  rendered as `<div id={…}>` at `statistics-screen.tsx:932`, so the fragment link resolves.

---

## What I did not check

An unstated gap reads as a pass, so:

- **The route counts** (`ward-nav.test.ts`, `ward-landmarks.test.ts`, `docs/site-map.md`,
  `data/repo-awareness-snapshot.json`) — deliberately untouched; another reviewer owns them.
- **The six known reds** — ignored entirely, as briefed. I did not check whether any of them masks
  a truthfulness defect underneath.
- **I ran nothing.** No `vitest`, no `typecheck`, no `lint`, no Playwright, no
  `token-collision-scan.mjs`, no dev server, no browser. Every claim above is source reading plus
  arithmetic on fixture literals. Anything I called "on first load" is derived from the seed
  constants, not observed on a screen.
- **The five v4 statistics mockup HTML files** (~11,000 lines) — read only by targeted grep. One
  thing I saw and did **not** pursue, and it is a **mockup, so it is evidence about that file
  only**: `mockup-statistics-ed-v4.html` says _"Eight departments, one wait"_ and _"All eight
  departments, combined"_ while a disclosure below reads _"Why the other six departments are not
  drawn as their own charts"_ — one worked example plus six others is seven, not eight. The real
  model has eight EDs (`ward-sites.ts`), so the _"eight"_ figures are right and the _"six"_ looks
  wrong. I did not open enough of the file to be sure it is not counting something else, and I did
  not check whether `statistics-ed-screen.tsx` inherited the sentence.
- **`statistics-v4.module.css` (897 lines) and `hub.module.css` (998 lines)** — not read.
  Contrast, forced-colors and greyscale behaviour of the new screens is unexamined.
- **`ward-flow-reducer.ts` (3,733 lines) and the inbox acknowledgement/completion work** — read
  only around the sites named above. The `"fact"` vs `"commitment"` safety property (a live legal
  breach must not be tickable) is asserted in comments I read but did not verify against the
  reducer's transitions.
- **`record-preview.tsx` and `patient-search.tsx`** — extracted but not reviewed; they came from
  the first-parent line, not from these four branches.
- **Whether the seed actually produces a `notBanded` row today.** Finding 3's mechanism is
  measured; its on-screen count is not.
- **Every `Movement.legalStatus` render.** The brief's shape 1 (the "Voluntary — no statutory
  clock" defect) was reported as already fixed elsewhere tonight; I checked the new screens for
  fresh instances of the pattern and found none, but I did not re-audit the existing ones.
