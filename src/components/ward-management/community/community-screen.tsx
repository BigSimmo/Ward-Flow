"use client";

import { useCallback, useEffect, useState, type Dispatch, type ReactNode } from "react";

import Link from "next/link";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";

import {
  admissionBelongsToTeam,
  admissionsWithNoCommunityTeam,
  communityMembershipResolution,
  communityHubLists,
  communityTeamById,
  COMMUNITY_TEAM_PAGES,
  isAwaitingTeamAnswer,
  leavingDestinationLabel,
  type CommunityTeam,
} from "@/components/ward-management/community/community-derivations";
import {
  ratifiedAliasesFor,
  ratifiedSameServiceNames,
} from "@/components/ward-management/community/community-ratified-aliases";
import {
  communityTeamSuburbCounts,
  nearDuplicateSpellingsOf,
} from "@/components/ward-management/community/community-vocabulary";
import { communityTeamHref } from "@/components/ward-management/shell/ward-facade";
import { applyAppearance } from "@/components/ward-management/shell/ward-bar";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { elapsedDaysPhrase } from "@/components/ward-management/community/community-elapsed";
import { referralWaitLine } from "@/components/ward-management/referrals/referral-wait";
import { withSendingTeam } from "@/components/ward-management/referrals/referral-sending-team";
import { daysInBed, type Admission } from "@/components/ward-management/ward-admissions";
import {
  CANCEL_TRANSPORT_REASONS,
  changeReasonLabels,
  type CancelTransportReason,
} from "@/components/ward-management/ward-change-reasons";
import {
  daysBetween,
  formatInstant,
  formatInstantWithDay,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { transportEtaRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import {
  COHORTS,
  COMMUNITY_DECLINE_REASONS,
  HOME_REGIONS,
  REFERRAL_HISTORY_LIMITS,
  TRANSPORT_LEGAL_STATUSES,
  TRANSPORT_PROVIDERS,
  URGENCY_LEVELS,
  type Cohort,
  type CommunityDeclineReason,
  type HomeRegion,
  type LegalForm,
  type Movement,
  type Referral,
  type ReferralAddressing,
  type TransportLegalStatus,
  type TransportProvider,
  type Unit,
} from "@/components/ward-management/ward-model";
import { COMMUNITY_DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";
import { WardFigure, WardFigureStrip } from "@/components/ward-management/ward-figure";
import {
  contactDecisionFor,
  contactForTeam,
} from "@/components/ward-management/community/community-team-contact-mapping";
import { REFERENCE_TEAM_CAVEAT } from "@/components/ward-management/reference/ward-reference-teams";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { siteByCode, wardSites } from "@/components/ward-management/ward-sites";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import {
  findPatients,
  patientDisplayName,
  type Patient,
  type PatientId,
} from "@/components/ward-management/ward-patients";

import styles from "./community.module.css";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";

/** Said wherever this screen has a heading for a fact that no Ward Flow record holds. */
const NOT_RECORDED_IN_WARD_FLOW = "Not recorded in Ward Flow";

/** Search results shown at once; the rest are reached by typing more of the name or UMRN. */
const SEARCH_RESULT_LIMIT = 8;

/**
 * 🔴 **THE CONFIRM CONTROL IS WIRED — engine fix, 2026-09-17, closing audit finding ISSUE-P1-83
 * (2026-09-16).**
 *
 * Until this fix, `DECLINE_REFERRAL`'s `reason` field was statically typed `ReferralDeclineReason`
 * in `ward-flow-events.ts` — the vocabulary `ward`/`ed` decline with — and the reducer's own
 * membership check was not scoped by destination kind, so a real `CommunityDeclineReason` value
 * would have been refused outright. That is now fixed at the source: `reason` widens to
 * `ReferralDeclineReason | CommunityDeclineReason`, and `DECLINE_REFERRAL`'s own case
 * (`ward-flow-reducer.ts`) checks `event.reason` against `COMMUNITY_DECLINE_REASONS` specifically
 * for a `community_team` destination, refusing a bed-placement reason there just as firmly as it
 * refuses a community reason for a ward or an ED — O-16.6's own ruling that the two vocabularies
 * share zero overlap in meaning, now enforced rather than merely stated.
 *
 * So this control dispatches a REAL `DECLINE_REFERRAL`, with role `"community"` (already permitted
 * — `EVENT_ROLE.DECLINE_REFERRAL` includes it, and the reducer's own `answerableBy` map ties that
 * role to `community_team` destinations only) and a reason drawn from the real community
 * vocabulary. It stays `aria-disabled` — never native `disabled`, so it remains discoverable to a
 * screen reader (the repo's D4 wording) — for exactly as long as no reason is chosen; the same
 * "state a reason before declining" rule `referral-match.tsx`'s own ward and ED controls hold to.
 */
const COMMUNITY_DECLINE_REASON_UNCHOSEN = "Choose the reason this team cannot take this referral before declining it.";
const CANCEL_TRANSPORT_UNCHOSEN = "Choose why the transport job is being cancelled first. The provider is told.";

const ESCORT_ANSWERS = [
  { value: true, label: "Escort required" },
  { value: false, label: "No escort required" },
] as const;

const TRANSPORT_LEGAL_STATUS_LABELS: Record<TransportLegalStatus, string> = {
  voluntary: "Voluntary",
  involuntary: "Involuntary",
};

const NO_TRANSPORT_PROVIDER_VALUE = "";

type TransportDraftState = {
  provider: TransportProvider | undefined;
  escortRequired: boolean | undefined;
  cadNumber: string;
  transportLegalStatus: TransportLegalStatus | undefined;
  estimatedTime: string;
  estimatedDay: "today" | "tomorrow";
};

const BLANK_TRANSPORT_DRAFT: TransportDraftState = {
  provider: undefined,
  escortRequired: undefined,
  cadNumber: "",
  transportLegalStatus: undefined,
  estimatedTime: "",
  estimatedDay: "today",
};

/** Same HH:MM parser the ED booking popup uses — local copy so this screen does not import from ed-screen. */
function minutesFromTimeInput(value: string): number | undefined {
  const parts = value.split(":");
  if (parts.length !== 2) return undefined;
  const [rawHours, rawMinutes] = parts;
  if (rawHours?.length !== 2 || rawMinutes?.length !== 2) return undefined;
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return undefined;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

function instantFromEstimatedTimeInputs(
  timeValue: string,
  day: "today" | "tomorrow",
  now: Instant,
): number | undefined {
  const minuteOfDay = minutesFromTimeInput(timeValue);
  if (minuteOfDay === undefined) return undefined;
  const startOfToday = Math.floor(now / 1440) * 1440;
  return startOfToday + (day === "tomorrow" ? 1440 : 0) + minuteOfDay;
}

function transportAnswersBlockedReason(draft: TransportDraftState, now: Instant): string | undefined {
  const missing: string[] = [];
  if (draft.provider === undefined) missing.push("choose who is collecting the patient");
  if (draft.escortRequired === undefined) missing.push("answer the escort question");
  if (draft.cadNumber.trim().length === 0) missing.push("enter the CAD transport number");
  if (draft.transportLegalStatus === undefined) missing.push("state whether the transport is voluntary or involuntary");
  if (instantFromEstimatedTimeInputs(draft.estimatedTime, draft.estimatedDay, now) === undefined) {
    missing.push("enter the estimated time");
  }
  if (missing.length === 0) return undefined;
  return `Before booking, ${missing.join(", ")}. None is filled in for you: the record has to say that this team decided.`;
}

type ActiveTabType = "tab-triage" | "tab-inpatients" | "tab-expected" | "tab-egress" | "tab-caseload" | "tab-team";

type DrawerType =
  | "px"
  | "pxDrawer"
  | "referral"
  | "referralDrawer"
  | "activity"
  | "activityDrawer"
  | "tasks"
  | "tasksDrawer"
  | "tools"
  | "toolsDrawer"
  | null;
type ModalType = "intake" | "contact" | "handover" | null;
type ServiceFilterType = "east" | "south" | "north" | "all";

/**
 * Clinical contact is the contact itself, not a sent message — team, time, and role only. Wired only
 * when the engine declares `RECORD_CLINICAL_CONTACT`.
 */
function clinicalContactCanSave(): boolean {
  return true;
}

function recordClinicalContact(
  dispatch: Dispatch<WardFlowEvent>,
  now: Instant,
  teamId: string,
): { role: WardFlowRole; at: Instant; teamId: string } | null {
  if (!clinicalContactCanSave()) return null;
  const role: WardFlowRole = "community";
  try {
    dispatch({ type: "RECORD_CLINICAL_CONTACT", role, now, teamId });
  } catch {
    return null;
  }
  return { role, at: now, teamId };
}

function serviceFilterLabel(service: ServiceFilterType): string {
  switch (service) {
    case "east":
      return "East Metropolitan (EMHS)";
    case "south":
      return "South Metropolitan (SMHS)";
    case "north":
      return "North Metropolitan (NMHS)";
    case "all":
      return "All WA Services";
  }
}

type CaseloadFilter = "all" | "5A" | "5B";

type CaseloadRow = {
  key: string;
  referralId: string;
  patientId: PatientId | undefined;
  umrn: string | undefined;
  ageBand: string;
  legalForm: LegalForm | undefined;
  addressingState: ReferralAddressing["state"] | undefined;
};

type IntakeDraft = {
  umrn: string;
  ageBand: Cohort | "";
  homeRegion: HomeRegion | "";
  urgency: "" | "1" | "2" | "3";
  originSiteCode: string;
  history: string;
};

const BLANK_INTAKE_DRAFT: IntakeDraft = {
  umrn: "",
  ageBand: "",
  homeRegion: "",
  urgency: "",
  originSiteCode: "",
  history: "",
};

/**
 * THE COMMUNITY HUB — one community team, and the part of the bed-flow circle it can actually see.
 *
 * The design spec asks for four lists. **This screen builds three of them, states in plain words
 * what the fourth cannot be built from, and says on itself what the three it does build are not.**
 * That is not caution for its own sake: this is the one screen in the prototype whose emptiness is
 * read as a safety statement, and the spec was written before anybody had established that the
 * follow-up fact it turns on — which does exist on the record — is written by nothing and read by
 * nothing.
 *
 * ⚠️ **THE FOUR THINGS THIS SCREEN SAYS ABOUT ITSELF, and why each is on the page rather than in a
 * document.**
 *
 *  1. **Whether follow-up has been arranged IS recorded on the admission, and NOTHING IN THE APP
 *     READS IT.** The spec's list 1 is "discharged, NO FOLLOW-UP ARRANGED".
 *
 *     ⚠️ **THIS PARAGRAPH AND THE SENTENCE IT DESCRIBES BOTH SAID SOMETHING FALSE UNTIL 2026-09-01,
 *     IN BOLD, ON A PAGE WHOSE WHOLE PURPOSE IS BEING BELIEVED.** They said the model held no
 *     follow-up field, event or vocabulary. It does: `Admission.followUp` is a
 *     `FollowUpRecord | null` (`ward-admissions.ts`, around `:452`, and in the field-presence map
 *     around `:484`), `FollowUpRecord` carries a `state`, a `recordedAt` and a `recordedBy` role, the
 *     vocabulary is `FOLLOW_UP_STATES` (`ward-admissions.ts`, around `:159`) =
 *     `["arranged", "not_arranged"]`, and the seed sets a real record on two departed admissions.
 *
 *     What is true — and it is a sharper statement than the false one, not a weaker one — is that
 *     the field has **no producer and no consumer**. No screen, derivation or reducer consumer reads
 *     it. The only mention in `ward-flow-reducer.ts` writes `followUp: null` (around `:941`, inside
 *     `case "PULL_PATIENT"` around `:811`) when it creates an admission, so no action available in
 *     this prototype can put a record there. `ward-reanchor.ts` moves the record's `recordedAt`
 *     because `INSTANT_FIELDS` NAMES `recordedAt`, explicitly and deliberately, with its own comment
 *     saying that a nested instant is exactly the kind that set loses track of and is therefore
 *     named rather than left for a reader to notice. It is not a side effect of the shift recursing,
 *     which is what this paragraph claimed until 2026-09-01 — an inverted mechanism under a sound
 *     conclusion, and the inversion mattered: "it happens to be reached" invites somebody to stop
 *     naming nested fields, which is the failure that set exists to prevent.
 *     A field nothing writes and nothing reads passes every gate and renders as a perfectly ordinary
 *     empty state, which is exactly why the wrong version of this sentence survived.
 *
 *     So the list here is "discharged to the community", and **the sentence saying the follow-up
 *     half is unavailable sits inside the section, above the list, at the same weight as the
 *     heading.** An empty list under the spec's own heading would assert that everybody discharged
 *     to this team's care is being followed up, which is the worst claim available on this screen
 *     and the one nothing else in Ward Flow could contradict. That conclusion is unchanged by the
 *     correction — only its reason is. The wording is pinned by an assertion in
 *     `tests/ward-community-index.test.ts` so the false version cannot come back.
 *  2. **The count of admissions this hub cannot place with any team.** See
 *     `admissionsWithNoCommunityTeam`. Under the owner's 2026-08-31 ruling a person belongs to the
 *     team NAMED ON THEIR REFERRAL, so anyone whose referral named no community team — and anyone
 *     admitted with no referral at all — is on no team's page anywhere. **That is most of the
 *     ward**, not an edge case, and the page must say so: a team's page is a picture of everyone
 *     this prototype can MATCH to that team, never a picture of an area.
 *
 *     ⚠️ **UNTIL 2026-09-01 THIS POINT AND THE SENTENCE IT DESCRIBES BOTH CALLED THE PAGE COMPLETE,
 *     IN BOLD, AND IT WAS NOT EARNED.** `admissionBelongsToTeam` needs the referral to be FOUND — an admission whose
 *     `referralId` resolves to nothing in the referrals this screen was handed is excluded exactly
 *     as if it had no referral at all — so completeness is conditional on that join succeeding, and
 *     the page cannot check it. The unresolved are counted in the figure this point describes, and
 *     the rendered sentence now says both halves rather than only the flattering one.
 *  3. **Referrals RAISED BY a team still cannot be attributed.** A referral records that its source
 *     was `"community"`, but the source side carries no team, so nothing says which team raised
 *     one. The receiving side is now knowable — `community_team` destinations carry `teamName` —
 *     and that list is outstanding work rather than an impossibility. The section renders with that
 *     statement and no list, because a section that says why it is empty is honest and one that is
 *     silently absent is not.
 *  4. **The team names come from one extracted source document**, the S2015 catchment table, by way
 *     of `communityTeamOptions()`. They are what a referral can name in this prototype. They are
 *     not a roster of WA community services, and no team has agreed to be represented here.
 *
 * ⚠️ **NO THRESHOLD, NO "OVERDUE", NO COLOUR BY AGE.** Nothing on this screen changes appearance
 * with a duration, nothing is compared against a target, and `formatRemaining` — which appends
 * "overdue" — is deliberately never called here. There is no follow-up interval, no contact target
 * and no breach, because no such figure exists and one invented on this screen would look more
 * authoritative than anywhere else in the prototype.
 *
 * ⚠️ **NO SECOND FREE-TEXT FIELD.** `FD-13` permits exactly one story field and it is on the
 * referral. A "handover note" box is the obvious next thing to want here and it is forbidden; there
 * is no `<textarea>`, no `<input>` and no writable control anywhere in this file. **Reported rather
 * than built:** a community team reading this screen has nowhere to record what it intends to do
 * about anybody on it, and that gap is real. Closing it is a governance decision about widening the
 * one-story-field rule, not an implementer's convenience.
 *
 * ⚠️ **ONE CLOCK AND ONE DATA SOURCE: the provider's.** `admissions`, `units` and `movements` come
 * from `useWardFlow()`; displayed and dispatched `now` comes from `useWardFlowClock()` so waits
 * and booking timestamps move with the live WA clock rather than the frozen event-only `now`.
 * A duration computed from a re-anchored `now` against a frozen seed inflated every wait on two
 * screens in this project, and *a wrong clock looks wrong; a wrong length of stay looks plausible.*
 * The `admissions` prop below exists only so a test can render populations the seed cannot produce,
 * and it falls back to live state — the same shape and the same reasoning as `OutOfAreaBoard`'s.
 *
 * ⚠️ **THIS SCREEN RENDERS NO INSTANT AT ALL — and the clock defect it was written for HAS SINCE
 * BEEN FIXED, so this paragraph now says something different from what it said.** It used to assert
 * that the re-anchor left `Admission`'s own instants behind when the demonstration clock moved, and
 * that the guard on it looked at the model file alone and so could never see them. **Both halves of
 * that are now false, and neither is repeated here in its own words: a false sentence written down
 * as history is a false sentence somebody can copy back.** `INSTANT_FIELDS` names `pulledAt`,
 * `awayAtEmergencyDepartmentSince`, `expectedDischargeAt`, `dischargeDateSetAt`,
 * `dischargeConfirmedAt`, `leftAt` and the nested `recordedAt`; and `tests/ward-reanchor.test.ts`
 * reads BOTH files — its `MODEL_FILES` lists `ward-model.ts` and `ward-admissions.ts` — which
 * `ward-reanchor.ts`'s own comment describes as a guard that reads both files. Landed by
 * `44ca08839`, "the demo clock was leaving six admission timestamps behind", which reached this
 * branch through the merge `aeff0635b`. The offset measurement this paragraph used to quote was
 * taken BEFORE that commit, and repeating it here made a repaired defect look live.
 *
 * **The two lists now state elapsed time rather than a bare "a date exists" — owner-approved
 * 2026-09-01.** Until that ruling this paragraph said the two lists could only state THAT a date
 * exists, and left whether to print it as the owner's open question. What remains true, and is the
 * reason a calendar date is still never printed: every date in this fixture is invented, so "left 14
 * August" would be a synthetic day rendered to a community team as though it were a plan. "Left 5
 * weeks ago" is different in kind, not degree — it carries the clinical signal a bare "a date is
 * recorded" cannot (a discharge with no follow-up arranged is unremarkable at a day and is the case
 * this hub exists to surface at five weeks), it cannot be mistaken for a real record of a real
 * person, and it stays correct as the demonstration clock moves with nobody maintaining it. See
 * `expectedBackLabel`'s and `departureLabel`'s own block, and `community-elapsed.ts` for the one
 * rounding rule both fields use. There is no `% 1440` anywhere in this file either.
 *
 * **A suburb is not an address (`PD-3`) — and this screen shows neither.** It renders a team name,
 * a ward, a bed state and a length of stay. No street, number or postcode; `address` remains unruled and no
 * field here approaches it. No name, no date of birth, no clinical record, no allocation, no last
 * contact, no visit frequency.
 *
 * ⚠️ **SECOND-EDITION PRESENTATION PASS, 2026-09-05 — MARKUP AND STYLE ONLY.** Every sentence this
 * screen renders, it still renders, word for word; every `data-testid` it carried, it still
 * carries. The four numbered sections below are now `WardPanel` (`ward-panel.tsx`), the same
 * primitive `community-index.tsx` adopted the same day, so the two screens in this route family
 * read as one system rather than two independently hand-rolled ones. The team switcher stays a
 * `<nav>` — it needs that landmark role, which `WardPanel` does not offer — and instead `composes`
 * `ward-panel.module.css`'s own header classes, so its chrome is pixel-identical to a real panel's
 * without becoming one. Nothing above this note changed.
 *
 * ⚠️ **THIRD EDITION, 2026-09-05 — THE OWNER'S REORDER, BUILT FROM THE APPROVED PROTOTYPE
 * (`docs/ward-flow/design/prototypes/mockup-community-team-hub-v1.html`).** This one changes what
 * the page says as well as how it looks, and every sentence the earlier two editions carried is
 * still here somewhere — moved, in several cases, never dropped or reworded. What is new:
 *
 *   1. **A figure strip above every list.** Six derived counts — waiting for an answer, longest
 *      wait, ours in a bed or holding one, expected back, admitted while already with this team,
 *      discharged into the area — each read from the same arrays the lists below it render, never
 *      typed. No figure here has a threshold or a colour keyed to it.
 *   2. **"Waiting for your answer" is now the first list.** The old page never asked who was
 *      waiting on this team; this is the team's own queue — every referral naming this team whose
 *      destination is still `"queued"` — sorted longest-waiting-first. Accept/decline is
 *      DELIBERATELY NOT WIRED here: `ACCEPT_REFERRAL`/`DECLINE_REFERRAL` restrict which role may
 *      answer which kind of destination (`ward-flow-reducer.ts`'s `answerableBy` map, gated
 *      earlier by `EVENT_ROLE`), and neither currently admits a community-team answer. Dispatching
 *      as `ward` or `coordinator` from this screen would write a FALSE `decidedBy` — the exact
 *      defect that map's own comment names as the reason a workaround must not be built — so this
 *      screen states the referral and states the gap rather than inventing a decision-maker.
 *      Widening who may answer a community destination is a reducer-level, role-permission
 *      decision outside this file's mandate; it is reported here rather than routed around.
 *   3. **"Admitted while already with this team", the most delicate addition.** `ReferralAddressing`
 *      carries `state: "accepted"` and `decidedAt`; `Admission` carries `arrivedAt`. So "this team
 *      had already accepted them before the bed began", and the gap between the two, are real and
 *      derivable — but NOTHING IN THIS MODEL RECORDS A TEAM CLOSING SOMEBODY: no team discharge, no
 *      episode end, no closing date (checked in `ward-model.ts`, not assumed). The heading and
 *      every sentence in this section therefore say what this team ACCEPTED, never that anybody
 *      was "currently active with" or "still with" the team — a heading making that claim would
 *      assert active care no field holds, to a clinician who would reasonably believe it. Somebody
 *      the team closed a year ago still appears here, and the page says so. People referred to this
 *      team DURING the admission they are still in are a different group — the ward reaching out,
 *      not a relapse — and are excluded and named separately, never merged in.
 *   4. **A rail.** "Worth your attention" (derived prompts, never invented ones), "What this page
 *      cannot tell you" (the same limits the page already stated, gathered), "This team" (name,
 *      the real per-team suburb count from `communityTeamSuburbCounts()`, near-duplicate count),
 *      and "Go to" (three real routes — no link is invented).
 *   5. **The four original lists still render, unmoved in substance, some moved in position and
 *      one split.** "Discharged to the community" and "Referrals we have made" keep every sentence
 *      they carried. The departures footnote that used to sit inside the discharged panel now has
 *      its own panel, "Left the ward another way", because the owner's order calls for it as its
 *      own numbered item — its text is unchanged, including the closing clause that still means
 *      what it always did, because the discharged list still renders above it on this page.
 *
 * No colour or emphasis anywhere on this page is keyed to elapsed time — sorting is the only signal
 * a duration is allowed to carry, per the owner's ruling that a first draft applied silently and
 * with nothing beside it saying so.
 */
export function CommunityScreen({
  teamId,
  admissions,
  referrals,
}: {
  teamId: string;
  admissions?: Admission[];
  referrals?: Referral[];
}) {
  usePrintableDisclosures();
  const {
    admissions: liveAdmissions,
    referrals: liveReferrals,
    notices,
    units,
    movements,
    patients,
    dispatch,
  } = useWardFlow();
  const now = useWardFlowClock();
  const [declineOpenFor, setDeclineOpenFor] = useState<string | undefined>(undefined);
  const [declineDraft, setDeclineDraft] = useState<CommunityDeclineReason | undefined>(undefined);
  const [transportBookFor, setTransportBookFor] = useState<string | undefined>(undefined);
  const [transportDraft, setTransportDraft] = useState<TransportDraftState>(BLANK_TRANSPORT_DRAFT);
  const [transportCancelFor, setTransportCancelFor] = useState<string | undefined>(undefined);
  const [cancelTransportReason, setCancelTransportReason] = useState<CancelTransportReason | undefined>(undefined);
  const [activeModal, setActiveModal] = useState<{
    type: "review" | "assign";
    referral: Referral;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTabType>("tab-triage");
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>(null);
  const [activeModalType, setActiveModalType] = useState<ModalType>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [selectedReferral] = useState<Referral | null>(null);
  const [serviceFilter, setServiceFilter] = useState<ServiceFilterType>("east");
  const [serviceMenuOpen, setServiceMenuOpen] = useState<boolean>(false);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [caseloadFilter, setCaseloadFilter] = useState<CaseloadFilter>("all");
  // The search and the dossier read the patient records themselves. Until 25 Sept 2026 both read a
  // typed table: three fixed search hits whatever was typed, and a dossier whose clinician, care
  // tier and review date belonged to nobody's record.
  const searchResults = findPatients(patients, searchQuery);
  const selectedPatient: Patient | undefined = patients.find((patient) => patient.id === selectedPatientId);
  const [intakeDraft, setIntakeDraft] = useState<IntakeDraft>(BLANK_INTAKE_DRAFT);
  const [contactRecord, setContactRecord] = useState<{ role: WardFlowRole; at: Instant; teamId: string } | null>(null);
  const [dismissedTaskIds, setDismissedTaskIds] = useState<Set<string>>(new Set());
  const [uiState, setUiState] = useState<"populated" | "skeleton" | "empty" | "error">("populated");

  const scrollToSection = useCallback((id: string) => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(id) || document.querySelector(`[data-testid="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  function handleToggleTheme() {
    if (typeof document === "undefined") return;
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    const next = cur === "dark" ? "light" : "dark";
    applyAppearance(next);
    setToastMessage(`Theme switched to ${next} mode.`);
  }

  function handleSetThemeExplicit(theme: "light" | "dark" | "auto") {
    applyAppearance(theme);
    setToastMessage(`Appearance set to ${theme}.`);
  }

  function handleActionClick(action: "Contacted" | "Review" | "Assign", referral: Referral) {
    if (action === "Contacted") {
      const recorded = recordClinicalContact(dispatch, now, teamId);
      if (recorded !== null) setContactRecord(recorded);
    } else if (action === "Review") {
      setActiveModal({ type: "review", referral });
      setToastMessage(`Review ${referral.id}: Not wired in this prototype.`);
    } else if (action === "Assign") {
      setActiveModal({ type: "assign", referral });
      setToastMessage(`Assign ${referral.id}: Not wired in this prototype.`);
    }
  }

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveModal(null);
        setActiveModalType(null);
        setActiveDrawer(null);
        setSearchOpen(false);
        setServiceMenuOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleToggleDecline(referralId: string) {
    setDeclineOpenFor((current) => (current === referralId ? undefined : referralId));
    setDeclineDraft(undefined);
  }

  /**
   * Dispatches a real `DECLINE_REFERRAL` for this team's own queue, with role `"community"` and
   * the chosen reason from the real community vocabulary. Guarded here too, not only on the
   * button's `aria-disabled` — the same belt-and-braces discipline `referral-match.tsx`'s own
   * `handleDecline` holds to, so an unstated reason can never reach the record even by a route that
   * bypasses the disabled control.
   */
  function handleConfirmDecline(referralId: string) {
    if (declineDraft === undefined) return;
    dispatch({
      type: "DECLINE_REFERRAL",
      role: "community",
      now,
      referralId,
      destinationKind: "community_team",
      reason: declineDraft,
    });
    setDeclineOpenFor(undefined);
    setDeclineDraft(undefined);
  }

  /**
   * RB5 (item 16, 2026-09-17) — "a community team may accept, for follow-up only". Dispatches a
   * real `ACCEPT_REFERRAL` for this team's own queue, with role `"community"` — this IS the
   * community team's own screen, unlike `referral-match.tsx`'s coordinator-facing shortlist, which
   * accepts on a community team's behalf as `"coordinator"` instead.
   *
   * No reason and no unit accompany a community acceptance (`ward-flow-reducer.ts`'s
   * `ACCEPT_REFERRAL` case never asks either of a `community_team` destination), so unlike decline
   * above this needs no draft state and no confirm step — the button dispatches directly.
   */
  function handleConfirmAccept(referralId: string) {
    dispatch({
      type: "ACCEPT_REFERRAL",
      role: "community",
      now,
      referralId,
      destinationKind: "community_team",
    });
  }

  function intakeBlockedReason(draft: IntakeDraft): string | undefined {
    if (draft.ageBand === "") return "Choose an age band before sending this follow-up referral.";
    if (draft.homeRegion === "") return "Choose a home region before sending this follow-up referral.";
    if (draft.urgency === "") return "Choose urgency before sending this follow-up referral.";
    if (!siteByCode(draft.originSiteCode)) {
      return "Choose the originating site before sending this follow-up referral.";
    }
    if (draft.history.length > REFERRAL_HISTORY_LIMITS.history) {
      return `The history is ${draft.history.length} characters and the limit is ${REFERRAL_HISTORY_LIMITS.history}.`;
    }
    const umrn = draft.umrn.trim();
    if (umrn !== "" && !patients.some((patient) => patient.umrn === umrn)) {
      return "No person on file with that UMRN. Leave it blank if nobody is on file.";
    }
    return undefined;
  }

  function submitCommunityFollowUp(teamName: string) {
    const blocked = intakeBlockedReason(intakeDraft);
    if (blocked !== undefined) return;
    const { ageBand, homeRegion, urgency, originSiteCode, history } = intakeDraft;
    if (ageBand === "" || homeRegion === "" || urgency === "") return;
    const umrn = intakeDraft.umrn.trim();
    const patient = umrn === "" ? undefined : patients.find((candidate) => candidate.umrn === umrn);
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now,
      patientId: patient?.id,
      ageBand,
      destinations: [{ kind: "community_team", teamName }],
      homeRegion,
      suburb: { kind: "unknown", reason: "not_known" },
      source: "community",
      urgency: Number(urgency) as 1 | 2 | 3,
      originSiteCode,
      transportNeeded: false,
      history,
    });
    setIntakeDraft(BLANK_INTAKE_DRAFT);
    setActiveModalType(null);
  }

  function handleSaveClinicalContact() {
    const recorded = recordClinicalContact(dispatch, now, teamId);
    if (recorded === null) return;
    setContactRecord(recorded);
    setActiveModalType(null);
  }

  function openTransportBook(movementId: string) {
    setTransportCancelFor(undefined);
    setCancelTransportReason(undefined);
    setTransportDraft(BLANK_TRANSPORT_DRAFT);
    setTransportBookFor(movementId);
  }

  function closeTransportBook() {
    setTransportBookFor(undefined);
    setTransportDraft(BLANK_TRANSPORT_DRAFT);
  }

  function openTransportCancel(movementId: string) {
    setTransportBookFor(undefined);
    setTransportDraft(BLANK_TRANSPORT_DRAFT);
    setCancelTransportReason(undefined);
    setTransportCancelFor(movementId);
  }

  function closeTransportCancel() {
    setTransportCancelFor(undefined);
    setCancelTransportReason(undefined);
  }

  function submitBookTransport(movementId: string) {
    const { provider, escortRequired, cadNumber, transportLegalStatus, estimatedTime, estimatedDay } = transportDraft;
    const estimatedAt = instantFromEstimatedTimeInputs(estimatedTime, estimatedDay, now);
    if (
      provider === undefined ||
      escortRequired === undefined ||
      cadNumber.trim().length === 0 ||
      transportLegalStatus === undefined ||
      estimatedAt === undefined
    ) {
      return;
    }
    dispatch({
      type: "BOOK_TRANSPORT",
      role: "community",
      now,
      movementId,
      actingPlaceId: teamId,
      provider,
      escortRequired,
      cadNumber: cadNumber.trim(),
      transportLegalStatus,
      estimatedAt,
    });
    closeTransportBook();
  }

  function submitCancelTransport(movementId: string) {
    if (cancelTransportReason === undefined) return;
    dispatch({
      type: "CANCEL_TRANSPORT",
      role: "community",
      now,
      movementId,
      actingPlaceId: teamId,
      reason: cancelTransportReason,
    });
    closeTransportCancel();
  }

  const team = communityTeamById(teamId);
  const source = admissions ?? liveAdmissions;
  // Membership is read off the referral now, so the referrals are as much an input to this screen
  // as the admissions are. Overridable together, and from the same place, so a test cannot supply
  // one without the other and get a page that is quietly empty for the wrong reason.
  const sourceReferrals = referrals ?? liveReferrals;

  if (!team) {
    return (
      <div className={styles.screen} data-ward-design="third-edition" data-testid="ward-community-screen">
        <main id="main-content" className={styles.main}>
          <h1 className={styles.notFoundHeading}>Community team not found</h1>
          <p className={styles.notFoundBody} data-testid="ward-community-unresolved">
            No community team matches &ldquo;{teamId}&rdquo;. This never falls back to a different team — showing one
            area&apos;s patients under another area&apos;s name is the worst answer this screen could give.
          </p>
          <p style={{ marginTop: "1rem" }}>
            <Link href="/mockups/ward-flow" className={styles.backLink}>
              Return to Dashboard
            </Link>
          </p>
        </main>
      </div>
    );
  }

  const lists = communityHubLists(source, team, sourceReferrals);
  const unattributable = admissionsWithNoCommunityTeam(source, sourceReferrals);
  /*
   * 🔴 **WHICH KIND OF EMPTY EVERY EMPTY LIST BELOW IS.** Ward Lead's ruling, 2026-09-05: a list
   * has the same two meanings a nullable figure has, and the same collapse. **"Nobody referred to
   * this team is currently in a bed" and "we cannot tell who is in a bed" must not read alike** —
   * and until today the screen said the first while the second was true for all but one team.
   *
   * ⚠️ **DERIVED PER TEAM, NEVER WRITTEN DOWN.** A hardcoded "cannot be computed" is true today
   * and becomes a FALSE GAP the day somebody writes the referral link — today's defect with its
   * sign flipped, and nothing would announce it. `tests/ward-community-membership-resolution.test.ts`
   * holds both directions, and its load-bearing case is the repaired fixture rather than this one.
   */
  const resolution = communityMembershipResolution(source, team, sourceReferrals);
  const cannotResolve = resolution.state === "not-computable";
  const nearDuplicates = nearDuplicateSpellingsOf(team.name);
  const sameService = ratifiedSameServiceNames(team.name);
  const ratifiedBy = ratifiedAliasesFor(team.name)[0];
  /**
   * ⚠️ **THE POPULATION `communityHubLists` DROPS SILENTLY, AND WHY IT IS COMPUTED HERE RATHER THAN
   * THERE.** `communityHubLists` only ever splits a matched admission into `bedIsOccupied`
   * (`pulled`/`occupied`) or `departed` — `ADMISSION_STATES` also has `waitlisted`, and a matched
   * admission still waitlisted for this team lands in neither bucket. It is also not in
   * `unattributable`: that function counts admissions matched to NO team, and this one IS matched —
   * a bed has simply not been pulled yet. So without this line such a person renders on no list and
   * is counted in no figure on this page, which is exactly the silent drop `admissionsWithNoCommunityTeam`
   * exists to prevent for the unmatched case and does not reach here. Kept narrow and local rather
   * than added to `CommunityHubLists`: the brief asks for a stated count, not a fifth list, and a
   * derivation used by exactly one paragraph belongs beside that paragraph.
   */
  const waitlistedForTeam = source.filter(
    (admission) => admission.state === "waitlisted" && admissionBelongsToTeam(admission, team, sourceReferrals),
  );

  // The team's own queue — referrals naming this team whose addressing to it has not yet been
  // answered — oldest raised first, so position alone carries "who has waited longest" with no
  // colour or threshold doing it instead.
  const waitingReferrals = [...referralsWaitingOnTeam(sourceReferrals, team)].sort((a, b) => a.raisedAt - b.raisedAt);
  const caseloadRows = caseloadRowsForTeam(sourceReferrals, movements, patients, team, [
    ...lists.currentlyAdmitted,
    ...lists.dischargedIntoTheArea,
  ]);
  const form5ACount = caseloadRows.filter((row) => caseloadStatutoryFormCode(row) === "5A").length;
  const form5BCount = caseloadRows.filter((row) => caseloadStatutoryFormCode(row) === "5B").length;
  const recordedCtoCount = form5ACount + form5BCount;
  const visibleCaseload =
    caseloadFilter === "all"
      ? caseloadRows
      : caseloadRows.filter((row) => caseloadStatutoryFormCode(row) === caseloadFilter);
  const intakeBlocked = intakeBlockedReason(intakeDraft);
  /**
   * F10 (Opus adversarial review, 2026-09-17) / item 48: `community_referral_received` notices
   * have nowhere else to be seen. `WardChromeRole` (`ward-chrome-role.ts`) has no "community"
   * member — that shared chrome is ed/ward/coordinator/officer only — and this route
   * (`/community/[teamId]`) never matches any of its segment checks anyway, so this team's own
   * page is the only place these notices can be listed, exactly as RB4 asks for. The reducer's
   * `MARK_NOTICE_READ` case already permits role "community" (`EVENT_ROLE`); only the listing was
   * missing. Newest first, same ordering `ward-bar.tsx`'s own Activity panel uses.
   */
  const teamNotices = [...notices]
    .filter((notice) => notice.raisedAt <= now && notice.to.role === "community" && notice.to.placeId === teamId)
    .sort((a, b) => b.raisedAt - a.raisedAt);
  const unreadTeamNoticeCount = teamNotices.filter((notice) => notice.readAt === undefined).length;
  function markTeamNoticeRead(noticeId: string) {
    dispatch({ type: "MARK_NOTICE_READ", role: "community", now, noticeId, actingPlaceId: teamId });
  }
  const inBedCount = lists.currentlyAdmitted.filter((admission) => admission.state === "occupied").length;
  const bedPulledCount = lists.currentlyAdmitted.filter((admission) => admission.state === "pulled").length;
  const pastPlannedDateCount = lists.expectedBack.filter(
    (admission) =>
      admission.expectedDischargeAt !== null &&
      Number.isFinite(admission.expectedDischargeAt) &&
      now > admission.expectedDischargeAt,
  ).length;

  // Every admission this team can see in a bed or holding one, split into the three groups the
  // acceptance-versus-arrival comparison can actually distinguish. See `categoriseTeamAdmission`'s
  // own doc comment for why a bed-pulled admission can be in neither of the other two.
  const teamAdmissionCategories = lists.currentlyAdmitted.map((admission) =>
    categoriseTeamAdmission(admission, team, sourceReferrals, now),
  );
  const admittedWhileAlreadyWithTeam = teamAdmissionCategories
    .filter((category): category is AcceptedBeforeAdmission => category.kind === "accepted-before-admission")
    .sort((a, b) => b.gapMinutes - a.gapMinutes);
  const referredDuringThisAdmission = teamAdmissionCategories.filter(
    (category) => category.kind === "referred-during-admission",
  );
  const bedPulledNotYetArrived = teamAdmissionCategories.filter(
    (category) => category.kind === "bed-pulled-not-arrived",
  );
  const shortestAcceptanceToAdmissionGap =
    admittedWhileAlreadyWithTeam.length > 0
      ? admittedWhileAlreadyWithTeam.reduce((shortest, candidate) =>
          candidate.gapMinutes < shortest.gapMinutes ? candidate : shortest,
        )
      : null;
  const suburbsNamingTeam = communityTeamSuburbCounts().get(team.name);

  /*
   * "Worth your attention" — every entry derived from the arrays already computed above, never a
   * new figure invented for the rail. Each condition is independent, so a quiet team with nothing
   * to flag renders none of them rather than a padded list, and the panel says so in words.
   */
  const attentionItems: ReactNode[] = [];
  if (waitingReferrals.length > 0) {
    const oldest = waitingReferrals[0];
    attentionItems.push(
      <>
        <strong>{oldest.id}</strong> has waited {referralWaitLine(oldest, now)} for an answer from this team — the
        longest of the {waitingReferrals.length} referral{waitingReferrals.length === 1 ? "" : "s"} waiting.
      </>,
    );
  }
  if (shortestAcceptanceToAdmissionGap) {
    const { admission, acceptedAt, arrivedAt } = shortestAcceptanceToAdmissionGap;
    attentionItems.push(
      <>
        <strong>{admission.id}</strong> was admitted {elapsedSinceOrUnderADay(daysBetween(acceptedAt, arrivedAt))} after
        this team accepted them — the shortest gap of the {admittedWhileAlreadyWithTeam.length} admitted while already
        with this team, and the one worth checking first.
      </>,
    );
  }
  if (pastPlannedDateCount > 0) {
    attentionItems.push(
      <>
        {pastPlannedDateCount} of the {lists.expectedBack.length} planned discharge{" "}
        {lists.expectedBack.length === 1 ? "date has" : "dates have"} already passed for people this team can see.
      </>,
    );
  }
  if (unattributable.length > 0) {
    attentionItems.push(
      <>
        {unattributable.length} admission{unattributable.length === 1 ? "" : "s"} could not be matched to any community
        team at all — not this one, and not another.
      </>,
    );
  }

  return (
    <div className={styles.screen} data-ward-design="third-edition" data-testid="ward-community-screen">
      <main id="main-content" className={styles.main}>
        <div className={styles.standing}>
          <header className={`${styles.pageHeader} ${styles.sovereignHeader}`} role="banner">
            <div className={styles.hdrPlace}>
              {/* "What kind of thing it is" — the identity block the second-edition layout asks for,
                above the team's own name. A category label, not a claim, so it carries no sentence
                this file's own rules govern the wording of. */}
              <p className={styles.eyebrow}>Community team</p>
              <h1 className={styles.pageTitle}>{team.name}</h1>
              <LegalLimitsNotChecked />
              <span className="sr-only">
                The bed coordinator&apos;s view of this team&apos;s referrals and bed flow.
              </span>
              <span
                className={styles.hdrChip}
                title="Synthetic clinical demonstration data only. Not a medical device."
              >
                Synthetic prototype
              </span>
            </div>

            <details className={styles.exampleMenu}>
              <summary className={styles.exampleMenuSummary}>Illustrative drawers</summary>
              <div className={styles.exampleMenuActions}>
                <p>Sample interface content. These items are not a live team feed.</p>
                <button type="button" className={styles.iconBtn} onClick={() => setActiveDrawer("activityDrawer")}>
                  Activity sample
                </button>
                <button type="button" className={styles.iconBtn} onClick={() => setActiveDrawer("tasksDrawer")}>
                  Tasks sample
                </button>
                <button type="button" className={styles.iconBtn} onClick={() => setActiveDrawer("toolsDrawer")}>
                  Tools sample
                </button>
              </div>
            </details>

            <div className={`${styles.searchWrap} ${styles.duplicateHeaderControl}`} id="searchWrap">
              <button
                type="button"
                className={styles.searchBox}
                onClick={() => setSearchOpen(true)}
                aria-label="Search sample patients by name or UMRN"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="M10.5 10.5L14 14" />
                </svg>
                <span className={styles.searchInputPlaceholder}>Search sample patients by name or UMRN...</span>
                <kbd className={styles.searchKbd}>/</kbd>
              </button>
              {searchOpen && (
                <div className={styles.qPop} id="qPop" role="listbox">
                  <div className={styles.searchPopInputWrap}>
                    <input
                      type="search"
                      autoFocus
                      className={styles.searchInput}
                      placeholder="Type UMRN or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button
                      type="button"
                      className={styles.searchPopClose}
                      onClick={() => setSearchOpen(false)}
                      aria-label="Close search"
                    >
                      &times;
                    </button>
                  </div>
                  {searchQuery.trim() === "" ? (
                    <p className={styles.qHitMeta} data-testid="ward-community-search-hint">
                      Type a name or UMRN to search the sample patients.
                    </p>
                  ) : searchResults.length === 0 ? (
                    <p className={styles.qHitMeta} data-testid="ward-community-search-empty">
                      No sample patient matches &ldquo;{searchQuery.trim()}&rdquo;.
                    </p>
                  ) : (
                    searchResults.slice(0, SEARCH_RESULT_LIMIT).map((patient) => (
                      <div
                        key={patient.id}
                        className={styles.qHit}
                        role="option"
                        aria-selected={false}
                        data-testid={`ward-community-search-hit-${patient.id}`}
                        onClick={() => {
                          setSelectedPatientId(patient.id);
                          setActiveDrawer("pxDrawer");
                          setSearchOpen(false);
                        }}
                      >
                        <div className={styles.qHitTop}>
                          <span>
                            {patientDisplayName(patient)} · {patient.umrn}
                          </span>
                          <span className={`${styles.statusPillBadge} ${styles.neutral}`}>
                            {patient.legalStatus ?? "Legal status not recorded"}
                          </span>
                        </div>
                        <span className={styles.qHitMeta}>
                          {patient.catchmentCommunityTeam ?? "Community team not recorded"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className={`${styles.menu} ${styles.duplicateHeaderControl}`} id="svcMenu">
              <button
                type="button"
                className={styles.menuBtn}
                id="svcBtn"
                onClick={() => setServiceMenuOpen(!serviceMenuOpen)}
                aria-expanded={serviceMenuOpen}
              >
                <span className={styles.dotSvc} data-svc={serviceFilter} id="svcDot" />
                <span id="svcLabel">{serviceFilterLabel(serviceFilter)}</span>
                <svg
                  viewBox="0 0 16 16"
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </button>
              {serviceMenuOpen && (
                <div className={styles.menuDropdown}>
                  <p className={styles.menuHead}>Filter Service Scope</p>
                  <button
                    type="button"
                    className={styles.menuItem}
                    aria-pressed={serviceFilter === "east"}
                    onClick={() => {
                      setServiceFilter("east");
                      setServiceMenuOpen(false);
                    }}
                  >
                    <span>East Metropolitan (EMHS)</span>
                    <span className={styles.dotSvc} data-svc="east" />
                  </button>
                  <button
                    type="button"
                    className={styles.menuItem}
                    aria-pressed={serviceFilter === "south"}
                    onClick={() => {
                      setServiceFilter("south");
                      setServiceMenuOpen(false);
                    }}
                  >
                    <span>South Metropolitan (SMHS)</span>
                    <span className={styles.dotSvc} data-svc="south" />
                  </button>
                  <button
                    type="button"
                    className={styles.menuItem}
                    aria-pressed={serviceFilter === "north"}
                    onClick={() => {
                      setServiceFilter("north");
                      setServiceMenuOpen(false);
                    }}
                  >
                    <span>North Metropolitan (NMHS)</span>
                    <span className={styles.dotSvc} data-svc="north" />
                  </button>
                  <button
                    type="button"
                    className={styles.menuItem}
                    aria-pressed={serviceFilter === "all"}
                    onClick={() => {
                      setServiceFilter("all");
                      setServiceMenuOpen(false);
                    }}
                  >
                    <span>All WA Services</span>
                    <span className={styles.dotSvc} data-svc="all" />
                  </button>
                </div>
              )}
            </div>

            <div className={`${styles.hdrEnd} ${styles.duplicateHeaderControl}`}>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setActiveDrawer("activityDrawer")}
                title="Live Activity Feed"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <path d="M1.5 8.5h3l2-5 3 9 2-4h3" />
                </svg>
                <span>Activity</span>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--good)" }} />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setActiveDrawer("tasksDrawer")}
                title="Coordination Tasks"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <path d="M2.5 4.5l1.5 1.5 3-3M2.5 9.5l1.5 1.5 3-3M9 4h5M9 9h5M9 13h3" />
                </svg>
                <span>Tasks</span>
                <span className={styles.badgePill}>{Math.max(0, 3 - dismissedTaskIds.size)}</span>
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setActiveDrawer("toolsDrawer")}
                title="Developer & State Tools"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <path d="M9.5 2.5a3 3 0 0 0-3.6 3.9L2 10.3V14h3.7l3.9-3.9a3 3 0 0 0 3.9-3.6l-2 2-2-.5-.5-2z" />
                </svg>
                <span>Tools</span>
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                id="themeToggleBtn"
                onClick={handleToggleTheme}
                title="Toggle Light / Dark Theme"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="8" r="3.5" />
                  <path d="M8 1v2M8 13v2M1 8h2M13 8h2" />
                </svg>
                <span id="themeToggleText">Theme</span>
              </button>
            </div>
          </header>

          {teamNotices.length > 0 ? (
            <section aria-label="Notices for this team" data-testid="ward-community-notices">
              <p className={styles.teamNoticesHead}>
                Notices <span>· {unreadTeamNoticeCount} unread</span>
              </p>
              <ol className={styles.teamNoticesFeed}>
                {teamNotices.map((notice) => {
                  const isRead = notice.readAt !== undefined;
                  return (
                    <li key={notice.id} data-notice-read={isRead}>
                      <time>{formatInstantWithDay(notice.raisedAt, now)}</time>
                      <div className={styles.teamNoticeContent}>
                        <span>{notice.sentence}</span>
                        {isRead ? (
                          <span className={styles.teamNoticeReadLabel}>
                            <span className={styles.readDot} aria-hidden="true" />
                            Read
                          </span>
                        ) : (
                          <div className={styles.noticeStatusActionRow}>
                            <span className={styles.alertBadge}>
                              <span className={styles.alertDot} aria-hidden="true" />
                              Unread
                            </span>
                            <button
                              type="button"
                              className={styles.teamNoticeMarkRead}
                              onClick={() => markTeamNoticeRead(notice.id)}
                            >
                              Mark as read
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          {/* ── Primary team actions ── */}
          <section className={styles.topActionBarWrap} aria-label="Community team actions">
            <div className={styles.actionBar}>
              <div className={styles.actionBtnsLeft}>
                <button
                  type="button"
                  className={styles.btnPrimaryAction}
                  id="btnMainTriage"
                  onClick={() => {
                    setActiveTab("tab-triage");
                    scrollToSection("ward-community-waiting");
                  }}
                  title="Open Priority Referral Triage Queue"
                >
                  <svg
                    viewBox="0 0 16 16"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2 4h12M2 8h8M2 12h5" />
                  </svg>
                  <span>Triage Referral Queue ({waitingReferrals.length} Waiting)</span>
                </button>

                <button
                  type="button"
                  className={styles.btnActionSec}
                  onClick={() => {
                    setIntakeDraft(BLANK_INTAKE_DRAFT);
                    setActiveModalType("intake");
                  }}
                >
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                  <span>Intake Referral</span>
                </button>

                <button type="button" className={styles.btnActionSec} onClick={() => setActiveModalType("contact")}>
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M3 8l3 3 7-7" />
                  </svg>
                  <span>Record Clinical Contact</span>
                </button>

                <details className={styles.moreActions}>
                  <summary className={styles.btnActionSec}>More actions</summary>
                  <div className={styles.moreActionsMenu}>
                    <button
                      type="button"
                      className={styles.btnActionSec}
                      onClick={() => {
                        setActiveTab("tab-caseload");
                        scrollToSection("section-caseload");
                      }}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path d="M3 2h7l4 4v8H3V2z" />
                        <path d="M10 2v4h4" />
                      </svg>
                      <span>CTO Statutory Register</span>
                    </button>

                    <button
                      type="button"
                      className={styles.btnActionSec}
                      onClick={() => setActiveModalType("handover")}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path d="M4 2h8v4H4zM3 6h10a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1zM4 11h8v3H4z" />
                      </svg>
                      <span>Print Catchment MDT</span>
                    </button>
                  </div>
                </details>
              </div>
            </div>
          </section>

          {/* ── Operational Tab Bar ── */}
          <nav className={styles.tabBarWrap} aria-label="Community Operational Tabs">
            <ul className={styles.tabList} role="tablist">
              <li role="presentation">
                <button
                  type="button"
                  className={styles.tabBtn}
                  role="tab"
                  id="tabBtn-triage"
                  aria-selected={activeTab === "tab-triage"}
                  aria-controls="tab-triage"
                  onClick={() => {
                    setActiveTab("tab-triage");
                    scrollToSection("ward-community-waiting");
                  }}
                >
                  <span>Waiting for the team&apos;s answer</span>
                  <span className={styles.tabBadge}>{waitingReferrals.length}</span>
                </button>
              </li>
              <li role="presentation">
                <button
                  type="button"
                  className={styles.tabBtn}
                  role="tab"
                  id="tabBtn-inpatients"
                  aria-selected={activeTab === "tab-inpatients"}
                  aria-controls="tab-inpatients"
                  onClick={() => {
                    setActiveTab("tab-inpatients");
                    scrollToSection("ward-community-admitted");
                  }}
                >
                  <span>In a bed or holding one</span>
                  <span className={styles.tabBadge}>{lists.currentlyAdmitted.length}</span>
                </button>
              </li>
              <li role="presentation">
                <button
                  type="button"
                  className={styles.tabBtn}
                  role="tab"
                  id="tabBtn-egress"
                  aria-selected={activeTab === "tab-egress"}
                  aria-controls="tab-egress"
                  onClick={() => {
                    setActiveTab("tab-egress");
                    scrollToSection("ward-community-expected-back");
                  }}
                >
                  <span>Expected back</span>
                  <span className={styles.tabBadge}>{lists.expectedBack.length}</span>
                </button>
              </li>
              <li role="presentation">
                <button
                  type="button"
                  className={styles.tabBtn}
                  role="tab"
                  id="tabBtn-caseload"
                  aria-selected={activeTab === "tab-caseload"}
                  aria-controls="tab-caseload"
                  onClick={() => {
                    setActiveTab("tab-caseload");
                    scrollToSection("section-caseload");
                  }}
                >
                  <span>Active Caseload &amp; CTOs</span>
                  <span className={styles.tabBadge}>{caseloadRows.length}</span>
                </button>
              </li>
              <li role="presentation">
                <button
                  type="button"
                  className={styles.tabBtn}
                  role="tab"
                  id="tabBtn-team"
                  aria-selected={activeTab === "tab-team"}
                  aria-controls="tab-team"
                  onClick={() => {
                    setActiveTab("tab-team");
                    scrollToSection("section-team-workspace");
                  }}
                >
                  <span>Illustrative team setup</span>
                  <span className={styles.tabBadge}>Sample</span>
                </button>
              </li>
            </ul>
          </nav>

          {/* ── Figures across the top — every value read from an array already computed above,
             none typed into prose. `WardFigureStrip` caps flagged tiles at two; exactly one is
             flagged here ("admitted while already with this team"), and the flag is a fixed
             property of that tile's CATEGORY, never of how large its number is — no figure on this
             page changes colour with elapsed time. ─────────────────────────────────────────── */}
          <WardFigureStrip>
            <WardFigure
              label="Waiting for an answer"
              value={`${waitingReferrals.length}`}
              sub={`referral${waitingReferrals.length === 1 ? "" : "s"} addressed to this team`}
            />
            <WardFigure
              label="Admitted while with the team"
              value={`${admittedWhileAlreadyWithTeam.length}`}
              unit={`of ${lists.currentlyAdmitted.length}`}
              sub="already accepted before the bed began"
              flagged={admittedWhileAlreadyWithTeam.length > 0}
            />
            <WardFigure
              label="In a bed or holding one"
              value={`${lists.currentlyAdmitted.length}`}
              sub={`${inBedCount} in the bed · ${bedPulledCount} bed pulled`}
            />
            <WardFigure
              label="Expected back"
              value={`${lists.expectedBack.length}`}
              unit={`of ${lists.currentlyAdmitted.length}`}
              sub={`${pastPlannedDateCount} planned date${pastPlannedDateCount === 1 ? "" : "s"} already passed`}
            />
            <WardFigure
              label="Discharged into the catchment"
              value={`${lists.dischargedIntoTheArea.length}`}
              sub="recorded as discharged to the community"
            />
            <WardFigure
              label="Longest wait"
              value={waitingReferrals.length === 0 ? "None waiting" : referralWaitLine(waitingReferrals[0], now)}
              sub={waitingReferrals.length === 0 ? undefined : `${waitingReferrals[0].id} · since it was raised`}
            />
          </WardFigureStrip>

          {/*
           * Every other team, whatever the catchment source turns out to name. A builder over
           * `COMMUNITY_TEAM_PAGES` rather than a hand-written list, for the same reason that array is
           * derived: a further team must reach this navigation by appearing in the catchment source
           * and by nothing else.
           *
           * ⚠️ **THIS SWITCHER IS NOT THE WAY IN. IT IS THE WAY ACROSS — AND THERE IS NOW A WAY IN.**
           * `/mockups/ward-flow/community` (`community-index.tsx`) is the front door: it lists every
           * team a referral can name, alphabetically, links each one, and `ward-nav.ts` carries it as
           * the `community` entry so the index is itself reachable from the rail. So a reader who is
           * not already on a team page reaches any team in two clicks, and this switcher is the
           * convenience for a reader who is.
           *
           * ⚠️ **`tests/ward-nav.test.ts` STILL RECORDS NOUGHT REACHABLE INSTANCES FOR THIS ROUTE,
           * AND THAT FIGURE NO LONGER MEANS WHAT IT SAYS ON ITS FACE.** Read the entry, not the
           * number — and note that the count of the full set is deliberately not repeated here, for
           * the reason the paragraph below gives. It now records a limit of a SOURCE SCAN, not a gap in the navigation: the index
           * builds its hrefs inside a `.map()` via `communityTeamHref`, and that scan counts a built
           * site as nought concrete instances **by design**, because reading a builder as
           * reachability is the defect class the guard exists to catch. Teaching it to count this one
           * would loosen it. What the index really covers is established by rendering it and reading
           * the links back out of the markup — `tests/ward-community-index.dom.test.tsx` pins the
           * linked set against `COMMUNITY_TEAM_PAGES` exactly and goes red on a single missing team.
           *
           * ⚠️ **THIS PARAGRAPH HAS NOW BEEN WRONG IN BOTH DIRECTIONS, WHICH IS THE POINT.** Until
           * 2026-09-01 it claimed the rail already carried a worked instance of this route — the
           * shape of `board/[unitId]`'s entry in that same test, not of this one. It was corrected to
           * say the route was an orphan reachable only by typing a URL, which was true for about an
           * hour, until `/community` landed in the merge that same evening. **A sentence describing
           * an absence is a sentence with a short shelf life**, because the absence is usually
           * somebody's next task. Cite the entry and its reasoning, never the bare figure: an
           * unchanged number whose meaning inverted is the one a careless check waves through.
           *
           * ⚠️ **AND NO COUNT OF THE TEAMS IS WRITTEN HERE.** This paragraph carried two of them — a
           * count of the other teams, and a count of the pages this switcher reaches — and both were
           * residue from the region era, when membership came from `ward-teams.ts`'s
           * `COMMUNITY_TEAMS`, a `Record<HomeRegion, string>` this hub deliberately does not read.
           * The real size is a property of the extracted catchment table, so a figure typed here has
           * no guard and goes stale the moment that source changes; the retired figures are not
           * repeated even as history, because a phrase written down is a phrase that can be copied
           * back. The list renders from the derivation; the prose describes the set.
           *
           * ⚠️ **KEPT AS ONE COMMENT WITH THE NOTE BELOW, DELIBERATELY.** `tests/ward-community-corrected-
           * claims.test.ts` locates "the switcher's own comment" by walking backward from the `<nav>`
           * to the nearest comment-close and comment-open marker pair, so a second, separate comment
           * landing between this one and the element it scans for would be captured INSTEAD of this
           * one — silently shrinking the region every absence pin below is checked against. A
           * `<nav>`, not a `WardPanel` — the
           * landmark role is what makes this switcher findable by `getByRole("navigation", ...)`, and
           * `WardPanel` renders a `<section>`. `composes` borrows the primitive's own header classes
           * instead, so the chrome matches every other panel on this page exactly rather than
           * approximately.
           */}
          <nav className={styles.teamSwitcher} aria-label="Other community teams">
            <details className={`${styles.teamDisclosure} source-print`}>
              <summary className={styles.teamSwitcherHeader}>
                <span className={styles.teamSwitcherTitle}>Change team</span>
                <span className={styles.switchCount}>{COMMUNITY_TEAM_PAGES.length - 1} other teams</span>
              </summary>
              <div className={styles.teamPopover}>
                <div className={styles.teamPopoverHeader}>
                  <span>Select team</span>
                  <span className={styles.teamPopoverMeta}>{COMMUNITY_TEAM_PAGES.length - 1} other catchments</span>
                </div>
                <ul className={styles.teamList}>
                  {COMMUNITY_TEAM_PAGES.filter((other) => other.id !== team.id).map((other) => {
                    const suburbs = communityTeamSuburbCounts().get(other.name);
                    return (
                      <li key={other.id} className={styles.teamListItem}>
                        <Link className={styles.teamLink} href={communityTeamHref(other)}>
                          <span className={styles.teamLinkName}>{other.name}</span>
                          {suburbs ? (
                            <span className={styles.teamLinkMeta}>
                              {suburbs} {suburbs === 1 ? "suburb" : "suburbs"}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </details>
          </nav>
        </div>

        <div className={styles.contentGrid}>
          <div className={styles.primaryColumn}>
            {/*
              🔴 **HOW TO REACH THIS TEAM — A PUBLISHED NUMBER, NOT A VERIFIED ONE, AND THE
              DIFFERENCE IS RENDERED RATHER THAN ASSUMED.**

              This panel appears only where a PERSON has paired this prototype's team name with a real
              WA service (`community-team-contact-mapping.ts`). It is not name matching: the app's
              names are the 2015 catchment table's place words and the register's are directory
              names, and across all 64 and all 25 they share not one exact match.

              ⚠️ **The absence of this panel means nobody has decided, NEVER that the team has
              no phone number** — which is why the unmapped case renders a sentence saying so rather
              than nothing at all. A blank would read as "no number exists", a different and wrong
              claim about a real service.

              ⚠️ The caveat and the record's date are not decoration. Every register row is
              `operationally_ratified: false`, and the pack's own note reads "2023 PDF footer contacts
              may be obsolete".
            */}
            {(() => {
              const contact = contactForTeam(team.name);
              const decision = contactDecisionFor(team.name);
              return (
                <WardPanel title="How to reach this team" testId="ward-community-contact">
                  <div className={styles.panelBody} role="region" aria-label="How to reach this team details">
                    {contact === null ? (
                      <p className={styles.emptyNote}>
                        Nobody has yet recorded which real service this name refers to, so no contact detail is shown.
                        That is not a statement that this team has no phone number.
                      </p>
                    ) : (
                      <>
                        <dl className={styles.contactList} data-testid="ward-community-contact-detail">
                          {contact.publishedPhone === null ? null : (
                            <>
                              <dt>Phone</dt>
                              <dd>
                                <a href={`tel:${contact.publishedPhone.replace(/[^\d+]/g, "")}`}>
                                  {contact.publishedPhone}
                                </a>
                              </dd>
                            </>
                          )}
                          {contact.publishedHours === null ? null : (
                            <>
                              <dt>Hours</dt>
                              <dd>{contact.publishedHours}</dd>
                            </>
                          )}
                          {contact.referralEmail === null ? null : (
                            <>
                              <dt>Referral email</dt>
                              <dd>
                                <a href={`mailto:${contact.referralEmail}`}>{contact.referralEmail}</a>
                              </dd>
                            </>
                          )}
                          {contact.address === null ? null : (
                            <>
                              <dt>Address</dt>
                              <dd>{contact.address}</dd>
                            </>
                          )}
                        </dl>
                        <p className={styles.footnote}>{REFERENCE_TEAM_CAVEAT}</p>
                        <p className={styles.footnote}>
                          Recorded {contact.recordedOn ?? "on a date the register does not give"}
                          {decision === null
                            ? null
                            : `. Paired with ${decision.serviceName} by ${decision.decidedBy} on ${decision.decidedOn}.`}
                        </p>
                      </>
                    )}
                  </div>
                </WardPanel>
              );
            })()}

            {/* ── Referrals addressed to this team, not yet answered — the team's own queue ── */}
            <WardPanel
              title="Waiting for the team's answer"
              count={`${waitingReferrals.length}`}
              testId="ward-community-waiting"
              blurb="Unanswered referrals addressed to this team, oldest first."
            >
              <div
                className={styles.panelBody}
                role="region"
                aria-label="Waiting for the team's answer details"
                tabIndex={0}
              >
                {waitingReferrals.length === 0 ? (
                  <p className={styles.emptyNote} data-testid="ward-community-waiting-empty">
                    No referral naming this team is currently waiting for an answer.
                  </p>
                ) : (
                  <ul className={styles.cardList} data-testid="ward-community-waiting-list">
                    {waitingReferrals.map((referral) => {
                      const declineOpen = declineOpenFor === referral.id;
                      // Blocked only until a reason is chosen — the same "state a reason before
                      // declining" rule `referral-match.tsx`'s own ward and ED controls hold to.
                      const declineBlocked = declineDraft === undefined ? COMMUNITY_DECLINE_REASON_UNCHOSEN : undefined;
                      return (
                        <li
                          key={referral.id}
                          className={styles.card}
                          data-testid={`ward-community-waiting-${referral.id}`}
                        >
                          <div className={styles.cardHeaderRow}>
                            <p className={styles.cardUnit}>
                              {referral.id} · {urgencyTierLabel(referral.urgency)}
                            </p>
                            <span className={styles.referralStatusMarker}>
                              <span className={styles.statusDot} aria-hidden="true" />
                              Awaiting answer
                            </span>
                          </div>
                          <p className={styles.cardDetail}>{referralWaitLine(referral, now)}</p>
                          <p className={styles.cardDetail}>
                            {referral.ageBand} · {referral.homeRegion} · {referralOriginLabel(referral)}
                          </p>
                          <p className={styles.cardDetail}>
                            {referral.transportNeeded ? "Transport needed" : "No transport recorded"}
                          </p>
                          <div className={styles.cardActionsGroup}>
                            <div className={styles.cardWorkflowActions}>
                              <button
                                type="button"
                                className={styles.cardActionButton}
                                onClick={() => handleActionClick("Contacted", referral)}
                              >
                                Contacted
                              </button>
                              <button
                                type="button"
                                className={styles.cardActionButton}
                                onClick={() => handleActionClick("Review", referral)}
                              >
                                Review
                              </button>
                              <button
                                type="button"
                                className={styles.cardActionButton}
                                onClick={() => handleActionClick("Assign", referral)}
                              >
                                Assign
                              </button>
                            </div>
                            <div className={styles.declineActions}>
                              {/* RB5 (item 16, 2026-09-17) — "a community team may accept, for
                                  follow-up only". Same row as the decline toggle beside it; no
                                  reason to gate on, so this dispatches directly. */}
                              <button
                                type="button"
                                className={styles.acceptConfirmButton}
                                data-testid={`ward-community-accept-${referral.id}`}
                                onClick={() => handleConfirmAccept(referral.id)}
                              >
                                Accept referral
                              </button>
                              <button
                                type="button"
                                className={styles.declineButton}
                                data-testid={`ward-community-decline-toggle-${referral.id}`}
                                aria-expanded={declineOpen}
                                onClick={() => handleToggleDecline(referral.id)}
                              >
                                Decline referral
                              </button>
                              {declineOpen ? (
                                <div
                                  className={styles.declineForm}
                                  data-testid={`ward-community-decline-panel-${referral.id}`}
                                >
                                  <label
                                    className={styles.declineLabel}
                                    htmlFor={`ward-community-decline-reason-${referral.id}`}
                                  >
                                    Decline reason
                                    <select
                                      id={`ward-community-decline-reason-${referral.id}`}
                                      className={styles.declineSelect}
                                      data-testid={`ward-community-decline-reason-${referral.id}`}
                                      value={declineDraft ?? ""}
                                      onChange={(e) => {
                                        const chosen = e.target.value;
                                        // Membership, never truthiness — the blank option must
                                        // resolve to "no answer yet", never to a reason that merely
                                        // sorts first (same discipline as `referral-match.tsx`'s own
                                        // decline selects).
                                        setDeclineDraft(
                                          (COMMUNITY_DECLINE_REASONS as readonly string[]).includes(chosen)
                                            ? (chosen as CommunityDeclineReason)
                                            : undefined,
                                        );
                                      }}
                                    >
                                      <option value="">Select a reason...</option>
                                      {COMMUNITY_DECLINE_REASONS.map((reason) => (
                                        <option key={reason} value={reason}>
                                          {COMMUNITY_DECLINE_REASON_LABELS[reason]}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <button
                                    type="button"
                                    className={styles.declineConfirmButton}
                                    data-testid={`ward-community-decline-confirm-${referral.id}`}
                                    aria-disabled={declineBlocked === undefined ? undefined : "true"}
                                    aria-describedby={
                                      declineBlocked === undefined
                                        ? undefined
                                        : `ward-community-decline-blocked-${referral.id}`
                                    }
                                    title={declineBlocked}
                                    onClick={
                                      declineBlocked === undefined
                                        ? () => handleConfirmDecline(referral.id)
                                        : ignoreUnavailableActivation
                                    }
                                  >
                                    Confirm decline
                                  </button>
                                  {declineBlocked === undefined ? null : (
                                    <span id={`ward-community-decline-blocked-${referral.id}`} className="sr-only">
                                      {declineBlocked}
                                    </span>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {/*
                 * 🔴 RB5 (item 16, 2026-09-17) CLOSED THE GAP THIS COMMENT ONCE DESCRIBED. Community
                 * teams can now accept their own community_team destination, for follow-up only —
                 * `EVENT_ROLE.ACCEPT_REFERRAL` permits "community", scoped by the reducer's own
                 * `answerableBy` map to that destination kind alone. What is still true, and still
                 * the reason this footnote exists: accepting an INPATIENT admission (a ward's bed)
                 * requires a ward or coordinator role and a bed allocation this team never holds.
                 */}
                <p className={styles.footnote} data-testid="ward-community-waiting-not-actionable">
                  Community-team roles can accept or decline referrals addressed to their own team, for follow-up only.
                  Inpatient admission acceptance is not recordable from this page.
                </p>
              </div>
            </WardPanel>

            <WardPanel title="Worth attention" testId="ward-community-attention">
              <div className={styles.panelBody} role="region" aria-label="Worth attention details" tabIndex={0}>
                {attentionItems.length === 0 ? (
                  <p className={styles.emptyNote} data-testid="ward-community-attention-empty">
                    Nothing on this page currently stands out beyond what the lists above already show.
                  </p>
                ) : (
                  <ul className={styles.attentionList} data-testid="ward-community-attention-list">
                    {attentionItems.map((item, index) => (
                      <li key={index} className={styles.attentionItem}>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </WardPanel>

            {/* ── List 2, moved — everyone of ours in a bed or holding one ─────────────────── */}
            <WardPanel
              title="In a bed or holding one"
              count={`${lists.currentlyAdmitted.length}`}
              testId="ward-community-admitted"
            >
              <div className={styles.panelBody} role="region" aria-label="In a bed or holding one details" tabIndex={0}>
                <p className={styles.count} data-testid="ward-community-admitted-count">
                  {lists.currentlyAdmitted.length}{" "}
                  {lists.currentlyAdmitted.length === 1
                    ? "person referred to this team is"
                    : "people referred to this team are"}{" "}
                  in a bed or have one pulled for them.
                </p>
                {lists.currentlyAdmitted.length === 0 ? (
                  <p className={styles.emptyNote} data-testid="ward-community-admitted-empty">
                    {cannotResolve ? (
                      <>
                        A bed carries no link back to the referral that named this team, so this list cannot be built
                        for {team.name}. Its emptiness is a gap in the record rather than an answer about the team.
                      </>
                    ) : (
                      <>Nobody referred to this team is currently in a bed.</>
                    )}
                  </p>
                ) : (
                  <WardTable
                    className={styles.table}
                    wrapperClassName={styles.tableScroll}
                    testId="ward-community-admitted-list"
                    hasScrollThreshold
                  >
                    <caption>People referred to this team in a bed or holding one</caption>
                    <thead>
                      <tr>
                        <th scope="col">Admission</th>
                        <th scope="col">Unit</th>
                        <th scope="col">State</th>
                        <th scope="col">In a bed for</th>
                        <th scope="col">Expected back</th>
                        {/*
                          Drawing Actions column shows Open Dossier only. Owner decision 1
                          (22 Sep 2026): drawings own look; book/cancel stays as behaviour and
                          the Actions cluster adjusts to fit (dossier + transport controls).
                        */}
                        <th scope="col" className={styles.actionsCol}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lists.currentlyAdmitted.map((admission) => {
                        const movement =
                          admission.state === "pulled" && admission.movementId !== null
                            ? movements.find((candidate) => candidate.id === admission.movementId)
                            : undefined;
                        const transport = movement?.transport;
                        const ownUncollectedBooking =
                          transport !== undefined &&
                          transport.bookedBy?.role === "community" &&
                          transport.bookedBy.placeId === teamId &&
                          transport.collectedAt === undefined;
                        const otherBooking = transport !== undefined && !ownUncollectedBooking;
                        const canBook =
                          admission.state === "pulled" &&
                          admission.movementId !== null &&
                          movement !== undefined &&
                          transport === undefined;
                        const dossierPatientId = admission.patientId;
                        return (
                          <tr key={admission.id} data-testid={`ward-community-admitted-${admission.id}`}>
                            <th scope="row">{admission.id}</th>
                            <td>{unitName(admission.unitId, units)}</td>
                            <td>{bedStateLabel(admission)}</td>
                            <td>{stayLabel(admission, now)}</td>
                            <td>{expectedBackLabel(admission, now)}</td>
                            <td
                              className={styles.actionsCell}
                              data-testid={`ward-community-transport-cell-${admission.id}`}
                            >
                              <div className={styles.rowActions}>
                                {dossierPatientId !== null ? (
                                  <button
                                    type="button"
                                    className={styles.btnSmSec}
                                    data-testid={`ward-community-open-dossier-${admission.id}`}
                                    onClick={() => {
                                      setSelectedPatientId(dossierPatientId);
                                      setActiveDrawer("pxDrawer");
                                    }}
                                  >
                                    Open Dossier
                                  </button>
                                ) : null}
                                {canBook ? (
                                  <button
                                    type="button"
                                    className={styles.btnSmPrimary}
                                    data-testid={`ward-community-book-transport-${admission.movementId}`}
                                    onClick={() => openTransportBook(admission.movementId!)}
                                  >
                                    Log transport booking
                                  </button>
                                ) : null}
                                {ownUncollectedBooking ? (
                                  <button
                                    type="button"
                                    className={styles.transportCancelButton}
                                    data-testid={`ward-community-cancel-transport-${admission.movementId}`}
                                    onClick={() => openTransportCancel(admission.movementId!)}
                                  >
                                    Cancel this team&apos;s booking
                                  </button>
                                ) : null}
                              </div>
                              {ownUncollectedBooking && transport.estimatedAt !== undefined ? (
                                <p
                                  className={styles.transportBookedNote}
                                  data-testid={`ward-community-transport-eta-${admission.movementId}`}
                                >
                                  Estimated {formatInstantWithDay(transport.estimatedAt, now)} ·{" "}
                                  {transportEtaRemainingLabel(transport.estimatedAt, now)}
                                </p>
                              ) : null}
                              {otherBooking ? (
                                <p
                                  className={styles.transportBookedNote}
                                  data-testid={`ward-community-transport-booked-${admission.movementId}`}
                                >
                                  Transport already booked
                                  {transport.bookedBy?.role === "ed"
                                    ? " by the emergency department"
                                    : transport.bookedBy?.role === "ward"
                                      ? " by a ward"
                                      : transport.bookedBy?.role === "community" &&
                                          transport.bookedBy.placeId !== teamId
                                        ? " by another community team"
                                        : ""}
                                  {transport.estimatedAt !== undefined
                                    ? ` · estimated ${formatInstantWithDay(transport.estimatedAt, now)} · ${transportEtaRemainingLabel(transport.estimatedAt, now)}`
                                    : ""}
                                  .
                                </p>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </WardTable>
                )}
              </div>
            </WardPanel>

            {/* ── Admitted while already with this team — the owner's most delicate request ──
                 See `categoriseTeamAdmission`'s doc comment above for the exact rule this table
                 draws on, and this file's header block (third edition) for why the wording below is
                 constrained the way it is. */}
            <WardPanel
              title="Admitted while already with the team"
              count={`${admittedWhileAlreadyWithTeam.length} of ${lists.currentlyAdmitted.length}`}
              testId="ward-community-accepted-before-admission"
              blurb="Accepted before the bed began, longest-accepted first. No community-team closure is recorded."
            >
              <div
                className={styles.panelBody}
                role="region"
                aria-label="Admitted while already with the team details"
                tabIndex={0}
              >
                {admittedWhileAlreadyWithTeam.length === 0 ? (
                  <p className={styles.emptyNote} data-testid="ward-community-accepted-before-admission-empty">
                    {cannotResolve ? (
                      <>
                        A bed carries no link back to the referral that named this team, so this list cannot be built
                        for {team.name}. Its emptiness is a gap in the record rather than an answer about the team.
                      </>
                    ) : (
                      <>
                        Nobody this team can currently see in a bed or holding one was accepted before that bed began.
                      </>
                    )}
                  </p>
                ) : (
                  <WardTable
                    className={styles.table}
                    wrapperClassName={styles.tableScroll}
                    testId="ward-community-accepted-before-admission-table"
                    hasScrollThreshold
                  >
                    <caption>Admissions this team had already accepted before the bed began</caption>
                    <thead>
                      <tr>
                        <th scope="col">Admission</th>
                        <th scope="col">Unit</th>
                        <th scope="col">In a bed for</th>
                        <th scope="col">Accepted before the bed began</th>
                        <th scope="col">Accepted altogether</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admittedWhileAlreadyWithTeam.map(({ admission, acceptedAt, arrivedAt }) => (
                        <tr key={admission.id} data-testid={`ward-community-accepted-before-admission-${admission.id}`}>
                          <th scope="row">{admission.id}</th>
                          <td>{unitName(admission.unitId, units)}</td>
                          <td>{stayLabel(admission, now)}</td>
                          <td>{elapsedSinceOrUnderADay(daysBetween(acceptedAt, arrivedAt))} before the bed began</td>
                          <td>{elapsedSinceOrUnderADay(daysBetween(acceptedAt, now))} since acceptance</td>
                        </tr>
                      ))}
                    </tbody>
                  </WardTable>
                )}
                {/*
                 * The two groups the table above deliberately excludes, named rather than silently
                 * dropped — a referral made from the ward is the ward reaching out, not a relapse
                 * under this team's care, and a pulled bed with nobody arrived yet has no admission
                 * start to compare an acceptance against at all.
                 */}
                <p className={styles.absenceNotice} data-testid="ward-community-accepted-before-admission-other-groups">
                  Excluded: {referredDuringThisAdmission.length} referred during the current admission and{" "}
                  {bedPulledNotYetArrived.length} with a bed pulled but no arrival. Neither establishes care before
                  admission.
                </p>
                <p className={styles.footnote} data-testid="ward-community-accepted-before-admission-not-active-claim">
                  Acceptance before admission does not establish current care; no community-team closure is recorded.
                </p>
              </div>
            </WardPanel>

            {/* ── List 4, moved — of those, who the ward expects back ──────────────────────── */}
            <WardPanel
              title="Expected back"
              count={`${lists.expectedBack.length} of ${lists.currentlyAdmitted.length}`}
              testId="ward-community-expected"
            >
              <div className={styles.panelBody} role="region" aria-label="Expected back details" tabIndex={0}>
                <p className={styles.count} data-testid="ward-community-expected-count">
                  {lists.expectedBack.length} of the {lists.currentlyAdmitted.length}{" "}
                  {lists.currentlyAdmitted.length === 1 ? "person" : "people"} above{" "}
                  {lists.expectedBack.length === 1 ? "has" : "have"} a discharge date the ward has written down.
                </p>
                {/*
                 * ⚠️ THE WORDING IS STILL CONSTRAINED BY ITS OWN GUARD, and deliberately. The natural
                 * sentence here is "not a deadline, not a target, and a passed date is not overdue" —
                 * words `tests/ward-community-hub.dom.test.tsx` refuses on sight, because a screen that
                 * names a threshold in order to disclaim it has still put the word in front of a reader
                 * who will remember the word. That guard did not go away when the date itself started
                 * rendering: `expectedBackLabel` below says how long until the plan, or how long since it
                 * passed, without ever spending the word "overdue" to do it. Saying what the elapsed time
                 * IS, in either direction, carries the same meaning as naming a threshold and leaves
                 * nothing to quote back.
                 */}
                {/*
                 * ⚠️ Corrected 2026-09-01, then acted on the same day: this justified the withheld date
                 * first with a demonstration-clock defect and then with an unresolved product question.
                 * Both are closed. `ward-reanchor.ts` shifts `expectedDischargeAt` with `now` (see this
                 * file's header block), and the owner has since ruled that elapsed time should be shown.
                 * A calendar date is still never printed — see the reason below.
                 */}
                <p className={styles.footnote} data-testid="ward-community-expected-elapsed">
                  Ward-reported plan; elapsed time only. No target is applied.
                </p>
                {lists.expectedBack.length === 0 ? (
                  <p className={styles.emptyNote} data-testid="ward-community-expected-empty">
                    {cannotResolve ? (
                      <>
                        A bed carries no link back to the referral that named this team, so this list cannot be built
                        for {team.name}. Its emptiness is a gap in the record rather than an answer about the team.
                      </>
                    ) : (
                      <>
                        No one referred to this team who is currently in a bed or has one pulled has a discharge date
                        the ward has written down.
                      </>
                    )}
                  </p>
                ) : (
                  <ul className={styles.cardList} data-testid="ward-community-expected-list">
                    {lists.expectedBack.map((admission) => (
                      <li
                        key={admission.id}
                        className={styles.card}
                        data-testid={`ward-community-expected-${admission.id}`}
                      >
                        <p className={styles.cardUnit}>{unitName(admission.unitId, units)}</p>
                        <p className={styles.cardDetail}>{expectedBackLabel(admission, now)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </WardPanel>

            {/* ── List 1, moved and renamed to the owner's wording — discharged into the area ── */}
            <WardPanel
              title="Discharged into the catchment"
              count={`${lists.dischargedIntoTheArea.length}`}
              testId="ward-community-discharged"
            >
              <div
                className={styles.panelBody}
                role="region"
                aria-label="Discharged into the catchment details"
                tabIndex={0}
              >
                {/*
                 * Point 1. INSIDE the section and ABOVE the list, so it cannot be read past on the way to
                 * an empty list, and worded as a statement about the record rather than as a caveat.
                 *
                 * ⚠️ Corrected 2026-09-01: this said "not recorded anywhere in this prototype… no field
                 * for it", which was false — see point 1 in this file's header for what was measured. The
                 * field exists; nothing writes it and nothing reads it. The conclusion below is unchanged.
                 */}
                <p className={styles.absenceNotice} data-testid="ward-community-follow-up-not-recorded">
                  Follow-up status is not shown or editable here. This list shows recorded discharges into the
                  community, not people missing follow-up; an empty list does not establish that everybody is being
                  followed up.
                </p>

                {lists.dischargedIntoTheArea.length === 0 ? (
                  <p className={styles.emptyNote} data-testid="ward-community-discharged-empty">
                    {cannotResolve ? (
                      <>
                        A bed carries no link back to the referral that named this team, so this list cannot be built
                        for {team.name}. Its emptiness is a gap in the record rather than an answer about the team.
                      </>
                    ) : (
                      <>No admission referred to this team is recorded as discharged to the community.</>
                    )}
                  </p>
                ) : (
                  <ul className={styles.cardList} data-testid="ward-community-discharged-list">
                    {lists.dischargedIntoTheArea.map((admission) => (
                      <li
                        key={admission.id}
                        className={styles.card}
                        data-testid={`ward-community-discharged-${admission.id}`}
                      >
                        <p className={styles.cardUnit}>{unitName(admission.unitId, units)}</p>
                        <p className={styles.cardDetail}>{departureLabel(admission, now)}</p>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Why the row above says HOW LONG AGO somebody left rather than a date — said here as
                    well as in the expected-back section, because a reader who scrolls straight to this
                    list would otherwise wonder why no calendar date appears.

                    ⚠️ Corrected 2026-09-01, then acted on the same day. This footnote used to justify
                    withholding the date, first with a demonstration-clock defect and then with an
                    unresolved product question. Both are closed: `ward-reanchor.ts` shifts `leftAt` with
                    `now` (see this file's header block), and the owner has since ruled that elapsed time
                    should be shown. A calendar date is still never printed — see the reason below. */}
                <p className={styles.footnote} data-testid="ward-community-departure-elapsed">
                  Departure is shown as elapsed time; no calendar date is displayed.
                </p>
              </div>
            </WardPanel>

            {/* ── Left the ward another way — the owner's order asks for this as its own numbered
                 item. The paragraph below is the same one that used to sit as a footnote inside the
                 discharged panel above, word for word: it moved panel, not wording, and "the list
                 above" in its own text is still true because the discharged list still renders above
                 this panel on the page. ─────────────────────────────────────────────────────── */}
            <WardPanel
              title="Left the ward another way"
              count={`${lists.otherDepartures.length}`}
              testId="ward-community-other-departures-panel"
            >
              <div
                className={styles.panelBody}
                role="region"
                aria-label="Left the ward another way details"
                tabIndex={0}
              >
                {/*
                 * 🔴 **THIS SENTENCE CONTRADICTED THE ONE ABOVE IT, ON EVERY TEAM BUT ONE.** The empty
                 * state says the list CANNOT BE BUILT because a bed carries no link back to the
                 * referral; this footnote then said "No other admission referred to this team has
                 * ended" — **a conclusion drawn from the very data the sentence above says cannot be
                 * assembled.** If the list cannot be built, the page cannot know that no other
                 * admission has ended, and "no other has ended" is exactly the reassuring reading the
                 * first sentence exists to prevent.
                 *
                 * ⚠️ **AND IT IS INVISIBLE FROM THE ONE TEAM WHERE IT IS CORRECT.** On Inner City
                 * Clinic the join resolves, the list builds, and "no other" legitimately means "that is
                 * all of them". The sentence is true in one arm and false in the other, **and which arm
                 * a team is in differs per team** — which is why reading one team's page proves nothing
                 * about another's, and why it took a second reader opening both.
                 *
                 * So it renders only where the list could be built. Found by Ward Builder Three.
                 */}
                <p className={styles.absenceNotice} data-testid="ward-community-other-departures">
                  {cannotResolve
                    ? "Whether any other admission referred to this team has ended cannot be told from the record either, for the same reason."
                    : lists.otherDepartures.length === 0
                      ? "No other admission referred to this team has ended."
                      : `${lists.otherDepartures.length} other ${
                          lists.otherDepartures.length === 1 ? "admission" : "admissions"
                        } referred to this team ${lists.otherDepartures.length === 1 ? "has" : "have"} ended, recorded as: ${otherDepartureDestinations(lists.otherDepartures)}. None of those records says the person came back into the community, so none is on the list above.`}
                </p>
              </div>
            </WardPanel>

            {/* ── List 3, moved to the end — the one that cannot be built ──────────────────── */}
            <WardPanel title="Referrals we have made" testId="ward-community-referrals">
              <div className={styles.panelBody} role="region" aria-label="Referrals we have made details" tabIndex={0}>
                {/*
                 * Point 3. Rendered as a section with a statement and no list, deliberately. Leaving the
                 * section out would let a reader assume the hub had shown everything it knows; filtering
                 * community-sourced referrals by the patient's home region would produce a list that
                 * looked exactly right and was not this team's.
                 *
                 * No count in this panel's header, deliberately: a nought would read as "no referrals
                 * raised", and nothing on this page can measure that.
                 */}
                <p className={styles.absenceNotice} data-testid="ward-community-referrals-unattributable">
                  <strong>Referrals raised by this team cannot be attributed.</strong> The source records only
                  &ldquo;community&rdquo;, without a team name, so no list is shown.
                </p>
              </div>
            </WardPanel>

            {/* ── Active Caseload & CTO Statutory Register Table ── */}
            <section
              className={styles.caseloadSection}
              id="section-caseload"
              aria-label="Catchment Active Caseload and Statutory CTO Register"
            >
              <div className={styles.caseloadHead}>
                <h3 className={styles.caseloadTitle}>
                  <span>Catchment Active Caseload &amp; Statutory Register</span>
                  <span className={styles.badgePill}>{caseloadRows.length} Patients</span>
                </h3>
                <div className={styles.filterChipsGroup}>
                  <button
                    type="button"
                    className={styles.chipFilterBtn}
                    aria-pressed={caseloadFilter === "all"}
                    onClick={() => setCaseloadFilter("all")}
                  >
                    <span>All Active</span>
                    <span className={styles.badgePill}>{caseloadRows.length}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.chipFilterBtn}
                    aria-pressed={caseloadFilter === "5A"}
                    onClick={() => setCaseloadFilter("5A")}
                  >
                    <span>Recorded Form 5A</span>
                    <span className={styles.badgePill}>{form5ACount}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.chipFilterBtn}
                    aria-pressed={caseloadFilter === "5B"}
                    onClick={() => setCaseloadFilter("5B")}
                  >
                    <span>Recorded Form 5B</span>
                    <span className={styles.badgePill}>{form5BCount}</span>
                  </button>
                </div>
              </div>
              <div className={styles.tableContainer}>
                <table className={styles.dataTable} data-testid="ward-community-caseload-table">
                  <thead>
                    <tr>
                      <th scope="col">Referral / person</th>
                      <th scope="col">Age band</th>
                      <th scope="col">Statutory status</th>
                      <th scope="col">Recorded expiry</th>
                      <th scope="col">Follow-up</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCaseload.length === 0 ? (
                      <tr>
                        <td colSpan={6}>
                          <p className={styles.emptyNote} data-testid="ward-community-caseload-empty">
                            {caseloadFilter === "all"
                              ? "No accepted follow-up or matched admission is on this team's caseload yet."
                              : `No recorded Form ${caseloadFilter} on this team's caseload.`}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      visibleCaseload.map((row) => {
                        const formCode = caseloadStatutoryFormCode(row);
                        const formLabel = formCode ? legalFormName({ code: formCode }) : "No form recorded";
                        const expiryLabel = caseloadRecordedExpiryLabel(row, now);
                        const formTone =
                          formCode === "5A" || formCode === "5B" ? "danger" : formCode ? "warn" : "neutral";
                        return (
                          <tr key={row.key} data-testid={`ward-community-caseload-${row.referralId}`}>
                            <td>
                              <strong>{row.patientId ?? "No person on file"}</strong>
                              <span className={styles.caseloadMeta}>{row.umrn ?? row.referralId}</span>
                            </td>
                            <td>{row.ageBand}</td>
                            <td>
                              <span className={styles.statusPillBadge} data-tone={formTone}>
                                {formLabel}
                              </span>
                            </td>
                            <td>{expiryLabel}</td>
                            <td>{row.addressingState === "accepted" ? "Accepted" : "From matched admission"}</td>
                            <td>
                              {row.patientId !== undefined ? (
                                <button
                                  type="button"
                                  className={styles.btnSmSec}
                                  onClick={() => {
                                    setSelectedPatientId(row.patientId!);
                                    setActiveDrawer("pxDrawer");
                                  }}
                                >
                                  View Dossier
                                </button>
                              ) : (
                                <span className={styles.footnote}>No dossier without a person on file.</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Team Deployment, Clinic Rooms and Response Fleet ── */}
            <details className={styles.teamWorkspaceSection} id="section-team-workspace">
              <summary className={styles.teamWorkspaceSummary}>
                Illustrative staffing, rooms and vehicles
                <span className={styles.badgePill}>Sample only</span>
              </summary>
              <div className={styles.caseloadHead}>
                <h3 className={styles.caseloadTitle}>
                  <span>Example team deployment</span>
                  <span className={styles.badgePill}>8 example staff</span>
                </h3>
                <span style={{ fontSize: "var(--t-0)", color: "var(--muted)", fontFamily: "var(--mono)" }}>
                  Example huddle complete 0830 hrs · example routes assigned
                </span>
              </div>
              <p className={styles.illustrativeNotice} role="note">
                Illustrative staffing and logistics only. These are not roster, huddle, room or vehicle records for
                {` ${team.name}`}.
              </p>
              <div style={{ padding: "var(--ward-space-12) var(--ward-space-16)" }}>
                <div className={styles.teamRosterGrid}>
                  <div className={styles.staffCard}>
                    <div className={styles.staffHead}>
                      <div>
                        <div className={styles.staffName}>Dr S. Chen</div>
                        <div className={styles.staffRole}>Consultant Psychiatrist · Catchment Lead</div>
                      </div>
                      <span className={`${styles.statusPillBadge} ${styles.good}`}>On Duty</span>
                    </div>
                    <div className={styles.staffMetrics}>
                      <span>
                        Caseload: <b>42</b>
                      </span>
                      <span>Clinic Rm 2 · 0900 to 1630 hrs</span>
                    </div>
                  </div>
                  <div className={styles.staffCard}>
                    <div className={styles.staffHead}>
                      <div>
                        <div className={styles.staffName}>Dr K. Rao</div>
                        <div className={styles.staffRole}>Senior Registrar</div>
                      </div>
                      <span className={`${styles.statusPillBadge} ${styles.neutral}`}>In Field</span>
                    </div>
                    <div className={styles.staffMetrics}>
                      <span>
                        Caseload: <b>31</b>
                      </span>
                      <span>Vehicle 1 · Mobile Co-Response</span>
                    </div>
                  </div>
                  <div className={styles.staffCard}>
                    <div className={styles.staffHead}>
                      <div>
                        <div className={styles.staffName}>Dr J. Lim</div>
                        <div className={styles.staffRole}>Medical Officer</div>
                      </div>
                      <span className={`${styles.statusPillBadge} ${styles.good}`}>On Duty</span>
                    </div>
                    <div className={styles.staffMetrics}>
                      <span>
                        Caseload: <b>24</b>
                      </span>
                      <span>Clinic Rm 1 · Physical Health Reviews</span>
                    </div>
                  </div>
                  <div className={styles.staffCard}>
                    <div className={styles.staffHead}>
                      <div>
                        <div className={styles.staffName}>K. Vance</div>
                        <div className={styles.staffRole}>Nursing Unit Manager (NUM)</div>
                      </div>
                      <span className={`${styles.statusPillBadge} ${styles.good}`}>On Duty</span>
                    </div>
                    <div className={styles.staffMetrics}>
                      <span>Coordination</span>
                      <span>Triage Allocation &amp; Safety</span>
                    </div>
                  </div>
                  <div className={styles.staffCard}>
                    <div className={styles.staffHead}>
                      <div>
                        <div className={styles.staffName}>T. Bradley</div>
                        <div className={styles.staffRole}>Registered Nurse · Depot &amp; Crisis</div>
                      </div>
                      <span className={`${styles.statusPillBadge} ${styles.neutral}`}>In Field</span>
                    </div>
                    <div className={styles.staffMetrics}>
                      <span>
                        Caseload: <b>18</b>
                      </span>
                      <span>Outreach Vehicle 1</span>
                    </div>
                  </div>
                  <div className={styles.staffCard}>
                    <div className={styles.staffHead}>
                      <div>
                        <div className={styles.staffName}>C. Davis</div>
                        <div className={styles.staffRole}>Registered Nurse · Case Manager</div>
                      </div>
                      <span className={`${styles.statusPillBadge} ${styles.good}`}>On Duty</span>
                    </div>
                    <div className={styles.staffMetrics}>
                      <span>
                        Caseload: <b>22</b>
                      </span>
                      <span>Home Visits · Midland Sector</span>
                    </div>
                  </div>
                  <div className={styles.staffCard}>
                    <div className={styles.staffHead}>
                      <div>
                        <div className={styles.staffName}>M. Davies</div>
                        <div className={styles.staffRole}>Senior Social Worker</div>
                      </div>
                      <span className={`${styles.statusPillBadge} ${styles.good}`}>On Duty</span>
                    </div>
                    <div className={styles.staffMetrics}>
                      <span>
                        Caseload: <b>16</b>
                      </span>
                      <span>Housing &amp; NDIS Liaison</span>
                    </div>
                  </div>
                  <div className={styles.staffCard}>
                    <div className={styles.staffHead}>
                      <div>
                        <div className={styles.staffName}>E. Wilson</div>
                        <div className={styles.staffRole}>Occupational Therapist</div>
                      </div>
                      <span className={`${styles.statusPillBadge} ${styles.good}`}>On Duty</span>
                    </div>
                    <div className={styles.staffMetrics}>
                      <span>
                        Caseload: <b>14</b>
                      </span>
                      <span>Functional Recovery Assessments</span>
                    </div>
                  </div>
                </div>

                <div className={styles.clinicFleetGrid}>
                  <div>
                    <h4
                      style={{
                        margin: "0.75rem 0 0.5rem",
                        fontSize: "var(--t-1)",
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Illustrative clinic rooms
                    </h4>
                    <div className={styles.clinicRoomItem}>
                      <div className={styles.clinicRoomTop}>
                        <span className={styles.clinicRoomTitle}>Clinic Room 1 · Depot Clinic</span>
                        <span className={`${styles.statusPillBadge} ${styles.good}`}>Active</span>
                      </div>
                      <span style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
                        0900 to 1300 hrs · Dr J. Lim / RN T. Bradley
                      </span>
                    </div>
                    <div className={styles.clinicRoomItem}>
                      <div className={styles.clinicRoomTop}>
                        <span className={styles.clinicRoomTitle}>Clinic Room 2 · Consultant Reviews</span>
                        <span className={`${styles.statusPillBadge} ${styles.good}`}>Active</span>
                      </div>
                      <span style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
                        0900 to 1630 hrs · Dr S. Chen
                      </span>
                    </div>
                    <div className={styles.clinicRoomItem}>
                      <div className={styles.clinicRoomTop}>
                        <span className={styles.clinicRoomTitle}>Clinic Room 3 · Urgent Intake</span>
                        <span className={`${styles.statusPillBadge} ${styles.neutral}`}>Active Standby</span>
                      </div>
                      <span style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
                        Available for emergency crisis walk-ins
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4
                      style={{
                        margin: "0.75rem 0 0.5rem",
                        fontSize: "var(--t-1)",
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Illustrative outreach fleet
                    </h4>
                    <div className={styles.vehicleItem}>
                      <div className={styles.vehicleTop}>
                        <span className={styles.vehicleTitle}>Outreach Vehicle 1 (Dual Crew)</span>
                        <span className={`${styles.statusPillBadge} ${styles.neutral}`}>In Field</span>
                      </div>
                      <span style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
                        Dr K. Rao &amp; RN T. Bradley · Midland East Route
                      </span>
                    </div>
                    <div className={styles.vehicleItem}>
                      <div className={styles.vehicleTop}>
                        <span className={styles.vehicleTitle}>Outreach Vehicle 2 (Secondary)</span>
                        <span className={`${styles.statusPillBadge} ${styles.good}`}>At Base</span>
                      </div>
                      <span style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
                        Inspected · Standby for crisis call-out
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </details>
          </div>

          {/* ── The rail — worth-your-attention, the page's own limits, this team, and where to go
               next. Every figure here is read from an array already computed above; nothing new is
               derived just to fill the rail. ─────────────────────────────────────────────────── */}
          <aside className={styles.rail} aria-label="Context for this team's page">
            <WardPanel title="Coverage limits" testId="ward-community-limits">
              <div className={styles.panelBody} role="region" aria-label="Coverage limits details" tabIndex={0}>
                <ul className={styles.limitsList}>
                  <li>
                    <strong>Completeness.</strong> Only admissions linked to a referral this page can find are shown;{" "}
                    {unattributable.length} {unattributable.length === 1 ? "admission is" : "admissions are"} counted
                    rather than shown.
                  </li>
                  <li>
                    <strong>Current care.</strong> No community-team closure is recorded, so prior acceptance does not
                    establish current care.
                  </li>
                  <li>
                    <strong>Follow-up.</strong> Follow-up status is not shown or editable here.
                  </li>
                  <li>
                    <strong>Referrals raised.</strong> Community sources carry no team name.
                  </li>
                  <li>
                    <strong>Population.</strong> This is a destination-team view, not a geographic population view.
                  </li>
                  <li>
                    <strong>Dates.</strong> Elapsed time is shown instead of synthetic calendar dates.
                  </li>
                </ul>
              </div>
            </WardPanel>

            <WardPanel title="This team" testId="ward-community-facts">
              <div className={styles.panelBody} role="region" aria-label="This team details" tabIndex={0}>
                <dl className={styles.factsList}>
                  <div className={styles.factsRow}>
                    <dt>Name recorded as</dt>
                    <dd>{team.name}</dd>
                  </div>
                  <div className={styles.factsRow}>
                    <dt>Suburbs naming it</dt>
                    <dd data-testid="ward-community-suburb-count">
                      {suburbsNamingTeam === undefined ? "Not derivable from the catchment table" : suburbsNamingTeam}
                    </dd>
                  </div>
                  <div className={styles.factsRow}>
                    <dt>Entries that read alike</dt>
                    <dd>{nearDuplicates.length}</dd>
                  </div>
                  <div className={styles.factsRow}>
                    <dt>Hours, contacts, staffing</dt>
                    <dd>Not held</dd>
                  </div>
                </dl>
              </div>
            </WardPanel>

            <WardPanel title="Go to" testId="ward-community-links">
              <div className={styles.panelBody} role="region" aria-label="Go to links" tabIndex={0}>
                <ul className={styles.linksList}>
                  <li>
                    <Link className={styles.linksItem} href="/mockups/ward-flow/community">
                      All community teams
                    </Link>
                  </li>
                  <li>
                    <Link className={styles.linksItem} href={WARD_REFERRAL_INTAKE_HREF}>
                      Raise a referral
                    </Link>
                  </li>
                  <li>
                    <Link className={styles.linksItem} href="/mockups/ward-flow/referrals">
                      Referral board
                    </Link>
                  </li>
                </ul>
              </div>
            </WardPanel>
          </aside>
        </div>

        {/*
         * ⚠️ MOVED OFF THE TOP, 2026-09-05, AT THE OWNER'S REQUEST — "multiple warnings" was his
         * words for what stood between this page's heading and its first figure. NOT ONE SENTENCE
         * WAS CUT AND NOT ONE TESTID CHANGED, so every guard that polices this copy reads it
         * exactly where it did before.
         *
         * ⚠️ AND THE ORDER INSIDE THIS BLOCK IS UNCHANGED FOR A REASON. The comment that used to
         * sit above it recorded that these are grouped "so they read as the page's safety
         * statements rather than as loose warnings scattered among the clinical panels below".
         * That grouping is preserved; only its POSITION moved. Scattering them back among the
         * panels would undo the decision this move was careful not to touch.
         *
         * ⚠️ WHAT MUST NOT MOVE HERE: the caveats attached to a specific list stay WITH that list,
         * above it. `community-screen.tsx` has always placed the follow-up notice above the
         * discharged list so it cannot be read past on the way to an empty one. These three are
         * different — they qualify the whole page rather than one list — which is the only reason
         * they can sit at the foot at all.
         */}
        <footer
          className={styles.aboutPage}
          data-testid="ward-community-about"
          aria-label="Community data provenance and matching limits"
        >
          <details className={`${styles.aboutDisclosure} source-print`}>
            <summary className={styles.aboutHeading}>Data provenance and matching limits</summary>
            {/*
             * The two governance notices, grouped as one visual cluster so they read as the page's
             * safety statements rather than as loose warnings scattered among the clinical panels below
             * — the separation the second-edition layout asks for. Each keeps its own bordered warning
             * box; only the stacking is new.
             */}
            <div className={styles.noticeGroup}>
              {/* Point 4. Above every list, never a footnote: what the name in the heading above actually is. */}
              <p className={styles.notice} data-testid="ward-community-placeholder-notice">
                <strong>This team name comes from the S2015 catchment table.</strong> It is referral vocabulary, not a
                current roster of Western Australian community services. No team has agreed to be represented and this
                page does not identify who currently provides care.{" "}
                {/*
                 * 🔴 **OWNER RULING, 2026-09-05: SAY THAT DUPLICATE SPELLINGS EXIST, AND DO NOT MERGE
                 * THEM.** The refusal is the load-bearing half — normalising these names means the
                 * software deciding `Midalnd` means `Midland` and silently moving a patient from one
                 * team's list to another's on a guess. **A visible split a reader has been warned about
                 * is safer than an invisible merge nobody has been.**
                 *
                 * ⚠️ **IT SITS INSIDE THE PARAGRAPH THAT ALREADY SAYS WHERE THE NAMES CAME FROM**, not
                 * in a notice of its own. That paragraph is where a reader is already being told what
                 * these names are, and this page carries three advisory paragraphs before any data —
                 * a fourth would be the one nobody reads. Ward Builder Three's view, and I agree with it.
                 *
                 * ⚠️ **AND IT IS DERIVED PER TEAM, so it appears only where it is true.** A page for a
                 * team with no near-duplicate says nothing, because a warning shown where there is
                 * nothing to warn about teaches a reader to skip it.
                 */}
                {nearDuplicates.length > 0 ? (
                  <strong data-testid="ward-community-near-duplicate-warning">
                    {" "}
                    That document also spells some teams more than one way, and this is one of them: it also contains{" "}
                    {nearDuplicates.map((name, index) => (
                      <span key={name}>
                        {index > 0 ? (index === nearDuplicates.length - 1 ? " and " : ", ") : ""}
                        <span className={styles.fieldName}>{name}</span>
                      </span>
                    ))}
                    {nearDuplicates[nearDuplicates.length - 1].endsWith(".") ? "" : "."} Those are separate pages here,
                    and each reports only the people whose referral was typed its way — so somebody referred to this
                    team under another spelling is on that page and not on this one.
                  </strong>
                ) : null}
              </p>

              {/*
               * 🔴 **A PERSON'S RULING, RENDERED SEPARATELY FROM THE COMPUTED RESEMBLANCE ABOVE — AND
               * THE SEPARATION IS THE SAFETY, NOT THE DECORATION.**
               *
               * The sentence in the paragraph above says two NAMES are close. That is a property of the
               * strings, computed by a rule, checkable by anybody. **This says two names are the same
               * SERVICE, which is a clinical claim about a real clinic and which no rule in this
               * repository is entitled to make.** `ICC` and `Inner City Clinic` share three letters and
               * differ in length by fourteen: no edit distance, suffix fold or word-order key reaches
               * it, and any rule loose enough to would also merge `Alma Street (Cockburn)` with
               * `Alma Street (Melville)`, which are two sites.
               *
               * ⚠️ **IT WAS RECORDED FOR HOURS AND RENDERED NOWHERE, WHICH IS WHY THIS EXISTS.** The
               * table, its guards and its mutations all landed on 2026-09-05 and no component imported
               * them — so on the `ICC` page a reader saw NOTHING, which is precisely the gap the ruling
               * was made to close. **Both halves were individually correct; the combination was silent.**
               *
               * ⚠️ **AND IT IS A FOURTH ADVISORY BLOCK, WHICH THE COMMENT ABOVE ARGUES AGAINST.** That
               * argument is right about advisories and this is not one: it appears on FOUR of sixty-five
               * pages rather than on every page, so it cannot teach a reader to skip, and it is the only
               * thing on the page carrying a named person's decision. Stated rather than quietly
               * overridden.
               *
               * **It must read on the `ICC` page too, where there is no near-duplicate sentence to sit
               * beside** — so it carries its own context and never says "unlike the spellings above".
               */}
              {sameService.length > 0 && ratifiedBy !== undefined ? (
                <p className={styles.ratifiedNotice} data-testid="ward-community-ratified-alias">
                  <strong>
                    {ratifiedBy.decidedByKind === "person"
                      ? "A person has ruled that this team and "
                      : "This team has been recorded as the same service as "}
                    {sameService.map((name, index) => (
                      <span key={name}>
                        {index > 0 ? (index === sameService.length - 1 ? " and " : ", ") : ""}
                        <span className={styles.fieldName}>{name}</span>
                      </span>
                    ))}
                    {ratifiedBy.decidedByKind === "person" ? " are one service." : ", pending review."}
                  </strong>{" "}
                  This is a judgement about the real clinic, not an observation that the names look alike. No rule here
                  could have reached it and none did. Referrals typed under each spelling are still listed on that
                  spelling&apos;s own page: the decision is recorded, and nobody has been moved.
                  {/*
                   * 🔴 **TWO SENTENCES, BECAUSE ONE OF THEM WOULD BE A FABRICATED CLINICAL SIGNATURE.**
                   * Until 2026-09-06 every row here was the owner's, so this block could hard-code
                   * *"A person has ruled…"* and *"after being shown each spelling and the suburbs it
                   * routes"* and both were simply true. **The first agent-decided rows made both false
                   * without changing a character of this file** — the page would have told a clinician
                   * a named human signed a merge nobody had seen. The wording now switches on
                   * `decidedByKind`, which is a required field precisely so a new row cannot arrive
                   * claiming a signature by saying nothing.
                   *
                   * ⚠️ **THE AGENT SENTENCE NAMES ITS OWN LIMIT RATHER THAN SOFTENING IT.** "Recorded"
                   * not "ruled", "pending review" in the headline where a reader cannot miss it, and
                   * the provenance line says in terms that no person has seen the figures. A hedge
                   * that reads as confidence is worse than no hedge.
                   */}
                  <span className={styles.ratifiedProvenance} data-testid="ward-community-ratified-provenance">
                    {ratifiedBy.decidedByKind === "person" ? (
                      <>
                        Decided by {ratifiedBy.decidedBy} on {ratifiedBy.decidedOn}, after being shown each spelling and
                        the suburbs it routes.
                      </>
                    ) : (
                      <>
                        Recorded by {ratifiedBy.decidedBy} on {ratifiedBy.decidedOn}. No person has seen these spellings
                        or the suburbs they route, and this entry is waiting to be reviewed. Treat it as a working note,
                        not as a decision anyone has signed.
                      </>
                    )}
                  </span>
                </p>
              ) : null}

              {/*
               * Point 2 — the most important sentence on the page after the follow-up wording, and the
               * reason it is rendered whether the count is nought or not. A line that vanishes at nought
               * is a safety statement nobody ever sees.
               */}
              <p className={styles.notice} data-testid="ward-community-unattributable">
                <strong>
                  {unattributable.length}{" "}
                  {unattributable.length === 1
                    ? "admission is on no community team's page"
                    : "admissions are on no community team's page"}
                  .
                </strong>{" "}
                Only admissions linked to a referral naming this team appear here. Admissions without a matching
                referral, or whose referral asked only for a bed or emergency department, appear on no team page. This
                is not a geographic or complete population view.
              </p>
            </div>

            {/*
             * How a person is associated with this team, said once, near the top, because every list
             * below depends on it and none of them is meaningful without it. Quieter than the two
             * notices above — it qualifies the lists rather than disclaiming a claim — so it stays
             * outside the warning cluster.
             */}
            <p className={styles.provenance} data-testid="ward-community-association">
              Matches use the destination team written on the referral, never home region. A later decline or
              cancellation does not remove that association.{" "}
              <strong>
                {waitlistedForTeam.length}{" "}
                {waitlistedForTeam.length === 1
                  ? "admission is matched to this team and still waitlisted"
                  : "admissions are matched to this team and still waitlisted"}
                .
              </strong>{" "}
              {waitlistedForTeam.length === 1 ? "That person has" : "Those people have"} no pulled bed, so they appear
              in neither admitted list nor the unmatched count. A waitlisted match is still a match.
            </p>
          </details>
        </footer>

        {transportBookFor !== undefined ? (
          <div className={styles.modalBackdrop} role="presentation" onClick={closeTransportBook}>
            <div
              className={styles.modalDialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`ward-community-book-transport-title-${transportBookFor}`}
              data-testid={`ward-community-book-transport-dialog-${transportBookFor}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h3 id={`ward-community-book-transport-title-${transportBookFor}`} className={styles.modalTitle}>
                  Log the transport booking made by phone for {transportBookFor}
                </h3>
                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={closeTransportBook}
                  aria-label="Close dialog"
                >
                  &times;
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.declineForm}>
                  <label
                    className={styles.declineLabel}
                    htmlFor={`ward-community-transport-provider-${transportBookFor}`}
                  >
                    Who is collecting the patient
                    <select
                      id={`ward-community-transport-provider-${transportBookFor}`}
                      className={styles.declineSelect}
                      data-testid={`ward-community-transport-provider-${transportBookFor}`}
                      value={transportDraft.provider ?? NO_TRANSPORT_PROVIDER_VALUE}
                      onChange={(event) =>
                        setTransportDraft((current) => ({
                          ...current,
                          provider:
                            event.target.value === NO_TRANSPORT_PROVIDER_VALUE
                              ? undefined
                              : (event.target.value as TransportProvider),
                        }))
                      }
                    >
                      <option value={NO_TRANSPORT_PROVIDER_VALUE}>Not chosen</option>
                      {TRANSPORT_PROVIDERS.map((provider) => (
                        <option key={provider} value={provider}>
                          {provider}
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset
                    className={styles.transportFieldset}
                    data-testid={`ward-community-transport-escort-${transportBookFor}`}
                  >
                    <legend className={styles.declineLabel}>Does the patient need an escort?</legend>
                    <p className={styles.transportHint}>
                      Neither answer is selected. This is recorded as this team&apos;s answer.
                    </p>
                    {ESCORT_ANSWERS.map((answer) => (
                      <label key={answer.label} className={styles.transportOption}>
                        <input
                          type="radio"
                          name={`community-transport-escort-${transportBookFor}`}
                          data-testid={`ward-community-transport-escort-${answer.value ? "yes" : "no"}-${transportBookFor}`}
                          value={answer.value ? "yes" : "no"}
                          checked={transportDraft.escortRequired === answer.value}
                          onChange={() =>
                            setTransportDraft((current) => ({
                              ...current,
                              escortRequired: answer.value,
                            }))
                          }
                        />
                        {answer.label}
                      </label>
                    ))}
                  </fieldset>
                  <label className={styles.declineLabel} htmlFor={`ward-community-transport-cad-${transportBookFor}`}>
                    CAD transport number
                    <input
                      type="text"
                      id={`ward-community-transport-cad-${transportBookFor}`}
                      className={styles.declineSelect}
                      data-testid={`ward-community-transport-cad-${transportBookFor}`}
                      value={transportDraft.cadNumber}
                      onChange={(event) =>
                        setTransportDraft((current) => ({
                          ...current,
                          cadNumber: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <fieldset
                    className={styles.transportFieldset}
                    data-testid={`ward-community-transport-legal-${transportBookFor}`}
                  >
                    <legend className={styles.declineLabel}>Is the transport voluntary or involuntary?</legend>
                    {TRANSPORT_LEGAL_STATUSES.map((status) => (
                      <label key={status} className={styles.transportOption}>
                        <input
                          type="radio"
                          name={`community-transport-legal-${transportBookFor}`}
                          data-testid={`ward-community-transport-legal-${status}-${transportBookFor}`}
                          value={status}
                          checked={transportDraft.transportLegalStatus === status}
                          onChange={() =>
                            setTransportDraft((current) => ({
                              ...current,
                              transportLegalStatus: status,
                            }))
                          }
                        />
                        {TRANSPORT_LEGAL_STATUS_LABELS[status]}
                      </label>
                    ))}
                  </fieldset>
                  <label
                    className={styles.declineLabel}
                    htmlFor={`ward-community-transport-estimated-time-${transportBookFor}`}
                  >
                    Estimated time (24-hour, HH:MM)
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="HH:MM"
                      id={`ward-community-transport-estimated-time-${transportBookFor}`}
                      className={styles.declineSelect}
                      data-testid={`ward-community-transport-estimated-time-${transportBookFor}`}
                      value={transportDraft.estimatedTime}
                      onChange={(event) =>
                        setTransportDraft((current) => ({
                          ...current,
                          estimatedTime: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <fieldset
                    className={styles.transportFieldset}
                    data-testid={`ward-community-transport-estimated-day-${transportBookFor}`}
                  >
                    <legend className={styles.declineLabel}>Today or tomorrow?</legend>
                    {(["today", "tomorrow"] as const).map((day) => (
                      <label key={day} className={styles.transportOption}>
                        <input
                          type="radio"
                          name={`community-transport-estimated-day-${transportBookFor}`}
                          data-testid={`ward-community-transport-estimated-day-${day}-${transportBookFor}`}
                          value={day}
                          checked={transportDraft.estimatedDay === day}
                          onChange={() => setTransportDraft((current) => ({ ...current, estimatedDay: day }))}
                        />
                        {day === "today" ? "Today" : "Tomorrow"}
                      </label>
                    ))}
                  </fieldset>
                  {(() => {
                    const blocked = transportAnswersBlockedReason(transportDraft, now);
                    return (
                      <>
                        <button
                          type="button"
                          className={styles.transportConfirmButton}
                          data-testid={`ward-community-book-transport-confirm-${transportBookFor}`}
                          aria-disabled={blocked === undefined ? undefined : "true"}
                          aria-describedby={
                            blocked === undefined
                              ? undefined
                              : `ward-community-book-transport-blocked-${transportBookFor}`
                          }
                          title={blocked}
                          onClick={
                            blocked === undefined
                              ? () => submitBookTransport(transportBookFor)
                              : ignoreUnavailableActivation
                          }
                        >
                          Confirm booking
                        </button>
                        {blocked === undefined ? null : (
                          <span id={`ward-community-book-transport-blocked-${transportBookFor}`} className="sr-only">
                            {blocked}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {transportCancelFor !== undefined ? (
          <div className={styles.modalBackdrop} role="presentation" onClick={closeTransportCancel}>
            <div
              className={styles.modalDialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`ward-community-cancel-transport-title-${transportCancelFor}`}
              data-testid={`ward-community-cancel-transport-dialog-${transportCancelFor}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h3 id={`ward-community-cancel-transport-title-${transportCancelFor}`} className={styles.modalTitle}>
                  Cancel this team&apos;s transport booking for {transportCancelFor}
                </h3>
                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={closeTransportCancel}
                  aria-label="Close dialog"
                >
                  &times;
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.declineForm}>
                  <label
                    className={styles.declineLabel}
                    htmlFor={`ward-community-cancel-transport-reason-${transportCancelFor}`}
                  >
                    Why is the job being cancelled? The provider is told.
                    <select
                      id={`ward-community-cancel-transport-reason-${transportCancelFor}`}
                      className={styles.declineSelect}
                      data-testid={`ward-community-cancel-transport-reason-${transportCancelFor}`}
                      value={cancelTransportReason ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCancelTransportReason(
                          CANCEL_TRANSPORT_REASONS.includes(value as CancelTransportReason)
                            ? (value as CancelTransportReason)
                            : undefined,
                        );
                      }}
                    >
                      <option value="">Choose a reason…</option>
                      {CANCEL_TRANSPORT_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {changeReasonLabels[reason]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className={styles.transportConfirmButton}
                    data-testid={`ward-community-cancel-transport-confirm-${transportCancelFor}`}
                    aria-disabled={cancelTransportReason === undefined ? "true" : undefined}
                    aria-describedby={
                      cancelTransportReason === undefined
                        ? `ward-community-cancel-transport-blocked-${transportCancelFor}`
                        : undefined
                    }
                    title={cancelTransportReason === undefined ? CANCEL_TRANSPORT_UNCHOSEN : undefined}
                    onClick={
                      cancelTransportReason === undefined
                        ? ignoreUnavailableActivation
                        : () => submitCancelTransport(transportCancelFor)
                    }
                  >
                    Confirm cancel
                  </button>
                  {cancelTransportReason === undefined ? (
                    <span id={`ward-community-cancel-transport-blocked-${transportCancelFor}`} className="sr-only">
                      {CANCEL_TRANSPORT_UNCHOSEN}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeModal !== null && (
          <div className={styles.modalBackdrop} role="presentation" onClick={() => setActiveModal(null)}>
            <div
              className={styles.modalDialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="community-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h3 id="community-modal-title" className={styles.modalTitle}>
                  {activeModal.type === "review" ? "Review referral" : "Assign referral"}: {activeModal.referral.id}
                </h3>
                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={() => setActiveModal(null)}
                  aria-label="Close dialog"
                >
                  &times;
                </button>
              </div>
              <div className={styles.modalBody}>
                <p className={styles.modalProtNote}>
                  <strong>Not wired in this prototype.</strong>
                </p>
                <div className={styles.modalDetailsList}>
                  <p>
                    <strong>Referral:</strong> {activeModal.referral.id}
                  </p>
                  <p>
                    <strong>Urgency:</strong> {urgencyTierLabel(activeModal.referral.urgency)}
                  </p>
                  <p>
                    <strong>Origin:</strong> {referralOriginLabel(activeModal.referral)}
                  </p>
                  <p>
                    <strong>Region:</strong> {activeModal.referral.homeRegion}
                  </p>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.modalDoneBtn} onClick={() => setActiveModal(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Drawers (mounted only when activeDrawer !== null) ── */}
        {activeDrawer !== null && (
          <div className={styles.drawerScrim} role="presentation" onClick={() => setActiveDrawer(null)}>
            <div
              className={styles.drawerPanel}
              role="dialog"
              aria-modal="true"
              aria-labelledby="drawer-heading"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.drawerHead}>
                <h3 id="drawer-heading" className={styles.drawerTitle}>
                  {(activeDrawer === "px" || activeDrawer === "pxDrawer") &&
                    (selectedPatient
                      ? `Patient Dossier: ${patientDisplayName(selectedPatient)} · ${selectedPatient.umrn}`
                      : `Patient Dossier: ${selectedPatientId}`)}
                  {(activeDrawer === "referral" || activeDrawer === "referralDrawer") &&
                    `Referral Triage: ${selectedReferral ? selectedReferral.id : "Triage Detail"}`}
                  {(activeDrawer === "activity" || activeDrawer === "activityDrawer") &&
                    "Illustrative catchment activity"}
                  {(activeDrawer === "tasks" || activeDrawer === "tasksDrawer") && "Illustrative coordination tasks"}
                  {(activeDrawer === "tools" || activeDrawer === "toolsDrawer") && "Prototype display tools"}
                </h3>
                <button
                  type="button"
                  className={styles.drawerClose}
                  onClick={() => setActiveDrawer(null)}
                  aria-label="Close drawer"
                >
                  &times;
                </button>
              </div>
              <div className={styles.drawerBody}>
                {(activeDrawer === "px" || activeDrawer === "pxDrawer") && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: "var(--t-2)" }}>
                        {selectedPatient
                          ? `${patientDisplayName(selectedPatient)} · ${selectedPatient.umrn}`
                          : `${selectedPatientId} · no patient record found`}
                      </span>
                      <span className={`${styles.statusPillBadge} ${styles.neutral}`}>
                        {selectedPatient?.legalStatus ?? "Legal status not recorded"}
                      </span>
                    </div>
                    <p className={styles.footnote}>
                      Catchment dossier view for clinical coordination. Full electronic health record integration is
                      simulated.
                    </p>
                    <div
                      style={{
                        background: "var(--surface-2)",
                        padding: "0.75rem",
                        borderRadius: "var(--r2)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <h4 style={{ margin: "0 0 0.5rem", fontSize: "var(--t-1)" }}>Key Information</h4>
                      <dl className={styles.factsList}>
                        <div className={styles.factsRow}>
                          <dt>Key Clinician</dt>
                          <dd>{NOT_RECORDED_IN_WARD_FLOW}</dd>
                        </div>
                        <div className={styles.factsRow}>
                          <dt>Care Tier</dt>
                          <dd>{NOT_RECORDED_IN_WARD_FLOW}</dd>
                        </div>
                        <div className={styles.factsRow}>
                          <dt>Next Scheduled Review</dt>
                          <dd>{NOT_RECORDED_IN_WARD_FLOW}</dd>
                        </div>
                      </dl>
                    </div>
                    <button
                      type="button"
                      className={styles.btnSmPrimary}
                      onClick={() =>
                        setToastMessage(`Patient action for ${selectedPatientId}: Not wired in this prototype.`)
                      }
                    >
                      Update Care Plan
                    </button>
                  </>
                )}

                {(activeDrawer === "referral" || activeDrawer === "referralDrawer") && (
                  <>
                    <p className={styles.footnote}>Priority triage assessment and referral routing record.</p>
                    <div
                      style={{
                        background: "var(--surface-2)",
                        padding: "0.75rem",
                        borderRadius: "var(--r2)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <h4 style={{ margin: "0 0 0.5rem", fontSize: "var(--t-1)" }}>Triage Clinical Notes</h4>
                      <p style={{ fontSize: "var(--t-1)", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                        Patient presented with acute behavioural disturbance. Urgent liaison review recommended. No
                        current medical clearance barrier.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={styles.btnSmPrimary}
                      onClick={() => setToastMessage("Referral update: Not wired in this prototype.")}
                    >
                      Confirm Triage Allocation
                    </button>
                  </>
                )}

                {(activeDrawer === "activity" || activeDrawer === "activityDrawer") && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <p className={styles.footnote}>
                      Illustrative interface content only. This is not a live activity stream for {team.name}.
                    </p>
                    <div style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--line)", fontSize: "var(--t-1)" }}>
                      {/* No named patient here: an example event attached to a sample patient's name reads
                          as that person's record, and contradicted it (25 Sept 2026). */}
                      <span style={{ color: "var(--muted)", fontSize: "var(--t-0)", display: "block" }}>
                        Example entry
                      </span>
                      <b>Referral:</b> a priority referral arrives from an emergency department.
                    </div>
                    <div style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--line)", fontSize: "var(--t-1)" }}>
                      <span style={{ color: "var(--muted)", fontSize: "var(--t-0)", display: "block" }}>
                        Example entry
                      </span>
                      <b>Discharge:</b> a discharge summary arrives from an inpatient ward.
                    </div>
                    <div style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--line)", fontSize: "var(--t-1)" }}>
                      <span style={{ color: "var(--muted)", fontSize: "var(--t-0)", display: "block" }}>
                        Example entry
                      </span>
                      <b>Team huddle:</b> the morning allocations are completed.
                    </div>
                  </div>
                )}

                {(activeDrawer === "tasks" || activeDrawer === "tasksDrawer") && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <p className={styles.footnote}>
                      Illustrative interface content only. These are not recorded tasks for this catchment shift.
                    </p>
                    {[
                      {
                        id: "task-1",
                        label: "Example: review a Form 1A referral waiting for an answer",
                        prio: "Immediate",
                      },
                      { id: "task-2", label: "Example: coordinate the depot clinic list", prio: "Scheduled" },
                      {
                        id: "task-3",
                        label: "Example: contact a person after their discharge",
                        prio: "Attention Needed",
                      },
                    ].map((task) => {
                      const isDismissed = dismissedTaskIds.has(task.id);
                      return (
                        <div
                          key={task.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.625rem 0.75rem",
                            background: isDismissed ? "var(--surface-2)" : "var(--surface)",
                            border: "1px solid var(--line)",
                            borderRadius: "var(--r2)",
                            opacity: isDismissed ? 0.5 : 1,
                          }}
                        >
                          <div>
                            <span
                              style={{
                                fontSize: "var(--t-1)",
                                textDecoration: isDismissed ? "line-through" : "none",
                              }}
                            >
                              {task.label}
                            </span>
                            <span style={{ display: "block", fontSize: "var(--t-0)", color: "var(--muted)" }}>
                              {task.prio}
                            </span>
                          </div>
                          <button
                            type="button"
                            className={styles.btnSmSec}
                            onClick={() => {
                              setDismissedTaskIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(task.id)) next.delete(task.id);
                                else next.add(task.id);
                                return next;
                              });
                            }}
                          >
                            {isDismissed ? "Undo" : "Mark Done"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(activeDrawer === "tools" || activeDrawer === "toolsDrawer") && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div>
                      <h4 style={{ margin: "0 0 0.5rem", fontSize: "var(--t-1)" }}>Appearance / Theme</h4>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          type="button"
                          className={styles.btnSmSec}
                          onClick={() => handleSetThemeExplicit("light")}
                        >
                          Light
                        </button>
                        <button
                          type="button"
                          className={styles.btnSmSec}
                          onClick={() => handleSetThemeExplicit("dark")}
                        >
                          Dark
                        </button>
                        <button
                          type="button"
                          className={styles.btnSmSec}
                          onClick={() => handleSetThemeExplicit("auto")}
                        >
                          System Auto
                        </button>
                      </div>
                    </div>
                    <div>
                      <h4 style={{ margin: "0 0 0.5rem", fontSize: "var(--t-1)" }}>Prototype State Simulation</h4>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                        <button
                          type="button"
                          className={uiState === "populated" ? styles.btnSmPrimary : styles.btnSmSec}
                          onClick={() => {
                            setUiState("populated");
                            setToastMessage("State: Populated Console");
                          }}
                        >
                          Populated
                        </button>
                        <button
                          type="button"
                          className={uiState === "skeleton" ? styles.btnSmPrimary : styles.btnSmSec}
                          onClick={() => {
                            setUiState("skeleton");
                            setToastMessage("State: Skeleton Loading");
                          }}
                        >
                          Skeleton
                        </button>
                        <button
                          type="button"
                          className={uiState === "empty" ? styles.btnSmPrimary : styles.btnSmSec}
                          onClick={() => {
                            setUiState("empty");
                            setToastMessage("State: Empty Catchment");
                          }}
                        >
                          Empty
                        </button>
                        <button
                          type="button"
                          className={uiState === "error" ? styles.btnSmPrimary : styles.btnSmSec}
                          onClick={() => {
                            setUiState("error");
                            setToastMessage("State: Network Simulation Error");
                          }}
                        >
                          Error Banner
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Modals (mounted only when activeModalType !== null) ── */}
        {activeModalType !== null && (
          <div className={styles.modalOverlay} role="presentation" onClick={() => setActiveModalType(null)}>
            <div
              className={styles.modalBox}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-heading"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHead}>
                <h3 id="modal-heading" className={styles.modalTitle}>
                  {activeModalType === "intake" && "New Catchment Referral Intake"}
                  {activeModalType === "contact" && "Record Clinical Contact"}
                  {activeModalType === "handover" && "Print Catchment MDT Summary"}
                </h3>
                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={() => setActiveModalType(null)}
                  aria-label="Close dialog"
                >
                  &times;
                </button>
              </div>
              <div className={styles.modalBody}>
                {activeModalType === "intake" && (
                  <form
                    data-testid="ward-community-intake-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitCommunityFollowUp(team.name);
                    }}
                    className={styles.intakeForm}
                  >
                    <p className={styles.footnote}>
                      For community follow-up with {team.name}. This names the team and opens a real referral. It does
                      not invent a statutory duration.
                    </p>
                    <label className={styles.intakeField}>
                      <span>Team</span>
                      <input
                        type="text"
                        readOnly
                        value={team.name}
                        className={styles.searchInput}
                        data-testid="ward-community-intake-team"
                      />
                    </label>
                    <label className={styles.intakeField}>
                      <span>UMRN (optional)</span>
                      <input
                        type="text"
                        value={intakeDraft.umrn}
                        onChange={(event) => setIntakeDraft((current) => ({ ...current, umrn: event.target.value }))}
                        placeholder="Leave blank if nobody is on file"
                        className={styles.searchInput}
                        data-testid="ward-community-intake-umrn"
                      />
                    </label>
                    <label className={styles.intakeField}>
                      <span>Age band</span>
                      <select
                        className={styles.declineSelect}
                        value={intakeDraft.ageBand}
                        onChange={(event) =>
                          setIntakeDraft((current) => ({
                            ...current,
                            ageBand: event.target.value as IntakeDraft["ageBand"],
                          }))
                        }
                        data-testid="ward-community-intake-age-band"
                      >
                        <option value="">Choose one</option>
                        {COHORTS.map((cohort) => (
                          <option key={cohort} value={cohort}>
                            {cohort}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.intakeField}>
                      <span>Home region</span>
                      <select
                        className={styles.declineSelect}
                        value={intakeDraft.homeRegion}
                        onChange={(event) =>
                          setIntakeDraft((current) => ({
                            ...current,
                            homeRegion: event.target.value as IntakeDraft["homeRegion"],
                          }))
                        }
                        data-testid="ward-community-intake-home-region"
                      >
                        <option value="">Choose one</option>
                        {HOME_REGIONS.map((region) => (
                          <option key={region} value={region}>
                            {region}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.intakeField}>
                      <span>Urgency</span>
                      <select
                        className={styles.declineSelect}
                        value={intakeDraft.urgency}
                        onChange={(event) =>
                          setIntakeDraft((current) => ({
                            ...current,
                            urgency: event.target.value as IntakeDraft["urgency"],
                          }))
                        }
                        data-testid="ward-community-intake-urgency"
                      >
                        <option value="">Choose one</option>
                        {URGENCY_LEVELS.map((level) => (
                          <option key={level} value={String(level)}>
                            {urgencyTierLabel(level)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.intakeField}>
                      <span>Originating site</span>
                      <select
                        className={styles.declineSelect}
                        value={intakeDraft.originSiteCode}
                        onChange={(event) =>
                          setIntakeDraft((current) => ({ ...current, originSiteCode: event.target.value }))
                        }
                        data-testid="ward-community-intake-origin-site"
                      >
                        <option value="">Choose one</option>
                        {wardSites.map((site) => (
                          <option key={site.code} value={site.code}>
                            {site.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.intakeField}>
                      <span>History (optional)</span>
                      <textarea
                        value={intakeDraft.history}
                        onChange={(event) => setIntakeDraft((current) => ({ ...current, history: event.target.value }))}
                        className={styles.intakeHistory}
                        rows={4}
                        maxLength={REFERRAL_HISTORY_LIMITS.history}
                        data-testid="ward-community-intake-history"
                      />
                    </label>
                    <div className={styles.modalFoot}>
                      <button type="button" className={styles.btnSmSec} onClick={() => setActiveModalType(null)}>
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className={styles.btnSmPrimary}
                        data-testid="ward-community-intake-submit"
                        aria-disabled={intakeBlocked === undefined ? undefined : "true"}
                        aria-describedby={intakeBlocked === undefined ? undefined : "ward-community-intake-blocked"}
                        title={intakeBlocked}
                        onClick={intakeBlocked === undefined ? undefined : ignoreUnavailableActivation}
                      >
                        Send for community follow-up
                      </button>
                      {intakeBlocked === undefined ? null : (
                        <span id="ward-community-intake-blocked" className="sr-only">
                          {intakeBlocked}
                        </span>
                      )}
                    </div>
                  </form>
                )}

                {activeModalType === "contact" && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                    }}
                    style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
                  >
                    <p className={styles.footnote}>
                      Log a formal face-to-face or telehealth clinical contact against catchment caseload.
                    </p>
                    <div>
                      <label
                        htmlFor="community-contact-patient"
                        style={{
                          display: "block",
                          fontSize: "var(--t-1)",
                          fontWeight: 600,
                          marginBottom: "0.25rem",
                        }}
                      >
                        Patient ID
                      </label>
                      <input
                        id="community-contact-patient"
                        type="text"
                        required
                        defaultValue=""
                        className={styles.searchInput}
                        style={{ width: "100%", height: "2.25rem", padding: "0 0.5rem" }}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="community-contact-modality"
                        style={{
                          display: "block",
                          fontSize: "var(--t-1)",
                          fontWeight: 600,
                          marginBottom: "0.25rem",
                        }}
                      >
                        Contact Modality
                      </label>
                      <select
                        id="community-contact-modality"
                        className={styles.declineSelect}
                        style={{ width: "100%", height: "2.25rem" }}
                      >
                        <option value="home">Home Visit (Community Outreach)</option>
                        <option value="clinic">Clinic Appointment</option>
                        <option value="phone">Telephone Review</option>
                      </select>
                    </div>
                    <div
                      className={styles.modalFoot}
                      style={{ margin: 0, padding: 0, border: "none", background: "none" }}
                    >
                      <button type="button" className={styles.btnSmSec} onClick={() => setActiveModalType(null)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={styles.btnSmPrimary}
                        data-testid="ward-community-contact-save"
                        aria-disabled={clinicalContactCanSave() ? undefined : "true"}
                        title={clinicalContactCanSave() ? undefined : "Clinical contact is not recorded yet."}
                        onClick={clinicalContactCanSave() ? handleSaveClinicalContact : ignoreUnavailableActivation}
                      >
                        Save Contact
                      </button>
                    </div>
                    <p
                      className={styles.footnote}
                      data-testid="ward-community-contact-save-status"
                      data-recorded={contactRecord ? "true" : "false"}
                    >
                      {contactRecord
                        ? `Contact recorded as ${contactRecord.role} for this team at ${formatInstantWithDay(contactRecord.at, now)}.`
                        : "Clinical contact is not recorded yet."}
                    </p>
                  </form>
                )}

                {activeModalType === "handover" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <p className={styles.footnote}>Catchment MDT summary print view for clinical huddle.</p>
                    <div
                      style={{
                        background: "var(--surface-2)",
                        padding: "1rem",
                        borderRadius: "var(--r2)",
                        fontSize: "var(--t-1)",
                      }}
                    >
                      <b>{team.name} · Morning MDT Summary</b>
                      <p style={{ margin: "0.5rem 0 0" }}>
                        {caseloadRows.length} Active Caseload · {waitingReferrals.length} Waiting Referrals ·{" "}
                        {recordedCtoCount} recorded Form 5A/5B
                      </p>
                    </div>
                    <div
                      className={styles.modalFoot}
                      style={{ margin: 0, padding: 0, border: "none", background: "none" }}
                    >
                      <button type="button" className={styles.btnSmSec} onClick={() => setActiveModalType(null)}>
                        Close
                      </button>
                      <button
                        type="button"
                        className={styles.btnSmPrimary}
                        onClick={() => {
                          if (typeof window !== "undefined") window.print();
                        }}
                      >
                        Print Report
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className={`${styles.actionToast} ${toastMessage ? styles.show : ""}`} role="status" aria-live="polite">
          {toastMessage && (
            <>
              <span className={styles.toastIcon} aria-hidden="true">
                ℹ
              </span>
              <span>{toastMessage}</span>
            </>
          )}
        </div>
        <WardPrototypeFooter
          testId="community-screen-governance"
          note="Community team directory · Not a medical device"
        />
      </main>
    </div>
  );
}

/**
 * The ward's own name, from the units the provider holds. Never a literal: a hospital name typed
 * into a screen is a second home for a fact the data layer owns, which
 * `tests/ward-flow-data-boundary.test.ts` exists to refuse.
 *
 * An id the unit list does not carry renders as the id rather than as a blank or a guess.
 */
function unitName(unitId: string, units: readonly Unit[]): string {
  return units.find((unit) => unit.id === unitId)?.name ?? unitId;
}

/**
 * Which of the two bed states this is, said out loud on every row — and, for an occupied bed, a
 * third fact this function used to miss entirely.
 *
 * `bedIsOccupied` is true for `"pulled"` as well as `"occupied"` — correctly, because the ward has
 * given the bed away — but a person whose bed is pulled may still be in an emergency department. A
 * row that read the same for both would tell a community team somebody is on a ward when they are
 * not.
 *
 * ⚠️ **THAT PARAGRAPH USED TO STOP THERE AND CLAIM A COMPLETENESS IT DID NOT HAVE.** It named only
 * the pulled-but-not-arrived case as the one this function exists to distinguish, and missed the
 * mirror case the model actually records for an OCCUPIED bed: `Admission.awayAtEmergencyDepartmentSince`
 * is a real, non-null-able field, and `ward-admissions.ts` (around `:408`) is explicit that the bed
 * STAYS occupied while it is set — "It is a fact about the PERSON, which is why it is a field and
 * not a state." The seed creates admissions with it set (`ward-admissions-seed.ts`, around `:426`)
 * and the reducer writes it at runtime, but until now this function never read it, so "In the bed"
 * rendered identically for somebody on the ward and somebody who has been sent to an emergency
 * department — the exact confusion the doc comment above claimed to have already prevented.
 */
function bedStateLabel(admission: Admission): string {
  if (admission.state !== "occupied") return "A bed is pulled — not yet arrived";
  if (admission.awayAtEmergencyDepartmentSince !== null) return "In the bed — currently at an emergency department";
  return "In the bed";
}

/**
 * How long this person has been in this bed, in whole days, via `daysInBed` — the one place this
 * project computes a stay, counted from `arrivedAt` and never from `pulledAt`. `null` is stated
 * rather than substituted: somebody whose bed is pulled has not arrived, and "0 days" would read as
 * "arrived this morning".
 */
function stayLabel(admission: Admission, now: Instant): string {
  const days = daysInBed(admission, now);
  if (days === null) return "Not yet arrived, so no length of stay";
  if (days === 0) return "In this bed under a day";
  return `In this bed ${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * ⚠️ **BOTH FUNCTIONS BELOW NOW RENDER A DURATION, NOT AN INSTANT — A NEW OWNER RULING, NOT A
 * REVERSAL OF THE FINDING BELOW.** The demonstration-clock defect this block used to describe is
 * still closed exactly as stated: `WardFlowProvider` re-anchors the seeded state onto the hour the
 * demonstration opens by walking `INSTANT_FIELDS` (`ward-reanchor.ts`) and shifting every field it
 * names, and `INSTANT_FIELDS` names `pulledAt`, `awayAtEmergencyDepartmentSince`,
 * `expectedDischargeAt`, `dischargeDateSetAt`, `dischargeConfirmedAt`, `leftAt` and the nested
 * `recordedAt` — landed by `44ca08839` ("the demo clock was leaving six admission timestamps
 * behind"), reaching this branch through the merge `aeff0635b`. `tests/ward-reanchor.test.ts`
 * derives its expectation from BOTH `ward-model.ts` and `ward-admissions.ts` — see its `MODEL_FILES`
 * — so `now` and these dates are on ONE clock and `now - field` is sound.
 *
 * **What changed on 2026-09-01 is the question that clock defect used to gate.** Once a duration can
 * be computed soundly, the owner ruled it should be SHOWN — as elapsed time, never a calendar date.
 * A printed expected-discharge day or departure time would still be a synthetic figure rendered to a
 * community team as though it were a plan, because every date in this fixture is invented; "left 5
 * weeks ago" carries no such claim, cannot be mistaken for a real record of a real person, and stays
 * correct as the demonstration clock moves with nobody maintaining it. See this file's header block
 * for the full ruling and `community-elapsed.ts` for the one rounding rule both fields use.
 *
 * ⚠️ **THE TWO FIELDS ARE NOT THE SAME SHAPE, AND THAT IS THE TRAP HERE.** `leftAt` is set only once
 * a departure has actually happened, so `departureLabel` has exactly one direction to say. But
 * `expectedDischargeAt` is "a ward's own plan, revisable at will" (see the field's own comment in
 * `ward-admissions.ts`) and can be past OR future — `isPastExpectedDischarge` exists precisely
 * because a person can be overdue. A single past-tense renderer applied to both would print "left −3
 * days ago" for someone not yet due, which is nonsense, and would silently hide the one direction on
 * this screen that is clinically interesting: a plan that has already passed. `expectedBackLabel`
 * therefore branches on the sign of `now - expectedDischargeAt` and says "in N days/weeks" for a plan
 * still ahead, "N days/weeks ago" for one that has passed, and never spends the word "overdue" doing
 * it — that word names a followed-up-contact threshold this screen still does not have (see the "NO
 * THRESHOLD" paragraph in the file header, which this change does not touch).
 */
function expectedBackLabel(admission: Admission, now: Instant): string {
  // `null` cannot reach here — `expectedBack` filters it out — and is still stated rather than
  // substituted, because a fallback string is the one shape that could put an unrecorded plan on
  // this screen if that ever changed. Non-finite is degraded the same conservative way
  // `isPastExpectedDischarge` treats it — as no sound answer, never a guessed one.
  const expected = admission.expectedDischargeAt;
  if (expected === null || !Number.isFinite(expected) || !Number.isFinite(now)) {
    // D-47: one wording for one fact — `ward-board.tsx` and the printed daily sheet say the
    // same thing about the same field, and three variants read as three different facts.
    // 🔴 AND THE NULL ARM OF THIS BRANCH IS UNREACHABLE TODAY: the only caller maps
    // `lists.expectedBack`, built as `currentlyAdmitted.filter((a) => a.expectedDischargeAt
    // !== null)`, so a null cannot arrive. The LIVE path is non-finite-but-non-null — a stored
    // value that is not a date, which is a DATA DEFECT and not an absence. ⚠️ Two different
    // facts share this branch; separate them when you next touch this function. Not split
    // here because that is a behaviour change and D-47 is a wording ruling.
    return "No expected date set";
  }
  if (now > expected) {
    const days = daysBetween(expected, now);
    return days === 0
      ? "Expected discharge was earlier today"
      : `Expected discharge was ${elapsedDaysPhrase(days)} ago`;
  }
  if (now < expected) {
    const days = daysBetween(now, expected);
    return days === 0 ? "Expected discharge is later today" : `Expected discharge in ${elapsedDaysPhrase(days)}`;
  }
  return "Expected discharge is today";
}

/**
 * How long ago this admission ended, never the date it ended on. See the block above for why a
 * duration and not a date. `leftAt` is always in the past in practice (set only once a departure has
 * actually happened), so unlike `expectedBackLabel` there is exactly one direction to say — but a
 * negative or non-finite instant is still degraded to the absence wording rather than trusted, the
 * same conservative floor `daysInBed` holds for an incoherent arrival. `null` — nobody recorded a
 * departure instant — is still a distinct thing to say, and this exact wording is unchanged: an
 * absence is not a duration of zero.
 */
function departureLabel(admission: Admission, now: Instant): string {
  const leftAt = admission.leftAt;
  if (leftAt === null || !Number.isFinite(leftAt) || !Number.isFinite(now)) {
    return "Left this ward; the departure time was not recorded";
  }
  const days = Math.max(daysBetween(leftAt, now), 0);
  return days === 0 ? "Left this ward earlier today" : `Left this ward ${elapsedDaysPhrase(days)} ago`;
}

/**
 * The recorded destinations of the departures that are NOT on list 1, as a de-duplicated sentence
 * fragment in the vocabulary's own words. Derived from the same array whose length is printed
 * beside it, so the number and the words cannot describe different sets.
 */
function otherDepartureDestinations(departures: readonly Admission[]): string {
  const labels = [
    ...new Set(
      departures.map((admission) => leavingDestinationLabel(admission.leavingDestination) ?? "no destination recorded"),
    ),
  ];
  return labels.join("; ");
}

/**
 * Display labels only — never the picker's own option set. Duplicated from
 * `referral-intake.tsx`'s own (unexported) `SOURCE_LABELS`, the third time this repository has
 * made that trade rather than export a form-picker's private map for a read-only screen to import;
 * `community-vocabulary.ts`'s own near-identical duplication note records the same reasoning. A
 * source missing from this map still renders, as its own raw value, via the `??` fallback below.
 */
const REFERRAL_SOURCE_LABELS: Record<Referral["source"], string> = {
  community: "Community",
  crisis_service: "Crisis service",
  police: "Police",
  ambulance: "Ambulance",
  inter_hospital: "Inter-hospital",
  // The owner's own words, 2026-09-06, quoted rather than paraphrased: "ED medical staff will
  // refer a patient". Names the referrer, not the department — see `REFERRAL_SOURCES`.
  ed_medical: "ED medical staff",
  // Owner answer 25, 2026-09-17: "GP referrals: the GP is told by phone or letter for now; add
  // 'GP' as a referral source." See `REFERRAL_SOURCES`' own doc comment in `ward-model.ts` for
  // why this app never contacts the GP itself.
  gp: "General practitioner (GP)",
  psychiatric_ward: "Inpatient psychiatric ward",
};

/**
 * Where a referral says it came from, in words a coordinator reading this queue can act on: the
 * channel (`REFERRAL_SOURCE_LABELS`) and, where the record names one, the originating site
 * (`siteByCode`) — never a literal hospital name, which would be a second home for a fact
 * `wardSites` already owns. An unresolvable site code renders as the code itself rather than a
 * blank or a guess, the same discipline `unitName` holds a few functions above.
 */
function referralOriginLabel(referral: Referral): string {
  const channel = REFERRAL_SOURCE_LABELS[referral.source] ?? referral.source;
  const site = siteByCode(referral.originSiteCode);
  const origin = site ? `${channel} · ${site.name}` : `${channel} · site ${referral.originSiteCode}`;
  // The sending team, where the record names one. Appended through the shared helper rather than
  // formatted here: this is one of three places origin is rendered, and a wording decision made
  // three times becomes three claims about one fact the day somebody sharpens one of them.
  return withSendingTeam(origin, referral);
}

/**
 * The one addressing on `referral` that names `team` — the same match `admissionBelongsToTeam`
 * makes for an admission, read here for the referral itself rather than for who it eventually
 * admitted. `undefined` when this referral never named this team at all.
 */
function communityAddressingFor(referral: Referral, team: CommunityTeam): ReferralAddressing | undefined {
  return referral.destinations.find(
    (addressing) => addressing.destination.kind === "community_team" && addressing.destination.teamName === team.name,
  );
}

function caseloadStatutoryFormCode(row: CaseloadRow): string | undefined {
  return row.legalForm?.code;
}
/** Only a person-recorded expiry belongs in the current record. */
function caseloadRecordedExpiryAt(row: CaseloadRow): Instant | undefined {
  return row.legalForm?.dueAt;
}
function caseloadRecordedExpiryLabel(row: CaseloadRow, now: Instant): string {
  const expiresAt = caseloadRecordedExpiryAt(row);
  return expiresAt !== undefined ? formatInstantWithDay(expiresAt, now) : "No expiry recorded";
}
function caseloadRowsForTeam(
  referrals: readonly Referral[],
  movements: readonly Movement[],
  patients: readonly Patient[],
  team: CommunityTeam,
  matchedAdmissions: readonly Admission[],
): CaseloadRow[] {
  const patientById = new Map(patients.map((patient) => [patient.id, patient] as const));
  const movementById = new Map(movements.map((movement) => [movement.id, movement] as const));
  const movementByReferralId = new Map<string, Movement>();
  for (const movement of movements) {
    if (movement.referralId === undefined) continue;
    if (!movementByReferralId.has(movement.referralId)) {
      movementByReferralId.set(movement.referralId, movement);
    }
  }

  const rows: CaseloadRow[] = [];
  const seenReferralIds = new Set<string>();

  for (const referral of referrals) {
    const addressing = communityAddressingFor(referral, team);
    if (addressing === undefined || addressing.state !== "accepted") continue;
    seenReferralIds.add(referral.id);
    const movement = movementByReferralId.get(referral.id);
    const patient = referral.patientId === undefined ? undefined : patientById.get(referral.patientId);
    rows.push({
      key: referral.id,
      referralId: referral.id,
      patientId: referral.patientId,
      umrn: patient?.umrn,
      ageBand: referral.ageBand,
      legalForm: movement?.legalForm,
      addressingState: addressing.state,
    });
  }

  for (const admission of matchedAdmissions) {
    if (admission.referralId === null || seenReferralIds.has(admission.referralId)) continue;
    const referral = referrals.find((candidate) => candidate.id === admission.referralId);
    if (referral === undefined) continue;
    seenReferralIds.add(referral.id);
    const addressing = communityAddressingFor(referral, team);
    const movement =
      admission.movementId === null ? movementByReferralId.get(referral.id) : movementById.get(admission.movementId);
    const patient =
      admission.patientId !== null
        ? patientById.get(admission.patientId)
        : referral.patientId === undefined
          ? undefined
          : patientById.get(referral.patientId);
    rows.push({
      key: referral.id,
      referralId: referral.id,
      patientId: admission.patientId ?? referral.patientId,
      umrn: patient?.umrn,
      ageBand: referral.ageBand,
      legalForm: movement?.legalForm,
      addressingState: addressing?.state,
    });
  }

  return rows;
}

/**
 * Referrals naming `team` whose addressing to it is still `"queued"` — the team's own unanswered
 * queue. `FD-24` means a referral can be queued here while another destination has already decided
 * something else entirely; that is exactly why this reads the ADDRESSING's own state, never
 * `referralState(referral)`, which would read the referral's overall (and irrelevant) outcome.
 */
function referralsWaitingOnTeam(referrals: readonly Referral[], team: CommunityTeam): Referral[] {
  /*
   * 🔴 **FD-5 OPT-IN — EXCLUDED. This is a WORKLIST, and that is the whole of the answer.**
   * Every row here is something a person must accept or decline. A referral the referrer has taken
   * back needs neither: **a decline is a recorded clinical decision, and recording one against a
   * referral nobody is pressing would put a refusal on a person's record that no clinician meant.**
   *
   * ⚠️ **AND THE COST OF THIS EXCLUSION IS REAL, SO IT IS WRITTEN DOWN RATHER THAN LEFT TO BE
   * DISCOVERED:** a team that had been working on somebody now sees that row simply disappear from
   * this screen. **The team hub's list is where it stays visible and says it was withdrawn** — that
   * pairing is deliberate, and neither half is correct alone. ✅ **Ruled and built 2026-09-12.**
   *
   * ⚠️ **INERT TODAY, AND SAYING SO IS THE POINT.** No referral in the seed carries `withdrawnAt`,
   * so this exclusion changes nothing yet and a "simplification" back to a bare `state === "queued"`
   * would be GREEN. **An uncaught claim that knows it is uncaught is survivable; one that does not is
   * how the next author deletes it in good faith.** The catcher arrives with the seed specimen, which
   * is parked because nothing can yet CREATE a withdrawal — `RECORD_REFERRER_WITHDRAWAL` has no
   * dispatcher, and hand-authoring a state the reducer cannot reach would make all four of these look
   * tested while testing nothing.
   */
  return referrals.filter((referral) => isAwaitingTeamAnswer(communityAddressingFor(referral, team)));
}

/**
 * ⚠️ **THE MOST DELICATE DERIVATION ON THIS SCREEN, AND WHY EACH BRANCH IS WORDED AS IT IS.**
 *
 * `ReferralAddressing` carries `state: "accepted"` and `decidedAt` — WHEN this team said yes.
 * `Admission` carries `arrivedAt` — when the bed began. Comparing the two is real and derivable;
 * nothing else about "is this person still with the team" is. `ward-model.ts` holds no team
 * discharge, no episode end and no closing date for a community addressing — checked, not assumed
 * — so this function can only ever say what this team ACCEPTED and WHEN, never who is currently
 * under its care.
 *
 * Three outcomes, and they are the only three `lists.currentlyAdmitted` can produce:
 *
 *   - `"bed-pulled-not-arrived"` — `arrivedAt` is `null`. There is no admission START to compare an
 *     acceptance against, so this admission can be neither of the other two. A person here may
 *     still be in an emergency department; the bed has simply been given away.
 *   - `"accepted-before-admission"` — this team accepted, with a recorded `decidedAt`, strictly
 *     before `arrivedAt`. This is the group the owner asked for: admitted while ALREADY accepted.
 *   - `"referred-during-admission"` — everything else: no accepted addressing to this team at all,
 *     or one accepted at or after `arrivedAt`. A referral raised during the bed necessarily decides
 *     no earlier than it was raised, so it can never land in the branch above by construction —
 *     this is the ward reaching out, not a relapse under this team's care, and the two must never
 *     be merged.
 */
export type AcceptedBeforeAdmission = {
  readonly kind: "accepted-before-admission";
  readonly admission: Admission;
  readonly acceptedAt: Instant;
  /** Never null here — narrowed once, at the point this variant is built, so every reader of this
   *  type gets the real instant rather than re-deriving "this branch means arrivedAt exists". */
  readonly arrivedAt: Instant;
  /** Minutes from acceptance to the bed beginning — always positive by construction. Kept as raw
   *  minutes (not a day count) so sorting and "shortest gap" comparisons stay exact; every rendered
   *  duration is still derived from `acceptedAt`/`arrivedAt` through `daysBetween`, never from this
   *  field directly. */
  readonly gapMinutes: number;
};
type TeamAdmissionCategory =
  | AcceptedBeforeAdmission
  | { readonly kind: "referred-during-admission"; readonly admission: Admission }
  | { readonly kind: "bed-pulled-not-arrived"; readonly admission: Admission };

function categoriseTeamAdmission(
  admission: Admission,
  team: CommunityTeam,
  referrals: readonly Referral[],
  now: Instant,
): TeamAdmissionCategory {
  const arrivedAt = admission.arrivedAt;
  if (arrivedAt === null || !Number.isFinite(arrivedAt) || !Number.isFinite(now)) {
    return { kind: "bed-pulled-not-arrived", admission };
  }
  const referral =
    admission.referralId === null ? undefined : referrals.find((candidate) => candidate.id === admission.referralId);
  const addressing = referral ? communityAddressingFor(referral, team) : undefined;
  if (addressing && addressing.state === "accepted" && addressing.decidedAt !== undefined) {
    const decidedAt = addressing.decidedAt;
    if (Number.isFinite(decidedAt) && decidedAt < arrivedAt) {
      return {
        kind: "accepted-before-admission",
        admission,
        acceptedAt: decidedAt,
        arrivedAt,
        gapMinutes: arrivedAt - decidedAt,
      };
    }
  }
  return { kind: "referred-during-admission", admission };
}

/** A whole-day elapsed phrase, except that zero (or negative, or non-finite) whole days reads as
 *  "under a day" rather than "0 days" — `elapsedDaysPhrase` itself refuses a count below 1, so this
 *  is the one place on this screen that decides the same-day case its caller must decide. */
function elapsedSinceOrUnderADay(days: number): string {
  return Number.isFinite(days) && days > 0 ? elapsedDaysPhrase(days) : "under a day";
}
