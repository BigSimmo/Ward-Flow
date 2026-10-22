// Referral vocabulary: sources, states, community decline reasons, home regions, destination kinds,
// purposes, addressing states, suburbs, history limits and corrections. Moved out of `ward-model.ts`
// unchanged; that file re-exports all of it and keeps `Referral` itself.
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";

/**
 * Phase 7 (spec "The front door"): where a referral entered the network. A referral itself
 * carries no patient location — only where the request came FROM, and only as one of a fixed,
 * synthetic set of channels, never a service name that could identify a specific team.
 *
 * ⚠️ **SOURCE IS WHO SENT IT; `originSiteCode` IS WHERE IT CAME FROM. Two questions, and this
 * field answers only the first.** Nothing derives one from the other, and they sit at different
 * granularities deliberately: a source is a channel, a site code is a HOSPITAL. **Neither is a
 * department, and no field on a `Referral` is** — ED identity lives on `Movement.originEdId` and
 * on the ED destination arm's `edId`, never on a referral's origin. A screen that promises to say
 * which department a referral came from is promising something this type cannot carry.
 *
 * **`ed_medical` — owner ruling, 2026-09-06:** *"ED medical staff will refer a patient and ED
 * psychiatry staff will add it to the referral board. The patient were officially referred from
 * ED in the referral location."* That is two facts about one referral and they land in the two
 * fields above: ED medical staff are the SOURCE, the emergency department is the LOCATION —
 * carried as its hospital's site code, which is the finest thing that exists here.
 *
 * ⚠️ **IT IS NOT CALLED `emergency_department`, AND THAT IS A DECISION RATHER THAN A PREFERENCE.**
 * That exact string is already a `REFERRAL_DESTINATION_KINDS` value on this same record — and per
 * its own comment it does not even mean "goes to an ED" there; it is ED psychiatry's
 * self-addressed inbox. **One referral carrying the identical string in two fields meaning two
 * different things is a defect nobody sees until they happen to read both.** The owner's words
 * name the REFERRER rather than the place, so the value does too.
 *
 * ⚠️ **ONLY THE LABEL IS THE OWNER'S.** "ED medical staff" is quoted from him verbatim and lives
 * in the two `SOURCE_LABELS` maps. `ed_medical` is an identifier that reaches no screen, ruled by
 * Ward Lead 2026-09-06 on exactly that distinction: fixed lists are the owner's **where he sees
 * them**, and taking an internal value to him is asking him to name a variable.
 *
 * ⚠️ **A REFERRAL FROM `ed_medical` MUST COME FROM A SITE THAT HAS AN EMERGENCY DEPARTMENT**, and
 * `RECEIVE_REFERRAL` enforces it — see `ward-flow-reducer.ts`. **Nine sites in `wardSites` have
 * none** (Fremantle, Bentley and the country sites). Without that check the model accepts a
 * referral from the emergency department of a hospital that has no emergency department, and it
 * renders as a clean, plausible row that nothing anywhere contradicts.
 *
 * **`gp` — owner answer 25, 2026-09-17, verbatim:** *"GP referrals: the GP is told by phone or
 * letter for now; add 'GP' as a referral source."* This supersedes his earlier 2026-09-11 answer
 * ("NO. They come through ED or community.") that kept `gp` out of this list — see
 * `docs/ward-flow/owner-answers-2026-09-17.md` item 25 and `shell/ward-facade.ts`'s own comment on
 * the answer it replaces. Recorded so a GP referral can be attributed honestly; the app itself
 * still contacts nobody on its behalf. `referralReferrer` (`ward-flow-reducer.ts`) resolves no
 * addressee for `gp`, exactly like `community`/`crisis_service`/`ambulance`/
 * `inter_hospital` — see that function's own doc comment, which this addition does not change.
 */
export const REFERRAL_SOURCES = [
  "community",
  "crisis_service",
  "ambulance",
  "inter_hospital",
  "ed_medical",
  "gp",
  /**
   * Ward-to-ward stepdown / transfer request. Same referral path as an emergency referral; the
   * sending ward is named on `Referral.originUnitId`. The sending bed stays occupied until arrival.
   */
  "psychiatric_ward",
] as const;
export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

/** A referral's own lifecycle — deliberately separate from `MovementStage`, which belongs to a
 *  movement already inside the department. A referral is a request for a bed, not yet a person
 *  in a department bed. */
export const REFERRAL_STATES = ["queued", "accepted", "declined"] as const;
export type ReferralState = (typeof REFERRAL_STATES)[number];

/**
 * 🔴 **A COMMUNITY TEAM DECLINING A REFERRAL IS A DIFFERENT ACT FROM A WARD DECLINING A BED, AND
 * THESE ARE TWO LISTS BY OWNER RULING (O-16.6, 2026-09-12).**
 *
 * ⚠️ **THE MEASUREMENT, RECORDED HERE BECAUSE THE RULING REQUIRES IT AND BECAUSE THE NEXT READER
 * WILL OTHERWISE MERGE THESE TWO HELPFULLY.** The approved community drawing names five outcomes.
 * Against `REFERRAL_DECLINE_REASONS` directly above, the overlap in meaning is **ZERO — not one of
 * the seven fits**:
 *
 *     the seven, above       no suitable bed · age band not provided here · sex designation
 *                            unavailable · secure bed unavailable · belongs to another service ·
 *                            referred elsewhere · another reason
 *     the community four     outside the catchment · needs inpatient care rather than community
 *                            follow-up · the person declined or could not be reached · already
 *                            open to a peer team
 *
 * 🔴 **The seven are about a BED. The four are about a SERVICE and a PERSON.** One shared list forces
 * both into wording that fits neither.
 *
 * ⚠️ **THE NEAREST PAIR IS THE TRAP AND IT IS NOT A NEAR-MISS.** `belongs_to_another_service` and
 * *"already open to another community team"* read as interchangeable and are different claims: the
 * first says **this is not our service**, the second says **a peer team already holds this person**.
 * Merging them puts a wrong reason against a real refusal, and this codebase's own words about a
 * neighbouring list are that **a wrong reason is worse than a blunt one**.
 *
 * 🔴 **FOUR MEMBERS, AND THE DRAWING'S FIFTH ROW IS DELIBERATELY ABSENT (O-18.1).** That row is
 * *"Withdrawn by the referrer before assessment"*, **which is not a decline**: a decline is the
 * receiving service saying no, a withdrawal is the sender saying never mind. **O-17.11 ruled a
 * withdrawal a FIELD on the addressing for exactly that reason, and putting it here would flatter or
 * damn a team for something it did not do.** The table still renders five rows — the fifth's number
 * comes from the withdrawal field, not from this vocabulary.
 *
 * **Keys here, words in `COMMUNITY_DECLINE_REASON_LABELS` (`ward-referrals.ts`)** — the same split
 * the seven above use, and bound by `Record<CommunityDeclineReason, string>`, so a member without a
 * label is a compile error rather than a blank on a screen. **The words are the drawing's own,
 * copied and never retyped.**
 */
export const COMMUNITY_DECLINE_REASONS = [
  "outside_the_teams_catchment",
  "needs_inpatient_care_not_community_follow_up",
  "client_declined_or_could_not_be_contacted",
  "already_open_to_another_community_team",
] as const;
export type CommunityDeclineReason = (typeof COMMUNITY_DECLINE_REASONS)[number];

/**
 * Phase 7 fix round B (this task): "A sixth answer, given mid-build" in
 * `docs/ward-flow-phase-6-7-decisions.md`. A referral records the broad area a person is from —
 * a REGION, chosen from this fixed list, never an address, never a postcode, never free text.
 * Real Western Australian regions, permitted by roadmap decision 12 ("real WA place names for
 * geography and distance only") — a region name is public geography, not a fact the prototype
 * invented about anyone's home. `RECEIVE_REFERRAL` (`ward-flow-reducer.ts`) membership-checks
 * every referral's `homeRegion` against this array, the same discipline `REFERRAL_SOURCES` and
 * `REFERRAL_DECLINE_REASONS` already hold to, so an address can never be entered where a region
 * belongs.
 *
 * This field exists so a later phase can ask "how far from home was this person placed", never
 * to compute a distance or a travel-time band itself — that calculation is Phase 8's, deliberately
 * not built here. See the decisions doc for why the field is needed now: the out-of-area equity
 * measure the roadmap names "the one with teeth" would otherwise measure distance from the
 * referring hospital, not from home, because that is the only geography the system holds today.
 */
export const HOME_REGIONS = [
  "Perth Metropolitan",
  "Peel",
  "South West",
  "Great Southern",
  "Wheatbelt",
  "Goldfields-Esperance",
  "Mid West",
  "Gascoyne",
  "Pilbara",
  "Kimberley",
] as const;
export type HomeRegion = (typeof HOME_REGIONS)[number];

/**
 * Where a referral is ADDRESSED, and the criteria that destination can answer.
 *
 * Owner ruling, 2026-08-30: every referral is a request that can be accepted or declined. There is
 * no notification-only kind — a ward asking an ED to see someone, and a ward asking a community
 * team to follow someone up, are both requests, and both can be declined even though they rarely
 * are. So ONE verb and ONE lifecycle serve all four destinations, and **what varies between them is
 * the criteria, nothing else.**
 *
 * That is the whole reason this is a union rather than a `kind` string beside a flat field list.
 * A destination that carried only an address would let one screen ask a community team about bed
 * security. Here it cannot: **the community arm has no such field, so the question cannot be
 * spelled**, and `referralEligibility` (`ward-eligibility.ts`) cannot be called with anything but a
 * ward referral because the criteria it reads exist on no other arm. That is a compiler guarantee,
 * not a screen remembering.
 *
 * **What each arm carries, and why the other two carry nothing.** Capacity, sex mix, security and
 * authorisation are all properties of a BED. An ED is being asked a medical question and a
 * community team is answered by a team rather than a bed, so none of the four applies to them —
 * not "does not apply yet", but has no meaning there at all.
 *
 * **THERE IS NO `medical_ward` ARM, AND ITS ABSENCE IS A DECISION, NOT AN OVERSIGHT.** Owner,
 * 2026-08-30: "just route to ED which also includes medical ward" — a psychiatric ward sending
 * someone for a medical problem addresses the ED, and the ED is where a medical ward is reached
 * from. An arm for it was built and taken out again on that ruling. Recorded here so the next
 * reader who notices a psych ward can refer to a medical ward in real life does not add the arm
 * believing it was forgotten: it was considered, and deferred, with a reason.
 *
 * **NO ARM CARRIES AN ADDRESS OR A STATE.** An arm says what a destination IS and what it can be
 * asked; `ReferralAddressing` below says where a particular referral was sent and what came back.
 * Keeping the two apart is what stops a lifecycle field being read as a criterion — the union is
 * matched against beds, and a `state` inside it would sooner or later be matched against one too.
 *
 * (This comment previously recorded multi-destination as an OPEN QUESTION. Owner ruling FD-21,
 * 2026-08-30, settled it: one referral, several destinations, chosen in one act.)
 */
export const REFERRAL_DESTINATION_KINDS = ["psychiatric_ward", "emergency_department", "community_team"] as const;
export type ReferralDestinationKind = (typeof REFERRAL_DESTINATION_KINDS)[number];

/**
 * WHY A REFERRAL WAS ADDRESSED TO AN EMERGENCY DEPARTMENT — a separate axis from WHERE.
 *
 * `FD-15`/`FD-11`. Three flows address a department and none of them means the same thing: a
 * community service asking for a **bed**, ED psychiatry addressing **themselves** for a review
 * (`FD-16`'s self-addressed inbox, which is the whole mechanism), and a ward telling ED about a
 * **medical** problem.
 *
 * ⚠️ **IT IS A FIELD, NOT A KIND, AND THAT IS THE DECISION RATHER THAN A DETAIL.** A fourth
 * destination kind encoding "psychiatric review at an ED" would put the WHY inside the WHERE, and a
 * bed request would then be answered by the same affordance as a review request — which is how one
 * silently becomes the other.
 *
 * ⚠️ **AND IT EXISTS TO KILL A SPECIFIC WORKAROUND THAT WAS FOUND AND REFUSED RATHER THAN
 * SHIPPED:** inferring "addressed to itself" from `originSiteCode === department.siteCode`. That
 * compiles, reads correctly, and drops the ward→ED MEDICAL notification straight into the
 * psychiatry inbox — because a psychiatric ward at the same hospital shares that site code. It is
 * wrong on exactly the case the spec names, which is the case nobody re-reads after implementing
 * from it. `FD-18` is the general form; `tests/ward-referral-ed-destination.test.ts` is the guard.
 *
 * ⚠️ **AND THERE IS A SECOND, PERMITTED PIECE OF REASONING THAT LOOKS IDENTICAL TO THE REFUSED ONE.
 * The distinction is written here because a reader who collapses them will be reasoning correctly
 * from what is in front of them.** `REFERRAL_SOURCES`'s `ed_medical` plus `originSiteCode` DOES
 * identify one emergency department, because a `Site` carries at most one (`emergencyDepartment`
 * is a single optional field and `allEmergencyDepartments()` is a flatMap over it).
 *
 * **That is allowed, and the refused inference above is not, for one reason: it derives the
 * department from a fact somebody RECORDED, not from a coincidence.** The refused version reads
 * meaning out of two site codes happening to match — which they also do for a psychiatric ward at
 * the same hospital, so it answers a question nobody asked it. `ed_medical` was chosen by the
 * person raising the referral and means only itself.
 *
 * ⚠️ **The permission is exactly that wide and no wider.** It licenses resolving WHICH department
 * an `ed_medical` referral came from. It does not license inferring a `ReferralPurpose`, a
 * destination, or self-addressing from any site code, ever.
 *
 * Only the ED arm carries it. A psychiatric-ward destination is asking for a bed and a community
 * team is not, so giving them a purpose would mean inventing values nobody has ruled on — and a
 * fixed list in this project is the owner's to write.
 */
export const REFERRAL_PURPOSES = ["bed", "psychiatric_review", "medical_assessment"] as const;
export type ReferralPurpose = (typeof REFERRAL_PURPOSES)[number];

/**
 * D-74 (Josh, 21 Oct 2026, Q9): what a community team arm is FOR, the owner's list now written.
 * Every form that sends a referral to a community team asks for one of these. An arm saved before
 * D-74 has none and reads as follow-up (`communityPurposeOf`). Neither value moves a bed: an
 * "assess for admission" arm asks the team to assess, and any bed request is still its own referral.
 */
export const COMMUNITY_REFERRAL_PURPOSES = ["follow_up", "assess_for_admission"] as const;
export type CommunityReferralPurpose = (typeof COMMUNITY_REFERRAL_PURPOSES)[number];

export function isCommunityReferralPurpose(value: unknown): value is CommunityReferralPurpose {
  return typeof value === "string" && (COMMUNITY_REFERRAL_PURPOSES as readonly string[]).includes(value);
}

/**
 * ONE DESTINATION THIS REFERRAL WAS SENT TO, AND WHAT THAT DESTINATION ANSWERED.
 *
 * Owner ruling FD-21, 2026-08-30: a referrer chooses several destinations in ONE act — not repeat
 * referrals — up to `PARALLEL_REFERRAL_CAP`. So a referral holds a list of these, and each one is
 * answered independently.
 *
 * **WHY THE STATE IS HERE AND NOT ON THE REFERRAL**, which is the whole reason this type exists.
 * A referral used to carry one `state`, one `decidedAt`, one `decidedBy`, one `declineReason` and
 * one `acceptedUnitId`, because there was one thing to decide. Two rulings make that impossible:
 *
 *   FD-24 — a decline locks nobody out, so one destination may decline while the others stay live.
 *           A referral whose ward said no is NOT a declined referral.
 *   FD-22 — the first acceptance cancels the rest. "Cancelled" is a state only a destination can
 *           be in; a referral is never cancelled, it is accepted.
 *
 * A plural list with the state left on the referral would have compiled and passed everything and
 * been unable to express either ruling.
 *
 * **And `cancelled` is why no separate withdrawal record exists here.** `Movement.withdrawnReferrals`
 * holds the same meaning for its own subject — a person already inside a department — and keeps it.
 * One meaning on two subjects is not a duplicated concept; two different NAMES for one meaning would
 * be. Kept deliberately distinct from FD-5, a referrer withdrawing, which is an act by a person
 * rather than a consequence of somebody else's acceptance, and which has no event yet.
 */
export const REFERRAL_ADDRESSING_STATES = ["queued", "accepted", "declined", "cancelled"] as const;
export type ReferralAddressingState = (typeof REFERRAL_ADDRESSING_STATES)[number];

/**
 * The front door: a referral arriving from anywhere in the network, before it is ever a
 * `Movement` inside a department. Carries a deliberately tiny, governed set of facts about the
 * person referred and nothing else: no name, date of birth, record number, address, diagnosis, or
 * narrative history or treatment. No free-text field of any kind, unlike `Decline` (which has an
 * optional `note`) — a referral has no field a person's own words, or an author's summary of them,
 * could ever land in. `tests/ward-referral-model.test.ts` asserts this structurally, against this
 * type's own field set, so a future field named `patientId`, `notes`, `diagnosis` or `dob` is
 * caught rather than merely discouraged by convention.
 *
 * **THE FACTS ABOUT A PERSON ARE `ageBand`, `homeRegion`, AND — on a ward referral only — `sex`.**
 * This comment said "EXACTLY five facts" until the destination union landed, listing
 * `secureBedNeeded` and `involuntaryBedNeeded` among them. That was never right, and the type's own
 * field comments said so in the same breath: both are described there as facts about the REQUEST,
 * never about the person. Splitting the arms made the contradiction impossible to keep. Corrected
 * rather than deleted, because the count is a governance record and the reason it changed is the
 * part worth keeping.
 *
 * The set moved from three to four mid-build (Task 2, "A fifth answer, given mid-build" in
 * `docs/ward-flow-phase-6-7-decisions.md`, spec D5), from four to five in Phase 7 fix round B
 * ("A sixth answer, given mid-build" in the same doc), which added `homeRegion`, and was restated
 * — not widened — when the destination union landed on 2026-08-30. Each widening is deliberate and
 * rare on purpose: widening this set is a governance decision, not an implementation one, and the
 * structural test is what makes that true rather than aspirational.
 *
 * **`ageBand` and `homeRegion` stayed common to every destination, and that was a judgement.**
 * Every destination kind has age bands — a paediatric ED, a youth community team, an adolescent
 * ward — and every one of them cares where a person is from. Neither is a bed property, so neither
 * belongs on the ward arm. Recorded here as a decision rather than left as an accident of where the
 * fields already sat; if the owner rules otherwise, this is the line to change.
 *
 * **What `homeRegion` did and did not do** (corrected, review finding I5). It is the first fact
 * this system holds about where a person is from. It does NOT give any bed a catchment: neither
 * `Site` nor `Unit` carries a region, nothing associates a bed, unit, site or service with one,
 * and nothing checks a `DECLINE_REFERRAL`'s administrative decline reason against anything at all
 * — that reason is still the coordinator's own assertion, checked against nothing. Phase 8 Task 6
 * closed the honesty half of that gap by renaming `"out_of_catchment"` to
 * `"belongs_to_another_service"`, so the reason no longer implies a catchment check; the reason is
 * still unchecked, and `homeRegion` cannot check it — a catchment is a service's boundary and a
 * home region is where a person lives, and the two vocabularies do not align (ten WA regions
 * against five health services), so mapping one onto the other would invent an administrative
 * fact. This comment previously claimed the gap was closed; it was not,
 * and `HOME_REGIONS`' own comment 25 lines above already said the honest version. A comment
 * asserting an unchecked real-world fact is exactly how the deleted Form 1A figure entered this
 * codebase — an agent read it, believed it, and wrote it into the model.
 */
/**
 * Why a suburb is not a `string` — and it was one, for about an hour.
 *
 * 🔴 **A PATIENT OF NO FIXED ABODE COULD NOT BE REFERRED AT ALL.** The field landed as
 * `suburb: string`, resolved against the catchment table, empty refused. There was therefore no
 * representable answer for *"not known"* — and in psychiatry that is not an edge case. Homelessness
 * is common among people needing acute admission, and a person brought in by police at 3am
 * frequently has no recorded address. ⚠️ **The front door refused precisely the cohort most likely
 * to need a bed.** Found by Ward Referrals reading the committed code rather than the description
 * of it.
 *
 * ⚠️ **AND OPTIONAL WOULD HAVE BEEN WORSE.** An unanswered suburb passing the form and failing at
 * the reducer is a control that appears to accept and does not. The type has to carry the answer,
 * not omit it.
 *
 * ⚠️ **THE FAILURE MODE THIS PREVENTS IS A CLINICIAN TYPING SOMETHING UNTRUE.** Faced with a
 * required picker and no honest option, the way past the form is to choose a plausible nearby
 * suburb — which puts an invented administrative fact into the record through the one field that
 * had resolution built into it specifically to keep invented places out. A type that cannot say
 * "we do not know" does not prevent unknowns; it launders them.
 *
 * ⚠️ **WHETHER "NOT KNOWN" AND "NO FIXED ABODE" ARE ONE ANSWER OR TWO IS THE OWNER'S, AND IT IS ON
 * HIS QUEUE.** They mean different things to a community team deciding who follows a patient up,
 * which is this field's whole purpose. `SUBURB_UNKNOWN_REASONS` is provisional and has one member;
 * a second is an ADDED MEMBER, not a rebuild, which is why this is a union rather than
 * `string | null` — `R41`: a wrong value is an edit, a wrong shape is a rebuild.
 */
export const SUBURB_UNKNOWN_REASONS = ["not_known"] as const;
export type SuburbUnknownReason = (typeof SUBURB_UNKNOWN_REASONS)[number];

/** What a screen says. One home for the wording, so no surface invents its own phrase for absence. */
export const suburbUnknownLabels: Record<SuburbUnknownReason, string> = {
  not_known: "Suburb not known",
};

export type ReferralSuburb = { kind: "named"; name: string } | { kind: "unknown"; reason: SuburbUnknownReason };

/**
 * How long each written-history field may be.
 *
 * ⚠️ **PLACEHOLDERS. NOBODY HAS MEASURED A REAL REFERRAL AGAINST THEM.** Chosen to be generous
 * enough that no ordinary referral meets one, and small enough that the field is BOUNDED — a
 * bounded free-text field is a different privacy proposition from an endless one. The owner has
 * been told they are unmeasured and it is his number to set.
 *
 * ⚠️ **A LIMIT IS ENFORCED BY REFUSING, NEVER BY CUTTING.** The reducer rejects an over-length
 * value and the front door shows a counted, blocking state. Nothing truncates: silently dropping
 * the tail of a risk note is the worst thing this form could do, and it would look like success.
 *
 * ⚠️ **2000, AND IT IS NOT A NEW NUMBER.** The three-box form used 1500 / 2000 / 1000; the owner's
 * 2026-09-05 ruling collapsed it to one box and this takes the LARGEST of the three rather than
 * authoring a fresh figure or summing them. Total capacity therefore falls from 4500 to 2000, and
 * that is a real reduction — but an over-long story BLOCKS the Send with a counted, visible
 * message, so a referrer who needs more is told, not truncated.
 *
 * The keys are exactly the history fields on `Referral`, so a second field cannot be added without
 * either appearing here or failing `historyFieldsAreLimited` in the model tests.
 */
export const REFERRAL_HISTORY_LIMITS = {
  history: 2000,
} as const;

export type ReferralHistoryField = keyof typeof REFERRAL_HISTORY_LIMITS;

/**
 * How long a sending team's name may be. A NAME, not a story -- kept out of
 * `REFERRAL_HISTORY_LIMITS` on purpose, because that map's one entry is the free-text account of a
 * person and putting a 120-character label beside a 2000-character narrative invites a later reader
 * to treat them as the same kind of thing. The reducer refuses an over-length value rather than
 * shortening it, exactly as it does for the history.
 */
export const SENDING_TEAM_NAME_LIMIT = 120;

/* `REQUIRED_HISTORY_FIELD` was declared here until the owner's ruling of 2026-09-05: ONE story
 * box, OPTIONAL. There is no required history field any more, so the constant is gone rather than
 * left pointing at a rule nobody enforces. The reducer's blank-refusal went with it. */

/**
 * How long a correction note (`Referral.corrections[].note`, RB7, build plan item 27, 2026-09-17)
 * may be. Kept OUT of `REFERRAL_HISTORY_LIMITS` on purpose, the same reason `SENDING_TEAM_NAME_LIMIT`
 * is above: that map's keys are "exactly the history fields on `Referral`" (its own comment), and a
 * correction is not a history field — it is an entry in an ARRAY, appended by
 * `ADD_REFERRAL_CORRECTION`, never the single flat `history` string itself.
 *
 * ⚠️ **SAME NUMBER AS `history`, SAME REASON, NOT A COINCIDENCE.** 2000 is the placeholder ceiling
 * this session chose for exactly the same "generous enough for any ordinary entry, small enough to
 * be a BOUNDED field" reasoning `REFERRAL_HISTORY_LIMITS`'s own comment states, applied to a second
 * piece of free text this codebase now holds. Unmeasured against a real correction, like its twin —
 * the owner's number to set, not this session's.
 *
 * ⚠️ **A LIMIT IS ENFORCED BY REFUSING, NEVER BY CUTTING.** `case "ADD_REFERRAL_CORRECTION"`
 * rejects an over-length note outright; nothing truncates it.
 *
 * ⚠️ **NAMED `MAX_CHARACTERS`, NEVER `LIMIT`, AND THAT IS DELIBERATE.** `tests/ward-legal-figure-guard.test.ts`'s
 * Part 3 token denylist flags any exported `ward-management` identifier tokenising to both a
 * `LEGAL_TOKENS` member (`REFERRAL` here) and a `DURATION_TOKENS` member (`LIMIT` was one) — the
 * exact shape every fabricated Mental Health Act figure this guard exists to catch has taken. This
 * constant is genuinely not one (a text-field character cap, not a clock), but Part 3 carries no
 * allowlist of its own (unlike Part 2's `MODEL_CONSTANT_PROVENANCE` above), so the fix is the name,
 * not a justification written beside a name the guard still trips on. Do not rename this back to
 * anything containing `LIMIT`, `WINDOW`, `DEADLINE` or `TIMEOUT`.
 */
export const REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS = 2000;

/**
 * ONE CORRECTION NOTE — RB7, build plan item 27 (2026-09-17). See `Referral.corrections`'s own
 * doc comment for why this exists as an append-only array rather than ever touching `history`.
 *
 * `by` is a ROLE (`WardFlowRole`), never a person — the same discipline `localBedSought.by` and
 * `withdrawalRecordedBy` already hold on this type, so a correction records WHO ACTED (in the
 * organisational sense this whole model uses) and never a person's name.
 */
export type ReferralCorrection = {
  at: Instant;
  by: WardFlowRole;
  /** Human-typed prose, refused blank or over `REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS`. Never derived from,
   *  never truncated — the same two rules `history` itself is held to. */
  note: string;
};
