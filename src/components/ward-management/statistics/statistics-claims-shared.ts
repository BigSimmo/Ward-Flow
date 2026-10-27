// The claims register's record types, the repository paths it cites and the evidence strings and
// falsifying edits shared between several claims. Split out of `statistics-claims-register.ts`.

/**
 * ⚠️ **THE CHANGE THAT WOULD MAKE A CLAIM FALSE, WRITTEN AS AN EDIT THE TEST CAN ACTUALLY APPLY.**
 *
 * A find/replace pair over `sourceFile` was chosen over the alternatives (an insertion with an
 * anchor, a line number, a structured mutation) for one reason: it is the shape that is simplest to
 * write correctly for every entry, and every other shape is a special case of it. An insertion is
 * `find: "<anchor>"`, `replaceWith: "<anchor> <new line>"`. A deletion is `replaceWith: ""` on the
 * deleted fragment. A rename or a retype is the ordinary case. Nothing else was needed.
 *
 * Both halves are checked by `tests/ward-statistics-claims.test.ts`:
 *
 *   - `find` must appear in `sourceFile` **exactly once**, so an edit whose anchor has itself gone
 *     stale goes red rather than silently applying nothing and passing;
 *   - `replaceWith` must differ from `find`, so a no-op edit cannot be recorded;
 *   - after the replacement, `evidence` must be **ABSENT** from the file.
 *
 * The edit is applied to an in-memory copy. No file is written and nothing is executed.
 */
export type FalsifyingEdit = {
  /**
   * The change to the world this edit stands for, in the register's own words — what would have to
   * become true of the system for the claim to be false. This is the half no machine can check, so
   * it is where honesty is spent: if the edit only falsifies PART of the claim, say so here.
   */
  change: string;
  /** An exact substring of `sourceFile` (whitespace-collapsed), which must appear there exactly once. */
  find: string;
  /** What `find` becomes. Must differ from `find`, and the result must no longer contain `evidence`. */
  replaceWith: string;
};

export type ModelClaim = {
  /** Unique. Reads `<surface>/<where on it>/<what is claimed>`, so a red names a place and a fact. */
  id: string;
  /** Repository-relative path of the file that MAKES the claim. One of `REGISTERED_SURFACES` for active claims; retained historically for retired prose. */
  renderedIn: string;
  /**
   * A short locator copied from `renderedIn` — a `data-testid`, or a distinctive fragment where the
   * paragraph has none. Asserted to appear in that file exactly once. Not the claim itself.
   */
  rendered: string;
  /** Removed page prose; its historical claim, evidence and falsifier remain checked. */
  retiredPageProse?: { date: string; reason: string };
  /** What is being claimed, in one line, in the register's own words. Never the page's sentence. */
  claim: string;
  /** Repository-relative path of the file the evidence lives in. */
  sourceFile: string;
  /** An exact substring of `sourceFile`, which must appear there exactly once. */
  evidence: string;
  /**
   * The edit that would make this claim false. Applied in memory by the test, which then asserts
   * `evidence` has gone. A claim whose evidence SURVIVES its own falsifying edit is a claim nothing
   * is guarding, and it goes red naming the claim.
   */
  falsifiedBy: FalsifyingEdit;
};

export const WARD_MODEL = "src/components/ward-management/ward-model.ts";
export const WARD_MODEL_MOVEMENT_PARTS = "src/components/ward-management/ward-model-movement-parts.ts";
// F-17 (26 Oct 2026): `BedRelease` and its word lists moved out of ward-model.ts unchanged.
export const WARD_MODEL_BED_RELEASE = "src/components/ward-management/ward-model-bed-release.ts";
export const WARD_ADMISSIONS = "src/components/ward-management/ward-admissions.ts";
export const WARD_REDUCER = "src/components/ward-management/ward-flow-reducer.ts";
export const WARD_RECORD_EVENTS = "src/components/ward-management/ward-flow-record-events.ts";
export const WARD_PLACEMENT_EVENTS = "src/components/ward-management/ward-flow-placement-events.ts";
export const WARD_BED_EVENTS = "src/components/ward-management/ward-flow-bed-events.ts";
export const WARD_REFERRAL_ANSWER_EVENTS = "src/components/ward-management/ward-flow-referral-answer-events.ts";
export const WARD_STATISTICS = "src/components/ward-management/ward-statistics.ts";
export const WARD_DERIVATIONS = "src/components/ward-management/ward-derivations.ts";
export const WARD_BED_AVAILABILITY = "src/components/ward-management/ward-ready-beds.ts";
export const WARD_REFERRALS = "src/components/ward-management/ward-referrals.ts";
export const WARD_SITES = "src/components/ward-management/ward-sites.ts";
export const WARD_TEAMS = "src/components/ward-management/ward-teams.ts";
export const STATISTICS_SCREEN = "src/components/ward-management/statistics/statistics-screen.tsx";
export const OVERVIEW_SCREEN = "src/components/ward-management/statistics/statistics-overview-screen.tsx";
export const COMPARE_SCREEN = "src/components/ward-management/statistics/statistics-compare-screen.tsx";
export const WARD_STATS_SCREEN = "src/components/ward-management/statistics/statistics-ward-screen.tsx";
export const ED_SCREEN = "src/components/ward-management/statistics/statistics-ed-screen.tsx";
export const DERIVATIONS = "src/components/ward-management/statistics/statistics-derivations.ts";
export const COMMUNITY_INDEX = "src/components/ward-management/community/community-index.tsx";
export const WARD_NAV = "src/components/ward-management/ward-nav.ts";
export const COMMUNITY_DERIVATIONS = "src/components/ward-management/community/community-derivations.ts";
export const COMMUNITY_SCREEN = "src/components/ward-management/community/community-screen.tsx";
/** The team screen's hero section, where its "Other community teams" switcher now lives (the
 *  screen was split into sections on 15 Oct 2026, fix list 2.5 and 9.6). */
export const COMMUNITY_SCREEN_HERO = "src/components/ward-management/community/community-screen-hero.tsx";
export const WARD_FACADE = "src/components/ward-management/shell/ward-facade.ts";
export const DESTINATION_OPTIONS = "src/components/ward-management/referrals/referral-destination-options.ts";

/**
 * The whole `ReferralAddressing` type body, cited as ONE substring on purpose.
 *
 * This is the strongest entry in the register and the one that would have caught the worst of the
 * seven. The claim three screens make is not about a field being present — it is that
 * `acceptedUnitId` is the ONLY field on this record that can name a unit. No single-line citation
 * can witness an "only". Citing the entire body can: any field added, removed or renamed on the
 * record changes this string and every claim standing on it goes red at once. That is the correct
 * blast radius, because a new unit field on this record falsifies all three of them together.
 */
export const REFERRAL_ADDRESSING_BODY =
  'export type ReferralAddressing = { /** Explicitly placed on a recipient waitlist; still awaiting an answer. */ waitlistedAt?: Instant; /** When this specific destination was referred. */ referredAt?: Instant; destination: ReferralDestination; state: ReferralAddressingState; /** When this destination answered, or when acceptance elsewhere cancelled it. */ decidedAt?: Instant; /** A ROLE, never a person — see `WARD_FLOW_ROLE_LABELS`. Absent on a `cancelled` addressing, * because nobody decided it: it is a consequence of an acceptance, not an act. */ decidedBy?: string; /** * Only on a `declined` addressing. From `REFERRAL_DECLINE_REASONS` when `destination.kind` is * `psychiatric_ward` or `emergency_department` (the latter further narrowed to * `ED_DECLINE_REASONS` by convention, never enforced by this type); from * `COMMUNITY_DECLINE_REASONS` when `destination.kind` is `community_team` — O-16.6, community- * decline engine fix, 2026-09-17. `DECLINE_REFERRAL` (`ward-flow-reducer.ts`) holds the two * vocabularies apart at runtime, since this field\'s own type cannot narrow per destination kind — * see that case. */ declineReason?: ReferralDeclineReason | CommunityDeclineReason; /** * Only on an `accepted` addressing, and only from `OVERRIDE_REASONS` — the SAME vocabulary the * three placement events use, deliberately not a second one. Set when the ward accepted a * referral that failed a judgement gate (age, legal status, sex designation, forensic, security, * sex mix), which is permitted with a reason recorded and refused without one. * * ⚠️ Its ABSENCE on an accepted addressing means the referral passed every gate — not that * nobody bothered to type a reason. The reducer refuses the acceptance outright in that case, so * an accepted-and-unreasoned addressing is only ever a clean one. */ acceptOverrideReason?: OverrideReason; /** The unit that accepted. Only ever set on a `psychiatric_ward` addressing — the other three * are answered by a person or a team, and have no unit to name. */ acceptedUnitId?: string; /** FD-5 — when the referrer took this referral back. A FIELD, not a fifth state (O-17.11), and * set on every destination still `queued` at that moment: the referrer takes back the REFERRAL, * not one ward\'s copy of it. A destination that already answered keeps its answer. The reasoning, * and the three same-shaped events it must not be confused with, are on * `RECORD_REFERRER_WITHDRAWAL` (`ward-flow-events.ts`) and in its reducer case. */ withdrawnAt?: Instant; /** The ROLE that wrote it down — never the person who withdrew, who is the referrer and outside * this system. Deliberately not `withdrawnBy`: that name reads as the first and would hold the * second. Like `decidedBy`, see `WARD_FLOW_ROLE_LABELS`. */ withdrawalRecordedBy?: string; /** * Owner ruling 11 (2026-09-17): only set when `RECORD_REFERRER_WITHDRAWAL` withdrew THIS one * destination alone (`destinationKind: "community_team"`), never on a whole-referral withdrawal — * that act carries no reason at all (see that event\'s own doc comment, `ward-flow-events.ts`, for * why). Reuses `WardRequestWithdrawalReason`, the one existing fixed vocabulary for "why a person * took back one destination\'s own live request", rather than a second list for this narrower act. */ withdrawalReason?: WardRequestWithdrawalReason; /** * v10 pass 2 (Josh, 10 Oct 2026, ward Bed board "Place here"): the bed number, 1 to `Unit.beds`, * the accepting ward placed this referral in. Only ever beside `acceptedUnitId`, and only when the * acceptance named a bed (`ACCEPT_REFERRAL.bedNumber`). A fact about the ward\'s act, not the person. */ heldBedNumber?: number; /** Append-only log of evolving clinical reassessments recorded on this destination addressing. */ reassessmentHistory?: ReadonlyArray<ClinicalReassessmentEntry>; reassessmentNote?: string; /** * Smart features idea 3 (19 Oct 2026): when the addressed ward first opened this referral * (`MARK_REFERRAL_OPENED`). Shown to the sender as "Opened by <ward>". A receipt, never an answer: * it does not move `state` and does not stop the decision clock. Only on a `psychiatric_ward` * addressing, and only the first opening is kept. */ openedAt?: Instant; /** * Smart features idea 4 (19 Oct 2026): what the ward asked for before deciding * (`REQUEST_REFERRAL_INFORMATION`), each ticked off by the referrer or the coordinator * (`MARK_REFERRAL_INFORMATION_MET`). Chosen from a fixed list, never typed. Append-only. */ informationNeeds?: ReadonlyArray<ReferralInformationNeedEntry>; /** Fix plan item 16 (D-76): the ROLE that added this ward to an open referral with * `ASK_MORE_WARDS`. Absent on every destination the referrer chose when raising it. */ addedBy?: string; /** Closing-the-loop A: response commitments on this ward copy, oldest first. Never an answer. */ commitments?: ReadonlyArray<ReferralCommitmentEntry>; };';

/**
 * The `psychiatric_ward` destination arm, cited whole — from its `kind` discriminant to the brace
 * that closes it. Two screens say this arm records the bed's criteria "and never a unit"; only the
 * whole arm can witness the "never".
 *
 * ⚠️ **THIS CONSTANT PREVIOUSLY SAID "cited whole" AND WAS NOT.** Until 2026-09-01 the string ran
 * from `sex: Sex;` to `secureBedNeeded: boolean;` — omitting `kind` at one end and
 * `involuntaryBedNeeded` at the other, touching neither boundary of the arm. Adding
 * `preferredUnitId?: string;` left every cited byte in place, so both screens went on saying the arm
 * "carries no unit id of its own" with nothing checking it; deleting `involuntaryBedNeeded`, which
 * the claim NAMES as one of the three criteria, likewise broke nothing. The register asserting a
 * property of its own evidence that its own evidence did not have is this module's defect one level
 * up, and it is the reason `falsifiedBy` exists.
 */
export const WARD_DESTINATION_ARM =
  "kind: \"psychiatric_ward\"; /** Selected recipient. Absent on legacy network-wide requests. */ unitId?: string; /** * Compared to a unit's `sexMix` and `sexDesignation` by equality. A fact about the person, * and the ONLY one that sits on an arm rather than on the referral itself \u2014 it is here * because it is read solely to match a bed's designation, and no other destination has one. */ sex: RecordedSex; /** * T10, item 8: the gender recorded at referral \u2014 see `Movement.gender`'s doc comment for * why this is a separate, wider fact from `sex` immediately above and from * `Patient.gender`. Absent means not yet recorded. */ gender?: ReferralGender; /** Whether THIS REQUEST needs a secure bed. Never a fact stored about the person. */ secureBedNeeded: boolean; /** * Whether THIS REQUEST needs a bed that can hold someone involuntarily \u2014 never a fact stored * about the person, and never a legal determination. Same convention as `secureBedNeeded` and * roadmap decision 5's cohort framing: the request needs an adolescent bed, a secure bed, or * here, a bed that can hold someone involuntarily \u2014 the word never attaches to the patient. * Introduces no figure, timeframe or threshold from the Mental Health Act; a plain * Voluntary/Involuntary bed label was already permitted, and this is the same category. */ involuntaryBedNeeded: boolean; /** * Whether THIS REQUEST needs high-acuity nursing. Same convention as the two above: a fact * about the request, never one stored about the person, and never a score, risk or * assessment. **The referring clinician marks it at referral** \u2014 owner ruling 2026-09-10, * chosen over the system working it out. Read only to ask whether a ward is staffed for a * high-acuity place; see the `acuity` gate in `ward-eligibility.ts` for why nothing here * may be turned into a remaining count. */ highAcuityNursingNeeded: boolean;";

/** Shared by both screens that make the ward-destination claim, so both go red together. */
export const WARD_DESTINATION_ARM_GAINS_A_UNIT_ID: FalsifyingEdit = {
  change: "The selected ward recipient is no longer recorded on a named request.",
  find: "/** Selected recipient. Absent on legacy network-wide requests. */ unitId?: string;",
  replaceWith: "",
};

/**
 * The whole `BedRelease` record, cited as ONE substring for the same reason `REFERRAL_ADDRESSING_BODY`
 * is: the claim standing on it is an "only". The statistics home page says the record carries a
 * SINGLE `confirmedAt` rather than one instant per act on the release, and no short citation can
 * witness that — a second instant field arriving anywhere on the record falsifies it, so the whole
 * record is what has to be pinned.
 *
 * ⚠️ **IT USED TO CITE TWO FIELDS.** `preparationNote: BedPreparationNote | null; confirmedAt:
 * Instant;` is a slice, and `preparedAt: Instant | null;` added after `confirmedBy` left it exactly
 * where it was. Four claims away, `REFERRAL_ADDRESSING_BODY` was already doing this correctly.
 */
export const BED_RELEASE_BODY =
  "export type BedRelease = { id: string; unitId: string; /** * THE STAY THIS RELEASE BELONGS TO — " +
  "owner decision, Josh, 25 September 2026: *a bed release is a * named patient's discharge.* " +
  "Required, never null, and always an `Admission.id` on this same * `unitId`. `FLAG_BED_RELEASE` " +
  "refuses to create a release without one. * * It is what makes the free-bed count move exactly " +
  "once. When this admission leaves * (`RECORD_LEAVING` / `RECORD_PATIENT_DISCHARGE`, both through " +
  '`departAdmission`), this release * completes to `"discharged"` in the same write that raises the ' +
  "ward's figures. Before this field * existed, the reducer guessed which departure matched which " +
  "release by comparing ward-wide counts, * with two seeded ids hard-coded as exceptions. * * A " +
  "JOIN KEY, NOT A DISPLAY FIELD. No screen renders it, and no audit record copies it. A bed that * " +
  "comes free for any other reason (cleaning, repairs) is not a `BedRelease` at all. It belongs to " +
  "* the blocked and closed-bed records. */ admissionId: string; state: BedReleaseState; " +
  "expectedAt: Instant; /** * What this discharge is still waiting on, chosen from " +
  '`BED_RELEASE_WAITING_ON`. Non-null only * while `state` is `"expected"` — a confirmed discharge ' +
  "is a decision, not something still * being waited on, and a released one has already happened. * " +
  "* Renamed from `confidence` by the Q1 axis change of 2026-08-28. Keeping the old name over the * " +
  'new values would have put "Awaiting ward round" in a field called `confidence` on a screen a * ' +
  "coordinator reads as fact, which is the kind of quiet mismatch this project treats as a * defect " +
  'rather than a cosmetic point. * * `"Nothing outstanding"` is a legitimate value, not an absence: ' +
  "it means a expected discharge * with no obstacle. `null` means the release is not expected at " +
  "all. The two are different and * must not be collapsed. */ waitingOn: BedReleaseWaitingOn | " +
  "null; /** * **The blocked FLAG's reason** (bed-model rework, 2026-08-28). Non-null means this " +
  'discharge * is decided-or-expected AND currently stuck; it may sit on a `"expected"` release or ' +
  'on a * `"confirmed"` one, and a blocked-but-confirmed release still counts as confirmed. Always ' +
  '* `null` on a `"discharged"` release — once the bed is free there is nothing left being held up. ' +
  "* * Before this rework `blocked` was a fourth STATE and this field was legal only in it, which * " +
  "is what made a stuck confirmed discharge fall out of the ward's confirmed count entirely. * " +
  "Always a `BedReleaseBlocker` — enforced by the type here, and by a membership check against * " +
  "`BED_RELEASE_BLOCKERS` in the reducer. */ blocker: BedReleaseBlocker | null; /** * The role that " +
  "recorded the block, non-null exactly when `blocker` is. A role — a unit or * service label — " +
  "never a personal name, the same discipline `confirmedBy` holds to. Kept * separate from " +
  "`confirmedBy` because the two answer different questions once a block can * outlive a state " +
  "change: `confirmedBy` is who last reported this release's stage, this is who * said it was stuck " +
  "(Q3: provenance stays a role and a timestamp, never a person). */ blockedBy: string | null; /** " +
  "* Q4 of the 2026-08-28 decisions: this bed is being MADE READY (cleaning and the like). * " +
  "**Informational only — it must NEVER gate allocation.** A bed being prepared is still * offered, " +
  "still counts in `availableNow`, and still appears in every figure, because the pull * of the " +
  "next patient takes hours anyway. See `BED_PREPARATION_NOTES` for the full reasoning. */ " +
  "preparing: boolean; /** * What the bed is waiting on to be ready, chosen from " +
  "`BED_PREPARATION_NOTES` — the owner * supplied that list on 2026-08-28, so the field is now " +
  "expressible where it could previously * only be `null`. `null` " +
  'alongside `preparing: true` remains legal and means "being made ready, * reason not stated"; ' +
  '`preparing: false` forces it null, because "not being made ready, waiting * on a clean" is a ' +
  "contradiction. * * **A note here still gates NOTHING.** See `preparing` above and " +
  "`BED_PREPARATION_NOTES`. */ preparationNote: BedPreparationNote | null; confirmedAt: Instant; /** A " +
  "role — a unit or service label. Never a personal name. */ confirmedBy: string; " +
  "/** Reason the most recent discharge blocker was cleared, chosen from `DISCHARGE_DELAY_CLEAR_REASONS`. */ " +
  "lastClearedBlockReason?: DischargeDelayClearReason; " +
  "/** Append-only history of cleared discharge blockers on this bed release. */ " +
  "clearedBlockHistory?: ReadonlyArray<{ readonly at: Instant; readonly by: WardFlowRole; /** Absent when the clearing event named no reason; never defaulted. */ readonly reason?: DischargeDelayClearReason; readonly blocker?: BedReleaseBlocker | null; }>; " +
  "/** * #398 (D-72): the support notices the ward sent for this confirmed release, one per service, * oldest " +
  "first (`SEND_RELEASE_SUPPORT_NOTICE`). About the bed only. Absent until the first. */ supportNoticesSent?: " +
  "ReadonlyArray<{ readonly service: SupportServiceType; readonly at: Instant; readonly by: WardFlowRole; }>; " +
  "} & DischargeLogisticsFields;";

/**
 * The site lookup, cited as its signature AND its body. Two screens claim it returns nothing rather
 * than a fallback when a code matches none, and the RETURN TYPE cannot witness that: `?? siteDirectory[0]`
 * is still assignable to `SiteIdentity | undefined`, so the declared signature is unchanged by exactly the
 * edit that makes the claim false. The `.find(...)` expression is what has to move.
 */
export const SITE_BY_CODE_LOOKUP =
  "/** Returns `undefined` for an unknown code. Never falls back to a different site. The site's " +
  "* identity only: its wards differ by scenario, so read them through the network. */ export " +
  "function siteByCode(code: string): SiteIdentity | undefined { return siteDirectory.find((site) => " +
  "site.code === code); }";

/** Shared by the two screens that make the site-lookup claim, so both go red together. */
export const SITE_BY_CODE_GAINS_A_FALLBACK: FalsifyingEdit = {
  change:
    "The lookup starts substituting a site instead of answering nothing — `?? siteDirectory[0]` — which " +
    "is legal against the unchanged declared return type and is precisely what both screens deny.",
  find: "return siteDirectory.find((site) => site.code === code); }",
  replaceWith: "return siteDirectory.find((site) => site.code === code) ?? siteDirectory[0]; }",
};

/*
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 * FALSIFYING EDITS SHARED BY SEVERAL CLAIMS.
 *
 * Where three screens state the same fact, they cite the same evidence and they should go red
 * TOGETHER when it changes — so they share one edit too. A shared edit also stops the three from
 * drifting into three different accounts of what would make the same fact false.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 */

export const REFERRAL_ADDRESSING_GAINS_A_SECOND_UNIT_ID: FalsifyingEdit = {
  change:
    "A second field on the record can name a unit — `declinedByUnitId` — so `acceptedUnitId` stops being " +
    "the only one, and every screen saying so is wrong at once.",
  // ⚠️ RE-ANCHORED 2026-09-12: FD-5's two new fields moved the closing `};` away from
  // `acceptedUnitId`, so the old anchor (which ended `acceptedUnitId?: string; };`) no longer
  // matched anything. The edit it describes is unchanged — a SECOND field naming a unit — and the
  // claim it falsifies still stands, because neither new field names one.
  find: "and have no unit to name. */ acceptedUnitId?: string;",
  replaceWith: "and have no unit to name. */ acceptedUnitId?: string; declinedByUnitId?: string;",
};

export const ACCEPTANCE_STOPS_RECORDING_THE_UNIT: FalsifyingEdit = {
  change:
    "The acceptance path stops recording which unit accepted, so the reducer no longer writes " +
    "`acceptedUnitId` there. (This falsifies the positive half. The 'and nowhere else' half is an " +
    "absence — a second writer added on the decline path would leave this line untouched.)",
  find: 'accepted = { ...addressing, state: "accepted", acceptedUnitId: unit.id,',
  replaceWith: 'accepted = { ...addressing, state: "accepted",',
};

export const DECLINE_LOSES_ITS_UNIT: FalsifyingEdit = {
  change: "A movement decline stops naming the unit that gave it, so it no longer records a unit id at all.",
  find: "export type Decline = { unitId: string; at: Instant;",
  replaceWith: "export type Decline = { at: Instant;",
};

export const DECLINE_GAINS_FREE_TEXT: FalsifyingEdit = {
  change: "A free-text note arrives on a movement decline, so it no longer carries a reason and nothing else.",
  find: "reason?: DeclineReason; };",
  replaceWith: "reason?: DeclineReason; note: string; };",
};

export const MOVEMENT_STOPS_CARRYING_A_DECLINE_LIST: FalsifyingEdit = {
  change:
    "A movement keeps only its most recent decline instead of a list, so it no longer records every ward " +
    "decline against it.",
  find: "declines: Decline[];",
  replaceWith: "declines: Decline | null;",
};

/** D-76 (23 Oct 2026): the origin department became optional for a journey from a community team. */
export const MOVEMENT_ORIGIN_ED_BECOMES_REQUIRED: FalsifyingEdit = {
  change:
    "The origin department becomes required again — `originEdId: string;` — so no journey can start at a " +
    "community team and every movement names a department.",
  find: "originEdId?: string;",
  replaceWith: "originEdId: string;",
};

export const REFERRED_UNIT_IDS_BECOMES_ONE_ID: FalsifyingEdit = {
  change:
    "The field stops being a list and becomes a single id, so a movement can be live at one ward only and " +
    "the screens' 'not a single id' is false.",
  find: "referredUnitIds: string[];",
  replaceWith: "referredUnitId: string | null;",
};

export const THE_PARALLEL_REFERRAL_CAP_IS_REMOVED: FalsifyingEdit = {
  change: "The cap is removed, so no constant of that name bounds how many wards one movement can be live at.",
  find: "export const PARALLEL_REFERRAL_CAP = 3;",
  replaceWith: "",
};

export const REFERRAL_ID_STOPS_BEING_NULLABLE: FalsifyingEdit = {
  change: "`Admission.referralId` stops being nullable, so a null is no longer a state the record can hold at all.",
  find: "referralId: string | null;",
  replaceWith: "referralId: string;",
};

export const RAISED_AT_STOPS_BEING_REQUIRED: FalsifyingEdit = {
  change: "`Referral.raisedAt` becomes optional, so a referral may carry no instant it was raised.",
  // RE-ANCHORED 2026-09-12, and the claim was re-read before re-pointing rather than after.
  // `Referral.sendingTeamName` landed between `source` and `raisedAt`, so the old adjacency is
  // gone. THE CLAIM ITSELF SURVIVED -- `raisedAt` is still required and still on `Referral`.
  // The neighbour is only here to disambiguate: `raisedAt: Instant;` appears TWICE in the model
  // (`Referral` and one other type), so the bare field would fail the exactly-once rule and
  // could silently come to cite the wrong type.
  find: "sendingTeamName?: string; raisedAt: Instant;",
  replaceWith: "sendingTeamName?: string; raisedAt?: Instant;",
};

export const PREPARING_STOPS_BEING_A_BOOLEAN: FalsifyingEdit = {
  change:
    "Bed readiness stops being a yes/no and becomes a state — `preparing: BedPreparationState;` — so every " +
    "page calling it a boolean is wrong.",
  find: "preparing: boolean;",
  replaceWith: "preparing: BedPreparationState;",
};

/** The whole `EmergencyDepartment` record. The ED screen claims it holds these three and no more. */
export const EMERGENCY_DEPARTMENT_BODY =
  "export type EmergencyDepartment = { id: string; siteCode: string; referenceEdId?: string; name: string; };";

/** The whole `Decline` record. Three screens state its three fields by name. */
export const DECLINE_BODY =
  "export type Decline = { unitId: string; at: Instant; " +
  "/** Absent only on an ED's copy: other wards' decline reasons are the coordinator's (D-80). */ reason?: DeclineReason; };";

/**
 * The two capacity counts on `Unit`, cited as ONE substring with the doc comment that sits between
 * them. The statistics home page quotes both fields' meanings in the reader's own words — "the beds
 * that are physically empty per the feed", "the beds the ward says it can actually allocate" — and
 * that paraphrase is only true while the record says so. Citing the pair together also witnesses
 * their ADJACENCY, which is what makes "both are aggregate counts for the whole ward" checkable:
 * neither carries a bed id, and a per-bed field arriving between them would break this string.
 */
export const UNIT_CAPACITY_COUNTS =
  "empty: CapacityFigure; " +
  "/** Beds the ward says it can actually allocate. Never greater than `empty` in practice. */ " +
  "allocatable: CapacityFigure;";

/**
 * The derived ward-side readiness gap, cited as the two lines that compute it.
 *
 * ⚠️ **THE PAGE DELIBERATELY DOES NOT PRINT THIS FORMULA, AND THE CLAIM IS STILL ABOUT IT.** The
 * "empty but not offered beds" block says the model derives a readiness gap from those two
 * aggregate counts and nothing per-bed; the arithmetic is what makes that true, so the arithmetic
 * is what is cited. Change either line — introduce a bed id, read a third field, stop deriving it —
 * and the claim's evidence goes with it. A citation of the field `Unit.held` would NOT do: that
 * field is authored and read by nothing, so it can change freely without the derived figure moving.
 */
// Owner ruling 13 Oct 2026 (R-B-09 unified): the arithmetic now lives once, in
// `boundedBedAvailability`. H-0978 / WS-15 (26 Oct 2026): it also takes off how many beds the ward
// closed by number (`closedBeds`). It counts those marks and reads no bed or request id.
export const HELD_IS_DERIVED_FROM_TWO_AGGREGATES =
  "const available = isClosed ? 0 : Math.max(0, Math.min(unit.allocatable.value, effectiveEmpty) - closedBeds); " +
  "const held = Math.max(effectiveEmpty - available, 0);";

/**
 * The whole movement-decline vocabulary, cited as one array literal — the strongest shape available
 * and the reason it is written out rather than pointed at by name. The claim the page makes is that
 * every row in its reason table comes from this list and that the row count IS the member count. No
 * single-line citation can witness a membership claim; this one breaks on any member added,
 * removed, renamed or reordered, which is every change that would falsify it.
 *
 * ⚠️ **THIS PROJECT ALREADY PAID FOR THAT ON 2026-09-01.** A task brief written against a pre-merge
 * tree named a member that a rename had since replaced. A table copied from the brief would have
 * been wrong, and a test written from the same brief would have agreed with it.
 */
export const DECLINE_REASONS_LIST =
  'export const DECLINE_REASONS = [ "no_suitable_bed", "age_band_not_provided_here", ' +
  '"sex_designation_unavailable", "secure_bed_unavailable", "belongs_to_another_service", ' +
  '"referred_elsewhere", "specialling_unavailable", "acuity_mix", "capability_mismatch", ' +
  '"bed_pulled_for_earlier_referral", "another_reason", ] as const;';

/**
 * D-78 (Josh, 21 Oct 2026): the referral-side name is now the SAME list as the one above, kept so
 * importers are unchanged. Pinned so a second, separate referral list cannot return in silence.
 */
export const REFERRAL_DECLINE_REASONS_LIST = "export const REFERRAL_DECLINE_REASONS = DECLINE_REASONS;";

/**
 * The two derived properties of a team page, cited as ONE substring so the CONTRAST between them is
 * what goes red.
 *
 * The claim is that a team's name is exactly the string a referral stores — never composed, never
 * prettified. `name,` is the shorthand property, and it IS that claim: the raw string passed
 * through untouched. Compose or prettify it and this line must become `name: something(name)`, so
 * the citation breaks on precisely the change that would make the claim false.
 *
 * The `id:` line above it is cited with it deliberately, because it does the opposite —
 * `communityTeamSlug` transforms, `name` does not. A reader who meets this red sees both halves and
 * can tell which one was supposed to change.
 *
 * ⚠️ **THIS REPLACED A CITATION THAT COULD NOT FAIL** (2026-09-01). The claim used to cite the doc
 * comment beside the field: "Exactly the string a referral stores in `teamName`. Never composed or
 * prettified here." That is prose restating the claim, not code witnessing it. Prettify the name
 * anywhere and the comment sits exactly where it is; the only edit that broke the citation was
 * DELETING the comment, which is the one action that does not make the claim false. The register's
 * own version of the defect it exists to prevent. `tests/ward-statistics-claims.test.ts` now
 * rejects a comment-only citation mechanically, so the shape cannot return unnoticed.
 */
export const COMMUNITY_TEAM_PAGE_DERIVATION =
  "id: communityTeamSlug(name), " + //
  "name, }));";

/**
 * `communityTeamOptions` cited whole — signature, both loops, the tie-break and the return.
 *
 * The claim is that the vocabulary comes from ONE source document, and a "one" is an absence of a
 * second: the citation has to break when a second document's rows are read. It previously stopped
 * at the first `for (const row of S2015_CATCHMENT_ROWS) {`, so a second loop over another table
 * could be added underneath it and every cited byte survived — in a file that already models
 * several documents, which is what makes that a live edit rather than a theoretical one.
 */
export const COMMUNITY_TEAM_VOCABULARY_DERIVATION =
  "export function communityTeamOptions(): readonly string[] { const spellings = new Map<string, " +
  "Map<string, number>>(); for (const row of S2015_CATCHMENT_ROWS) { for (const clinic of " +
  "parseFollowUpClinicSet(row.followUpClinicVerbatim)) { const key = communityTeamKey(clinic); if (key " +
  '=== "") continue; const counts = spellings.get(key) ?? new Map<string, number>(); counts.set(clinic, ' +
  "(counts.get(clinic) ?? 0) + 1); spellings.set(key, counts); } } const chosen = " +
  "[...spellings.values()].map( (counts) => [...counts.entries()].sort((a, b) => b[1] - a[1] || " +
  "a[0].localeCompare(b[0]))[0][0], ); return chosen.sort((a, b) => a.localeCompare(b)); }";

/** The whole `CommunityTeam` record. The community index claims it is `{ id, name }` and nothing else. */
export const COMMUNITY_TEAM_BODY =
  "export type CommunityTeam = { id: string; " +
  "/** Exactly the string a referral stores in `teamName`. Never composed or prettified here. */ name: string; };";
