// Forked from src/components/ward-redesign/community-team/community-team-redesign.tsx (role view: community clinician).
"use client";

import { WardNotFoundBody } from "@/components/ward-management/shell/ward-not-found";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { currentCareContactCompleted } from "@/components/ward-management/ward-care-journey";
import type { DischargeOpenHandle } from "@/components/ward-management/ward-discharge-records";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsPhone, useOptionalToast } from "@/components/wf";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import {
  admissionBelongsToTeam,
  admissionsWithNoCommunityTeam,
  communityMembershipResolution,
  communityHubLists,
  communityTeamById,
} from "@/components/ward-management/community/community-derivations";
import { referralsSentByTeam } from "@/components/ward-management/community/community-sent-referrals";
import {
  ratifiedAliasesFor,
  ratifiedSameServiceNames,
} from "@/components/ward-management/community/community-ratified-aliases";
import {
  communityTeamSuburbCounts,
  nearDuplicateSpellingsOf,
} from "@/components/ward-management/community/community-vocabulary";
import { raiseReferralHref } from "@/components/ward-management/shell/ward-facade";
import { openReferralSheet } from "@/components/ward-management/shell/ward-drawer-bus";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import {
  useCommunityScopedReferrals,
  useCommunitySentReferrals,
  useDanglingReferralIds,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import type { CommunityScopedReferral } from "@/components/ward-management/ward-referral-visibility";
import {
  patientIdentityLine,
  resolveSubjectPatient,
  UMRN_NOT_RECORDED,
  type PatientResolutionSubject,
} from "@/components/ward-management/ward-patient-resolver";
import type { CommunityDeclineReason } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import styles from "@/components/ward-management/community/community.module.css";
import { useCommunityContactSave } from "@/components/ward-management/community/use-community-contact-save";
import { CommunityAboutThisData, CommunityWorthAttention, type CommunityPhoneListId } from "./community-team-phone";
import v6 from "@/components/ward-management/community/community-team-v6.module.css";
import {
  DEMO_COMMUNITY_CASELOAD,
  DEMO_COMMUNITY_UMRNS,
  resolveCommunityTeamConfig,
} from "@/components/ward-management/community/community-demo-cohort";
import {
  referralOriginLabel,
  caseloadStatutoryFormCode,
  caseloadRowsForTeam,
  referralsWaitingOnTeam,
  categoriseTeamAdmission,
  declineTargetIsOpen,
  type ActiveTabType,
  type DrawerType,
  type ModalType,
  type CaseloadFilter,
  type AcceptedBeforeAdmission,
} from "@/components/ward-management/community/community-screen-helpers";
import {
  communityPhoneAttentionItems,
  communityNoticesSection,
  communitySinceElement,
  communityOnDutyPanel,
  communityCoveragePanel,
} from "@/components/ward-management/community/community-screen-panels";
// Role view (community clinician): the phone tree and the hero are forked beside this file, each with
// its community branch; nothing else in this copy changes.
import { CommunityScreenPhone } from "./community-screen-phone";
import { CommunityScreenDesktopHero, CommunityScreenSwitchDrawer } from "./community-screen-hero";
import { CommunityScreenSentTab } from "@/components/ward-management/community/community-screen-sent-tab";
import { CommunityScreenWaitingTab } from "@/components/ward-management/community/community-screen-waiting-tab";
import { CommunityTeamInBedTab } from "./community-team-in-bed";
import { CommunityTeamHowToReach } from "@/components/ward-redesign/community-team/community-team-contact";
import { CommunityScreenBackTab } from "@/components/ward-management/community/community-screen-back-tab";
import { CommunityScreenCaseloadTab } from "@/components/ward-management/community/community-screen-caseload-tab";
import {
  CommunityScreenTransportBookDialog,
  CommunityScreenTransportCancelDialog,
} from "@/components/ward-management/community/community-screen-transport-dialogs";
import {
  CommunityScreenReferralModal,
  CommunityScreenNoteModal,
} from "@/components/ward-management/community/community-screen-modals";
import { CommunityScreenDrawer } from "@/components/ward-redesign/community-team/community-screen-drawer-redesign";
import { useCommunityScreenDemoLists } from "@/components/ward-management/community/use-community-screen-demo-lists";
import { useCommunityDrawerTestOpeners } from "@/components/ward-management/community/community-drawer-test-openers";
import {
  useCommunityScreenOverlayFocus,
  useCommunityScreenTransport,
} from "@/components/ward-management/community/use-community-screen-overlays";
import { useHoldOpenForm } from "@/components/ward-management/use-hold-open-form";

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
// Its blocked-reason sentence, and the cancel-transport one, live in `community-blocked-reasons.ts`.

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
 * (`design/prototypes/mockup-community-team-hub-v1.html`).** This one changes what
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
type CommunityScreenProps = {
  teamId: string;
  demonstration?: boolean;
  admissions?: Admission[];
  /** Already community-scoped (FD-23): this page never holds another destination. */
  referrals?: CommunityScopedReferral[];
};

/** Type bridge only (D-91): the team page has no patient search. Delete with the three view fields. */
const NO_SEARCH = () => {};
const NO_SEARCH_RESULTS: Patient[] = [];

function useCommunityScreenView({ teamId, admissions, referrals, demonstration = false }: CommunityScreenProps) {
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
    notices,
    units,
    movements,
    patients,
    rejections,
    openDischargeRecord,
    readDischargeRecord,
    dispatch,
    shared,
    worldGeneration,
  } = useWardFlowSelect(
    "admissions",
    "notices",
    "units",
    "movements",
    "patients",
    "rejections",
    "openDischargeRecord",
    "readDischargeRecord",
    "dispatch",
    "shared",
    "worldGeneration",
  );
  const liveReferrals = useCommunityScopedReferrals();
  const sentByAnyTeam = useCommunitySentReferrals();
  const now = useWardFlowClock();
  const raise = useWardRaise("community");
  // D-39: one lookup per render, so the resolver's index cache holds across every notice line.
  const umrnLookup = useMemo(
    () => ({ patients, referrals: referrals ?? liveReferrals, movements }),
    [patients, referrals, liveReferrals, movements],
  );
  // D-39: a person is named by name and UMRN through the resolver, never by a referral, admission or
  // patient record number. The demonstration cohort holds a UMRN only on its caseload rows.
  const identityOf = (subject: PatientResolutionSubject) =>
    patientIdentityLine(resolveSubjectPatient(subject, umrnLookup));
  const demoUmrnOf = (patientId: string) =>
    DEMO_COMMUNITY_CASELOAD.find((row) => row.patientId === patientId)?.umrn ??
    DEMO_COMMUNITY_UMRNS[patientId] ??
    UMRN_NOT_RECORDED;
  const team =
    communityTeamById(teamId) ??
    (teamId === "fremantle" || teamId === "alma-street" ? communityTeamById("alma-street-fremantle") : null);
  // Option B (Josh, 13 Oct 2026): one referral flow. New referral opens the referral slide-out
  // from this team; the retired intake modal asked the same questions with no person named.
  const referFromTeamHref = raiseReferralHref({ source: "community", teamId: team?.id ?? teamId });
  const openNewReferral = useCallback(() => openReferralSheet(referFromTeamHref), [referFromTeamHref]);
  const [followUpFilter, setFollowUpFilter] = useState("all");
  const [declineOpenFor, setDeclineOpenFor] = useState<string | undefined>(undefined);
  // Audit CS3-01: the waiting row's decline form is checked against the board it opened on.
  useHoldOpenForm(declineOpenFor !== undefined, declineOpenFor && `referral:${declineOpenFor}`);
  const [declineDraft, setDeclineDraft] = useState<CommunityDeclineReason | undefined>(undefined);
  const [activeModal, setActiveModal] = useState<{ referral: CommunityScopedReferral } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Device audit option A (11 Oct 2026): the page opens on the first list with someone in it
  // (`firstListWithSomeone`, below, once the lists are built), until the reader picks another.
  const [chosenTab, setChosenTab] = useState<ActiveTabType | null>(null);
  // Set once the reader picks a list; until then the default may follow the resolved viewport.
  const readerPickedTab = useRef(false);
  const setActiveTab = useCallback((tab: ActiveTabType) => {
    readerPickedTab.current = true;
    setChosenTab(tab);
  }, []);
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>(null);
  const [activeModalType, setActiveModalType] = useState<ModalType>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [selectedReferralId, setSelectedReferralId] = useState<string | null>(null);
  const [pendingAcceptance, setPendingAcceptance] = useState<{ id: string; rejectionCount: number } | null>(null);

  /*
   * v10 pass 3: an Accept or Decline recorded here shows a toast with Undo
   * (`UNDO_REFERRAL_DECISION`, this team's own decision), through the shared `useUndoableStep`: a
   * refused step or Undo says why.
   */
  const toast = useOptionalToast();
  const {
    run: runDecision,
    runRecorded: runRecordedDecision,
    offer: offerDecision,
  } = useUndoableStep({
    dispatch,
    rejections,
    now,
    routeRole: "community",
    toast,
  });
  const decisionStep = useCallback(
    (referralId: string, word: "accepted" | "declined") => ({
      success: `Referral ${word}`,
      undo: (at: Instant): WardFlowEvent => ({
        type: "UNDO_REFERRAL_DECISION",
        role: "community",
        now: at,
        referralId,
      }),
      undone: "Decision undone. The referral is back in the queue.",
    }),
    [],
  );
  const [switchOpen, setSwitchOpen] = useState(false);
  // Phone (v10): the waiting referral and the departure open as bottom sheets.
  const isPhone = useIsPhone();
  // The first render (and hydration) reads the viewport as desktop. Once the phone query resolves,
  // clear the held default so it is re-picked from the phone's own lists, unless the reader chose one.
  // Only the viewport change does this; rows leaving a list never switch it under the reader.
  useEffect(() => {
    if (!readerPickedTab.current) setChosenTab(null);
  }, [isPhone]);
  const [phoneReferralId, setPhoneReferralId] = useState<string | null>(null);
  const [phoneDeclining, setPhoneDeclining] = useState(false);
  const declineSave = useWardFormSave(`community-decline:${declineOpenFor ?? phoneReferralId ?? ""}`);
  const [phoneDepartureId, setPhoneDepartureId] = useState<string | null>(null);
  // The phone's Caseload list opens on the whole caseload, matching its count (Josh, 30 Oct 2026).
  const [phoneShowWholeCaseload, setPhoneShowWholeCaseload] = useState(true);
  const [switchQuery, setSwitchQuery] = useState("");
  const switchTriggerRef = useRef<HTMLButtonElement>(null);

  const [acceptanceError, setAcceptanceError] = useState<string | null>(null);
  const [showCareEditor, setShowCareEditor] = useState(false);
  const [careAccess, setCareAccess] = useState<{ admissionId: string; handle: DischargeOpenHandle } | null>(null);
  const [triageFilter, setTriageFilter] = useState<"all" | "p1" | "p2" | "p3" | "ed">("all");
  const [caseloadFilter, setCaseloadFilter] = useState<CaseloadFilter>("all");
  // The dossier reads the patient record itself. Until 25 Sept 2026 it read a typed table, with a
  // clinician, care tier and review date that belonged to nobody's record.
  const selectedPatient: Patient | undefined = patients.find((patient) => patient.id === selectedPatientId);
  const contactSave = useCommunityContactSave({
    dispatch,
    now,
    teamId,
    generation: worldGeneration,
    shared,
    onAccepted: (source) => {
      if (source === "modal") setActiveModalType((current) => (current === "contact" ? null : current));
      else setToastMessage("Team contact logged. This does not record patient or referral contact.");
    },
    onQuickMessage: setToastMessage,
  });
  const { contactRecord, contactSaveMessage, contactSaveDisabled } = contactSave;
  const [dismissedTaskIds, setDismissedTaskIds] = useState<Set<string>>(new Set());
  const [uiState, setUiState] = useState<"populated" | "skeleton" | "empty" | "error">("populated");
  const [inpatientFilter, setInpatientFilter] = useState<"all" | "secure" | "open" | "older">("all");
  const [egressFilter, setEgressFilter] = useState<"all" | "overdue" | "today" | "upcoming">("all");

  const hasExplicitProps = Boolean(admissions || referrals);
  const isDemoMode = demonstration && !hasExplicitProps;

  const { demoTeamReferrals, demoVisibleReferrals, demoVisibleInpatients, demoVisibleEgress, demoVisibleCaseload } =
    useCommunityScreenDemoLists({ teamId, triageFilter, inpatientFilter, egressFilter, caseloadFilter });

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
      el.scrollIntoView({ behavior: wardScrollBehavior(), block: "start" });
    }
  }, []);

  function handleActionClick(action: "Contacted" | "Review" | "Assign", referral: CommunityScopedReferral) {
    if (action === "Contacted") {
      contactSave.saveContact("quick");
    } else if (action === "Review") {
      setSelectedReferralId(referral.id);
      setPendingAcceptance(null);
      setAcceptanceError(null);
      setActiveDrawer("referralDrawer");
    } else if (action === "Assign") {
      setActiveModal({ referral });
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
    // Escape runs last (window), after any open layer has handled it.
    function handleEscape(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      setActiveModal(null);
      setActiveModalType(null);
      setActiveDrawer(null);
    }
    // D-91: "/" is the header search's own key here. The team page's sample-patient search, its
    // popover, the phone's Find a person chip and this key's binding went as a copy of the header
    // search (search and forms review, Josh, 30 Oct 2026).
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function handleToggleDecline(referralId: string) {
    setDeclineOpenFor((current) => (current === referralId ? undefined : referralId));
    setDeclineDraft(undefined);
    declineSave.forget();
  }

  /**
   * Dispatches a real `DECLINE_REFERRAL` for this team's own queue, with role `"community"` and
   * the chosen reason from the real community vocabulary. Guarded here too, not only on the
   * button's `aria-disabled` — the same belt-and-braces discipline `referral-match.tsx`'s own
   * `handleDecline` holds to, so an unstated reason can never reach the record even by a route that
   * bypasses the disabled control.
   */
  const handleConfirmDecline = useCallback(
    (referralId: string, onDeclined?: () => void) => {
      if (declineDraft === undefined || declineSave.pending) return;
      if (
        !declineTargetIsOpen(referralId, declineOpenFor, { declining: phoneDeclining, referralId: phoneReferralId })
      ) {
        return;
      }
      // H-0117 (audit SM2-03): the reason stays chosen until the decline is accepted.
      declineSave.submit(
        () => {
          let completion: ReturnType<typeof dispatch> | undefined;
          runRecordedDecision(
            () =>
              (completion = dispatch({
                type: "DECLINE_REFERRAL",
                role: "community",
                now,
                referralId,
                destinationKind: "community_team",
                reason: declineDraft,
              })),
            decisionStep(referralId, "declined"),
          );
          return completion;
        },
        () => {
          setDeclineOpenFor(undefined);
          setDeclineDraft(undefined);
          onDeclined?.();
        },
      );
    },
    [
      declineDraft,
      declineOpenFor,
      declineSave,
      phoneDeclining,
      phoneReferralId,
      decisionStep,
      dispatch,
      now,
      runRecordedDecision,
    ],
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
      // The projection carries the referral's one community addressing (the reducer refuses two), so
      // it is this team's only when it names this team or a ratified same-service spelling.
      const addressing = liveReferrals.find((referral) => referral.id === referralId)?.addressing;
      if (
        !addressing ||
        !team ||
        ![team.name, ...ratifiedSameServiceNames(team.name)].includes(addressing.destination.teamName) ||
        addressing.state !== "queued" ||
        addressing.withdrawnAt !== undefined
      ) {
        setAcceptanceError("Referral cannot be accepted: reload the current queued referral for this team.");
        setPendingAcceptance(null);
        return;
      }
      setAcceptanceError(null);
      setPendingAcceptance({ id: referralId, rejectionCount: rejections.length });
      const completion = raise("ACCEPT_REFERRAL", {
        referralId,
        destinationKind: "community_team",
      });
      offerDecision(decisionStep(referralId, "accepted"), { completion });
    },
    [raise, liveReferrals, rejections.length, team, offerDecision, decisionStep],
  );

  const openReferralDrawerForTest = useCallback((referralId: string) => {
    setSelectedReferralId(referralId);
    setPendingAcceptance(null);
    setAcceptanceError(null);
    setActiveDrawer("referralDrawer");
  }, []);
  const openPatientDrawerForTest = useCallback((patientId: string) => {
    setSelectedPatientId(patientId);
    setActiveDrawer("pxDrawer");
  }, []);
  useCommunityDrawerTestOpeners({
    openReferralDrawer: openReferralDrawerForTest,
    openPatientDrawer: openPatientDrawerForTest,
  });

  function handleSaveClinicalContact() {
    contactSave.saveContact("modal");
  }

  // The shared modal contract for the drawer and dialogs, then the two transport dialogs. Hook order
  // is stacking order, so these two calls keep this order (see `use-community-screen-overlays.ts`).
  const {
    drawerPanelRef,
    drawerScrimRef,
    noteModalRef,
    noteModalOverlayRef,
    referralModalRef,
    referralModalBackdropRef,
  } = useCommunityScreenOverlayFocus({
    activeDrawer,
    setActiveDrawer,
    activeModalType,
    setActiveModalType,
    activeModal,
    setActiveModal,
  });
  const {
    transportBookFor,
    setTransportBookFor,
    transportDraft,
    setTransportDraft,
    transportCancelFor,
    setTransportCancelFor,
    cancelTransportReason,
    setCancelTransportReason,
    cancelTransportBlocked,
    openTransportBook,
    closeTransportBook,
    openTransportCancel,
    closeTransportCancel,
    transportBookDialogRef,
    transportCancelDialogRef,
    submitBookTransport,
    submitCancelTransport,
  } = useCommunityScreenTransport({ raise, now, teamId });

  const source = admissions ?? liveAdmissions;
  // Membership is read off the referral now, so the referrals are as much an input to this screen
  // as the admissions are. Overridable together, and from the same place, so a test cannot supply
  // one without the other and get a page that is quietly empty for the wrong reason.
  const sourceReferrals = referrals ?? liveReferrals;
  const danglingReferralIds = useDanglingReferralIds(source);

  // The page for an unknown team is the not-found body below, rendered by `CommunityScreen`.
  if (!team) return null;
  // Fix plan item 17 and D-77 group A: what this team sent, for the Sent tab on desktop and phone.
  const sentReferrals = {
    sent: referralsSentByTeam(sentByAnyTeam.sent, team),
    unattributed: sentByAnyTeam.unattributed,
  };

  // Only a referral addressed to this team, or a ratified same-service name, opens in the drawer.
  const selectedReferral = sourceReferrals.find(
    (referral) =>
      referral.id === selectedReferralId &&
      [team.name, ...ratifiedSameServiceNames(team.name)].includes(referral.addressing.destination.teamName),
  );

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
    [liveReferrals.find((referral) => referral.id === pendingAcceptance.id)?.addressing].find(
      (addressing) =>
        addressing !== undefined &&
        [team.name, ...ratifiedSameServiceNames(team.name)].includes(addressing.destination.teamName),
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
        ? `Referral for ${identityOf({ referralId: pendingAcceptance.id })} accepted for ${team.name} follow-up. No clinician assignment was recorded.`
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
  /*
   * FD-23 (owner's choice, 15 Oct 2026): this page holds only the referrals that name a community
   * team. An admission whose referral went only to a ward or an ED is left out, as the page may not
   * see it. A referral id that matches nothing at all stays in, so a broken link still reads as
   * not computable.
   */
  const visibleReferralIds = new Set(sourceReferrals.map((referral) => referral.id));
  const resolution = communityMembershipResolution(
    source.filter(
      (admission) =>
        admission.referralId === null ||
        visibleReferralIds.has(admission.referralId) ||
        danglingReferralIds.has(admission.referralId),
    ),
    team,
    sourceReferrals,
  );
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
  const hasAnyReferralsForTeam = sourceReferrals.some((r) => r.addressing.destination.teamName === team.name);
  // Use the same unfiltered queue as the rendered list. Priority chips narrow visible rows,
  // while the tab and urgent total continue to describe the whole queue.
  const usesDemoReferrals = isDemoMode && !hasAnyReferralsForTeam;
  const waitingCount = usesDemoReferrals ? demoTeamReferrals.length : waitingReferrals.length;
  const urgentAnswerCount = usesDemoReferrals
    ? demoTeamReferrals.filter((referral) => referral.urgency === 1 || referral.urgency === 2).length
    : urgentWaitingCount;
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
    raise("MARK_NOTICE_READ", { noticeId, actingPlaceId: teamId });
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

  // Site review 12 Oct 2026: admissions matched to no team are a fact about the data, not about this
  // team, and they showed twice (main column and rail). The count stays in About this data only.

  // Sent is left out of both lists on purpose: it is a record of what the team asked for, not work
  // waiting on the team, so the page still opens on the first list that needs the team.
  const tabCounts: [ActiveTabType, number][] = [
    ["tab-triage", waitingCount],
    ["tab-inpatients", isDemoMode ? teamConfig.inpatients : lists.currentlyAdmitted.length],
    ["tab-egress", isDemoMode ? teamConfig.egress : lists.expectedBack.length],
    ["tab-caseload", isDemoMode ? teamConfig.caseload : caseloadRows.length],
  ];
  // Phone lists render live rows (or the sample referrals), so the phone opens on one with rows in it.
  const phoneRowCounts: [ActiveTabType, number][] = [
    ["tab-triage", waitingCount],
    ["tab-inpatients", lists.currentlyAdmitted.length],
    ["tab-egress", lists.expectedBack.length],
    ["tab-caseload", caseloadRows.length],
  ];
  const firstListWithSomeone =
    (isPhone ? phoneRowCounts : tabCounts).find(([, count]) => count > 0)?.[0] ?? "tab-caseload";
  // Held from the first render (React's "adjust state while rendering" pattern), so the list never
  // switches under the reader when the last row leaves it.
  if (chosenTab === null) setChosenTab(firstListWithSomeone);
  const activeTab: ActiveTabType = chosenTab ?? firstListWithSomeone;
  const phoneListTab: Record<CommunityPhoneListId, ActiveTabType> = {
    sent: "tab-sent",
    waiting: "tab-triage",
    inBed: "tab-inpatients",
    back: "tab-egress",
    ctos: "tab-caseload",
  };
  const phoneList: CommunityPhoneListId =
    activeTab === "tab-sent"
      ? "sent"
      : activeTab === "tab-inpatients"
        ? "inBed"
        : activeTab === "tab-egress" || activeTab === "tab-expected"
          ? "back"
          : activeTab === "tab-caseload"
            ? "ctos"
            : "waiting";
  const phonePerson = (patientId: string | null | undefined) =>
    patientId ? patients.find((candidate) => candidate.id === patientId) : undefined;
  const phoneName = (patient: Patient | undefined, fallback: string) =>
    patient ? `${patient.familyName}, ${patient.givenName}` : fallback;
  const openDossier = (patientId: string) => {
    setSelectedPatientId(patientId);
    setActiveDrawer("pxDrawer");
  };
  // With no recorded referrals the demonstration lists its sample referrals, so the phone count and
  // rows come from the same source.
  const phoneUsesDemoReferrals = usesDemoReferrals;
  const phoneWaitingValue = waitingCount;
  const phoneUrgent = urgentAnswerCount;
  const phoneCtoRows = caseloadRows.filter((row) => {
    const code = caseloadStatutoryFormCode(row);
    return code === "5A" || code === "5B";
  });
  const phoneCaseloadShown = phoneShowWholeCaseload ? caseloadRows : phoneCtoRows;
  const phoneReferral = waitingReferrals.find((referral) => referral.id === phoneReferralId);
  const phoneReferralPerson = phonePerson(phoneReferral?.patientId);
  const phoneDeparture = lists.dischargedIntoTheArea.find((admission) => admission.id === phoneDepartureId);
  const phoneDeparturePerson = phonePerson(phoneDeparture?.patientId);
  const closePhoneReferral = () => {
    setPhoneReferralId(null);
    setPhoneDeclining(false);
    setDeclineDraft(undefined);
    declineSave.forget();
  };

  return {
    teamId,
    admissions,
    referrals,
    demonstration,
    limitsDisclosureRef,
    liveAdmissions,
    notices,
    units,
    movements,
    patients,
    rejections,
    openDischargeRecord,
    readDischargeRecord,
    dispatch,
    liveReferrals,
    now,
    umrnLookup,
    identityOf,
    demoUmrnOf,
    team,
    referFromTeamHref,
    openNewReferral,
    followUpFilter,
    setFollowUpFilter,
    declineOpenFor,
    setDeclineOpenFor,
    declineDraft,
    setDeclineDraft,
    transportBookFor,
    setTransportBookFor,
    transportDraft,
    setTransportDraft,
    transportCancelFor,
    setTransportCancelFor,
    cancelTransportReason,
    setCancelTransportReason,
    cancelTransportBlocked,
    activeModal,
    setActiveModal,
    toastMessage,
    setToastMessage,
    chosenTab,
    setChosenTab,
    readerPickedTab,
    setActiveTab,
    activeDrawer,
    setActiveDrawer,
    activeModalType,
    setActiveModalType,
    selectedPatientId,
    setSelectedPatientId,
    selectedReferralId,
    setSelectedReferralId,
    pendingAcceptance,
    setPendingAcceptance,
    toast,
    runDecision,
    offerDecision,
    decisionStep,
    declineSave,
    switchOpen,
    setSwitchOpen,
    isPhone,
    phoneReferralId,
    setPhoneReferralId,
    phoneDeclining,
    setPhoneDeclining,
    phoneDepartureId,
    setPhoneDepartureId,
    phoneShowWholeCaseload,
    setPhoneShowWholeCaseload,
    switchQuery,
    setSwitchQuery,
    switchTriggerRef,
    acceptanceError,
    setAcceptanceError,
    showCareEditor,
    setShowCareEditor,
    careAccess,
    setCareAccess,
    triageFilter,
    setTriageFilter,
    // Type bridge (D-91): the page draws no patient search. Until #1123 merges, the real
    // `CommunityScreenView` still names these three fields, so they stay here, empty and unused.
    searchQuery: "",
    setSearchQuery: NO_SEARCH,
    caseloadFilter,
    setCaseloadFilter,
    searchResults: NO_SEARCH_RESULTS,
    selectedPatient,
    contactRecord,
    contactSaveMessage,
    contactSaveDisabled,
    dismissedTaskIds,
    setDismissedTaskIds,
    uiState,
    setUiState,
    inpatientFilter,
    setInpatientFilter,
    egressFilter,
    setEgressFilter,
    hasExplicitProps,
    isDemoMode,
    demoTeamReferrals,
    demoVisibleReferrals,
    demoVisibleInpatients,
    demoVisibleEgress,
    demoVisibleCaseload,
    handleCompleteContact,
    scrollToSection,
    handleActionClick,
    handleToggleDecline,
    handleConfirmDecline,
    handleConfirmAccept,
    handleSaveClinicalContact,
    openTransportBook,
    closeTransportBook,
    openTransportCancel,
    closeTransportCancel,
    drawerPanelRef,
    drawerScrimRef,
    noteModalRef,
    noteModalOverlayRef,
    referralModalRef,
    referralModalBackdropRef,
    transportBookDialogRef,
    transportCancelDialogRef,
    submitBookTransport,
    submitCancelTransport,
    source,
    sourceReferrals,
    danglingReferralIds,
    selectedReferral,
    teamConfig,
    careActor,
    patientAdmissions,
    careRead,
    openPatientCare,
    acceptedAddressing,
    acceptanceRefusal,
    acceptanceMessage,
    lists,
    filteredDepartures,
    unattributable,
    visibleReferralIds,
    resolution,
    cannotResolve,
    nearDuplicates,
    sameService,
    ratifiedBy,
    waitlistedForTeam,
    waitingReferrals,
    urgentWaitingCount,
    waitingCount,
    urgentAnswerCount,
    p1ReferralsCount,
    p2ReferralsCount,
    p3ReferralsCount,
    edReferralsCount,
    visibleWaitingReferrals,
    hasAnyReferralsForTeam,
    caseloadRows,
    form5ACount,
    form5BCount,
    recordedCtoCount,
    visibleCaseload,
    teamNotices,
    unreadTeamNoticeCount,
    markTeamNoticeRead,
    inBedCount,
    bedPulledCount,
    pastPlannedDateCount,
    teamAdmissionCategories,
    admittedWhileAlreadyWithTeam,
    referredDuringThisAdmission,
    bedPulledNotYetArrived,
    shortestAcceptanceToAdmissionGap,
    suburbsNamingTeam,
    tabCounts,
    phoneRowCounts,
    firstListWithSomeone,
    activeTab,
    phoneListTab,
    phoneList,
    sentReferrals,
    phonePerson,
    phoneName,
    openDossier,
    phoneUsesDemoReferrals,
    phoneWaitingValue,
    phoneUrgent,
    phoneCtoRows,
    phoneCaseloadShown,
    phoneReferral,
    phoneReferralPerson,
    phoneDeparture,
    phoneDeparturePerson,
    closePhoneReferral,
  };
}

export function CommunityTeamRedesign(props: CommunityScreenProps) {
  const view = useCommunityScreenView(props);
  if (view === null) {
    return (
      <div className={styles.screen} data-ward-design="third-edition" data-testid="ward-community-screen">
        <main id="main-content" className={styles.main}>
          <WardNotFoundBody
            title="Community team not found"
            testId="ward-community-unresolved"
            list={{ href: "/ward-flow/community", label: "All community teams" }}
          >
            No community team matches this link. It never falls back to a different team.
          </WardNotFoundBody>
        </main>
      </div>
    );
  }
  const { isPhone, toastMessage, activeDrawer, acceptanceMessage, acceptanceError, acceptanceRefusal } = view;

  return (
    <div className={styles.screen} data-ward-design="third-edition" data-testid="ward-community-screen">
      <main id="main-content" className={styles.main}>
        {isPhone ? null : (
          <>
            <CommunityScreenDesktopHero view={view} />

            {communitySinceElement(view)}
          </>
        )}
        {isPhone ? <CommunityScreenPhone view={view} /> : null}

        <CommunityScreenSwitchDrawer view={view} />

        {isPhone ? null : (
          <div className={`${styles.contentWorkspace} ${v6.workspace}`}>
            {/* ── Sent: the referrals this team made, each with its answer (D-77 group A) ── */}
            <CommunityScreenSentTab view={view} />

            {/* ── Tab 1: Priority Referral Triage Queue ── */}
            <CommunityScreenWaitingTab view={view} />

            {/* ── Tab 2: Catchment Acute Inpatients ── */}
            <CommunityTeamInBedTab view={view} />

            {/* ── Tab 3: 7-Day Post-Discharge Follow-Up & Egress ── */}
            <CommunityScreenBackTab view={view} />

            {/* ── Tab 4: Active Caseload & CTO Statutory Register ── */}
            <CommunityScreenCaseloadTab view={view} />

            {/* ── The team itself: how to reach it, and the sample deployment. Shown under every list (v6). ── */}
            <div className={`${styles.tabPanelActive} ${v6.side}`} id="tab-team" data-wf-rail="1201">
              <CommunityWorthAttention items={communityPhoneAttentionItems(view)} />

              {/* ── How to reach this team ── */}
              <CommunityTeamHowToReach view={view} />

              {/* ── Team Deployment, Clinic Rooms and Response Fleet ── */}
              {communityOnDutyPanel(view)}
            </div>

            {/* ── About this data: notices, limits, facts, links and provenance, closed (option A) ── */}
            <CommunityAboutThisData>
              {communityNoticesSection(view)}
              {communityCoveragePanel(view)}
            </CommunityAboutThisData>
          </div>
        )}

        <CommunityScreenTransportBookDialog view={view} />

        <CommunityScreenTransportCancelDialog view={view} />

        <CommunityScreenReferralModal view={view} />

        {/* ── Drawers (mounted only when activeDrawer !== null) ── */}
        <CommunityScreenDrawer view={view} />

        {/* ── Modals (mounted only when activeModalType !== null) ── */}
        <CommunityScreenNoteModal view={view} />

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
          note="Community team directory · Not approved for clinical use"
        />
      </main>
    </div>
  );
}
