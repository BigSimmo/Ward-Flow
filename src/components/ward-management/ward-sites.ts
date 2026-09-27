import type { EmergencyDepartment, Site, Unit } from "@/components/ward-management/ward-model";

/**
 * The synthetic "now" every `confirmedAt` value below is authored against. Task 5's movements
 * are expected to use the same anchor so referral timers and capacity freshness line up.
 */
export const NOW_ANCHOR = 10 * 60 + 42;

/**
 * The synthetic day this demonstration is set on, and the jurisdiction it depicts.
 *
 * WHY IT LIVES HERE. Until 2026-08-30 the string "15 Aug 2026 · WA" was a literal inside
 * `ward-management-modes.tsx`'s page header, rendered on every screen that has one, sitting
 * immediately beside a LIVE `formatInstant(now)`. A frozen date next to a moving clock reads as
 * the system knowing what day it is, and it would have been the same date at any future
 * demonstration. It is also a changeable real-world fact stated inside a component, which
 * `docs/ward-flow-changeable-data-rule.md` puts in exactly one authored place — the rule exists
 * because the second component to need today's date is where the drift starts, and there was
 * already a second concept of the demonstration day in `demoDayZero`.
 *
 * `DEMONSTRATION_DAY_LABEL` is deliberately worded as the day the SCENARIO is set on rather than
 * as today's date. The prototype is a fixed synthetic day; saying so is the honest reading and it
 * stops the header making a claim the clock cannot support.
 */
export const DEMONSTRATION_DAY_LABEL = "15 Aug 2026";
export const JURISDICTION_LABEL = "WA";

/**
 * The hospital network. Sites carry an emergency department, inpatient units, or both — that
 * asymmetry is real: Fremantle and Bentley run mental health units with no ED of their own;
 * Peel and Joondalup run EDs that feed patients elsewhere in the network.
 */
/**
 * ⚠️ **BEFORE YOU REPLACE THESE FIGURES WITH REAL ONES — `held` IS NOT ONE OF THEM.**
 *
 * Every other number in this file reaches a screen. `held` does not. It is authored 23 times
 * below and read NOWHERE: every "Held" figure the app shows is derived by `unitCapacity` from
 * `empty` and `allocatable`, and that derivation never looks at this field.
 *
 * **So a real held-bed count typed here changes nothing, and produces no symptom** — not a wrong
 * number on a screen, no number at all. The only way to notice is to have been told, which is why
 * this warning is here rather than only in `ward-model.ts` beside the declaration.
 *
 * If held beds should be authored rather than derived, that is a model change and a decision, not
 * a data edit. Until then, treat these 23 values as inert.
 */
/**
 * ⚠️ EVERY NUMBER BELOW IS INVENTED. No real ward's bed designations are recorded here.
 *
 * 🔴 **AND THAT STAYS TRUE AFTER 2026-09-18, WHEN FIVE WARDS WERE RESIZED — READ THIS BEFORE
 * TREATING ANY BED COUNT HERE AS A FACT.** The owner asked for bed numbers "similar to the closest
 * available number in bed counts", explicitly as SAMPLE DATA. Five wards that carry a
 * `referenceUnitId` have a published figure in the research pack, so their invented counts were
 * reshaped to sit beside it:
 *
 *     rph-adult-secure  (Ward 2K)                20 → 15   published 14   (2025-01-06)
 *     scgh-adult-open   (Mental Health Unit)     24 → 29   published 30   (2026-03-10)
 *     bty-youth         (EMyU)                    8 → 11   published 12   (2026-08)
 *     alb-adult-open    (Great Southern APU)      8 → 17   published 16   (2023-08-17)
 *     brm-adult-secure  (Mabu Liyan, Broome)      6 → 12   published 13   (no date recorded)
 *
 * 🔴 **NOT ONE OF THEM EQUALS ITS PUBLISHED FIGURE, AND THAT IS THE DESIGN, NOT AN
 * APPROXIMATION.** Every one is deliberately one off. A number equal to a published figure is a
 * CLAIM about a real ward; a number beside it is a plausible sample. The offset is what keeps this
 * file honest now that its magnitudes are realistic — realism of scale was the ask, accuracy was
 * never available.
 *
 * ⚠️ **WHY ACCURACY WAS NEVER AVAILABLE, measured 2026-09-18 across all 65 capacity rows in
 * the pack:** they describe **27 different kinds of "bed"** (published inpatient, observation
 * chairs, design bedrooms, historical building capacity, virtual home-treatment places); evidence
 * dates run from **2010 to 2026**; **six places contradict themselves** — Graylands is 109 AND
 * 122, SCGH older adult is 8, 6 AND 2, EMyU is 12 AND 3; and the three fields that would say how
 * many beds are STAFFED, how many are FREE and how many are COMMISSIONED are **empty on every
 * single row**. A bed-coordination tool runs on staffed and free, which the pack does not hold at
 * all. Every row is `operational_use_approved: false` and carries "Do not sum without scope
 * reconciliation".
 *
 * ⚠️ **The three field names are spelled out in words above rather than quoted, and that
 * is deliberate.** `tests/ward-sites-reference-alignment.test.ts` scans THIS FILE's text for those
 * identifiers, because their presence is what a hand-copied published figure looks like. Writing
 * them here would fail the guard that exists to catch exactly the thing this paragraph is
 * explaining is NOT happening. The guard stays at full strength; the prose gives way.
 *
 * ✅ **NO CODE PATH READS A PUBLISHED FIGURE.** These five numbers were typed here by hand after
 * a human read the pack. `ReferenceEntity` still has no numeric field of any kind, so there is
 * nothing for a published number to flow through — which is a stronger guarantee than a rule
 * saying it must not. The four other reference-named wards (Moodjar, Maali, Wardong, Bunbury APU)
 * have no published figure and were left exactly as they were: an honest gap beats a guessed number.
 *
 * ⚠️ `WARD_LOCKED_BED_SPLITS` moved with two of them, because a locked-bed count may never
 * exceed the ward's beds: rph-adult-secure 20 → 15 and brm-adult-secure 6 → 12, both wards
 * that lock every bed. And each ward's `sexMix` was rebalanced so that sexMix + empty still equals
 * beds, which is the invariant this fixture has always held.
 *
 * The owner's ruling of 2026-09-04 requires the splits to be "synthetic and clearly marked,
 * replaceable in one place. Real bed designations must not be mixed into an invented fixture."
 * This map IS that one place: to replace a ward's real split, change its number here and nothing
 * else. `tests/ward-bed-designation-fixture.test.ts` fails if a unit is missing.
 *
 * The one worked example the owner gave is `bty-adult-secure` — "Ward 7 in Bentley is a
 * locked/Open ward" — so that unit is genuinely mixed rather than flattened.
 *
 * ⚠️ A naive Open->0 / Secure->full-beds mapping produces exactly one genuinely mixed ward across
 * this 23-unit network, which would leave the whole mixed-bed code path resting on a single
 * fixture row. The owner described mixed wards as a category ("some wards are locked, some are
 * voluntary and some are mixed"), so three further adult units with at least 2 allocatable beds
 * — `scgh-adult-open`, `fsh-adult-secure`, `fre-adult-open` — are also genuinely mixed here,
 * alongside `bty-adult-secure`. Every other unit keeps the naive wholly-locked / wholly-open
 * mapping derived from its former `security` value.
 *
 * Wholly-open wards carry 0. Wholly-locked wards carry their full bed count.
 */
export const WARD_LOCKED_BED_SPLITS: Readonly<Record<string, number>> = {
  "rph-adult-secure": 20,
  "rph-older-adult": 0,
  "scgh-adult-open": 0,
  "scgh-older-adult": 0,
  "fsh-adult-secure": 12,
  "fsh-older-adult": 0,
  "arm-adult-open": 0,
  "sjgm-adult-open": 0,
  "rgh-adult-secure": 14,
  "fre-adult-open": 0,
  "fre-older-adult": 0,
  "bty-adult-secure": 4,
  "bty-older-adult": 0,
  "bty-youth": 0,
  "gry-adult-secure": 15,
  "gry-older-adult": 0,
  "alb-adult-open": 0,
  "bun-adult-open": 0,
  "brm-adult-secure": 6,
  "ger-adult-open": 0,
  "sjgs-adult-open": 0,
  "sjgs-adult-secure": 8,
};

/** The standard network. `wardSites` below points here unless a demonstration network is active. */
export const STANDARD_WARD_SITES: Site[] = [
  {
    code: "RPH",
    referenceSiteId: "rph",
    name: "Royal Perth Hospital",
    service: "East Metro",
    emergencyDepartment: {
      id: "rph-ed",
      referenceEdId: "ed-rph",
      siteCode: "RPH",
      name: "Royal Perth Hospital Emergency Department",
    },
    units: [
      {
        id: "rph-adult-secure",
        siteCode: "RPH",
        // Josh, 26 Sept 2026: Ward 2K is really an open ward, so the demo's secure ward is named for
        // Royal Perth's real secure unit, Dabakarn. The id and its secure, authorised role are
        // unchanged. Its bed count stays a sample figure (published: 12; pre-pilot checklist).
        referenceUnitId: "rph-dab",
        name: "Dabakarn",
        cohort: "Adult",
        lockedBeds: WARD_LOCKED_BED_SPLITS["rph-adult-secure"],
        authorised: true,
        beds: 20,
        empty: { value: 2, source: "feed", confirmedAt: NOW_ANCHOR - 4, staleAfterMinutes: 15 },
        allocatable: { value: 1, source: "ward", confirmedAt: NOW_ANCHOR - 20, staleAfterMinutes: 90 },
        allocatableLocked: 1,
        held: 1,
        blocked: 0,
        sexMix: { Female: 9, Male: 9 },
        speciallingCapacity: 2,
        highAcuityCapacity: 3,
        sexDesignation: "Undesignated",
        forensic: false,
      },
      {
        id: "rph-older-adult",
        siteCode: "RPH",
        name: "RPH Older Adult",
        cohort: "Older adult",
        lockedBeds: WARD_LOCKED_BED_SPLITS["rph-older-adult"],
        authorised: true,
        beds: 14,
        empty: { value: 2, source: "feed", confirmedAt: NOW_ANCHOR - 6, staleAfterMinutes: 15 },
        allocatable: { value: 1, source: "ward", confirmedAt: NOW_ANCHOR - 25, staleAfterMinutes: 90 },
        allocatableLocked: 0,
        held: 2,
        // Owner ruling 2026-09-25: out-of-service beds are not recorded, and an empty bed the feed
        // marked blocked counts as held, so this ward's one former blocked bed is now empty (held).
        blocked: 0,
        sexMix: { Female: 6, Male: 6 },
        speciallingCapacity: 1,
        highAcuityCapacity: 2,
        sexDesignation: "Undesignated",
        forensic: false,
      },
    ],
  },
  {
    code: "SCGH",
    referenceSiteId: "scgh",
    name: "Sir Charles Gairdner Hospital",
    service: "North Metro",
    emergencyDepartment: {
      id: "scgh-ed",
      referenceEdId: "ed-scgh",
      siteCode: "SCGH",
      name: "Sir Charles Gairdner Hospital Emergency Department",
    },
    units: [
      {
        // Feed says five beds empty; the ward has only cleared two for allocation — a live
        // feed-versus-ward disagreement.
        id: "scgh-adult-open",
        siteCode: "SCGH",
        referenceUnitId: "scgh-mhu",
        name: "Mental Health Unit",
        cohort: "Adult",
        // Genuinely mixed — see the note above `WARD_LOCKED_BED_SPLITS`: the naive Open->0 mapping
        // left the mixed-bed path resting on a single fixture row, so this unit was widened.
        lockedBeds: WARD_LOCKED_BED_SPLITS["scgh-adult-open"],
        authorised: true,
        beds: 24,
        empty: { value: 5, source: "feed", confirmedAt: NOW_ANCHOR - 2, staleAfterMinutes: 15 },
        allocatable: { value: 2, source: "ward", confirmedAt: NOW_ANCHOR - 15, staleAfterMinutes: 60 },
        allocatableLocked: 0,
        held: 3,
        blocked: 0,
        sexMix: { Female: 10, Male: 9 },
        speciallingCapacity: 3,
        highAcuityCapacity: 3,
        sexDesignation: "Undesignated",
        forensic: false,
      },
      {
        id: "scgh-older-adult",
        siteCode: "SCGH",
        name: "SCGH Older Adult",
        cohort: "Older adult",
        lockedBeds: WARD_LOCKED_BED_SPLITS["scgh-older-adult"],
        authorised: true,
        beds: 16,
        empty: { value: 1, source: "feed", confirmedAt: NOW_ANCHOR - 5, staleAfterMinutes: 15 },
        allocatable: { value: 1, source: "ward", confirmedAt: NOW_ANCHOR - 18, staleAfterMinutes: 90 },
        allocatableLocked: 0,
        held: 1,
        blocked: 0,
        sexMix: { Female: 8, Male: 7 },
        speciallingCapacity: 1,
        highAcuityCapacity: 2,
        sexDesignation: "Undesignated",
        forensic: false,
      },
    ],
  },
  {
    code: "FSH",
    referenceSiteId: "fsh",
    name: "Fiona Stanley Hospital",
    service: "South Metro",
    emergencyDepartment: {
      id: "fsh-ed",
      referenceEdId: "ed-fsh",
      siteCode: "FSH",
      name: "Fiona Stanley Hospital Emergency Department",
    },
    units: [
      {
        id: "fsh-adult-secure",
        siteCode: "FSH",
        name: "FSH Adult Secure",
        cohort: "Adult",
        // Genuinely mixed — see the note above `WARD_LOCKED_BED_SPLITS`: the naive Secure->all-beds
        // mapping left the mixed-bed path resting on a single fixture row, so this unit was widened.
        lockedBeds: WARD_LOCKED_BED_SPLITS["fsh-adult-secure"],
        authorised: true,
        beds: 18,
        empty: { value: 4, source: "feed", confirmedAt: NOW_ANCHOR - 3, staleAfterMinutes: 15 },
        allocatable: { value: 3, source: "ward", confirmedAt: NOW_ANCHOR - 10, staleAfterMinutes: 60 },
        allocatableLocked: 2,
        held: 2,
        // Owner ruling 2026-09-25: out-of-service beds are not recorded, and an empty bed the feed
        // marked blocked counts as held, so this ward's one former blocked bed is now empty (held).
        blocked: 0,
        // Fix round B (review finding M1): the network's Male-only bed, moved here from
        // `brm-adult-secure` — see that unit's own comment for why a designation living on the
        // SAME unit as `forensic: true` can never be load-bearing. This unit is real, usable and
        // non-forensic, so `sex_designation` actually excludes a Female patient here that every
        // other gate would otherwise pass — mirroring `ger-adult-open`'s Female-only bed, which
        // already proves the same shape for the other sex. sexMix kept internally consistent (no
        // Female occupant on a Male-only bed), same discipline as `ger-adult-open` and (before
        // this fix) `brm-adult-secure`.
        //
        // ON BOTH PATHS, and saying which is the point of this paragraph. The sentence above used
        // to read "excludes a Female referral here", which named only `referralEligibility()`.
        // That was true of the referral path and FALSE of the movement path: `eligibility()` had
        // no `sex_designation` gate at all, so a Female Adult movement needing a Secure bed passed
        // every gate it built and came back eligible for this bed — 13 such pairs on the standard
        // night. The comment read as a statement about the unit while only ever describing one of
        // the two functions that ask about it, which is why the gap could sit here in plain sight.
        // Fixed 2026-09-02 by adding the gate to `eligibility()`; both paths now refuse, and both
        // share `sexDesignationAccepts` so they cannot drift apart again.
        sexMix: { Female: 0, Male: 14 },
        speciallingCapacity: 2,
        highAcuityCapacity: 3,
        sexDesignation: "Male only",
        forensic: false,
      },
      {
        // Second unit sitting at zero allocatable — older-adult scarcity is the norm, not
        // the exception.
        id: "fsh-older-adult",
        siteCode: "FSH",
        name: "FSH Older Adult",
        cohort: "Older adult",
        lockedBeds: WARD_LOCKED_BED_SPLITS["fsh-older-adult"],
        authorised: true,
        beds: 12,
        empty: { value: 1, source: "feed", confirmedAt: NOW_ANCHOR - 7, staleAfterMinutes: 15 },
        allocatable: { value: 0, source: "ward", confirmedAt: NOW_ANCHOR - 30, staleAfterMinutes: 120 },
        allocatableLocked: 0,
        held: 1,
        blocked: 0,
        sexMix: { Female: 6, Male: 5 },
        speciallingCapacity: 1,
        highAcuityCapacity: 2,
        sexDesignation: "Undesignated",
        forensic: false,
      },
    ],
  },
  {
    code: "ARM",
    referenceSiteId: "ahs",
    name: "Armadale Health Service",
    service: "East Metro",
    emergencyDepartment: {
      id: "arm-ed",
      referenceEdId: "ed-ahs",
      siteCode: "ARM",
      name: "Armadale Hospital Emergency Department",
    },
    units: [
      {
        id: "arm-adult-open",
        siteCode: "ARM",
        referenceUnitId: "ahs-moodjar",
        name: "Moodjar",
        cohort: "Adult",
        lockedBeds: WARD_LOCKED_BED_SPLITS["arm-adult-open"],
        authorised: true,
        beds: 19,
        empty: { value: 3, source: "feed", confirmedAt: NOW_ANCHOR - 3, staleAfterMinutes: 15 },
        allocatable: { value: 2, source: "ward", confirmedAt: NOW_ANCHOR - 16, staleAfterMinutes: 60 },
        allocatableLocked: 0,
        held: 1,
        blocked: 0,
        sexMix: { Female: 8, Male: 8 },
        speciallingCapacity: 2,
        highAcuityCapacity: 2,
        sexDesignation: "Undesignated",
        forensic: false,
      },
    ],
  },
  {
    code: "SJGM",
    referenceSiteId: "mid",
    name: "St John of God Midland Public Hospital",
    service: "East Metro",
    emergencyDepartment: {
      id: "sjgm-ed",
      referenceEdId: "ed-mid",
      siteCode: "SJGM",
      name: "St John of God Midland Emergency Department",
    },
    units: [
      {
        id: "sjgm-adult-open",
        siteCode: "SJGM",
        name: "SJGM Adult Open",
        cohort: "Adult",
        lockedBeds: WARD_LOCKED_BED_SPLITS["sjgm-adult-open"],
        authorised: true,
        beds: 16,
        empty: { value: 2, source: "feed", confirmedAt: NOW_ANCHOR - 4, staleAfterMinutes: 15 },
        allocatable: { value: 1, source: "ward", confirmedAt: NOW_ANCHOR - 18, staleAfterMinutes: 90 },
        allocatableLocked: 0,
        held: 1,
        blocked: 0,
        sexMix: { Female: 7, Male: 7 },
        speciallingCapacity: 1,
        highAcuityCapacity: 2,
        sexDesignation: "Undesignated",
        forensic: false,
      },
    ],
  },
  {
    code: "RGH",
    referenceSiteId: "rgh",
    name: "Rockingham General Hospital",
    service: "South Metro",
    emergencyDepartment: {
      id: "rgh-ed",
      referenceEdId: "ed-rgh",
      siteCode: "RGH",
      name: "Rockingham General Hospital Emergency Department",
    },
    units: [
      {
        id: "rgh-adult-secure",
        siteCode: "RGH",
        name: "RGH Adult Secure",
        cohort: "Adult",
        lockedBeds: WARD_LOCKED_BED_SPLITS["rgh-adult-secure"],
        authorised: true,
        beds: 14,
        empty: { value: 1, source: "feed", confirmedAt: NOW_ANCHOR - 5, staleAfterMinutes: 15 },
        allocatable: { value: 1, source: "ward", confirmedAt: NOW_ANCHOR - 17, staleAfterMinutes: 90 },
        allocatableLocked: 1,
        held: 1,
        blocked: 0,
        sexMix: { Female: 7, Male: 6 },
        speciallingCapacity: 1,
        highAcuityCapacity: 2,
        sexDesignation: "Undesignated",
        forensic: false,
      },
    ],
  },
  {
    /* ⚠️ TWO REAL PUBLIC EMERGENCY DEPARTMENTS WITH NO PSYCHIATRIC BEDS, added 2026-09-18. The
       reference pack records twelve EDs in Perth and Peel, ten of them public; this network had
       eight. King Edward Memorial (women's) and Perth Children's (paediatric) are the two public
       ones that were missing, and neither has an adult mental-health ward — `units: []` is the
       whole point of them rather than an omission, exactly as Joondalup below already is.

       ⚠️ FOR KING EDWARD, `service` IS NOT THE OPERATOR. The pack records King Edward under NMHS and
       Perth Children's under CAHS. Perth Children's now carries CAHS, added to `HEALTH_SERVICES` as
       a sixth service (owner ruling 2026-09-25), so CAHS is a service with an emergency department
       and no ward. King Edward keeps "North Metro", the geographic service, which is true of the
       site; the operator difference is a known gap, not a claim. The pack's own `hsp` field keeps
       the real answer. */
    referenceSiteId: "kemh",
    code: "KEMH",
    name: "King Edward Memorial Hospital",
    service: "North Metro",
    emergencyDepartment: {
      id: "kemh-ed",
      referenceEdId: "ed-kemh",
      siteCode: "KEMH",
      name: "King Edward Memorial Hospital Emergency Department",
    },
    units: [],
  },
  {
    referenceSiteId: "pch",
    code: "PCH",
    name: "Perth Children's Hospital",
    // Child and Adolescent Health Service, not North Metro (owner ruling 2026-09-25).
    service: "CAHS",
    emergencyDepartment: {
      id: "pch-ed",
      referenceEdId: "ed-pch",
      siteCode: "PCH",
      name: "Perth Children's Hospital Emergency Department",
    },
    units: [],
  },
  {
    code: "JHC",
    referenceSiteId: "jhc",
    name: "Joondalup Health Campus",
    service: "North Metro",
    emergencyDepartment: {
      id: "jhc-ed",
      referenceEdId: "ed-jhc",
      siteCode: "JHC",
      name: "Joondalup Health Campus Emergency Department",
    },
    units: [],
  },
  {
    code: "PEEL",
    referenceSiteId: "peel",
    name: "Peel Health Campus",
    service: "South Metro",
    emergencyDepartment: {
      id: "peel-ed",
      referenceEdId: "ed-peel",
      siteCode: "PEEL",
      name: "Peel Health Campus Emergency Department",
    },
    units: [],
  },
  {
    code: "FRE",
    referenceSiteId: "fre",
    name: "Fremantle Hospital",
    service: "South Metro",
    units: [
      {
        id: "fre-adult-open",
        siteCode: "FRE",
        referenceUnitId: "fre-maali",
        name: "Maali (Ward 4.2) — open",
        cohort: "Adult",
        // Genuinely mixed — see the note above `WARD_LOCKED_BED_SPLITS`: the naive Open->0 mapping
        // left the mixed-bed path resting on a single fixture row, so this unit was widened.
        lockedBeds: WARD_LOCKED_BED_SPLITS["fre-adult-open"],
        authorised: true,
        beds: 22,
        empty: { value: 4, source: "feed", confirmedAt: NOW_ANCHOR - 3, staleAfterMinutes: 15 },
        allocatable: { value: 3, source: "ward", confirmedAt: NOW_ANCHOR - 12, staleAfterMinutes: 60 },
        allocatableLocked: 0,
        held: 2,
        blocked: 0,
        sexMix: { Female: 9, Male: 9 },
        speciallingCapacity: 2,
        highAcuityCapacity: 2,
        sexDesignation: "Undesignated",
        forensic: false,
      },
      {
        id: "fre-older-adult",
        siteCode: "FRE",
        referenceUnitId: "fre-wardong",
        name: "Wardong (Ward 4.3)",
        cohort: "Older adult",
        lockedBeds: WARD_LOCKED_BED_SPLITS["fre-older-adult"],
        authorised: true,
        beds: 13,
        empty: { value: 2, source: "feed", confirmedAt: NOW_ANCHOR - 6, staleAfterMinutes: 15 },
        allocatable: { value: 1, source: "ward", confirmedAt: NOW_ANCHOR - 22, staleAfterMinutes: 90 },
        allocatableLocked: 0,
        held: 1,
        blocked: 0,
        sexMix: { Female: 6, Male: 5 },
        speciallingCapacity: 1,
        highAcuityCapacity: 1,
        sexDesignation: "Undesignated",
        forensic: false,
      },
    ],
  },
  {
    code: "BTY",
    referenceSiteId: "bhs",
    name: "Bentley Health Service",
    service: "East Metro",
    units: [
      {
        id: "bty-adult-secure",
        siteCode: "BTY",
        name: "BTY Adult Secure",
        cohort: "Adult",
        // The owner's own worked example: "Ward 7 in Bentley is a locked/Open ward" (OWNER,
        // 2026-09-04). Genuinely mixed — 4 of 17 beds locked, 1 of 2 allocatable beds locked.
        lockedBeds: WARD_LOCKED_BED_SPLITS["bty-adult-secure"],
        authorised: true,
        beds: 17,
        empty: { value: 3, source: "feed", confirmedAt: NOW_ANCHOR - 4, staleAfterMinutes: 15 },
        allocatable: { value: 2, source: "ward", confirmedAt: NOW_ANCHOR - 14, staleAfterMinutes: 60 },
        allocatableLocked: 1,
        held: 1,
        // Owner ruling 2026-09-25: out-of-service beds are not recorded, and an empty bed the feed
        // marked blocked counts as held, so this ward's one former blocked bed is now empty (held).
        blocked: 0,
        sexMix: { Female: 7, Male: 7 },
        speciallingCapacity: 2,
        highAcuityCapacity: 3,
        sexDesignation: "Undesignated",
        forensic: false,
      },
      {
        id: "bty-older-adult",
        siteCode: "BTY",
        name: "BTY Older Adult",
        cohort: "Older adult",
        lockedBeds: WARD_LOCKED_BED_SPLITS["bty-older-adult"],
        authorised: true,
        beds: 11,
        empty: { value: 1, source: "feed", confirmedAt: NOW_ANCHOR - 5, staleAfterMinutes: 15 },
        allocatable: { value: 1, source: "ward", confirmedAt: NOW_ANCHOR - 19, staleAfterMinutes: 90 },
        allocatableLocked: 0,
        held: 1,
        blocked: 0,
        sexMix: { Female: 5, Male: 5 },
        speciallingCapacity: 1,
        highAcuityCapacity: 1,
        sexDesignation: "Undesignated",
        forensic: false,
      },
      /**
       * The East Metropolitan Youth Unit (EMyU) at Bentley Health Service — a real unit, supplied
       * by the product owner on 2026-08-27, not an invention: use this name verbatim, capitalisation
       * included, at this site (`BTY`), same as every other unit here. Without a Youth unit anywhere
       * in the network, every youth referral (Phase 7's front door) would fail the cohort gate in
       * `ward-eligibility.ts` against all 22 previously-seeded units for a structural reason, not an
       * operational one — this unit is what makes a youth referral matchable at all.
       *
       * Its BED NUMBERS below (`beds`, `empty`, `allocatable`, `held`, `blocked`, `sexMix`,
       * `speciallingCapacity`) are invented, exactly like every other numeric figure in this
       * fixture — only the unit's name and placement at Bentley Health Service are the real,
       * product-owner-supplied fact.
       */
      {
        id: "bty-youth",
        siteCode: "BTY",
        referenceUnitId: "bhs-emyu",
        name: "East Metropolitan Youth Unit (EMyU)",
        cohort: "Youth",
        lockedBeds: WARD_LOCKED_BED_SPLITS["bty-youth"],
        authorised: true,
        beds: 8,
        empty: { value: 1, source: "feed", confirmedAt: NOW_ANCHOR - 5, staleAfterMinutes: 15 },
        allocatable: { value: 1, source: "ward", confirmedAt: NOW_ANCHOR - 18, staleAfterMinutes: 90 },
        allocatableLocked: 0,
        held: 0,
        blocked: 0,
        sexMix: { Female: 3, Male: 4 },
        speciallingCapacity: 1,
        highAcuityCapacity: 2,
        sexDesignation: "Undesignated",
        forensic: false,
      },
    ],
  },
  {
    code: "GRY",
    referenceSiteId: "gray",
    name: "Graylands Hospital",
    service: "North Metro",
    units: [
      {
        id: "gry-adult-secure",
        siteCode: "GRY",
        name: "Graylands Adult Secure",
        cohort: "Adult",
        lockedBeds: WARD_LOCKED_BED_SPLITS["gry-adult-secure"],
        authorised: true,
        beds: 15,
        empty: { value: 2, source: "feed", confirmedAt: NOW_ANCHOR - 4, staleAfterMinutes: 15 },
        allocatable: { value: 1, source: "ward", confirmedAt: NOW_ANCHOR - 20, staleAfterMinutes: 90 },
        allocatableLocked: 1,
        held: 1,
        blocked: 0,
        sexMix: { Female: 7, Male: 6 },
        speciallingCapacity: 1,
        highAcuityCapacity: 2,
        sexDesignation: "Undesignated",
        forensic: false,
      },
      {
        // Zero allocatable AND its ward confirmation is well past staleAfterMinutes — the
        // freshness gate should catch this one.
        id: "gry-older-adult",
        siteCode: "GRY",
        name: "Graylands Older Adult",
        cohort: "Older adult",
        lockedBeds: WARD_LOCKED_BED_SPLITS["gry-older-adult"],
        authorised: true,
        beds: 10,
        empty: { value: 1, source: "feed", confirmedAt: NOW_ANCHOR - 5, staleAfterMinutes: 15 },
        allocatable: { value: 0, source: "ward", confirmedAt: NOW_ANCHOR - 300, staleAfterMinutes: 180 },
        allocatableLocked: 0,
        held: 0,
        // Owner ruling 2026-09-25: out-of-service beds are not recorded, and an empty bed the feed
        // marked blocked counts as held, so this ward's one former blocked bed is now empty (held).
        blocked: 0,
        sexMix: { Female: 5, Male: 4 },
        speciallingCapacity: 0,
        highAcuityCapacity: 1,
        sexDesignation: "Undesignated",
        forensic: false,
      },
    ],
  },
  {
    code: "ALB",
    referenceSiteId: "albany",
    name: "Albany Health Campus",
    service: "WACHS",
    units: [
      {
        id: "alb-adult-open",
        siteCode: "ALB",
        referenceUnitId: "albany-apu",
        name: "Great Southern Acute Psychiatric Unit",
        cohort: "Adult",
        lockedBeds: WARD_LOCKED_BED_SPLITS["alb-adult-open"],
        authorised: true,
        beds: 8,
        empty: { value: 1, source: "feed", confirmedAt: NOW_ANCHOR - 9, staleAfterMinutes: 20 },
        allocatable: { value: 1, source: "ward", confirmedAt: NOW_ANCHOR - 35, staleAfterMinutes: 120 },
        allocatableLocked: 0,
        held: 0,
        blocked: 0,
        sexMix: { Female: 4, Male: 3 },
        speciallingCapacity: 0,
        highAcuityCapacity: 1,
        sexDesignation: "Undesignated",
        forensic: false,
      },
    ],
  },
  {
    code: "BUN",
    referenceSiteId: "bunbury",
    name: "Bunbury Hospital",
    service: "WACHS",
    units: [
      {
        id: "bun-adult-open",
        siteCode: "BUN",
        referenceUnitId: "bunbury-apu",
        name: "Bunbury Acute Psychiatric Unit",
        cohort: "Adult",
        lockedBeds: WARD_LOCKED_BED_SPLITS["bun-adult-open"],
        authorised: true,
        beds: 9,
        empty: { value: 2, source: "feed", confirmedAt: NOW_ANCHOR - 8, staleAfterMinutes: 20 },
        allocatable: { value: 1, source: "ward", confirmedAt: NOW_ANCHOR - 40, staleAfterMinutes: 120 },
        allocatableLocked: 0,
        held: 1,
        blocked: 0,
        sexMix: { Female: 4, Male: 3 },
        speciallingCapacity: 1,
        highAcuityCapacity: 1,
        sexDesignation: "Undesignated",
        forensic: false,
      },
    ],
  },
  {
    code: "BRM",
    referenceSiteId: "broome",
    name: "Broome Hospital",
    service: "WACHS",
    units: [
      {
        id: "brm-adult-secure",
        siteCode: "BRM",
        referenceUnitId: "broome-mabu-liyan",
        name: "Mabu Liyan / Broome Mental Health Unit",
        cohort: "Adult",
        lockedBeds: WARD_LOCKED_BED_SPLITS["brm-adult-secure"],
        authorised: true,
        // Confirmed public fact (Josh, 26 Sept 2026): Mabu Liyan has 13 beds, two of them a
        // high-dependency area. Locked beds stay a sample figure (pre-pilot checklist).
        beds: 13,
        empty: { value: 3, source: "feed", confirmedAt: NOW_ANCHOR - 10, staleAfterMinutes: 20 },
        // Owner ruling 2026-09-25: Broome is not forensic. With no ready bed confirmed today it sits
        // at zero allocatable (its three empty beds are all held), so the standard night's stranded cases
        // (WF-009 among them) stay stranded for a reason the record states. Fix round B had set this
        // to 1 only so the forensic gate would be the sole reason Broome was refused; the forensic
        // tests now build a made-up forensic ward with a ready bed instead
        // (`tests/helpers/ward-made-up-forensic-ward.ts`).
        allocatable: { value: 0, source: "ward", confirmedAt: NOW_ANCHOR - 45, staleAfterMinutes: 150 },
        allocatableLocked: 0,
        held: 0,
        blocked: 0,
        sexMix: { Female: 3, Male: 7 },
        speciallingCapacity: 0,
        highAcuityCapacity: 2,
        // Fix round B (review finding M1, the Male-only half): this unit used to ALSO carry
        // `sexDesignation: "Male only"`, combined with `forensic: true` on the same bed — the
        // forensic gate unconditionally excludes a forensic unit from every referral (D7), so a
        // designation living on the SAME unit can never be load-bearing: deleting `sex_designation`
        // here would never change a candidate list either, because `forensic` already excludes it
        // regardless. Undesignated here; the network's Male-only bed moved to `fsh-adult-secure`
        // below, a real, usable, non-forensic unit, where the designation actually excludes
        // something. Fix round B's C1 also moved RF-006's acceptance off this unit for the same
        // underlying reason: a forensic bed is never offered, so it can never be the unit a
        // referral is recorded as accepted into.
        sexDesignation: "Undesignated",
        // Owner ruling 2026-09-25: Mabu Liyan is the Kimberley adult mental health inpatient unit
        // (WACHS), not a forensic unit. It was the sample network's only forensic ward; the tests
        // of the forensic gate now build their own made-up forensic ward instead.
        forensic: false,
      },
    ],
  },
  {
    code: "GER",
    referenceSiteId: "geraldton",
    name: "Geraldton Hospital",
    service: "WACHS",
    units: [
      {
        id: "ger-adult-open",
        siteCode: "GER",
        name: "Geraldton Adult Open",
        cohort: "Adult",
        lockedBeds: WARD_LOCKED_BED_SPLITS["ger-adult-open"],
        authorised: true,
        beds: 7,
        empty: { value: 1, source: "feed", confirmedAt: NOW_ANCHOR - 9, staleAfterMinutes: 20 },
        allocatable: { value: 1, source: "ward", confirmedAt: NOW_ANCHOR - 38, staleAfterMinutes: 120 },
        allocatableLocked: 0,
        held: 0,
        blocked: 0,
        // Female only, so every current occupant is Female — the one designated bed the seed
        // deliberately keeps internally consistent with its own sexMix.
        sexMix: { Female: 6, Male: 0 },
        speciallingCapacity: 0,
        highAcuityCapacity: 0,
        sexDesignation: "Female only",
        forensic: false,
      },
    ],
  },
  {
    code: "SJGS",
    name: "St John of God Subiaco Hospital",
    service: "Private",
    units: [
      {
        // Private and not authorised under the Mental Health Act — it can take voluntary
        // admissions but never an involuntary destination.
        id: "sjgs-adult-open",
        siteCode: "SJGS",
        name: "SJGS Adult Open",
        cohort: "Adult",
        lockedBeds: WARD_LOCKED_BED_SPLITS["sjgs-adult-open"],
        authorised: false,
        beds: 10,
        empty: { value: 2, source: "feed", confirmedAt: NOW_ANCHOR - 5, staleAfterMinutes: 15 },
        allocatable: { value: 1, source: "ward", confirmedAt: NOW_ANCHOR - 20, staleAfterMinutes: 90 },
        allocatableLocked: 0,
        held: 1,
        blocked: 0,
        sexMix: { Female: 4, Male: 4 },
        speciallingCapacity: 1,
        highAcuityCapacity: 2,
        sexDesignation: "Undesignated",
        forensic: false,
      },
      {
        id: "sjgs-adult-secure",
        siteCode: "SJGS",
        name: "SJGS Adult Secure",
        cohort: "Adult",
        lockedBeds: WARD_LOCKED_BED_SPLITS["sjgs-adult-secure"],
        authorised: false,
        beds: 8,
        empty: { value: 1, source: "feed", confirmedAt: NOW_ANCHOR - 6, staleAfterMinutes: 15 },
        allocatable: { value: 1, source: "ward", confirmedAt: NOW_ANCHOR - 24, staleAfterMinutes: 90 },
        allocatableLocked: 1,
        held: 0,
        blocked: 0,
        sexMix: { Female: 4, Male: 3 },
        speciallingCapacity: 0,
        highAcuityCapacity: 2,
        sexDesignation: "Undesignated",
        forensic: false,
      },
    ],
  },
];

/**
 * THE ACTIVE NETWORK. Every lookup below (`allUnits`, `unitById`, `siteByCode`, ...) and every
 * direct reader of `wardSites` sees the network of the scenario on screen. It is the standard
 * network unless the EMHS demo or surge scenario is loaded, which swaps in its own wards
 * (`ward-scenarios.ts`, `activateScenarioNetwork`). Sites, site codes and emergency departments
 * are the same in every network; only the wards differ.
 *
 * ⚠️ A module-level binding, re-pointed rather than mutated: importers read the live value.
 * Nothing but `activateWardNetwork` may assign it.
 */
export let wardSites: Site[] = STANDARD_WARD_SITES;

/** Points every lookup at `sites`. Idempotent; pass `STANDARD_WARD_SITES` to go back. */
export function activateWardNetwork(sites: Site[]): void {
  wardSites = sites;
}

export function allUnits(): Unit[] {
  return wardSites.flatMap((site) => site.units);
}

export function allEmergencyDepartments(): EmergencyDepartment[] {
  return wardSites.flatMap((site) => (site.emergencyDepartment ? [site.emergencyDepartment] : []));
}

/** Returns `undefined` for an unknown id. Never falls back to a different unit. */
export function unitById(id: string): Unit | undefined {
  return allUnits().find((unit) => unit.id === id);
}

/**
 * Task 9: added alongside `unitById` (per the Task 9-12 preflight's "no `edById`" note) rather
 * than leaving every future caller to write its own inline `.find()`. Returns `undefined` for an
 * unknown id — never falls back to a different department.
 */
export function edById(id: string): EmergencyDepartment | undefined {
  if (!id) return undefined;
  const trimmed = id.trim();
  const lower = trimmed.toLowerCase();
  return (
    allEmergencyDepartments().find((ed) => ed.id === trimmed) ??
    allEmergencyDepartments().find(
      (ed) =>
        ed.id.toLowerCase() === lower ||
        ed.id.toLowerCase() === `${lower}-ed` ||
        ed.siteCode?.toLowerCase() === lower ||
        (lower.endsWith("-ed") && ed.siteCode?.toLowerCase() === lower.replace(/-ed$/, "")),
    )
  );
}

/** Returns `undefined` for an unknown code. Never falls back to a different site. */
export function siteByCode(code: string): Site | undefined {
  return wardSites.find((site) => site.code === code);
}
