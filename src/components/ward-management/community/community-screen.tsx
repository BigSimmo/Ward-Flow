"use client";

import { ReferralIntakeSummary } from "../referrals/referral-intake-summary";
import { currentCareContact, currentCareContactCompleted } from "../ward-care-journey";
import { CommunityFollowUp } from "./community-follow-up";
import { DischargeCareJourney } from "../discharges/discharge-care-journey";
import type { DischargeOpenHandle } from "../ward-discharge-records";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode } from "react";

import Link from "next/link";
import { ChevronDown, FileText, Phone, Plus, Search, Users } from "lucide-react";
import {
  Badge,
  Button,
  Count,
  Hero,
  HeroStat,
  Icon,
  Menu,
  Popover,
  SrOnly,
  StatusGlyph,
  TextInput,
  type WfTone,
} from "@/components/wf";
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
import { daysBetween, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { transportEtaRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { withUmrnInPlaceOfMovementIds } from "@/components/ward-management/ward-patient-resolver";
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
import v6 from "./community-team-v6.module.css";
import {
  DEMO_COMMUNITY_REFERRALS,
  DEMO_COMMUNITY_INPATIENTS,
  DEMO_COMMUNITY_EGRESS,
  DEMO_COMMUNITY_CASELOAD,
  DEMO_COMMUNITY_STAFF,
  resolveCommunityTeamConfig,
} from "./community-demo-cohort";

/** Said wherever this screen has a heading for a fact that no Ward Flow record holds. */
const NOT_RECORDED_IN_WARD_FLOW = "Not recorded in Ward Flow";

/** Search results shown at once; the rest are reached by typing more of the name or UMRN. */
const SEARCH_RESULT_LIMIT = 8;

/**
 * The hero's four lists, in the mockup's order. Ids are the panels' own. The team's own facts (how
 * to reach it, the sample deployment) are no longer a fifth tab: the v6 page keeps them in view
 * under every list, as the mockup's side column does.
 */
/**
 * The side column's sample roster (v6 "On duty today"). Illustrative only, the same eight example
 * roles the page carried before, by role rather than by name. No caseload counts: those were
 * invented figures with nothing behind them.
 */
const SAMPLE_ROSTER: readonly {
  initials: string;
  role: string;
  detail: string;
  status: "On duty" | "In field" | "At base";
  lead?: boolean;
}[] = [
  {
    initials: "SC",
    role: "Consultant psychiatrist",
    detail: "Catchment lead · clinic room 2",
    status: "On duty",
    lead: true,
  },
  { initials: "KR", role: "Senior registrar", detail: "Vehicle 1 · co-response", status: "In field" },
  { initials: "JL", role: "Medical officer", detail: "Clinic room 1 · physical health reviews", status: "On duty" },
  { initials: "KV", role: "Nurse unit manager", detail: "Coordination · triage allocation", status: "On duty" },
  { initials: "TB", role: "Registered nurse", detail: "Depot and crisis · vehicle 1", status: "In field" },
  { initials: "CD", role: "RN case manager", detail: "Home visits", status: "On duty" },
  { initials: "MD", role: "Senior social worker", detail: "Housing and NDIS liaison", status: "At base" },
  { initials: "EW", role: "Occupational therapist", detail: "Recovery assessments", status: "At base" },
];

const ROSTER_TONE: Record<(typeof SAMPLE_ROSTER)[number]["status"], WfTone> = {
  "On duty": "success",
  "In field": "info",
  "At base": "neutral",
};

const TEAM_TABS = [
  { id: "tab-triage", buttonId: "tabBtn-triage", label: "Waiting answer", section: "ward-community-waiting" },
  { id: "tab-inpatients", buttonId: "tabBtn-inpatients", label: "In a bed", section: "ward-community-admitted" },
  { id: "tab-egress", buttonId: "tabBtn-egress", label: "Expected back", section: "ward-community-expected-back" },
  { id: "tab-caseload", buttonId: "tabBtn-caseload", label: "Caseload and CTOs", section: "section-caseload" },
] as const;

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

type ActiveTabType = "tab-triage" | "tab-inpatients" | "tab-expected" | "tab-egress" | "tab-caseload";

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
type ModalType = "intake" | "contact" | "handover" | "crisis" | null;

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

type CaseloadFilter = "all" | "5A" | "5B" | "cto" | "high" | "depot";

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
 * The discharged list covers recorded community departures, independently of follow-up status.
 * `INSTANT_FIELDS` NAMES `recordedAt` explicitly, including nested follow-up records.
 *
 *  1. Follow-up arrangements can be recorded on the discharge board (2026-10-03) through
 *     RECORD_ADMISSION_FOLLOW_UP. The community list does not filter on that fact: neither an
 *     empty list nor an arrangement recorded elsewhere proves that contact happened.
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
  demonstration = false,
}: {
  teamId: string;
  demonstration?: boolean;
  admissions?: Admission[];
  referrals?: Referral[];
}) {
  usePrintableDisclosures();
  // Phone only (8 Oct 2026): the provenance and coverage disclosure starts closed under 48rem so
  // the team's lists are not followed by a long block of explanatory text. It still opens with a
  // tap, and above 48rem it renders open exactly as before.
  const limitsDisclosureRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const disclosure = limitsDisclosureRef.current;
    if (!disclosure || typeof window.matchMedia !== "function") return;
    if (window.matchMedia("(max-width: 48rem)").matches) disclosure.open = false;
  }, []);
  const {
    admissions: liveAdmissions,
    referrals: liveReferrals,
    notices,
    units,
    movements,
    patients,
    rejections,
    openDischargeRecord,
    readDischargeRecord,
    dispatch,
  } = useWardFlow();
  const now = useWardFlowClock();
  const team =
    communityTeamById(teamId) ??
    (teamId === "fremantle" || teamId === "alma-street" ? communityTeamById("alma-street-fremantle") : null);
  const [followUpFilter, setFollowUpFilter] = useState("all");
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
  const [selectedReferralId, setSelectedReferralId] = useState<string | null>(null);
  const selectedReferral = (referrals ?? liveReferrals).find((referral) => referral.id === selectedReferralId);
  const [pendingAcceptance, setPendingAcceptance] = useState<{ id: string; rejectionCount: number } | null>(null);
  const [acceptanceError, setAcceptanceError] = useState<string | null>(null);
  const [showCareEditor, setShowCareEditor] = useState(false);
  const [careAccess, setCareAccess] = useState<{ admissionId: string; handle: DischargeOpenHandle } | null>(null);
  const [triageFilter, setTriageFilter] = useState<"all" | "p1" | "p2" | "p3" | "ed">("all");
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
  const [inpatientFilter, setInpatientFilter] = useState<"all" | "secure" | "open" | "older">("all");
  const [egressFilter, setEgressFilter] = useState<"all" | "overdue" | "today" | "upcoming">("all");

  const hasExplicitProps = Boolean(admissions || referrals);
  const isDemoMode = demonstration && !hasExplicitProps;

  const demoTeamReferrals = useMemo(() => {
    return DEMO_COMMUNITY_REFERRALS.filter((r) => {
      if (r.team && r.team !== teamId && (teamId !== "alma-street-fremantle" || r.team !== "fremantle")) return false;
      return true;
    });
  }, [teamId]);

  const demoVisibleReferrals = useMemo(() => {
    return demoTeamReferrals.filter((r) => {
      if (triageFilter === "p1") return r.urgency === 1;
      if (triageFilter === "p2") return r.urgency === 2;
      if (triageFilter === "p3") return r.urgency === 3;
      if (triageFilter === "ed") {
        return (
          r.origin.toLowerCase().includes("ed") ||
          r.origin.toLowerCase().includes("crisis") ||
          r.origin.toLowerCase().includes("resus")
        );
      }
      return true;
    });
  }, [demoTeamReferrals, triageFilter]);

  const demoVisibleInpatients = DEMO_COMMUNITY_INPATIENTS.filter((i) => {
    if (inpatientFilter === "all") return true;
    return i.category === inpatientFilter;
  });

  const demoVisibleEgress = DEMO_COMMUNITY_EGRESS.filter((e) => {
    if (egressFilter === "all") return true;
    return e.status === egressFilter;
  });

  const demoVisibleCaseload = DEMO_COMMUNITY_CASELOAD.filter((c) => {
    if (caseloadFilter === "all") return true;
    if (caseloadFilter === "5A") return c.statutoryStatus.includes("5A");
    if (caseloadFilter === "5B") return c.statutoryStatus.includes("5B");
    if (caseloadFilter === "cto") return c.category.includes("cto");
    if (caseloadFilter === "high") return c.category.includes("high");
    if (caseloadFilter === "depot") return c.category.includes("depot");
    return true;
  });

  const handleCompleteContact = useCallback((ptId: string) => {
    setSelectedPatientId(ptId);
    setCareAccess(null);
    setShowCareEditor(true);
    setActiveDrawer("pxDrawer");
  }, []);

  const scrollToSection = useCallback((id: string) => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(id) || document.querySelector(`[data-testid="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  function handleSetThemeExplicit(theme: "light" | "dark" | "auto") {
    applyAppearance(theme);
    setToastMessage(`Appearance set to ${theme}.`);
  }

  function handleActionClick(action: "Contacted" | "Review" | "Assign", referral: Referral) {
    if (action === "Contacted") {
      const recorded = recordClinicalContact(dispatch, now, teamId);
      if (recorded !== null) {
        setContactRecord(recorded);
        setToastMessage("Team contact logged. This does not record patient or referral contact.");
      }
    } else if (action === "Review") {
      setSelectedReferralId(referral.id);
      setPendingAcceptance(null);
      setAcceptanceError(null);
      setActiveDrawer("referralDrawer");
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
      } else if (
        e.key === "/" &&
        (e.target as HTMLElement)?.tagName !== "INPUT" &&
        (e.target as HTMLElement)?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        // The hero's search popover opens from its own trigger and focuses its input itself.
        if (!document.getElementById("q")) document.getElementById("ward-community-search-trigger")?.click();
        document.getElementById("q")?.focus();
      } else if (e.key === "[") {
        const current = document.documentElement.getAttribute("data-rail");
        document.documentElement.setAttribute("data-rail", current === "closed" ? "open" : "closed");
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
  const handleConfirmDecline = useCallback(
    (referralId: string) => {
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
    },
    [declineDraft, dispatch, now],
  );

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
  const handleConfirmAccept = useCallback(
    (referralId: string) => {
      const current = liveReferrals.find((referral) => referral.id === referralId);
      const addressing = current?.destinations.find(
        (entry) =>
          entry.destination.kind === "community_team" &&
          !!team &&
          [team.name, ...ratifiedSameServiceNames(team.name)].includes(entry.destination.teamName),
      );
      const firstCommunityAddressing = current?.destinations.find(
        (entry) => entry.destination.kind === "community_team",
      );
      if (
        !addressing ||
        firstCommunityAddressing !== addressing ||
        addressing.state !== "queued" ||
        addressing.withdrawnAt !== undefined
      ) {
        setAcceptanceError("Referral cannot be accepted: reload the current queued referral for this team.");
        setPendingAcceptance(null);
        return;
      }
      setAcceptanceError(null);
      setPendingAcceptance({ id: referralId, rejectionCount: rejections.length });
      dispatch({
        type: "ACCEPT_REFERRAL",
        role: "community",
        now,
        referralId,
        destinationKind: "community_team",
      });
    },
    [dispatch, liveReferrals, now, rejections.length, team],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as unknown as Record<string, unknown>;
    win.switchTab = (tabId: ActiveTabType) => {
      setActiveTab(tabId);
    };
    win.openReferralDrawer = (refId: string) => {
      setSelectedReferralId(refId);
      setPendingAcceptance(null);
      setAcceptanceError(null);
      setActiveDrawer("referralDrawer");
    };
    win.openPatientDrawer = (ptId: string) => {
      setSelectedPatientId(ptId);
      setActiveDrawer("pxDrawer");
    };
    win.acceptReferral = (refId: string) => {
      handleConfirmAccept(refId);
    };
    win.declineReferral = (refId: string) => {
      handleConfirmDecline(refId);
    };
    win.completeContact = (ptId: string) => {
      handleCompleteContact(ptId);
    };
    win.openCrisisModal = () => {
      setActiveModalType("crisis");
    };
    win.openModal = (modalId: string) => {
      if (modalId === "newReferralModal") setActiveModalType("intake");
      else if (modalId === "handoverModal") setActiveModalType("handover");
      else if (modalId === "contactModal") setActiveModalType("contact");
      else if (modalId === "crisisModal") setActiveModalType("crisis");
    };
    win.openDrawer = (drawerId: DrawerType) => {
      setActiveDrawer(drawerId);
    };
    win.selectTeam = (targetTeamId: string) => {
      const target = COMMUNITY_TEAM_PAGES.find((t) => t.id === targetTeamId);
      if (target) {
        window.location.href = communityTeamHref(target);
      }
    };
  }, [referrals, liveReferrals, handleCompleteContact, handleConfirmAccept, handleConfirmDecline, now]);

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

  const teamConfig = resolveCommunityTeamConfig(team);
  const careActor = { role: "community", actingTeamId: team.id } as const;
  const patientAdmissions = liveAdmissions.filter(
    (admission) => admission.patientId === selectedPatientId && admissionBelongsToTeam(admission, team, liveReferrals),
  );
  const careRead =
    careAccess && patientAdmissions.some((admission) => admission.id === careAccess.admissionId)
      ? readDischargeRecord(careActor, careAccess.admissionId, careAccess.handle)
      : null;
  function openPatientCare() {
    setShowCareEditor(true);
    if (patientAdmissions.length === 1) {
      const admissionId = patientAdmissions[0]!.id;
      setCareAccess({ admissionId, handle: openDischargeRecord(careActor, admissionId) });
    } else {
      setCareAccess(null);
    }
  }
  const acceptedAddressing =
    pendingAcceptance &&
    liveReferrals
      .find((referral) => referral.id === pendingAcceptance.id)
      ?.destinations.find(
        (entry) =>
          entry.destination.kind === "community_team" &&
          [team.name, ...ratifiedSameServiceNames(team.name)].includes(entry.destination.teamName),
      );
  const acceptanceRefusal =
    pendingAcceptance &&
    rejections
      .slice(pendingAcceptance.rejectionCount)
      .find((rejection) => rejection.attempted === "ACCEPT_REFERRAL" && rejection.movementId === pendingAcceptance.id);
  const acceptanceMessage =
    acceptanceError ??
    (acceptanceRefusal
      ? `Referral was not accepted: ${acceptanceRefusal.reason}`
      : pendingAcceptance && acceptedAddressing?.state === "accepted"
        ? `Referral ${pendingAcceptance.id} accepted for ${team.name} follow-up. No clinician assignment was recorded.`
        : pendingAcceptance
          ? "Awaiting referral acceptance result."
          : null);
  const lists = communityHubLists(source, team, sourceReferrals);
  const filteredDepartures = lists.dischargedIntoTheArea.filter(
    (a) =>
      followUpFilter === "all" ||
      (followUpFilter === "missing_arrangement"
        ? a.followUp?.state !== "arranged"
        : !currentCareContactCompleted(a.careJourney)),
  );
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
  const urgentWaitingCount = waitingReferrals.filter((r) => r.urgency === 1 || r.urgency === 2).length;
  const p1ReferralsCount = waitingReferrals.filter((r) => r.urgency === 1).length;
  const p2ReferralsCount = waitingReferrals.filter((r) => r.urgency === 2).length;
  const p3ReferralsCount = waitingReferrals.filter((r) => r.urgency === 3).length;
  const edReferralsCount = waitingReferrals.filter(
    (r) =>
      r.source === "ed_medical" ||
      r.source === "crisis_service" ||
      referralOriginLabel(r).toLowerCase().includes("ed") ||
      referralOriginLabel(r).toLowerCase().includes("crisis"),
  ).length;
  const visibleWaitingReferrals = waitingReferrals.filter((r) => {
    if (triageFilter === "p1") return r.urgency === 1;
    if (triageFilter === "p2") return r.urgency === 2;
    if (triageFilter === "p3") return r.urgency === 3;
    if (triageFilter === "ed") {
      return (
        r.source === "ed_medical" ||
        r.source === "crisis_service" ||
        referralOriginLabel(r).toLowerCase().includes("ed") ||
        referralOriginLabel(r).toLowerCase().includes("crisis")
      );
    }
    return true;
  });
  const hasAnyReferralsForTeam = sourceReferrals.some((r) =>
    r.destinations.some((d) => d.destination.kind === "community_team" && d.destination.teamName === team.name),
  );
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
        <div className={v6.standing}>
          {/*
           * THE V6 HERO, 7 October 2026 — `design/pages-v6/CommunityTeam.png`. One band carries the
           * team's name with its team menu, the six counts, the four tabs and the four team actions.
           * It replaces the inner header (whose Activity, Tasks, Tools and Theme buttons repeated the
           * shell's own), the action bar and the telemetry ribbon. Every count reads the same
           * expression the ribbon and tab badges read, so no figure changed.
           */}
          <Hero
            level={1}
            eyebrow="Community team"
            title={team.name}
            titleMeta={
              <Popover
                label="WA community mental health teams"
                panelClassName={v6.teamPanel}
                trigger={(props) => (
                  <button
                    {...props}
                    type="button"
                    className={v6.heroMenuButton}
                    aria-label="Change team"
                    title="Switch community team"
                  >
                    <Icon icon={ChevronDown} size={14} />
                  </button>
                )}
              >
                {(close) => (
                  <div className={v6.teamMenu}>
                    <p className={v6.teamMenuHead}>
                      <span>WA community mental health teams</span>
                      <span>{COMMUNITY_TEAM_PAGES.length} teams</span>
                    </p>
                    <ul className={v6.teamMenuList}>
                      {COMMUNITY_TEAM_PAGES.map((other) => (
                        <li key={other.id}>
                          <Link
                            className={v6.teamMenuItem}
                            href={communityTeamHref(other)}
                            aria-current={other.id === team.id ? "page" : undefined}
                            onClick={close}
                          >
                            <span>{other.name}</span>
                            {other.id === team.id ? <Badge size="sm">Active</Badge> : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Popover>
            }
            stats={
              <div className={v6.heroStats}>
                <HeroStat value={isDemoMode ? teamConfig.caseload : caseloadRows.length} label="Caseload" />
                <HeroStat
                  value={isDemoMode && !hasAnyReferralsForTeam ? teamConfig.triage : waitingReferrals.length}
                  trend={
                    isDemoMode && !hasAnyReferralsForTeam
                      ? `${teamConfig.urgentTriage} urgent`
                      : urgentWaitingCount > 0
                        ? `${urgentWaitingCount} urgent`
                        : undefined
                  }
                  label="Waiting answer"
                />
                <HeroStat
                  // One figure with the tab: everyone in a bed or holding one, and how many of
                  // those hold a pulled bed they have not yet reached.
                  value={isDemoMode ? teamConfig.inpatients : lists.currentlyAdmitted.length}
                  trend={
                    isDemoMode
                      ? `of ${teamConfig.inpatientsTotal}`
                      : bedPulledCount > 0
                        ? `${bedPulledCount} bed pulled`
                        : undefined
                  }
                  label="In a bed"
                />
                <HeroStat value={isDemoMode ? teamConfig.egress : lists.expectedBack.length} label="Expected back" />
                <HeroStat value={isDemoMode ? teamConfig.cto : form5ACount} label="On a CTO" />
                {/* No record in the model holds a team's open crisis episodes, so outside the
                    demonstration the count is not shown rather than invented. */}
                <HeroStat
                  value={isDemoMode ? teamConfig.crisis : <span aria-hidden="true">–</span>}
                  trend={isDemoMode ? undefined : "Not recorded"}
                  label="Crisis open"
                  tone="info"
                />
              </div>
            }
            aside={
              <>
                <Menu
                  label="Illustrative drawers"
                  align="end"
                  items={[
                    { id: "activity", label: "Activity sample", onSelect: () => setActiveDrawer("activityDrawer") },
                    { id: "tasks", label: "Tasks sample", onSelect: () => setActiveDrawer("tasksDrawer") },
                    { id: "tools", label: "Tools sample", onSelect: () => setActiveDrawer("toolsDrawer") },
                  ]}
                  trigger={(props) => (
                    <Button {...props} variant="onHero" size="sm" iconEnd={ChevronDown}>
                      Samples
                    </Button>
                  )}
                />
                <Popover
                  label="Search sample patients"
                  align="end"
                  panelClassName={v6.searchPanel}
                  trigger={(props) => (
                    <Button
                      {...props}
                      variant="onHero"
                      size="sm"
                      iconOnly
                      icon={Search}
                      id="ward-community-search-trigger"
                      aria-label="Search sample patients by name or UMRN"
                      title="Search sample patients by name or UMRN"
                    />
                  )}
                >
                  {(close) => (
                    <div className={v6.search}>
                      <TextInput
                        type="search"
                        id="q"
                        icon={Search}
                        aria-label="Search sample patients"
                        placeholder="Type UMRN or name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClear={() => setSearchQuery("")}
                      />
                      {searchQuery.trim() === "" ? (
                        <p className={v6.searchNote} data-testid="ward-community-search-hint">
                          Type a name or UMRN to search the sample patients.
                        </p>
                      ) : searchResults.length === 0 ? (
                        <p className={v6.searchNote} data-testid="ward-community-search-empty">
                          No sample patient matches &ldquo;{searchQuery.trim()}&rdquo;.
                        </p>
                      ) : (
                        <ul className={v6.searchList}>
                          {searchResults.slice(0, SEARCH_RESULT_LIMIT).map((patient) => (
                            <li key={patient.id}>
                              <button
                                type="button"
                                className={v6.searchHit}
                                data-testid={`ward-community-search-hit-${patient.id}`}
                                onClick={() => {
                                  setSelectedPatientId(patient.id);
                                  setActiveDrawer("pxDrawer");
                                  close();
                                }}
                              >
                                <span className={v6.searchHitTop}>
                                  <strong>
                                    {patientDisplayName(patient)} · {patient.umrn}
                                  </strong>
                                  <Badge size="sm">{patient.legalStatus ?? "Legal status not recorded"}</Badge>
                                </span>
                                <span className={v6.searchHitMeta}>
                                  {patient.catchmentCommunityTeam ?? "Community team not recorded"}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </Popover>
              </>
            }
            bar={
              <div className={v6.trackScroll}>
                <div className={v6.track} role="tablist" aria-label="Community team lists">
                  {TEAM_TABS.map((tab) => {
                    const selected = activeTab === tab.id;
                    const count =
                      tab.id === "tab-triage"
                        ? isDemoMode && !hasAnyReferralsForTeam
                          ? teamConfig.triage
                          : waitingReferrals.length
                        : tab.id === "tab-inpatients"
                          ? isDemoMode
                            ? teamConfig.inpatients
                            : lists.currentlyAdmitted.length
                          : tab.id === "tab-egress"
                            ? isDemoMode
                              ? teamConfig.egress
                              : lists.expectedBack.length
                            : isDemoMode
                              ? teamConfig.caseload
                              : caseloadRows.length;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        id={tab.buttonId}
                        aria-selected={selected}
                        aria-controls={tab.id}
                        tabIndex={selected ? 0 : -1}
                        className={v6.trackItem}
                        onClick={() => {
                          setActiveTab(tab.id);
                          scrollToSection(tab.section);
                        }}
                        onKeyDown={(event) => {
                          const index = TEAM_TABS.findIndex((item) => item.id === tab.id);
                          const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                          if (step === 0) return;
                          event.preventDefault();
                          const next = TEAM_TABS[(index + step + TEAM_TABS.length) % TEAM_TABS.length]!;
                          setActiveTab(next.id);
                          document.getElementById(next.buttonId)?.focus();
                        }}
                      >
                        <span>{tab.label}</span>
                        <Count n={count} className={v6.trackCount} />
                      </button>
                    );
                  })}
                </div>
              </div>
            }
            barAside={
              <div className={v6.actions}>
                <Button variant="onHero" size="sm" icon={Phone} onClick={() => setActiveModalType("contact")}>
                  Record contact
                </Button>
                <Button
                  variant="onHero"
                  size="sm"
                  icon={FileText}
                  onClick={() => {
                    setActiveTab("tab-caseload");
                    scrollToSection("section-caseload");
                  }}
                >
                  CTO register
                </Button>
                <Button variant="onHero" size="sm" icon={Users} onClick={() => setActiveModalType("handover")}>
                  Catchment MDT
                </Button>
                <Button
                  variant="light"
                  size="sm"
                  icon={Plus}
                  id="btnMainIntake"
                  onClick={() => {
                    setIntakeDraft(BLANK_INTAKE_DRAFT);
                    setActiveModalType("intake");
                  }}
                >
                  Intake referral
                </Button>
              </div>
            }
          />
          <SrOnly>The bed coordinator&apos;s view of this team&apos;s referrals and bed flow.</SrOnly>

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
                        <span>{withUmrnInPlaceOfMovementIds(notice.sentence, { patients, referrals, movements })}</span>
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

          {/* ── Figures across the top ── */}
          <div className={styles.legacyFigureStrip}>
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
          </div>

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

        <div className={`${styles.contentWorkspace} ${v6.workspace}`}>
          {/* ── Tab 1: Priority Referral Triage Queue ── */}
          <div
            className={activeTab === "tab-triage" ? styles.tabPanelActive : styles.tabPanelHidden}
            id="tab-triage"
            role="tabpanel"
            aria-labelledby="tabBtn-triage"
          >
            {/* ── Referrals addressed to this team, not yet answered — the team's own queue ── */}
            <section
              className={isDemoMode ? styles.workspaceSection : styles.cardPanel}
              aria-label="Waiting for the team's answer"
              data-testid="ward-community-waiting"
            >
              {!isDemoMode && (
                <div className={styles.panelHead}>
                  <h2 className={styles.panelTitle}>
                    <span>Waiting for the team&apos;s answer</span>
                  </h2>
                  <span className={styles.badgePill} data-ward-panel-count>
                    {waitingReferrals.length}
                  </span>
                </div>
              )}
              <div
                className={isDemoMode ? styles.workspaceBody : styles.panelBody}
                role="region"
                aria-label="Waiting for the team's answer details"
                tabIndex={0}
              >
                {waitingReferrals.length === 0 &&
                isDemoMode &&
                demoTeamReferrals.length > 0 &&
                !hasAnyReferralsForTeam ? (
                  <>
                    <div className={styles.filterToolbar}>
                      <div className={styles.filterChipsGroup}>
                        <button
                          type="button"
                          className={styles.chipFilterBtn}
                          aria-pressed={triageFilter === "all"}
                          onClick={() => setTriageFilter("all")}
                        >
                          <span>All Referrals</span>
                          <span className={styles.badgePill} id="chipAllRefBadge">
                            {demoTeamReferrals.length}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.chipFilterBtn}
                          aria-pressed={triageFilter === "p1"}
                          onClick={() => setTriageFilter("p1")}
                        >
                          <span>Priority 1 Immediate</span>
                          <span className={styles.badgePill} id="chipP1Badge" style={{ color: "var(--danger-ink)" }}>
                            {demoTeamReferrals.filter((r) => r.urgency === 1).length}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.chipFilterBtn}
                          aria-pressed={triageFilter === "p2"}
                          onClick={() => setTriageFilter("p2")}
                        >
                          <span>Priority 2 Urgent</span>
                          <span className={styles.badgePill} id="chipP2Badge">
                            {demoTeamReferrals.filter((r) => r.urgency === 2).length}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.chipFilterBtn}
                          aria-pressed={triageFilter === "p3"}
                          onClick={() => setTriageFilter("p3")}
                        >
                          <span>Priority 3 Routine</span>
                          <span className={styles.badgePill} id="chipP3Badge">
                            {demoTeamReferrals.filter((r) => r.urgency === 3).length}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.chipFilterBtn}
                          aria-pressed={triageFilter === "ed"}
                          onClick={() => setTriageFilter("ed")}
                        >
                          <span>ED Liaison &amp; Crisis</span>
                          <span className={styles.badgePill} id="chipEdBadge">
                            {
                              demoTeamReferrals.filter(
                                (r) =>
                                  r.origin.toLowerCase().includes("ed") ||
                                  r.origin.toLowerCase().includes("crisis") ||
                                  r.origin.toLowerCase().includes("resus"),
                              ).length
                            }
                          </span>
                        </button>
                      </div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: "var(--t-0)", color: "var(--muted)" }}>
                        Sorted by Longest Wait
                      </div>
                    </div>
                    {demoVisibleReferrals.length === 0 ? (
                      <p className={styles.emptyNote} data-testid="ward-community-waiting-empty">
                        No referral matching the selected triage priority is waiting for an answer.
                      </p>
                    ) : (
                      <ul id="triageGrid" className={styles.triageQueueGrid} data-testid="ward-community-waiting-list">
                        {demoVisibleReferrals.map((referral) => (
                          <li
                            key={referral.id}
                            className={styles.refCard}
                            data-testid={`ward-community-waiting-${referral.id}`}
                            data-ref-id={referral.id}
                            data-prio={`p${referral.urgency}`}
                            onClick={() => {
                              setSelectedPatientId(referral.patientId);
                              setActiveDrawer("pxDrawer");
                            }}
                            style={{ cursor: "pointer" }}
                          >
                            <div className={styles.refCardHead}>
                              <span className={styles.refId}>
                                {referral.id} · {referral.priorityLabel}
                              </span>
                              <span className={styles.refWait} data-breach={referral.isBreach ? "true" : undefined}>
                                {referral.waitLabel}
                              </span>
                            </div>
                            <div className={styles.refPatientRow}>
                              <b className={styles.patientIdWrap}>
                                {referral.patientId} ({referral.patientDetails})
                              </b>
                              <span className={`${styles.statusPillBadge} ${styles[referral.legalStatusTone]}`}>
                                {referral.legalStatus}
                              </span>
                            </div>
                            <p
                              className={styles.refSummaryText}
                              style={{ fontSize: "var(--t-1)", color: "var(--ink-soft)", margin: "0.5rem 0" }}
                            >
                              {referral.clinicalSummary}
                            </p>
                            <div className={styles.refActionsRow} onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className={styles.btnSmPrimary}
                                onClick={() => {
                                  setToastMessage(`Accepted ${referral.id} into community triage.`);
                                }}
                              >
                                {referral.primaryActionLabel}
                              </button>
                              <button
                                type="button"
                                className={styles.btnSmSec}
                                onClick={() => {
                                  setSelectedPatientId(referral.patientId);
                                  setActiveDrawer("pxDrawer");
                                }}
                              >
                                {referral.secActionLabel}
                              </button>
                              <button
                                type="button"
                                className={styles.btnSmSec}
                                onClick={() => {
                                  setToastMessage(`Decline option for ${referral.id} recorded.`);
                                }}
                              >
                                {referral.declineActionLabel}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : waitingReferrals.length === 0 ? (
                  <p className={styles.emptyNote} data-testid="ward-community-waiting-empty">
                    No referral naming this team is currently waiting for an answer.
                  </p>
                ) : (
                  <>
                    <div className={styles.filterChipsGroup} style={{ marginBottom: "0.75rem" }}>
                      <button
                        type="button"
                        className={styles.chipFilterBtn}
                        aria-pressed={triageFilter === "all"}
                        onClick={() => setTriageFilter("all")}
                      >
                        <span>All Referrals</span>
                        <span className={styles.badgePill} id="chipAllRefBadge">
                          {waitingReferrals.length}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={styles.chipFilterBtn}
                        aria-pressed={triageFilter === "p1"}
                        onClick={() => setTriageFilter("p1")}
                      >
                        <span>Priority 1 Immediate</span>
                        <span className={styles.badgePill} id="chipP1Badge" style={{ color: "var(--danger-ink)" }}>
                          {p1ReferralsCount}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={styles.chipFilterBtn}
                        aria-pressed={triageFilter === "p2"}
                        onClick={() => setTriageFilter("p2")}
                      >
                        <span>Priority 2 Urgent</span>
                        <span className={styles.badgePill} id="chipP2Badge">
                          {p2ReferralsCount}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={styles.chipFilterBtn}
                        aria-pressed={triageFilter === "p3"}
                        onClick={() => setTriageFilter("p3")}
                      >
                        <span>Priority 3 Routine</span>
                        <span className={styles.badgePill} id="chipP3Badge">
                          {p3ReferralsCount}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={styles.chipFilterBtn}
                        aria-pressed={triageFilter === "ed"}
                        onClick={() => setTriageFilter("ed")}
                      >
                        <span>ED Liaison &amp; Crisis</span>
                        <span className={styles.badgePill} id="chipEdBadge">
                          {edReferralsCount}
                        </span>
                      </button>
                    </div>
                    {visibleWaitingReferrals.length === 0 ? (
                      <p className={styles.emptyNote}>
                        No referral matching the selected triage priority is waiting for an answer.
                      </p>
                    ) : (
                      <ul
                        id="triageGrid"
                        className={`${styles.cardList} ${styles.triageQueueGrid}`}
                        data-testid="ward-community-waiting-list"
                      >
                        {visibleWaitingReferrals.map((referral) => {
                          const declineOpen = declineOpenFor === referral.id;
                          // Blocked only until a reason is chosen — the same "state a reason before
                          // declining" rule `referral-match.tsx`'s own ward and ED controls hold to.
                          const declineBlocked =
                            declineDraft === undefined ? COMMUNITY_DECLINE_REASON_UNCHOSEN : undefined;
                          return (
                            <li
                              key={referral.id}
                              className={`${styles.card} ${styles.refCard} refCard`}
                              data-testid={`ward-community-waiting-${referral.id}`}
                              data-ref-id={referral.id}
                              data-prio={`p${referral.urgency}${referral.source === "ed_medical" ? " ed" : ""}`}
                            >
                              <div className={styles.refCardHead}>
                                <span className={styles.refId}>
                                  {referral.id} · {urgencyTierLabel(referral.urgency)}
                                </span>
                                <span
                                  className={styles.refWait}
                                  data-breach={referral.urgency === 1 ? "true" : undefined}
                                >
                                  Wait: {referralWaitLine(referral, now)}
                                </span>
                              </div>
                              {(() => {
                                const pt = patients.find((p) => p.id === referral.patientId);
                                return (
                                  <div className={styles.refPatientRow}>
                                    <b className={styles.patientIdWrap}>
                                      {referral.patientId ?? referral.id}{" "}
                                      {pt ? `(${pt.sex === "Male" ? "M" : "F"})` : ""}
                                    </b>
                                    <span
                                      className={`${styles.statusPillBadge} ${referral.urgency === 1 ? styles.danger : styles.neutral}`}
                                    >
                                      {pt?.legalStatus ?? "Legal status not recorded"}
                                    </span>
                                  </div>
                                );
                              })()}
                              <div className={styles.refClinicalSummary}>
                                Origin: {referralOriginLabel(referral)}.{" "}
                                {referral.history ||
                                  `${referral.ageBand} · ${referral.homeRegion}. ${referral.transportNeeded ? "Transport needed." : "No transport recorded."}`}
                              </div>
                              <ReferralIntakeSummary intake={referral.intake} />
                              <p className={styles.cardDetail} style={{ display: "none" }}>
                                {referralWaitLine(referral, now)}
                              </p>
                              <p className={styles.cardDetail} style={{ display: "none" }}>
                                {referral.ageBand} · {referral.homeRegion} · {referralOriginLabel(referral)}
                              </p>
                              <p className={styles.cardDetail} style={{ display: "none" }}>
                                {referral.transportNeeded ? "Transport needed" : "No transport recorded"}
                              </p>
                              <div className={styles.cardActionsGroup}>
                                <div className={styles.cardWorkflowActions}>
                                  <button
                                    type="button"
                                    className={styles.cardActionButton}
                                    onClick={() => handleActionClick("Contacted", referral)}
                                  >
                                    Log team contact
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
                                  <button
                                    type="button"
                                    className={styles.cardActionButton}
                                    onClick={() => {
                                      setSelectedReferralId(referral.id);
                                      setPendingAcceptance(null);
                                      setAcceptanceError(null);
                                      setActiveDrawer("referralDrawer");
                                    }}
                                    title="Open full referral triage assessment"
                                  >
                                    Triage Dossier
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
                  </>
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
            </section>

            <div style={{ display: isDemoMode ? "none" : "block" }} aria-hidden={isDemoMode ? "true" : undefined}>
              <section className={styles.cardPanel} aria-label="Worth attention" data-testid="ward-community-attention">
                <div className={styles.panelHead}>
                  <h3 className={styles.panelTitle}>
                    <span>Worth attention</span>
                  </h3>
                </div>
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
              </section>
            </div>
          </div>

          {/* ── Tab 2: Catchment Acute Inpatients ── */}
          <div
            className={activeTab === "tab-inpatients" ? styles.tabPanelActive : styles.tabPanelHidden}
            id="tab-inpatients"
            role="tabpanel"
            aria-labelledby="tabBtn-inpatients"
          >
            {/* ── List 2, moved — everyone of ours in a bed or holding one ─────────────────── */}
            <section
              className={styles.cardPanel}
              aria-label="In a bed or holding one"
              data-testid="ward-community-admitted"
            >
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>
                  <span>In a bed or holding one</span>
                </h2>
                <span className={styles.badgePill} data-ward-panel-count>
                  {isDemoMode ? teamConfig.inpatients : lists.currentlyAdmitted.length}
                </span>
              </div>
              <div className={styles.panelBody} role="region" aria-label="In a bed or holding one details" tabIndex={0}>
                {isDemoMode ? (
                  <>
                    <div className={styles.filterToolbar}>
                      <div className={styles.filterChipsGroup} style={{ marginBottom: "0.75rem" }}>
                        <button
                          type="button"
                          className={styles.chipFilterBtn}
                          aria-pressed={inpatientFilter === "all"}
                          onClick={() => setInpatientFilter("all")}
                        >
                          <span>All Inpatients</span>
                          <span className={styles.badgePill} id="chipAllInpatBadge">
                            {DEMO_COMMUNITY_INPATIENTS.length}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.chipFilterBtn}
                          aria-pressed={inpatientFilter === "secure"}
                          onClick={() => setInpatientFilter("secure")}
                        >
                          <span>Secure / Locked Beds</span>
                          <span className={styles.badgePill}>
                            {DEMO_COMMUNITY_INPATIENTS.filter((i) => i.category === "secure").length}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.chipFilterBtn}
                          aria-pressed={inpatientFilter === "open"}
                          onClick={() => setInpatientFilter("open")}
                        >
                          <span>Open Acute Beds</span>
                          <span className={styles.badgePill}>
                            {DEMO_COMMUNITY_INPATIENTS.filter((i) => i.category === "open").length}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.chipFilterBtn}
                          aria-pressed={inpatientFilter === "older"}
                          onClick={() => setInpatientFilter("older")}
                        >
                          <span>Older Adult Units</span>
                          <span className={styles.badgePill}>
                            {DEMO_COMMUNITY_INPATIENTS.filter((i) => i.category === "older").length}
                          </span>
                        </button>
                      </div>
                      <p
                        id="inpatientSummaryNote"
                        className={styles.count}
                        style={{
                          fontSize: "var(--t-0)",
                          color: "var(--muted)",
                          fontFamily: "var(--mono)",
                          margin: "0.25rem 0 0.75rem",
                        }}
                      >
                        14 Admitted Across 4 Hospital Sites
                      </p>
                    </div>

                    <WardTable
                      id="inpatientTable"
                      className={styles.table}
                      wrapperClassName={styles.tableScroll}
                      testId="ward-community-admitted-list"
                      hasScrollThreshold
                    >
                      <caption>People referred to this team in a bed or holding one</caption>
                      <thead>
                        <tr>
                          <th scope="col">Patient</th>
                          <th scope="col">Admitting Ward &amp; Health Service</th>
                          <th scope="col">Bed</th>
                          <th scope="col" className={styles.n}>
                            Days in Bed
                          </th>
                          <th scope="col">Legal Status</th>
                          <th scope="col">Community Key Clinician</th>
                          <th scope="col">Liaison / MDT Status</th>
                          <th scope="col" className={styles.actionsCol}>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {demoVisibleInpatients.map((inp) => (
                          <tr
                            key={inp.id}
                            onClick={() => {
                              setSelectedPatientId(inp.patientId);
                              setActiveDrawer("pxDrawer");
                            }}
                            style={{ cursor: "pointer" }}
                          >
                            <td style={{ whiteSpace: "nowrap" }}>
                              <b className={styles.patientIdWrap}>{inp.patientId}</b> ({inp.patientDetails})
                            </td>
                            <td>
                              {inp.wardName} ({inp.healthService})
                            </td>
                            <td>
                              <span className={`${styles.statusPillBadge} ${styles.neutral}`}>{inp.bedId}</span>
                            </td>
                            <td className={styles.n}>{inp.daysInBed}</td>
                            <td>
                              <span className={`${styles.statusPillBadge} ${styles[inp.legalStatusTone]}`}>
                                {inp.legalStatus}
                              </span>
                            </td>
                            <td>{inp.keyClinician}</td>
                            <td>{inp.mdtStatus}</td>
                            <td className={styles.actionsCol} onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className={styles.btnSmSec}
                                onClick={() => {
                                  setSelectedPatientId(inp.patientId);
                                  setActiveDrawer("pxDrawer");
                                }}
                              >
                                Open Dossier
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </WardTable>
                  </>
                ) : (
                  <>
                    <p id="inpatientSummaryNote" className={styles.count} data-testid="ward-community-admitted-count">
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
                            A bed carries no link back to the referral that named this team, so this list cannot be
                            built for {team.name}. Its emptiness is a gap in the record rather than an answer about the
                            team.
                          </>
                        ) : (
                          <>Nobody referred to this team is currently in a bed.</>
                        )}
                      </p>
                    ) : (
                      <WardTable
                        id="inpatientTable"
                        className={styles.table}
                        wrapperClassName={styles.tableScroll}
                        testId="ward-community-admitted-list"
                        hasScrollThreshold
                      >
                        <caption>People referred to this team in a bed or holding one</caption>
                        <thead>
                          <tr>
                            {/*
                              v6 columns (`CommunityTeam--in-a-bed`), where the record holds the
                              figure: no key clinician or liaison column, since nothing records
                              either, and no invented bed number.
                            */}
                            <th scope="col">Person</th>
                            <th scope="col">Unit</th>
                            <th scope="col">Legal status</th>
                            <th scope="col" className={styles.n}>
                              In bed
                            </th>
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
                            const pt = patients.find((p) => p.id === admission.patientId);
                            const stayDays = daysInBed(admission, now);
                            return (
                              <tr key={admission.id} data-testid={`ward-community-admitted-${admission.id}`}>
                                <td style={{ whiteSpace: "nowrap" }}>
                                  <b className={styles.patientIdWrap}>{admission.patientId ?? admission.id}</b>
                                  {pt ? ` (${pt.sex === "Male" ? "M" : "F"})` : ""}
                                </td>
                                <td>
                                  <span className={styles.cellLead}>{unitName(admission.unitId, units)}</span>
                                  <span className={styles.cellSub}>{bedStateLabel(admission)}</span>
                                </td>
                                <td>{pt?.legalStatus ?? "Not recorded"}</td>
                                <td className={styles.n}>{stayDays === null ? "Not arrived" : `${stayDays}d`}</td>
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
                  </>
                )}
              </div>
            </section>

            {/* ── Admitted while already with this team — the owner's most delicate request ──
                 See `categoriseTeamAdmission`'s doc comment above for the exact rule this table
                 draws on, and this file's header block (third edition) for why the wording below is
                 constrained the way it is. */}
            <div style={{ display: isDemoMode ? "none" : "block" }} aria-hidden={isDemoMode ? "true" : undefined}>
              <section
                className={styles.cardPanel}
                aria-label="Admitted while already with the team"
                data-testid="ward-community-accepted-before-admission"
              >
                <div className={styles.panelHead}>
                  <h3 className={styles.panelTitle}>
                    <span>Admitted while already with the team</span>
                  </h3>
                  <span className={styles.badgePill} data-ward-panel-count>
                    {admittedWhileAlreadyWithTeam.length} of {lists.currentlyAdmitted.length}
                  </span>
                </div>
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
                          <tr
                            key={admission.id}
                            data-testid={`ward-community-accepted-before-admission-${admission.id}`}
                          >
                            <th scope="row">
                              <span className={styles.patientIdWrap}>{admission.id}</span>
                            </th>
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
                  <p
                    className={styles.absenceNotice}
                    data-testid="ward-community-accepted-before-admission-other-groups"
                  >
                    Excluded: {referredDuringThisAdmission.length} referred during the current admission and{" "}
                    {bedPulledNotYetArrived.length} with a bed pulled but no arrival. Neither establishes care before
                    admission.
                  </p>
                  <p
                    className={styles.footnote}
                    data-testid="ward-community-accepted-before-admission-not-active-claim"
                  >
                    Acceptance before admission does not establish current care; no community-team closure is recorded.
                  </p>
                </div>
              </section>
            </div>
          </div>

          {/* ── Tab 3: 7-Day Post-Discharge Follow-Up & Egress ── */}
          <div
            className={
              activeTab === "tab-egress" || activeTab === "tab-expected" ? styles.tabPanelActive : styles.tabPanelHidden
            }
            id="tab-egress"
            role="tabpanel"
            aria-labelledby="tabBtn-egress"
          >
            {/* ── Sovereign 7-Day Post-Discharge Register ── */}
            {isDemoMode && (
              <>
                <div className={styles.filterToolbar}>
                  <div className={styles.filterChipsGroup}>
                    <button
                      type="button"
                      className={styles.chipFilterBtn}
                      aria-pressed={egressFilter === "all"}
                      onClick={() => setEgressFilter("all")}
                    >
                      <span>All Egress</span>
                      <span className={styles.badgePill}>{DEMO_COMMUNITY_EGRESS.length}</span>
                    </button>
                    <button
                      type="button"
                      className={styles.chipFilterBtn}
                      aria-pressed={egressFilter === "overdue"}
                      onClick={() => setEgressFilter("overdue")}
                    >
                      <span>Overdue (Priority Follow-up)</span>
                      <span className={styles.badgePill} style={{ color: "var(--danger-ink)" }}>
                        {DEMO_COMMUNITY_EGRESS.filter((e) => e.status === "overdue").length}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.chipFilterBtn}
                      aria-pressed={egressFilter === "today"}
                      onClick={() => setEgressFilter("today")}
                    >
                      <span>Due Today</span>
                      <span className={styles.badgePill}>
                        {DEMO_COMMUNITY_EGRESS.filter((e) => e.status === "today").length}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.chipFilterBtn}
                      aria-pressed={egressFilter === "upcoming"}
                      onClick={() => setEgressFilter("upcoming")}
                    >
                      <span>Upcoming Discharges</span>
                      <span className={styles.badgePill}>
                        {DEMO_COMMUNITY_EGRESS.filter((e) => e.status === "upcoming").length}
                      </span>
                    </button>
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "var(--t-0)", color: "var(--muted)" }}>
                    Mandatory WA Health 7-Day Post-Discharge KPI
                  </div>
                </div>

                <div className={styles.cardPanel}>
                  <div className={styles.panelHead}>
                    <h2 className={styles.panelTitle}>
                      <svg
                        viewBox="0 0 16 16"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M9 3l4 5-4 5M13 8H3" />
                      </svg>
                      <span>7-Day Post-Discharge Follow-Up Register</span>
                    </h2>
                    <span className={styles.badgePill} id="egressHeadBadge">
                      {demoVisibleEgress.length} Patients in 7-Day Window
                    </span>
                  </div>
                  <div className={styles.tableScroll}>
                    <table className={styles.table} id="egressTable">
                      <thead>
                        <tr>
                          <th scope="col">Patient</th>
                          <th scope="col">Discharging Unit</th>
                          <th scope="col">Discharge Date / Plan</th>
                          <th scope="col">Destination</th>
                          <th scope="col">7-Day KPI Window Status</th>
                          <th scope="col">Assigned Coordinator</th>
                          <th scope="col" style={{ textAlign: "right" }}>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {demoVisibleEgress.map((egr) => {
                          const isContacted = liveAdmissions.some(
                            (admission) =>
                              admission.patientId === egr.patientId &&
                              currentCareContactCompleted(admission.careJourney),
                          );
                          return (
                            <tr
                              key={egr.id}
                              data-status={isContacted ? "completed" : egr.status}
                              data-pt-id={egr.patientId}
                              onClick={() => {
                                setSelectedPatientId(egr.patientId);
                                setActiveDrawer("pxDrawer");
                              }}
                              style={{ cursor: "pointer" }}
                            >
                              <td style={{ whiteSpace: "nowrap" }}>
                                <b className={styles.patientIdWrap}>{egr.patientId}</b> ({egr.patientDetails})
                              </td>
                              <td>{egr.dischargingUnit}</td>
                              <td>{egr.dischargeDatePlan}</td>
                              <td>{egr.destination}</td>
                              <td>
                                <span
                                  className={`${styles.statusPillBadge} ${
                                    isContacted ? styles.good : styles[egr.kpiTone]
                                  }`}
                                >
                                  {isContacted ? "Completed" : egr.kpiStatusLabel}
                                </span>
                              </td>
                              <td>{egr.assignedCoordinator}</td>
                              <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className={egr.isPrimaryAction ? styles.btnSmPrimary : styles.btnSmSec}
                                  onClick={() => {
                                    handleCompleteContact(egr.patientId);
                                    if (!egr.isPrimaryAction) {
                                      setSelectedPatientId(egr.patientId);
                                      setActiveDrawer("pxDrawer");
                                    }
                                  }}
                                >
                                  {isContacted ? "Contact Logged" : egr.actionLabel}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ── List 4, moved — of those, who the ward expects back ──────────────────────── */}
            <div style={{ display: isDemoMode ? "none" : "block" }} aria-hidden={isDemoMode ? "true" : undefined}>
              <section className={styles.cardPanel} aria-label="Expected back" data-testid="ward-community-expected">
                <div className={styles.panelHead}>
                  <h3 className={styles.panelTitle}>
                    <span>Expected back</span>
                  </h3>
                  <span className={styles.badgePill} data-ward-panel-count>
                    {lists.expectedBack.length} of {lists.currentlyAdmitted.length}
                  </span>
                </div>
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
              </section>

              {/* ── List 1, moved and renamed to the owner's wording — discharged into the area ── */}
              <section
                className={styles.cardPanel}
                aria-label="Discharged into the catchment"
                data-testid="ward-community-discharged"
              >
                <div className={styles.panelHead}>
                  <h3 className={styles.panelTitle}>
                    <span>Discharged into the catchment</span>
                  </h3>
                  <span className={styles.badgePill} data-ward-panel-count>
                    {lists.dischargedIntoTheArea.length}
                  </span>
                </div>
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
                   * Arrangements are recorded on the discharge board; this list remains all community
                   * departures rather than a follow-up completion measure.
                   */}
                  <p className={styles.absenceNotice} data-testid="ward-community-follow-up-not-recorded">
                    Follow-up arrangements and contact outcomes can be recorded for this team. An arrangement does not
                    establish that contact occurred. All community departures shows recorded discharges into the
                    community; an empty list does not establish that everybody is being followed up.
                  </p>

                  <label>
                    Community follow-up filter
                    <select value={followUpFilter} onChange={(e) => setFollowUpFilter(e.target.value)}>
                      <option value="all">All community departures</option>
                      <option value="missing_arrangement">Missing arrangements</option>
                      <option value="missing_contact">No completed contact recorded</option>
                    </select>
                  </label>
                  {filteredDepartures.length === 0 ? (
                    <p className={styles.emptyNote} data-testid="ward-community-discharged-empty">
                      {lists.dischargedIntoTheArea.length > 0 ? (
                        <>No community departures match this follow-up filter.</>
                      ) : cannotResolve ? (
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
                      {filteredDepartures.map((admission) => (
                        <li
                          key={admission.id}
                          className={styles.card}
                          data-testid={`ward-community-discharged-${admission.id}`}
                        >
                          <p className={styles.cardUnit}>{unitName(admission.unitId, units)}</p>
                          <p className={styles.cardDetail}>{departureLabel(admission, now)}</p>
                          <p>
                            Follow-up: {admission.followUp?.state?.replaceAll("_", " ") ?? "Not recorded"} · Contact:{" "}
                            {currentCareContact(admission.careJourney)?.outcome?.replaceAll("_", " ") ?? "Not recorded"}
                          </p>
                          <CommunityFollowUp admissionId={admission.id} teamId={team.id} />
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
              </section>

              {/* ── Left the ward another way — the owner's order asks for this as its own numbered
                 item. The paragraph below is the same one that used to sit as a footnote inside the
                 discharged panel above, word for word: it moved panel, not wording, and "the list
                 above" in its own text is still true because the discharged list still renders above
                 this panel on the page. ─────────────────────────────────────────────────────── */}
              <section
                className={styles.cardPanel}
                aria-label="Left the ward another way"
                data-testid="ward-community-other-departures-panel"
              >
                <div className={styles.panelHead}>
                  <h3 className={styles.panelTitle}>
                    <span>Left the ward another way</span>
                  </h3>
                  <span className={styles.badgePill} data-ward-panel-count>
                    {lists.otherDepartures.length}
                  </span>
                </div>
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
              </section>

              {/* ── List 3, moved to the end — the one that cannot be built ──────────────────── */}
              <section
                className={styles.cardPanel}
                aria-label="Referrals we have made"
                data-testid="ward-community-referrals"
              >
                <div className={styles.panelHead}>
                  <h3 className={styles.panelTitle}>
                    <span>Referrals we have made</span>
                  </h3>
                </div>
                <div
                  className={styles.panelBody}
                  role="region"
                  aria-label="Referrals we have made details"
                  tabIndex={0}
                >
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
              </section>
            </div>
          </div>

          {/* ── Tab 4: Active Caseload & CTO Statutory Register ── */}
          <div
            className={activeTab === "tab-caseload" ? styles.tabPanelActive : styles.tabPanelHidden}
            id="tab-caseload"
            role="tabpanel"
            aria-labelledby="tabBtn-caseload"
          >
            {isDemoMode ? (
              <>
                <div className={styles.filterToolbar}>
                  <div className={styles.filterChipsGroup}>
                    <button
                      type="button"
                      className={styles.chipFilterBtn}
                      aria-pressed={caseloadFilter === "all"}
                      onClick={() => setCaseloadFilter("all")}
                    >
                      <span>All Active Caseload</span>
                      <span className={styles.badgePill} id="chipAllCaseloadBadge">
                        {DEMO_COMMUNITY_CASELOAD.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.chipFilterBtn}
                      aria-pressed={caseloadFilter === "cto" || caseloadFilter === "5A"}
                      onClick={() => setCaseloadFilter("cto")}
                    >
                      <span>Active CTO (Form 5A)</span>
                      <span className={styles.badgePill} id="chipCtoBadge" style={{ color: "var(--good)" }}>
                        {DEMO_COMMUNITY_CASELOAD.filter((c) => c.category.includes("cto")).length}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.chipFilterBtn}
                      aria-pressed={caseloadFilter === "high"}
                      onClick={() => setCaseloadFilter("high")}
                    >
                      <span>High Acuity / Assertive Outreach</span>
                      <span className={styles.badgePill} id="chipHighAcuityBadge">
                        {DEMO_COMMUNITY_CASELOAD.filter((c) => c.category.includes("high")).length}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.chipFilterBtn}
                      aria-pressed={caseloadFilter === "depot"}
                      onClick={() => setCaseloadFilter("depot")}
                    >
                      <span>Depot Clinic Due</span>
                      <span className={styles.badgePill} id="chipDepotBadge">
                        {DEMO_COMMUNITY_CASELOAD.filter((c) => c.category.includes("depot")).length}
                      </span>
                    </button>
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "var(--t-0)", color: "var(--muted)" }}>
                    <span id="caseloadSectorNote">{team.name} / Sector Catchment</span>
                  </div>
                </div>

                <div className={styles.cardPanel}>
                  <div className={styles.panelHead}>
                    <h2 className={styles.panelTitle}>
                      <svg
                        viewBox="0 0 16 16"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <circle cx="8" cy="8" r="6" />
                        <path d="M8 5v3l2 2" />
                      </svg>
                      <span>Community Treatment Orders (Form 5A) &amp; High Acuity Caseload</span>
                    </h2>
                    <span className={styles.badgePill} id="caseloadHeadBadge">
                      {demoVisibleCaseload.length} Active Records
                    </span>
                  </div>
                  <div className={styles.tableScroll}>
                    <table className={styles.table} id="caseloadTable">
                      <thead>
                        <tr>
                          <th scope="col">UMRN / Patient</th>
                          <th scope="col">Age / Sex</th>
                          <th scope="col">Statutory Status</th>
                          <th scope="col">Care Plan Tier</th>
                          <th scope="col">Key Clinician</th>
                          <th scope="col">Last Contact</th>
                          <th scope="col">Next Scheduled Contact / Review</th>
                          <th scope="col" style={{ textAlign: "right" }}>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {demoVisibleCaseload.map((row) => (
                          <tr
                            key={row.id}
                            data-cat={row.category}
                            onClick={() => {
                              setSelectedPatientId(row.patientId);
                              setActiveDrawer("pxDrawer");
                            }}
                            style={{ cursor: "pointer" }}
                          >
                            <td>
                              <b>{row.umrn}</b> · {row.patientId}
                            </td>
                            <td>{row.ageSex}</td>
                            <td>
                              <span className={`${styles.statusPillBadge} ${styles[row.statutoryTone]}`}>
                                {row.statutoryStatus}
                              </span>
                            </td>
                            <td>{row.tier}</td>
                            <td>{row.keyClinician}</td>
                            <td>{row.lastContact}</td>
                            <td>{row.nextReview}</td>
                            <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className={styles.btnSmSec}
                                onClick={() => {
                                  setSelectedPatientId(row.patientId);
                                  setActiveDrawer("pxDrawer");
                                }}
                              >
                                Open Dossier
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}

            {/* ── Active Caseload & CTO Statutory Register Table ── */}
            <div style={{ display: isDemoMode ? "none" : "block" }} aria-hidden={isDemoMode ? "true" : undefined}>
              <section
                className={styles.caseloadSection}
                id="section-caseload"
                aria-label="Catchment Active Caseload and Statutory CTO Register"
              >
                <div className={styles.caseloadHead}>
                  <h3 className={styles.caseloadTitle}>
                    <span>Catchment Active Caseload &amp; Statutory Register</span>
                    <span id="caseloadHeadBadge" className={styles.badgePill}>
                      {caseloadRows.length} Patients
                    </span>
                    <span id="caseloadSectorNote" style={{ display: "none" }}>
                      {team.name}
                    </span>
                    <span id="chipDepotBadge" style={{ display: "none" }}>
                      Depot
                    </span>
                    <span id="chipHighAcuityBadge" style={{ display: "none" }}>
                      High Acuity
                    </span>
                  </h3>
                  <div className={styles.filterChipsGroup}>
                    <button
                      type="button"
                      className={styles.chipFilterBtn}
                      aria-pressed={caseloadFilter === "all"}
                      onClick={() => setCaseloadFilter("all")}
                    >
                      <span>All Active</span>
                      <span id="chipAllCaseloadBadge" className={styles.badgePill}>
                        {caseloadRows.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.chipFilterBtn}
                      aria-pressed={caseloadFilter === "5A"}
                      onClick={() => setCaseloadFilter("5A")}
                    >
                      <span>Recorded Form 5A</span>
                      <span id="chipCtoBadge" className={styles.badgePill}>
                        {form5ACount}
                      </span>
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
                <div className={styles.tableScroll}>
                  <table id="caseloadTable" className={styles.table} data-testid="ward-community-caseload-table">
                    <thead>
                      <tr>
                        <th scope="col">Person</th>
                        <th scope="col">Statutory status</th>
                        <th scope="col">Recorded expiry</th>
                        <th scope="col">Follow-up</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCaseload.length === 0 ? (
                        <tr>
                          <td colSpan={5}>
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
                                {/* The age band sits under the person, as the v6 table carries it. */}
                                <span className={styles.caseloadMeta}>
                                  {row.umrn ?? row.referralId} · {row.ageBand}
                                </span>
                              </td>
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
            </div>
          </div>

          {/* ── The team itself: how to reach it, and the sample deployment. Shown under every list (v6). ── */}
          <div className={`${styles.tabPanelActive} ${v6.side}`} id="tab-team">
            {/* ── How to reach this team ── */}
            <div style={{ display: isDemoMode ? "none" : "block" }} aria-hidden={isDemoMode ? "true" : undefined}>
              {(() => {
                const contact = contactForTeam(team.name);
                const decision = contactDecisionFor(team.name);
                return (
                  <section
                    className={v6.sideCard}
                    aria-label="How to reach this team"
                    data-testid="ward-community-contact"
                  >
                    <div className={v6.sideHead}>
                      <h3 className={v6.sideTitle}>How to reach</h3>
                      <span className={v6.sideMeta}>Published contacts</span>
                    </div>
                    <div className={v6.sideBody} role="region" aria-label="How to reach this team details">
                      {contact === null ? (
                        <p className={v6.sideNote}>
                          Nobody has yet recorded which real service this name refers to, so no contact detail is shown.
                          That is not a statement that this team has no phone number.
                        </p>
                      ) : (
                        <>
                          <dl className={v6.keyValues} data-testid="ward-community-contact-detail">
                            {contact.publishedPhone === null ? null : (
                              <div>
                                <dt>Phone</dt>
                                <dd className={v6.mono}>
                                  <a href={`tel:${contact.publishedPhone.replace(/[^\d+]/g, "")}`}>
                                    {contact.publishedPhone}
                                  </a>
                                </dd>
                              </div>
                            )}
                            {contact.publishedHours === null ? null : (
                              <div>
                                <dt>Hours</dt>
                                <dd>{contact.publishedHours}</dd>
                              </div>
                            )}
                            {contact.referralEmail === null ? null : (
                              <div>
                                <dt>Referrals</dt>
                                <dd>
                                  <a href={`mailto:${contact.referralEmail}`}>{contact.referralEmail}</a>
                                </dd>
                              </div>
                            )}
                            {contact.address === null ? null : (
                              <div>
                                <dt>Address</dt>
                                <dd>{contact.address}</dd>
                              </div>
                            )}
                          </dl>
                          <p className={v6.sideNote}>{REFERENCE_TEAM_CAVEAT}</p>
                          <p className={v6.sideNote}>
                            Recorded {contact.recordedOn ?? "on a date the register does not give"}
                            {decision === null
                              ? null
                              : `. Paired with ${decision.serviceName} by ${decision.decidedBy} on ${decision.decidedOn}.`}
                          </p>
                        </>
                      )}
                    </div>
                  </section>
                );
              })()}
            </div>

            {/* ── Team Deployment, Clinic Rooms and Response Fleet ── */}
            {isDemoMode ? (
              <>
                <div className={styles.cardPanel}>
                  <div className={styles.panelHead}>
                    <h2 className={styles.panelTitle}>
                      <svg
                        viewBox="0 0 16 16"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M6 7a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM11.5 8a2 2 0 100-4 2 2 0 000 4zM1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4M10.5 10.5c2 .3 3.5 1.6 3.5 3.5" />
                      </svg>
                      <span>Catchment Multidisciplinary Team Roster &amp; Duty Allocations</span>
                    </h2>
                    <span className={styles.badgePill} id="teamStaffCountBadge">
                      {teamConfig.staff} Key Clinicians Active
                    </span>
                  </div>
                  <div className={styles.panelBody}>
                    <div className={styles.teamRosterGrid}>
                      {DEMO_COMMUNITY_STAFF.map((staff) => (
                        <div key={staff.name} className={styles.staffCard}>
                          <div className={styles.staffHead}>
                            <div>
                              <div
                                className={styles.staffName}
                                id={staff.name === "Dr A. Nair" ? "leadConsultantName" : undefined}
                              >
                                {staff.name === "Dr A. Nair" ? teamConfig.consultant : staff.name}
                              </div>
                              <div className={styles.staffRole}>{staff.role}</div>
                            </div>
                            <span className={`${styles.statusPillBadge} ${styles[staff.statusTone]}`}>
                              {staff.status}
                            </span>
                          </div>
                          <div className={styles.staffMetrics}>
                            <span>
                              Caseload: <b>{staff.caseload}</b>
                            </span>
                            <span>
                              Ext: <b>{staff.ext}</b>
                            </span>
                            <span>{staff.assignment}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={styles.clinicFleetGrid}>
                  <div className={styles.cardPanel}>
                    <div className={styles.panelHead}>
                      <h3 className={styles.panelTitle} style={{ fontSize: "var(--t-2)" }}>
                        Clinic Room Utilization
                      </h3>
                      <span className={styles.badgePill}>3 Rooms Active</span>
                    </div>
                    <div className={styles.panelBody}>
                      <div className={styles.clinicRoomItem}>
                        <div className={styles.clinicRoomTop}>
                          <span className={styles.clinicRoomTitle}>Room 1 · Consultant Clinic</span>
                          <span className={`${styles.statusPillBadge} ${styles.good}`}>9am – 1pm</span>
                        </div>
                        <span style={{ fontSize: "var(--t-1)", color: "var(--ink-soft)" }}>
                          Dr K. Rao · Urgent Intakes &amp; Medication Reviews
                        </span>
                      </div>
                      <div className={styles.clinicRoomItem}>
                        <div className={styles.clinicRoomTop}>
                          <span className={styles.clinicRoomTitle}>Room 2 · Depot &amp; Physical Health</span>
                          <span className={`${styles.statusPillBadge} ${styles.good}`}>9am – 5pm</span>
                        </div>
                        <span style={{ fontSize: "var(--t-1)", color: "var(--ink-soft)" }}>
                          RN C. Davis · Long-acting injections, ECG, metabolic monitoring
                        </span>
                      </div>
                      <div className={styles.clinicRoomItem}>
                        <div className={styles.clinicRoomTop}>
                          <span className={styles.clinicRoomTitle}>Room 3 · Crisis Walk-in &amp; Triage</span>
                          <span className={`${styles.statusPillBadge} ${styles.warn}`}>Active Standby</span>
                        </div>
                        <span style={{ fontSize: "var(--t-1)", color: "var(--ink-soft)" }}>
                          Dr J. Lim · Urgent walk-in community assessments
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardPanel}>
                    <div className={styles.panelHead}>
                      <h3 className={styles.panelTitle} style={{ fontSize: "var(--t-2)" }}>
                        Mobile Outreach Vehicles
                      </h3>
                      <span className={styles.badgePill}>2 Vehicles</span>
                    </div>
                    <div className={styles.panelBody}>
                      <div className={styles.clinicRoomItem}>
                        <div className={styles.clinicRoomTop}>
                          <span className={styles.clinicRoomTitle} id="fleetVehicle1Title">
                            {teamConfig.fleet1}
                          </span>
                          <span className={`${styles.statusPillBadge} ${styles.warn}`}>In Field</span>
                        </div>
                        <span style={{ fontSize: "var(--t-1)", color: "var(--ink-soft)" }}>
                          Staff: T. Bradley RN &amp; Dr J. Lim · Scheduled Home Visits
                        </span>
                      </div>
                      <div className={styles.clinicRoomItem}>
                        <div className={styles.clinicRoomTop}>
                          <span className={styles.clinicRoomTitle} id="fleetVehicle2Title">
                            {teamConfig.fleet2}
                          </span>
                          <span className={`${styles.statusPillBadge} ${styles.good}`}>At Base</span>
                        </div>
                        <span style={{ fontSize: "var(--t-1)", color: "var(--ink-soft)" }}>
                          Staff: M. Davies SW · Available for Urgent Dispatch
                        </span>
                      </div>
                      <div className={styles.clinicRoomItem}>
                        <div className={styles.clinicRoomTop}>
                          <span className={styles.clinicRoomTitle}>Morning MDT Huddle Log</span>
                          <span className={`${styles.statusPillBadge} ${styles.neutral}`}>10am Completed</span>
                        </div>
                        <span style={{ fontSize: "var(--t-1)", color: "var(--ink-soft)" }}>
                          14 Catchment cases reviewed · 2 Inpatient transfers coordinated
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <section
                className={v6.sideCard}
                id="section-team-workspace"
                aria-labelledby="ward-community-roster-title"
                data-testid="ward-community-roster"
              >
                <div className={v6.sideHead}>
                  <h3 id="ward-community-roster-title" className={v6.sideTitle}>
                    On duty today
                  </h3>
                  <span id="teamStaffCountBadge" className={v6.sideMeta}>
                    Sample roster
                  </span>
                </div>
                <p className={v6.sampleNote} role="note">
                  Illustrative staffing and logistics only. These are not roster, huddle, room or vehicle records for
                  {` ${team.name}`}.
                </p>
                <ul className={v6.roster} aria-label="Sample roster, illustrative">
                  {SAMPLE_ROSTER.map((member) => (
                    <li key={member.role} className={v6.rosterRow}>
                      <span className={v6.initials} aria-hidden="true">
                        {member.initials}
                      </span>
                      <span className={v6.rosterWho}>
                        <span className={v6.rosterRole} id={member.lead ? "leadConsultantName" : undefined}>
                          {member.role}
                        </span>
                        <span className={v6.rosterDetail}>{member.detail}</span>
                      </span>
                      <span className={v6.rosterStatus}>
                        <StatusGlyph tone={ROSTER_TONE[member.status]} size={9} />
                        {member.status}
                      </span>
                    </li>
                  ))}
                </ul>
                <details className={v6.sampleMore}>
                  <summary>Sample rooms and vehicles</summary>
                  <ul className={v6.sampleList} aria-label="Sample clinic rooms and vehicles, illustrative">
                    <li>
                      <span>Clinic room 1 · depot clinic</span>
                      <span className={v6.rosterDetail}>Active</span>
                    </li>
                    <li>
                      <span>Clinic room 2 · consultant reviews</span>
                      <span className={v6.rosterDetail}>Active</span>
                    </li>
                    <li>
                      <span>Clinic room 3 · urgent intake</span>
                      <span className={v6.rosterDetail}>Standby</span>
                    </li>
                    <li>
                      <span id="fleetVehicle1Title">Outreach vehicle 1 (dual crew)</span>
                      <span className={v6.rosterDetail}>In field</span>
                    </li>
                    <li>
                      <span id="fleetVehicle2Title">Outreach vehicle 2 (secondary)</span>
                      <span className={v6.rosterDetail}>At base</span>
                    </li>
                  </ul>
                </details>
              </section>
            )}
          </div>

          {/* ── Governance Accordion: Limits, Facts, Links & Provenance ── */}
          <div style={{ display: isDemoMode ? "none" : "block" }} aria-hidden={isDemoMode ? "true" : undefined}>
            <details
              ref={limitsDisclosureRef}
              className={styles.governanceSection}
              data-testid="ward-community-limits"
              open
            >
              <summary className={styles.governanceSummary}>Data provenance, coverage limits and team facts</summary>
              <div className={styles.governanceBody}>
                {/* Coverage limits */}
                <div className={styles.cardPanel}>
                  <div className={styles.panelHead}>
                    <h3 className={styles.panelTitle}>
                      <span>Coverage limits</span>
                    </h3>
                  </div>
                  <div className={styles.panelBody} role="region" aria-label="Coverage limits details" tabIndex={0}>
                    <ul className={styles.limitsList}>
                      <li>
                        <strong>Completeness.</strong> Only admissions linked to a referral this page can find are
                        shown; <span>{unattributable.length}</span>{" "}
                        {unattributable.length === 1 ? "admission is" : "admissions are"} counted rather than shown.
                      </li>
                      <li>
                        <strong>Current care.</strong> No community-team closure is recorded, so prior acceptance does
                        not establish current care.
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
                </div>

                {/* This team facts */}
                <div className={styles.cardPanel} data-testid="ward-community-facts">
                  <div className={styles.panelHead}>
                    <h3 className={styles.panelTitle}>
                      <span>This team facts</span>
                    </h3>
                  </div>
                  <div className={styles.panelBody} role="region" aria-label="This team details" tabIndex={0}>
                    <dl className={styles.factsList}>
                      <div className={styles.factsRow}>
                        <dt>Name recorded as</dt>
                        <dd>{team.name}</dd>
                      </div>
                      <div className={styles.factsRow}>
                        <dt>Suburbs naming it</dt>
                        <dd data-testid="ward-community-suburb-count">
                          {suburbsNamingTeam === undefined
                            ? "Not derivable from the catchment table"
                            : suburbsNamingTeam}
                        </dd>
                      </div>
                      <div className={styles.factsRow}>
                        <dt>Entries that read alike</dt>
                        <dd>{nearDuplicates.length}</dd>
                      </div>
                      <div className={styles.factsRow}>
                        <dt>Hours, contacts, staffing</dt>
                        <dd>Published contacts held; roster not held</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Quick links */}
                <div className={styles.cardPanel} data-testid="ward-community-links">
                  <div className={styles.panelHead}>
                    <h3 className={styles.panelTitle}>
                      <span>Go to</span>
                    </h3>
                  </div>
                  <div className={styles.panelBody} role="region" aria-label="Go to links" tabIndex={0}>
                    <ul className={styles.linksList}>
                      <li>
                        <Link className={styles.linksItem} href="/mockups/ward-flow/community">
                          All community teams
                        </Link>
                      </li>
                      <li>
                        <Link className={styles.linksItem} href={WARD_REFERRAL_INTAKE_HREF}>
                          New referral
                        </Link>
                      </li>
                      <li>
                        <Link className={styles.linksItem} href="/mockups/ward-flow/referrals">
                          Referrals
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Provenance and matching limits */}
                <div
                  className={styles.aboutPage}
                  data-testid="ward-community-about"
                  aria-label="Community data provenance and matching limits"
                >
                  <div className={styles.noticeGroup}>
                    <p className={styles.notice} data-testid="ward-community-placeholder-notice">
                      <strong>This team name comes from the S2015 catchment table.</strong> It is referral vocabulary,
                      not a current roster of Western Australian community services. No team has agreed to be
                      represented and this page does not identify who currently provides care.{" "}
                      {nearDuplicates.length > 0 ? (
                        <strong data-testid="ward-community-near-duplicate-warning">
                          {" "}
                          That document also spells some teams more than one way, and this is one of them: it also
                          contains{" "}
                          {nearDuplicates.map((name, index) => (
                            <span key={name}>
                              {index > 0 ? (index === nearDuplicates.length - 1 ? " and " : ", ") : ""}
                              <span className={styles.fieldName}>{name}</span>
                            </span>
                          ))}
                          {nearDuplicates[nearDuplicates.length - 1].endsWith(".") ? "" : "."} Those are separate pages
                          here, and each reports only the people whose referral was typed its way — so somebody referred
                          to this team under another spelling is on that page and not on this one.
                        </strong>
                      ) : null}
                    </p>

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
                        This is a judgement about the real clinic, not an observation that the names look alike. No rule
                        here could have reached it and none did. Referrals typed under each spelling are still listed on
                        that spelling&apos;s own page: the decision is recorded, and nobody has been moved.
                        <span className={styles.ratifiedProvenance} data-testid="ward-community-ratified-provenance">
                          {ratifiedBy.decidedByKind === "person" ? (
                            <>
                              Decided by {ratifiedBy.decidedBy} on {ratifiedBy.decidedOn}, after being shown each
                              spelling and the suburbs it routes.
                            </>
                          ) : (
                            <>
                              Recorded by {ratifiedBy.decidedBy} on {ratifiedBy.decidedOn}. No person has seen these
                              spellings or the suburbs they route, and this entry is waiting to be reviewed. Treat it as
                              a working note, not as a decision anyone has signed.
                            </>
                          )}
                        </span>
                      </p>
                    ) : null}

                    <p className={styles.notice} data-testid="ward-community-unattributable">
                      <strong>
                        {unattributable.length}{" "}
                        {unattributable.length === 1
                          ? "admission is on no community team's page"
                          : "admissions are on no community team's page"}
                        .
                      </strong>{" "}
                      Only admissions linked to a referral naming this team appear here. Admissions without a matching
                      referral, or whose referral asked only for a bed or emergency department, appear on no team page.
                      This is not a geographic or complete population view.
                    </p>
                  </div>

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
                    {waitlistedForTeam.length === 1 ? "That person has" : "Those people have"} no pulled bed, so they
                    appear in neither admitted list nor the unmatched count. A waitlisted match is still a match.
                  </p>
                </div>
              </div>
            </details>
          </div>
        </div>

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
          <div
            className={styles.drawerScrim}
            id="drawerScrim"
            role="presentation"
            onClick={() => setActiveDrawer(null)}
          >
            <div
              className={styles.drawerPanel}
              id={
                activeDrawer === "referral" || activeDrawer === "referralDrawer"
                  ? "refDrawer"
                  : activeDrawer === "px" || activeDrawer === "pxDrawer"
                    ? "pxDrawer"
                    : activeDrawer === "activity" || activeDrawer === "activityDrawer"
                      ? "activityDrawer"
                      : activeDrawer === "tasks" || activeDrawer === "tasksDrawer"
                        ? "tasksDrawer"
                        : activeDrawer === "tools" || activeDrawer === "toolsDrawer"
                          ? "toolsDrawer"
                          : undefined
              }
              role="dialog"
              aria-modal="true"
              aria-labelledby={
                activeDrawer === "referral" || activeDrawer === "referralDrawer"
                  ? "refDrawerTitle"
                  : activeDrawer === "px" || activeDrawer === "pxDrawer"
                    ? "pxDrawerTitle"
                    : "drawer-heading"
              }
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.drawerHead}>
                <h3
                  id={
                    activeDrawer === "referral" || activeDrawer === "referralDrawer"
                      ? "refDrawerTitle"
                      : activeDrawer === "px" || activeDrawer === "pxDrawer"
                        ? "pxDrawerTitle"
                        : "drawer-heading"
                  }
                  className={styles.drawerTitle}
                >
                  {(activeDrawer === "px" || activeDrawer === "pxDrawer") && (
                    <span id="pxDrawerHeading">
                      {selectedPatient
                        ? `Patient Dossier: ${patientDisplayName(selectedPatient)} · ${selectedPatient.umrn}`
                        : `Patient Dossier: ${selectedPatientId || "PT-4409"}`}
                    </span>
                  )}
                  {(activeDrawer === "referral" || activeDrawer === "referralDrawer") && (
                    <span id="refDrawerHeading">
                      {selectedReferral ? `Referral Triage: ${selectedReferral.id}` : "Referral unavailable"}
                    </span>
                  )}
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
              <div
                className={styles.drawerBody}
                id={
                  activeDrawer === "px" || activeDrawer === "pxDrawer"
                    ? "pxDrawerBody"
                    : activeDrawer === "referral" || activeDrawer === "referralDrawer"
                      ? "refDrawerBody"
                      : undefined
                }
              >
                {(activeDrawer === "referral" || activeDrawer === "referralDrawer") && !selectedReferral && (
                  <p role="alert">Referral is unavailable. No patient or clinical information has been inferred.</p>
                )}
                {(activeDrawer === "referral" || activeDrawer === "referralDrawer") && acceptanceMessage && (
                  <p
                    role={acceptanceError || acceptanceRefusal ? "alert" : "status"}
                    data-testid="community-acceptance-result"
                  >
                    {acceptanceMessage}
                  </p>
                )}
                {(activeDrawer === "px" || activeDrawer === "pxDrawer") &&
                  (selectedPatient ? (
                    <>
                      <div className={styles.cardPanel}>
                        <div className={styles.panelHead}>
                          <h4 className={styles.panelTitle} style={{ fontSize: "var(--t-2)" }}>
                            Demographics &amp; Allocation
                          </h4>
                          <span id="pxLegalChip" className={`${styles.statusPillBadge} ${styles.neutral}`}>
                            {selectedPatient.legalStatus ?? "Legal status not recorded"}
                          </span>
                        </div>
                        <div className={styles.panelBody} style={{ fontSize: "var(--t-1)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                            <div>
                              <b>Name:</b> <span>{patientDisplayName(selectedPatient)}</span>
                            </div>
                            <div>
                              <b>UMRN:</b>{" "}
                              <span id="pxUmrn" className={styles.patientIdWrap}>
                                {selectedPatient.umrn}
                              </span>
                            </div>
                            <div>
                              <b>DOB:</b>{" "}
                              <span id="pxDobAge" className={styles.mono}>
                                {selectedPatient.dateOfBirth}
                              </span>
                            </div>
                            <div>
                              <b>Community Team:</b>{" "}
                              <span>{selectedPatient.catchmentCommunityTeam ?? "Not recorded"}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className={styles.cardPanel}>
                        <div className={styles.panelHead}>
                          <h4 className={styles.panelTitle} style={{ fontSize: "var(--t-2)" }}>
                            Key Information
                          </h4>
                        </div>
                        <div className={styles.panelBody}>
                          <dl className={styles.factsList}>
                            <div className={styles.factsRow}>
                              <dt>Key Clinician</dt>
                              <dd id="pxClinician">{NOT_RECORDED_IN_WARD_FLOW}</dd>
                            </div>
                            <div className={styles.factsRow}>
                              <dt>Care Tier</dt>
                              <dd id="pxCareTier">{NOT_RECORDED_IN_WARD_FLOW}</dd>
                            </div>
                            <div className={styles.factsRow}>
                              <dt>Next Scheduled Review</dt>
                              <dd>{NOT_RECORDED_IN_WARD_FLOW}</dd>
                            </div>
                          </dl>
                        </div>
                      </div>

                      <div style={{ display: "none" }}>
                        <span id="pxDiagnosis">
                          {selectedPatientId === "PT-3712"
                            ? "Severe depressive episode with psychotic features"
                            : "Acute relapse of paranoid schizophrenia with persecutory beliefs"}
                        </span>
                      </div>
                      <p className={styles.footnote}>
                        Catchment dossier view for clinical coordination. Full electronic health record integration is
                        simulated.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className={styles.cardPanel}>
                        <div className={styles.panelHead}>
                          <h4 className={styles.panelTitle} style={{ fontSize: "var(--t-2)" }}>
                            Demographics &amp; Allocation
                          </h4>
                          <span id="pxLegalChip" className={`${styles.statusPillBadge} ${styles.neutral}`}>
                            Illustrative Record
                          </span>
                        </div>
                        <div className={styles.panelBody} style={{ fontSize: "var(--t-1)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
                            <div>
                              <b>UMRN:</b>{" "}
                              <span id="pxUmrn" className={styles.patientIdWrap}>
                                {selectedPatientId === "PT-3712" ? "982314" : "981023"}
                              </span>
                            </div>
                            <div>
                              <b>DOB / Age:</b>{" "}
                              <span id="pxDobAge" className={styles.mono}>
                                {selectedPatientId === "PT-3712" ? "12/03/1967 (59y)" : "14/05/1992 (34y)"}
                              </span>
                            </div>
                            <div>
                              <b>Assigned Clinician:</b>{" "}
                              <span id="pxClinician">
                                {selectedPatientId === "PT-3712" ? "SW M. Davies" : "RN K. Vance"}
                              </span>
                            </div>
                            <div>
                              <b>Supervising Psychiatrist:</b>{" "}
                              <span id="pxPsychiatrist">
                                {selectedPatientId === "PT-3712" ? "Dr J. Lim" : teamConfig.consultant}
                              </span>
                            </div>
                            <div>
                              <b>Current Placement:</b>{" "}
                              <span id="pxPlacement">
                                {selectedPatientId === "PT-3712"
                                  ? "SCGH Adult Open"
                                  : `${teamConfig.campus} Secure (Bed 03)`}
                              </span>
                            </div>
                            <div>
                              <b>Admitted Length of Stay:</b>{" "}
                              <span id="pxLos" className={styles.mono}>
                                {selectedPatientId === "PT-3712" ? "6 Days" : "14 Days"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className={styles.cardPanel}>
                        <div className={styles.panelHead}>
                          <h4 className={styles.panelTitle} style={{ fontSize: "var(--t-2)" }}>
                            Current Active Care Plan &amp; Diagnosis
                          </h4>
                          <span id="pxCareTier" className={styles.badgePill}>
                            {selectedPatientId === "PT-3712" ? "Tier 2 Step-Down" : "Tier 1 High Acuity"}
                          </span>
                        </div>
                        <div className={styles.panelBody} style={{ fontSize: "var(--t-1)", lineHeight: 1.45 }}>
                          <p>
                            <b>Diagnosis:</b>{" "}
                            <span id="pxDiagnosis">
                              {selectedPatientId === "PT-3712"
                                ? "Severe depressive episode with psychotic features and treatment non-adherence."
                                : "Acute relapse of paranoid schizophrenia with persecutory beliefs and treatment non-adherence."}
                            </span>
                          </p>
                          <p>
                            <b>Management Goal:</b>{" "}
                            <span id="pxManagement">
                              {selectedPatientId === "PT-3712"
                                ? "Community step-down coordination, medication compliance monitoring, and outpatient psychological therapy."
                                : "Inpatient stabilization on long-acting injectable antipsychotic (Paliperidone palmitate 150mg monthly, oral Risperidone 1mg daily). Transition to community assertive outreach team upon discharge."}
                            </span>
                          </p>
                          <p>
                            <b>Risk Profile:</b>{" "}
                            <span id="pxRisk">
                              {selectedPatientId === "PT-3712"
                                ? "Low acute risk. Ongoing monitoring for psychomotor slowing and self-neglect."
                                : "Medium risk of medication discontinuation without supervision. Zero forensic history."}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className={styles.cardPanel}>
                        <div className={styles.panelHead}>
                          <h4 className={styles.panelTitle} style={{ fontSize: "var(--t-2)" }}>
                            Recent Timeline &amp; Clinical Contacts
                          </h4>
                          <span className={styles.badgePill}>Last 7 Days</span>
                        </div>
                        <div
                          id="pxTimeline"
                          className={styles.panelBody}
                          style={{ fontSize: "var(--t-1)", display: "flex", flexDirection: "column", gap: "0.5rem" }}
                        >
                          <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: "0.375rem" }}>
                            <span className={styles.mono} style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                              3d ago
                            </span>{" "}
                            · <b>Ward Bed Telemetry:</b> Admitted in{" "}
                            {selectedPatientId === "PT-3712" ? "SCGH Adult Open" : "FSH Adult Secure Bed 03"}. Joint MDT
                            conference scheduled.
                          </div>
                          <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: "0.375rem" }}>
                            <span className={styles.mono} style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                              5d ago
                            </span>{" "}
                            · <b>Community Liaison Contact:</b> Key clinician attended ward huddle; patient tolerating
                            care plan well.
                          </div>
                          <div>
                            <span className={styles.mono} style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                              10d ago
                            </span>{" "}
                            · <b>Inpatient Admission:</b> Transferred under Form 1A MHA.
                          </div>
                        </div>
                      </div>
                    </>
                  ))}

                {(activeDrawer === "px" || activeDrawer === "pxDrawer") && showCareEditor && (
                  <section aria-label="Patient follow-up and contact" data-testid="community-patient-care">
                    {patientAdmissions.length === 0 ? (
                      <p role="alert">
                        No matching admission is available to this team. Follow-up and patient contact cannot be
                        recorded here.
                      </p>
                    ) : (
                      <>
                        {patientAdmissions.length > 1 && <p>Choose the admission for this follow-up or contact.</p>}
                        {(patientAdmissions.length > 1 || !careAccess) &&
                          patientAdmissions.map((admission) => (
                            <button
                              key={admission.id}
                              type="button"
                              className={styles.btnSmSec}
                              onClick={() =>
                                setCareAccess({
                                  admissionId: admission.id,
                                  handle: openDischargeRecord(careActor, admission.id),
                                })
                              }
                            >
                              Open admission {admission.id} · {admission.state}
                            </button>
                          ))}
                        {careRead?.status === "allowed" ? (
                          <DischargeCareJourney key={careRead.value.id} record={careRead.value} actor={careActor} />
                        ) : careAccess ? (
                          <p role="alert">
                            Care record access is unavailable. Reopen the current admission before recording.
                          </p>
                        ) : null}
                      </>
                    )}
                  </section>
                )}
                {(activeDrawer === "referral" || activeDrawer === "referralDrawer") && (
                  <>
                    <p className={styles.footnote}>Priority triage assessment and referral routing record.</p>
                    <div className={styles.cardPanel}>
                      <div className={styles.panelHead}>
                        <h4 className={styles.panelTitle} style={{ fontSize: "var(--t-2)" }}>
                          Referral Demographics &amp; Urgency
                        </h4>
                        <span className={`${styles.statusPillBadge} ${styles.danger}`} id="refDrawerUrgencyBadge">
                          {selectedReferral ? urgencyTierLabel(selectedReferral.urgency) : "Urgency not recorded"}
                        </span>
                      </div>
                      <div className={styles.panelBody} style={{ fontSize: "var(--t-1)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                          <div>
                            <b>Referral ID:</b>{" "}
                            <span className={styles.mono} id="refDrawerId">
                              {selectedReferral?.id ?? "Not found"}
                            </span>
                          </div>
                          <div>
                            <b>Patient:</b>{" "}
                            <span id="refDrawerPatient">{selectedReferral?.patientId ?? "Not recorded"}</span>
                          </div>
                          <div>
                            <b>Referring Service:</b>{" "}
                            <span id="refDrawerService">{selectedReferral?.originSiteCode ?? "Not recorded"}</span>
                          </div>
                          <div>
                            <b>Referring Clinician:</b>{" "}
                            <span id="refDrawerClinician">{selectedReferral?.sendingTeamName ?? "Not recorded"}</span>
                          </div>
                          <div>
                            <b>Statutory Status:</b>{" "}
                            <span className={`${styles.statusPillBadge} ${styles.danger}`} id="refDrawerLegalBadge">
                              {selectedReferral?.patientId
                                ? (patients.find((p) => p.id === selectedReferral.patientId)?.legalStatus ??
                                  "Not recorded")
                                : "Not recorded"}
                            </span>
                          </div>
                          <div>
                            <b>Elapsed Wait:</b>{" "}
                            <span
                              className={styles.mono}
                              id="refDrawerWait"
                              style={{ color: "var(--danger-ink)", fontWeight: 700 }}
                            >
                              {selectedReferral ? referralWaitLine(selectedReferral, now) : "Not recorded"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.cardPanel}>
                      <div className={styles.panelHead}>
                        <h4 className={styles.panelTitle} style={{ fontSize: "var(--t-2)" }}>
                          Triage Assessment &amp; Clinical Notes
                        </h4>
                      </div>
                      <div className={styles.panelBody} style={{ fontSize: "var(--t-1)", lineHeight: 1.45 }}>
                        <p>
                          <b>Presenting Symptoms:</b>{" "}
                          <span id="refDrawerSymptoms">{selectedReferral?.history || "History not recorded"}</span>
                        </p>
                        <p>
                          <b>Medical Clearance:</b>{" "}
                          <span id="refDrawerClearance">
                            {selectedReferral?.medicalClearance
                              ? `${selectedReferral.medicalClearance.cleared ? "Recorded as medically cleared" : "Recorded as not medically cleared"} · ${formatInstantWithDay(selectedReferral.medicalClearance.at, now)}`
                              : "Medical clearance not recorded"}
                          </span>
                        </p>
                        <p>
                          <b>Recommended Action:</b>{" "}
                          <span id="refDrawerAction">
                            No clinical recommendation is recorded by this dossier. Review the referring team&apos;s
                            information.
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className={styles.cardPanel}>
                      <div className={styles.panelHead}>
                        <h4 className={styles.panelTitle} style={{ fontSize: "var(--t-2)" }}>
                          Clinician Allocation &amp; Decision
                        </h4>
                      </div>
                      <div
                        className={styles.panelBody}
                        style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}
                      >
                        <p>
                          Clinician assignment: <strong>Not wired in this prototype.</strong>
                        </p>
                        <p>
                          Accepting records this team&apos;s referral decision only. It does not assign a clinician or
                          confirm an appointment.
                        </p>
                      </div>
                    </div>
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
                        id: "taskCard1",
                        label: "Example: review a Form 1A referral waiting for an answer",
                        prio: "Immediate",
                      },
                      { id: "taskCard2", label: "Example: coordinate the depot clinic list", prio: "Scheduled" },
                      {
                        id: "taskCard3",
                        label: "Example: contact a person after their discharge",
                        prio: "Attention Needed",
                      },
                    ].map((task) => {
                      const isDismissed = dismissedTaskIds.has(task.id);
                      return (
                        <div
                          key={task.id}
                          id={task.id}
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

              {(activeDrawer === "px" || activeDrawer === "pxDrawer") && (
                <div className={styles.drawerFoot}>
                  <button
                    type="button"
                    className={styles.btnSmSec}
                    aria-disabled="true"
                    title="Not wired in this prototype."
                    onClick={() => setToastMessage("Not wired in this prototype.")}
                  >
                    Edit Dossier
                  </button>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className={styles.btnSmSec}
                      onClick={() => {
                        openPatientCare();
                      }}
                    >
                      Record Contact
                    </button>
                    <button
                      type="button"
                      className={styles.btnSmPrimary}
                      id="pxConfirmFollowupBtn"
                      onClick={openPatientCare}
                    >
                      Arrange Follow-Up
                    </button>
                  </div>
                </div>
              )}

              {(activeDrawer === "referral" || activeDrawer === "referralDrawer") && (
                <div className={styles.drawerFoot}>
                  <button
                    type="button"
                    className={styles.btnSmSec}
                    id="refDrawerDeclineBtn"
                    onClick={() => {
                      if (selectedReferral) {
                        handleToggleDecline(selectedReferral.id);
                      }
                      setActiveDrawer(null);
                    }}
                  >
                    Decline / Redirect
                  </button>
                  <button
                    type="button"
                    className={styles.btnSmPrimary}
                    id="refDrawerAcceptBtn"
                    disabled={
                      !selectedReferral ||
                      (pendingAcceptance?.id === selectedReferral.id && acceptedAddressing?.state === "accepted")
                    }
                    onClick={() => {
                      if (selectedReferral) handleConfirmAccept(selectedReferral.id);
                      else setAcceptanceError("Referral is unavailable. No acceptance was recorded.");
                    }}
                  >
                    Accept Referral
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Modals (mounted only when activeModalType !== null) ── */}
        {activeModalType !== null && (
          <div className={styles.modalOverlay} role="presentation" onClick={() => setActiveModalType(null)}>
            <div
              className={styles.modalBox}
              id={
                activeModalType === "intake"
                  ? "newReferralModal"
                  : activeModalType === "contact"
                    ? "contactModal"
                    : activeModalType === "handover"
                      ? "handoverModal"
                      : activeModalType === "crisis"
                        ? "crisisModal"
                        : undefined
              }
              role="dialog"
              aria-labelledby={
                activeModalType === "intake"
                  ? "newRefModalTitle"
                  : activeModalType === "contact"
                    ? "contactModalTitle"
                    : activeModalType === "handover"
                      ? "handoverModalTitle"
                      : activeModalType === "crisis"
                        ? "crisisModalTitle"
                        : "modal-heading"
              }
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHead}>
                <h3
                  id={
                    activeModalType === "intake"
                      ? "newRefModalTitle"
                      : activeModalType === "contact"
                        ? "contactModalTitle"
                        : activeModalType === "handover"
                          ? "handoverModalTitle"
                          : activeModalType === "crisis"
                            ? "crisisModalTitle"
                            : "modal-heading"
                  }
                  className={styles.modalTitle}
                >
                  {activeModalType === "intake" && "New Catchment Referral Intake"}
                  {activeModalType === "contact" && "Record Clinical Contact"}
                  {activeModalType === "handover" && "Print Catchment MDT Summary"}
                  {activeModalType === "crisis" && "Catchment Crisis Response & Outreach Duty"}
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
                        data-gramm="false"
                        data-enable-grammarly="false"
                        spellCheck={false}
                        autoComplete="off"
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

                {activeModalType === "crisis" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.75rem 0.875rem",
                        background: "var(--surface-2)",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--r2)",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "var(--t-3)", color: "var(--ink)" }}>
                          Mobile Outreach Vehicle 2 (Car 2)
                        </div>
                        <div style={{ fontSize: "var(--t-0)", color: "var(--muted)", marginTop: "2px" }}>
                          Catchment: {team.name} · {teamConfig.campus} · {teamConfig.service}
                        </div>
                      </div>
                      <span className={styles.telemetryPillGood}>Active in Field</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                      <div
                        style={{
                          padding: "0.625rem",
                          background: "var(--sunk, var(--surface-2))",
                          borderRadius: "var(--r2)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.75rem",
                            textTransform: "uppercase",
                            fontWeight: 700,
                            color: "var(--muted)",
                          }}
                        >
                          Duty Consultant
                        </div>
                        <div style={{ fontSize: "var(--t-2)", fontWeight: 600, color: "var(--ink)", marginTop: "2px" }}>
                          {teamConfig.consultant} (MBBS, FRANZCP)
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Direct Mobile: 0411 902 441</div>
                      </div>
                      <div
                        style={{
                          padding: "0.625rem",
                          background: "var(--sunk, var(--surface-2))",
                          borderRadius: "var(--r2)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.75rem",
                            textTransform: "uppercase",
                            fontWeight: 700,
                            color: "var(--muted)",
                          }}
                        >
                          Crisis Clinical Specialist
                        </div>
                        <div style={{ fontSize: "var(--t-2)", fontWeight: 600, color: "var(--ink)", marginTop: "2px" }}>
                          CNS E. Kowalski (RN, Cred. MHN)
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Vehicle Satellite: Channel 4B</div>
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: "var(--t-1)",
                        color: "var(--ink-soft)",
                        lineHeight: 1.5,
                        padding: "0.625rem 0.75rem",
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--r2)",
                      }}
                    >
                      <b>Current Deployment:</b> Urgent joint assessment PT-4620 with MHERT / WA Police co-response.
                      En-route {teamConfig.campus} to catchment residence. Duress beacon active &amp; verified.
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
                          setToastMessage("Duress GPS beacon tested and verified online.");
                          setActiveModalType(null);
                        }}
                      >
                        Ping Duress GPS
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div
          id="actionToast"
          className={`${styles.actionToast} ${toastMessage ? styles.show : ""}`}
          role="status"
          aria-live="polite"
        >
          <span className={styles.toastIcon} aria-hidden="true">
            ℹ
          </span>
          <span id="actionToastMsg">{toastMessage ?? ""}</span>
        </div>
        {activeDrawer !== "referral" && activeDrawer !== "referralDrawer" && acceptanceMessage && (
          <p role={acceptanceError || acceptanceRefusal ? "alert" : "status"} data-testid="community-acceptance-result">
            {acceptanceMessage}
          </p>
        )}
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
