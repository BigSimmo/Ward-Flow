/*
 * The community team screen's phone tree (under 48rem): the band hero, the four person lists and
 * the two bottom sheets.
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026) as a pure refactor:
 * the markup, text, class names and behaviour are unchanged. Comments moved with the code, so
 * "this file" or "this screen" in them still means the community team screen as a whole.
 */

import { ReferralIntakeSummary } from "../referrals/referral-intake-summary";
import { currentCareContact } from "../ward-care-journey";
import { CommunityFollowUp } from "./community-follow-up";
import { FileText, Phone, Users } from "lucide-react";
import { Badge, Button, PhoneSheet, Radio, SrOnly } from "@/components/wf";
import { referralWaitLine } from "@/components/ward-management/referrals/referral-wait";
import { daysInBed } from "@/components/ward-management/ward-admissions";
import { daysBetween } from "@/components/ward-management/ward-clock";
import { transportEtaRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { communityDeclineBlockedReason } from "@/components/ward-management/community/community-blocked-reasons";
import { UMRN_NOT_RECORDED } from "@/components/ward-management/ward-patient-resolver";
import { COMMUNITY_DECLINE_REASONS } from "@/components/ward-management/ward-model";
import { COMMUNITY_DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import phoneCss from "./community-team-phone.module.css";
import { CommunityPhoneFacts, CommunityTeamPhone, type CommunityPhoneList } from "./community-team-phone";
import {
  unitName,
  bedStateLabel,
  expectedBackLabel,
  departureLabel,
  referralOriginLabel,
  caseloadStatutoryFormCode,
  caseloadRecordedExpiryLabel,
  elapsedSinceOrUnderADay,
} from "./community-screen-helpers";
import {
  communityPhoneAttentionItems,
  communitySearchRenderer,
  communityNoticesSection,
  communitySinceElement,
  communityHowToReachPanel,
  communityOnDutyPanel,
  communityCoveragePanel,
} from "./community-screen-panels";
import type { CommunityScreenView } from "./community-screen";
import { SentReferralJourneyChanges } from "../movements/sent-referral-journey-changes";
import {
  sentAgo,
  sentAnswer,
  sentAskedFor,
  sentPlaceLine,
  sentToLine,
  unattributedSentLine,
} from "./community-sent-referrals";

/*
 * PHONE (v10 all-pages mockup, "Community team", Phone, 11 Oct 2026). Its own tree under 48rem,
 * built from the same data and handlers as the desktop page: the band hero with three figures,
 * Switch team and Refer from team; Since you looked as one row; tool chips (How to reach, On duty
 * and Coverage open sheets holding the desktop side panels); Worth attention; then Waiting, In
 * bed, Back and CTOs as person rows. Every coordinator action on desktop stays reachable here.
 */

/** The phone tree, rendered only under 48rem. Built from the same view as desktop. */
export function CommunityScreenPhone({ view }: { view: CommunityScreenView }) {
  const {
    teamId,
    units,
    movements,
    now,
    team,
    openNewReferral,
    followUpFilter,
    setFollowUpFilter,
    declineDraft,
    setDeclineDraft,
    setActiveTab,
    setActiveDrawer,
    setActiveModalType,
    setPendingAcceptance,
    setSwitchOpen,
    isPhone,
    setPhoneReferralId,
    phoneDeclining,
    setPhoneDeclining,
    setPhoneDepartureId,
    phoneShowWholeCaseload,
    setPhoneShowWholeCaseload,
    switchTriggerRef,
    acceptanceError,
    setAcceptanceError,
    isDemoMode,
    demoTeamReferrals,
    scrollToSection,
    handleActionClick,
    handleConfirmDecline,
    handleConfirmAccept,
    declineSave,
    openTransportBook,
    openTransportCancel,
    teamConfig,
    acceptanceRefusal,
    acceptanceMessage,
    lists,
    filteredDepartures,
    cannotResolve,
    waitingReferrals,
    caseloadRows,
    pastPlannedDateCount,
    admittedWhileAlreadyWithTeam,
    suburbsNamingTeam,
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
  } = view;
  const sinceElement = communitySinceElement(view);
  const noticesSection = communityNoticesSection(view);
  const howToReachPanel = communityHowToReachPanel(view);
  const onDutyPanel = communityOnDutyPanel(view);
  const coveragePanel = communityCoveragePanel(view);
  const renderSearch = communitySearchRenderer(view);
  const phoneAttentionItems = communityPhoneAttentionItems(view);

  // Built only on a phone, so desktop does no phone work.
  // Built only on a phone, so desktop does no phone work.
  const phoneLists: CommunityPhoneList[] = isPhone
    ? [
        {
          // D-77 group A: the referrals this team sent, first among the team's lists, as mocked.
          id: "sent",
          label: "Sent",
          groups: [
            {
              id: "sent",
              rows: sentReferrals.sent.map((referral) => {
                const person = phonePerson(referral.patientId);
                const patientId = referral.patientId;
                return {
                  id: referral.id,
                  testId: `ward-community-phone-sent-${referral.id}`,
                  name: phoneName(person, "No person on file"),
                  meta: `${sentAskedFor(referral)} · ${sentToLine(referral, units)}`,
                  time: `Sent ${sentAgo(referral.raisedAt, now)}`,
                  note: [
                    sentAnswer(referral, units).text,
                    ...referral.addressings.map((addressing) => sentPlaceLine(addressing, units)),
                  ].join(" "),
                  onSelect: patientId !== undefined ? () => openDossier(patientId) : undefined,
                  // D-80: the team changes its own journey's urgency or legal status.
                  controls: (
                    <SentReferralJourneyChanges referral={referral} patientWho={phoneName(person, "this person")} />
                  ),
                };
              }),
              empty: `No referral on record names ${team.name} as the team that sent it.`,
              after:
                sentReferrals.unattributed > 0 ? (
                  <p className={phoneCss.quiet}>{unattributedSentLine(sentReferrals.unattributed)}</p>
                ) : undefined,
            },
          ],
        },
        {
          id: "waiting",
          label: "Waiting",
          groups: [
            {
              id: "waiting",
              rows: phoneUsesDemoReferrals
                ? demoTeamReferrals.map((referral) => {
                    const person = phonePerson(referral.patientId);
                    return {
                      id: referral.id,
                      testId: `ward-community-phone-waiting-${referral.id}`,
                      name: phoneName(person, referral.patientDetails),
                      meta: `${person?.umrn ?? "No UMRN"} · From ${referral.origin}`,
                      value: referral.waitLabel,
                      time: `Tier ${referral.urgency}`,
                      actNow: referral.urgency === 1,
                      onSelect: () => openDossier(referral.patientId),
                    };
                  })
                : waitingReferrals.map((referral) => {
                    const person = phonePerson(referral.patientId);
                    return {
                      id: referral.id,
                      testId: `ward-community-phone-waiting-${referral.id}`,
                      name: phoneName(person, "No person on file"),
                      meta: `${person?.umrn ?? "No UMRN"} · From ${referralOriginLabel(referral)}`,
                      value: referralWaitLine(referral, now),
                      time: `Tier ${referral.urgency}`,
                      actNow: referral.urgency === 1,
                      onSelect: () => {
                        setPhoneDeclining(false);
                        setDeclineDraft(undefined);
                        setPendingAcceptance(null);
                        setAcceptanceError(null);
                        setPhoneReferralId(referral.id);
                      },
                    };
                  }),
              empty: "No referral naming this team is waiting for an answer.",
              after: (
                <p className={phoneCss.quiet}>
                  Community-team roles can accept or decline referrals addressed to their own team, for follow-up only.
                </p>
              ),
            },
          ],
        },
        {
          id: "inBed",
          label: "In bed",
          groups: [
            {
              id: "in-bed",
              rows: lists.currentlyAdmitted.map((admission) => {
                const movement =
                  admission.state === "pulled" && admission.movementId !== null
                    ? movements.find((candidate) => candidate.id === admission.movementId)
                    : undefined;
                const transport = movement?.transport;
                const ownBooking =
                  transport !== undefined &&
                  transport.bookedBy?.role === "community" &&
                  transport.bookedBy.placeId === teamId &&
                  transport.collectedAt === undefined;
                const canBook =
                  admission.state === "pulled" &&
                  admission.movementId !== null &&
                  movement !== undefined &&
                  transport === undefined;
                const person = phonePerson(admission.patientId);
                const stayDays = daysInBed(admission, now);
                const patientId = admission.patientId;
                // A2-16 (audit round 2): the phone folds "accepted before the bed" into this row
                // rather than listing the same people again in a second group.
                const acceptedBefore = admittedWhileAlreadyWithTeam.find(
                  (category) => category.admission.id === admission.id,
                );
                const acceptedNote =
                  acceptedBefore === undefined
                    ? undefined
                    : `With the team ${elapsedSinceOrUnderADay(
                        daysBetween(acceptedBefore.acceptedAt, acceptedBefore.arrivedAt),
                      )} before the bed`;
                return {
                  id: admission.id,
                  testId: `ward-community-phone-in-bed-${admission.id}`,
                  name: phoneName(person, "No person on file"),
                  // F-16 (phone review, Oct 2026): legal status is its own chip, amber when it is not
                  // recorded, so it never reads as part of the grey place line.
                  meta: (
                    <span className={phoneCss.legalMeta}>
                      <span>{unitName(admission.unitId, units)}</span>
                      {person?.legalStatus ? (
                        <Badge size="sm" className={phoneCss.legalChip}>
                          <SrOnly>Legal status: </SrOnly>
                          {person.legalStatus}
                        </Badge>
                      ) : (
                        <Badge size="sm" tone="warning" className={phoneCss.legalChip}>
                          Legal status not recorded
                        </Badge>
                      )}
                    </span>
                  ),
                  value: stayDays === null ? "Not arrived" : `${stayDays}d`,
                  time: bedStateLabel(admission),
                  onSelect: patientId !== null ? () => openDossier(patientId) : undefined,
                  action: canBook
                    ? { label: "Log transport", onAction: () => openTransportBook(admission.movementId!) }
                    : ownBooking
                      ? { label: "Cancel booking", onAction: () => openTransportCancel(admission.movementId!) }
                      : undefined,
                  note:
                    transport === undefined
                      ? acceptedNote
                      : `${ownBooking ? "This team booked transport" : "Transport already booked"}${
                          transport.estimatedAt !== undefined
                            ? ` · ${transportEtaRemainingLabel(transport.estimatedAt, now)}`
                            : ""
                        }${acceptedNote === undefined ? "" : ` · ${acceptedNote}`}`,
                };
              }),
              empty: cannotResolve
                ? `A bed carries no link back to the referral that named this team, so this list cannot be built for ${team.name}.`
                : "Nobody referred to this team is currently in a bed.",
            },
          ],
        },
        {
          id: "back",
          label: "Back",
          groups: [
            {
              id: "expected",
              title: "Expected back",
              count: lists.expectedBack.length,
              rows: lists.expectedBack.map((admission) => {
                const person = phonePerson(admission.patientId);
                const patientId = admission.patientId;
                return {
                  id: admission.id,
                  name: phoneName(person, "No person on file"),
                  meta: `${person?.umrn ?? "No UMRN"} · ${unitName(admission.unitId, units)}`,
                  note: expectedBackLabel(admission, now),
                  onSelect: patientId !== null ? () => openDossier(patientId) : undefined,
                };
              }),
              empty: "Nobody in a bed has a discharge date the ward has written down.",
              after: <p className={phoneCss.quiet}>Ward-reported plan; elapsed time only. No target is applied.</p>,
            },
            {
              id: "discharged",
              title: "Discharged into the catchment",
              count: lists.dischargedIntoTheArea.length,
              before: (
                <label className={phoneCss.filter}>
                  Community follow-up filter
                  <select value={followUpFilter} onChange={(e) => setFollowUpFilter(e.target.value)}>
                    <option value="all">All community departures</option>
                    <option value="missing_arrangement">Missing arrangements</option>
                    <option value="missing_contact">No completed contact recorded</option>
                  </select>
                </label>
              ),
              rows: filteredDepartures.map((admission) => {
                const person = phonePerson(admission.patientId);
                return {
                  id: admission.id,
                  testId: `ward-community-phone-discharged-${admission.id}`,
                  name: phoneName(person, "No person on file"),
                  meta: `Follow-up ${admission.followUp?.state?.replaceAll("_", " ") ?? "not recorded"} · ${unitName(admission.unitId, units)}`,
                  note: departureLabel(admission, now),
                  onSelect: () => setPhoneDepartureId(admission.id),
                };
              }),
              empty:
                lists.dischargedIntoTheArea.length > 0
                  ? "No community departures match this follow-up filter."
                  : "No admission referred to this team is recorded as discharged to the community.",
            },
          ],
        },
        {
          id: "ctos",
          label: "Caseload",
          groups: [
            {
              id: "ctos",
              // The toggle below narrows the list to CTOs, so the term is spelt out here (F-16).
              before: <p className={phoneCss.quiet}>CTOs are community treatment orders.</p>,
              rows: phoneCaseloadShown.map((row) => {
                const person = phonePerson(row.patientId);
                const formCode = caseloadStatutoryFormCode(row);
                const patientId = row.patientId;
                return {
                  id: row.key,
                  testId: `ward-community-phone-cto-${row.referralId}`,
                  name: phoneName(person, "No person on file"),
                  meta: `${formCode ? `Form ${formCode}` : "No form recorded"} · ${row.umrn ?? UMRN_NOT_RECORDED}`,
                  time: caseloadRecordedExpiryLabel(row, now),
                  onSelect: patientId !== undefined ? () => openDossier(patientId) : undefined,
                };
              }),
              empty: phoneShowWholeCaseload
                ? "No accepted follow-up or matched admission is on this team's caseload yet."
                : "No recorded Form 5A or 5B on this team's caseload.",
              after: (
                <>
                  {phoneShowWholeCaseload || caseloadRows.length === phoneCtoRows.length ? null : (
                    <p className={phoneCss.quiet}>
                      {caseloadRows.length - phoneCtoRows.length} more on the caseload are not listed here.
                    </p>
                  )}
                  {caseloadRows.length === phoneCtoRows.length ? null : (
                    <Button
                      variant="ghost"
                      onClick={() => setPhoneShowWholeCaseload((all) => !all)}
                      aria-pressed={phoneShowWholeCaseload}
                    >
                      {phoneShowWholeCaseload ? "Show community treatment orders only" : "Show the whole caseload"}
                    </Button>
                  )}
                </>
              ),
            },
          ],
        },
      ]
    : [];
  const phoneSheets = isPhone ? (
    <>
      <PhoneSheet
        open={phoneReferral !== undefined}
        onClose={closePhoneReferral}
        title={phoneName(phoneReferralPerson, "Referral").split(", ").reverse().join(" ")}
        description={`${phoneReferralPerson?.umrn ?? "No UMRN"} · Waiting answer`}
        height="tall"
        data-testid="ward-community-phone-referral"
        primary={
          phoneReferral === undefined
            ? undefined
            : phoneDeclining
              ? {
                  label: "Decline referral",
                  disabledReason: communityDeclineBlockedReason(declineDraft),
                  onAction: () => handleConfirmDecline(phoneReferral.id, closePhoneReferral),
                }
              : { label: "Accept referral", onAction: () => handleConfirmAccept(phoneReferral.id) }
        }
        secondary={
          phoneDeclining
            ? {
                label: "Back",
                onAction: () => {
                  setPhoneDeclining(false);
                  setDeclineDraft(undefined);
                  declineSave.forget();
                },
              }
            : { label: "Decline", onAction: () => setPhoneDeclining(true) }
        }
      >
        {phoneReferral ? (
          <div className={phoneCss.sheetBody}>
            {acceptanceMessage ? (
              <p className={phoneCss.sheetNote} role={acceptanceError || acceptanceRefusal ? "alert" : "status"}>
                {acceptanceMessage}
              </p>
            ) : null}
            <CommunityPhoneFacts
              facts={[
                {
                  label: "Waiting",
                  value: referralWaitLine(phoneReferral, now),
                  tone: phoneReferral.urgency === 1 ? "danger" : undefined,
                },
                { label: "From", value: referralOriginLabel(phoneReferral) },
                { label: "Home", value: phoneReferral.homeRegion },
                { label: "Priority", value: urgencyTierLabel(phoneReferral.urgency) },
              ]}
            />
            {phoneDeclining ? (
              <>
                <fieldset className={phoneCss.reasons}>
                  <legend>Why decline?</legend>
                  {COMMUNITY_DECLINE_REASONS.map((reason) => (
                    <Radio
                      key={reason}
                      name={`ward-community-phone-decline-${phoneReferral.id}`}
                      className={phoneCss.reason}
                      label={COMMUNITY_DECLINE_REASON_LABELS[reason]}
                      checked={declineDraft === reason}
                      onChange={() => setDeclineDraft(reason)}
                    />
                  ))}
                </fieldset>
                <p className={phoneCss.sheetNote}>The referrer sees the reason.</p>
                {declineSave.error ? (
                  <p className={phoneCss.sheetNote} role="alert" data-testid="ward-community-phone-decline-failure">
                    {declineSave.error}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className={phoneCss.sheetNote}>
                  {phoneReferral.history ||
                    `${phoneReferral.ageBand} · ${phoneReferral.homeRegion}. ${phoneReferral.transportNeeded ? "Transport needed." : "No transport recorded."}`}
                </p>
                <ReferralIntakeSummary intake={phoneReferral.intake} />
                <div className={phoneCss.sheetActions}>
                  <Button size="sm" onClick={() => handleActionClick("Contacted", phoneReferral)}>
                    Log team contact
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      // The assign dialog draws under this sheet, so close the sheet first, as Full referral does.
                      closePhoneReferral();
                      handleActionClick("Assign", phoneReferral);
                    }}
                  >
                    Assign
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      closePhoneReferral();
                      handleActionClick("Review", phoneReferral);
                    }}
                  >
                    Full referral
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </PhoneSheet>

      <PhoneSheet
        open={phoneDeparture !== undefined}
        onClose={() => setPhoneDepartureId(null)}
        title={phoneName(phoneDeparturePerson, "Departure").split(", ").reverse().join(" ")}
        description={`${phoneDeparturePerson?.umrn ?? "No UMRN"} · Discharged into the catchment`}
        height="tall"
        data-testid="ward-community-phone-departure"
        primary={
          phoneDeparture?.patientId
            ? {
                label: "Open patient",
                onAction: () => {
                  const patientId = phoneDeparture.patientId!;
                  setPhoneDepartureId(null);
                  openDossier(patientId);
                },
              }
            : undefined
        }
      >
        {phoneDeparture ? (
          <div className={phoneCss.sheetBody}>
            <CommunityPhoneFacts
              facts={[
                { label: "Left", value: departureLabel(phoneDeparture, now) },
                { label: "From", value: unitName(phoneDeparture.unitId, units) },
                {
                  label: "Follow-up",
                  value: phoneDeparture.followUp?.state?.replaceAll("_", " ") ?? "Not recorded",
                },
                {
                  label: "Contact",
                  value:
                    currentCareContact(phoneDeparture.careJourney)?.outcome?.replaceAll("_", " ") ?? "Not recorded",
                },
              ]}
            />
            <CommunityFollowUp admissionId={phoneDeparture.id} teamId={team.id} />
          </div>
        ) : null}
      </PhoneSheet>
    </>
  ) : null;

  const communityPhoneTree = isPhone ? (
    <>
      <CommunityTeamPhone
        teamName={team.name}
        caseload={isDemoMode ? teamConfig.caseload : caseloadRows.length}
        sub={
          <>
            {suburbsNamingTeam
              ? `${suburbsNamingTeam} ${suburbsNamingTeam === 1 ? "suburb" : "suburbs"}`
              : "Suburbs not recorded"}
            {isDemoMode ? "" : " · crisis open not recorded"}
          </>
        }
        figures={[
          { id: "sent", value: sentReferrals.sent.length, label: "Sent" },
          {
            id: "waiting",
            value: phoneWaitingValue,
            label: "Waiting",
            tone: phoneUrgent > 0 ? "danger" : undefined,
          },
          {
            id: "inBed",
            value: isDemoMode ? teamConfig.inpatients : lists.currentlyAdmitted.length,
            label: "In a bed",
          },
          {
            id: "back",
            value: isDemoMode ? teamConfig.egress : lists.expectedBack.length,
            label: "Back",
            tone: pastPlannedDateCount > 0 ? "warning" : undefined,
          },
          // Josh, 30 Oct 2026: one caseload figure on phone and desktop (desktop's "Caseload and CTOs").
          { id: "ctos", value: isDemoMode ? teamConfig.caseload : caseloadRows.length, label: "Caseload" },
        ]}
        list={phoneList}
        onList={(id) => setActiveTab(phoneListTab[id])}
        onIntake={openNewReferral}
        onSwitchTeam={() => setSwitchOpen(true)}
        ownTeamOnly={view.ownTeamOnly}
        switchTriggerRef={switchTriggerRef}
        since={sinceElement}
        notices={noticesSection}
        howToReach={howToReachPanel}
        onDuty={onDutyPanel}
        coverage={coveragePanel}
        search={renderSearch}
        samples={[
          { id: "activity", label: "Activity sample", onPress: () => setActiveDrawer("activityDrawer") },
          { id: "tasks", label: "Tasks sample", onPress: () => setActiveDrawer("tasksDrawer") },
          { id: "tools", label: "Tools sample", onPress: () => setActiveDrawer("toolsDrawer") },
        ]}
        actions={[
          { id: "contact", label: "Record contact", icon: Phone, onPress: () => setActiveModalType("contact") },
          {
            id: "cto",
            label: "CTO register",
            icon: FileText,
            onPress: () => {
              setActiveTab("tab-caseload");
              scrollToSection("ward-community-phone-lists");
            },
          },
          { id: "mdt", label: "Catchment counts", icon: Users, onPress: () => setActiveModalType("handover") },
        ]}
        attention={phoneAttentionItems}
        lists={phoneLists}
      />
      {phoneSheets}
    </>
  ) : null;

  return communityPhoneTree;
}
