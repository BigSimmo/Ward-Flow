"use client";

// Each page and popup loads on its own, so a frame compiles and downloads only what it draws.
import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";

import type { ComponentType } from "react";

// Capacity is built into the app (lane R, 31 Oct 2026). Its slug stays as the backdrop the Loading
// state pop-up draws over, so it shows the real screen, fed by the preview world.
const CapacityScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/capacity/capacity-screen").then((module) => module.CapacityScreen),
  ),
);
// Home is built into the app (lane H): the preview draws the real screen (built-home.tsx).
const BuiltHome = dynamic<MockupPageProps>(
  withLoadRetry(() => import("./built-home").then((module) => module.BuiltHome)),
);
const NewReferralRedesign = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-redesign/new-referral/new-referral-redesign").then(
      (module) => module.NewReferralRedesign,
    ),
  ),
);
// Triage and risk is built into the app (7 Nov 2026): the preview draws the real form, for the same
// synthetic person the patient record entry draws, and the real Start a triage step.
const TriageRiskScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    Promise.all([
      import("@/components/ward-management/triage/triage-risk-form"),
      import("@/components/ward-management/shell/ward-record-address"),
    ]).then(
      ([screen, address]) =>
        function TriageRiskPreview() {
          return <screen.TriageScreen patientId={address.decodeRecordAddress("196zcp24w5t0") ?? "196zcp24w5t0"} />;
        },
    ),
  ),
);
const TriageStartScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/triage/triage-risk-form").then(
      (module) =>
        function TriageStartPreview() {
          return <module.TriageStartScreen />;
        },
    ),
  ),
);
// Built into the app (31 Oct 2026): Waiting draws the real screen, kept here as the backdrop for
// the Loading (Waiting) pop-up.
const WaitingPage = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/delays/delays-screen").then(
      (module) =>
        function WaitingScreen() {
          return <module.DelaysScreen />;
        },
    ),
  ),
);
// My ward is built (31 Oct 2026); its preview draws the real screen. Its pop-ups open from the page's
// own controls, as a click does (Josh, 2 Nov 2026).
const RealWardScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    Promise.all([import("@/components/ward-management/ward/ward-screen"), import("./open-on-load")]).then(
      ([module, open]) =>
        function RealWard({ openOnLoad }: MockupPageProps) {
          open.useOpenOnLoad(openOnLoad, WARD_POPUPS);
          return <module.WardScreen unitId="rph-adult-secure" />;
        },
    ),
  ),
);
const WARD_POPUPS = {
  "shift-brief": ["More ward actions", "Shift brief"],
  "ward-notices": ["More ward actions", "Notices"],
  "ward-switcher": ["Switch ward, now"],
  // The bed card, which opens the bed record on every width ("Bed 01" opens the round on a phone).
  "bed-record": ["[data-testid='ward-bed-card-1']"],
  "confirm-beds": ["Confirm numbers"],
} as const;
const EdBoardPage = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    Promise.all([import("@/components/ward-redesign/ed-board/ed-board-page"), import("./open-on-load")]).then(
      ([module, open]) =>
        function EdBoardPreview({ openOnLoad }: MockupPageProps) {
          open.useOpenOnLoad(openOnLoad, ED_BOARD_POPUPS);
          return <module.EdBoardPage />;
        },
    ),
  ),
);
const ED_BOARD_POPUPS = {
  // Phones have no row menu; the patient's sheet holds the same actions.
  "ed-actions": ["[data-testid='ward-ed-unfold-WF-020'], [data-testid='ward-ed-patient-WF-020'] > button"],
  "log-transport": [
    "[data-testid='ward-ed-patient-WF-311'] > button, [data-testid='ward-ed-row-name-WF-311']",
    "Log transport booking",
  ],
} as const;
// Legal forms is built into the app (lane L, 31 Oct 2026). Its slug stays as the backdrop the Record
// exam pop-up draws over, so it shows the real screen, fed by the preview world.
const LegalFormsScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    Promise.all([import("@/components/ward-management/legal-forms/legal-forms-screen"), import("./open-on-load")]).then(
      ([module, open]) =>
        function LegalFormsBackdrop({ openOnLoad }: MockupPageProps) {
          open.useOpenOnLoad(openOnLoad, LEGAL_FORMS_POPUPS);
          return <module.LegalFormsScreen />;
        },
    ),
  ),
);
const LEGAL_FORMS_POPUPS = {
  // On a phone the form's own sheet holds Add the time.
  "add-time": ["[aria-label^='Add the time for'], button[aria-label^='Ridgeholt, Fiora, UM']"],
  "record-form": ["Record a form"],
  "record-exam": ["Record and tell", "Record exam"],
} as const;
// The patient record is built into the app (lane L, 31 Oct 2026). Its slug stays as the backdrop the
// Medical clearance pop-up draws over: the real screen, opened on the sample record's coded address
// `/ward-flow/people/196zcp24w5t0` and resolved the same way the route does.
const PatientNowBackdrop = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    Promise.all([
      import("@/components/ward-management/patients/patient-now-screen"),
      import("@/components/ward-management/shell/ward-record-address"),
    ]).then(
      ([screen, address]) =>
        function PatientNowBackdropScreen() {
          const id = address.decodeRecordAddress("196zcp24w5t0") ?? "196zcp24w5t0";
          return (
            <screen.PatientNowScreen
              patientId={id.startsWith("PT-") ? id : undefined}
              movementId={id.startsWith("WF-") ? id : undefined}
            />
          );
        },
    ),
  ),
);
// Add a patient is built into the app (lane L, 31 Oct 2026). Its slug stays as the backdrop the
// Leave with unsaved changes pop-up draws over, so it shows the real form, fed by the preview world.
const AddPatientForm = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/patients/add-patient").then(
      (module) =>
        function AddPatientBackdrop() {
          return <module.AddPatientForm />;
        },
    ),
  ),
);

// Movements mock-up (1 Nov 2026): the real screen with the redesign drawn in place.
const MovementsPage = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    Promise.all([import("@/components/ward-management/movements/movements-screen"), import("./open-on-load")]).then(
      ([module, open]) =>
        function MovementsPreview({ openOnLoad }: MockupPageProps) {
          open.useOpenOnLoad(openOnLoad, MOVEMENTS_POPUPS);
          return <module.MovementsScreen />;
        },
    ),
  ),
);
const MOVEMENTS_POPUPS = {
  movement: [
    "[data-testid='movements-group-toggle-placement_requested'], [data-ward-primitive='record-id']",
    "What is recorded for",
  ],
} as const;

// Handover mock-up (1 Nov 2026): the real screen with the proposed changes, fed by the preview world.
const HandoverScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/handover/handover-page").then(
      (module) =>
        function HandoverBackdrop() {
          return <module.HandoverPage />;
        },
    ),
  ),
);

// Discharges mock-up (1 Nov 2026): the real board with the redesign drawn in place. Its pop-up opens
// a held-up release (Glasswell, Delia) on load, as a click on that row does.
const DischargesScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    Promise.all([import("@/components/ward-management/discharges/discharge-board"), import("react")]).then(
      ([board, react]) =>
        function DischargesPreview({ openOnLoad }: MockupPageProps) {
          react.useEffect(() => {
            if (openOnLoad !== "discharge-detail") return;
            let tries = 0;
            const timer = window.setInterval(() => {
              const row = document.querySelector<HTMLElement>('tr[data-release-id="derived-expected-AD-SCGA-03"]');
              if (row || tries++ > 40) {
                window.clearInterval(timer);
                row?.click();
              }
            }, 150);
            return () => window.clearInterval(timer);
          }, [openOnLoad]);
          return <board.DischargeBoard />;
        },
    ),
  ),
);

// Q218 (Josh, 2 Nov 2026): pages with no approved redesign draw main's real screen in the newest shell,
// fed by the preview world, so the master design shows their current content.

const EdsScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/ed/ed-index").then(
      (module) =>
        function EdsScreenPreview() {
          return <module.EdIndex />;
        },
    ),
  ),
);

const ReferralsScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/referrals/referral-board").then(
      (module) =>
        function ReferralsScreenPreview() {
          return <module.ReferralBoard defaultSelectFirst />;
        },
    ),
  ),
);

const StaysScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    Promise.all([import("@/components/ward-management/board/ward-board"), import("./open-on-load")]).then(
      ([module, open]) =>
        function StaysScreenPreview({ openOnLoad }: MockupPageProps) {
          open.useOpenOnLoad(openOnLoad, STAYS_POPUPS);
          return <module.WardBoard unitId="rph-adult-secure" />;
        },
    ),
  ),
);
const STAYS_POPUPS = {
  "board-blocker": ["[data-bed-kind='occupied'] button", "Record hold-up"],
} as const;

const PatientsScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/search/patient-search").then(
      (module) =>
        function PatientsScreenPreview() {
          return <module.PatientSearchPage />;
        },
    ),
  ),
);

const WardsScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/wards/ward-index").then(
      (module) =>
        function WardsScreenPreview() {
          return <module.WardIndex />;
        },
    ),
  ),
);

// Its Broadcast pop-up opens from the page's own More menu, as a click does (Q221).
const AlertsScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    Promise.all([import("@/components/ward-management/alerts/alerts-screen"), import("./open-on-load")]).then(
      ([module, open]) =>
        function AlertsScreenPreview({ openOnLoad }: MockupPageProps) {
          open.useOpenOnLoad(openOnLoad, ALERTS_POPUPS);
          return <module.AlertsScreen />;
        },
    ),
  ),
);
// Broadcast alert sits in the page header on a tablet or computer, and in the More menu on a phone.
const ALERTS_POPUPS = { broadcast: ["?More alert actions", "Broadcast alert"] } as const;

const OutOfAreaScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/out-of-area/out-of-area-board").then(
      (module) =>
        function OutOfAreaScreenPreview() {
          return <module.OutOfAreaBoard />;
        },
    ),
  ),
);

const OnCallScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/on-call/on-call-screen").then(
      (module) =>
        function OnCallScreenPreview() {
          return <module.OnCallScreen />;
        },
    ),
  ),
);

const SeclusionScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/restrictive-practice/seclusion-screen").then(
      (module) =>
        function SeclusionScreenPreview() {
          return <module.SeclusionScreen />;
        },
    ),
  ),
);

const GovernanceScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/ward-management-modes").then(
      (module) =>
        function GovernanceScreenPreview() {
          return <module.WardModeWorkspace mode="governance" />;
        },
    ),
  ),
);

const BedMeetingTvScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/bed-meeting/bed-meeting-tv").then(
      (module) =>
        function BedMeetingTvScreenPreview() {
          return <module.BedMeetingTvScreen />;
        },
    ),
  ),
);

const AgendaScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/bed-meeting/bed-meeting-agenda-screen").then(
      (module) =>
        function AgendaScreenPreview() {
          return <module.BedMeetingAgendaScreen />;
        },
    ),
  ),
);

const DowntimeScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/reports/downtime-pack-screen").then(
      (module) =>
        function DowntimeScreenPreview() {
          return <module.DowntimePackScreen />;
        },
    ),
  ),
);

const ChronologyScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/reports/patient-chronology-screen").then(
      (module) =>
        function ChronologyScreenPreview() {
          return <module.PatientChronologyScreen />;
        },
    ),
  ),
);

const PlacesScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/hub/hub-screen").then(
      (module) =>
        function PlacesScreenPreview() {
          return <module.HubScreen />;
        },
    ),
  ),
);

const CommunityIndexScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/community/community-index").then(
      (module) =>
        function CommunityIndexScreenPreview() {
          return <module.CommunityIndex />;
        },
    ),
  ),
);

// Its Record contact pop-up opens from the page's own button, as a click does (Q221).
const CommunityTeamScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    Promise.all([import("@/components/ward-management/community/community-screen"), import("./open-on-load")]).then(
      ([module, open]) =>
        function CommunityTeamScreenPreview({ openOnLoad }: MockupPageProps) {
          open.useOpenOnLoad(openOnLoad, COMMUNITY_POPUPS);
          return <module.CommunityScreen teamId="midland" />;
        },
    ),
  ),
);
const COMMUNITY_POPUPS = { "community-note": ["Record contact"] } as const;

// Its Accept in principle pop-up opens over the first ward a request waits on (ward-answer-preview.tsx).
const WardAnswerScreen = dynamic<MockupPageProps>(
  withLoadRetry(() => import("./ward-answer-preview").then((module) => module.WardAnswerPreview)),
);

// The transport officer's phone page, drawn as the page the Officer job panel opens over.
const TransportScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    Promise.all([import("@/components/ward-management/officer/officer-screen"), import("./open-on-load")]).then(
      ([module, open]) =>
        function TransportScreenPreview({ openOnLoad }: MockupPageProps) {
          open.useOpenOnLoad(openOnLoad, TRANSPORT_POPUPS);
          return <module.OfficerScreen />;
        },
    ),
  ),
);
const TRANSPORT_POPUPS = { "officer-job": ["[data-testid^='ward-officer-select-']"] } as const;

const SettingsScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/settings/settings-screen").then(
      (module) =>
        function SettingsScreenPreview() {
          return <module.SettingsScreen />;
        },
    ),
  ),
);

// Drawn without the live sign-in hook, so a preview tab that is already signed in is not sent on to
// the app (as the hook does on the real page). With no account form this is the page's own default.
const SignInScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/front-door/front-door").then(
      (module) =>
        function SignInScreenPreview() {
          return (
            <module.FrontDoor form={undefined} demoUrl={module.publicDemoUrl()} accountLabel="Username" demoFirst />
          );
        },
    ),
  ),
);

const StatisticsListScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/statistics/statistics-wards-index").then(
      (module) =>
        function StatisticsListScreenPreview() {
          return <module.StatisticsWardsIndexScreen />;
        },
    ),
  ),
);

const StatisticsUnitScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/statistics/statistics-ward-screen").then(
      (module) =>
        function StatisticsUnitScreenPreview() {
          return <module.StatisticsWardScreen unitId="fsh-adult-secure" />;
        },
    ),
  ),
);

// 3 Nov 2026: the Network statistics page and one ED's page, so their polish shows in the viewer.
const StatisticsNetworkScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/statistics/statistics-screen").then(
      (module) =>
        function StatisticsNetworkScreenPreview() {
          return <module.StatisticsScreen />;
        },
    ),
  ),
);

const EdDepartmentScreen = dynamic<MockupPageProps>(
  withLoadRetry(() =>
    import("@/components/ward-management/ed/ed-screen").then(
      (module) =>
        function EdDepartmentScreenPreview() {
          return <module.EdScreen edId="fsh-ed" />;
        },
    ),
  ),
);

import type { BuiltPageSlug } from "./built-pages";

export type MockupPageProps = { openOnLoad?: string };

/** Preview only: the redesigned page drawn for each mock-up slug. */
export const MOCKUP_PAGES: Readonly<Record<string, ComponentType<MockupPageProps>>> = {
  capacity: CapacityScreen,
  home: BuiltHome,
  waiting: WaitingPage,
  "new-referral": NewReferralRedesign,
  ward: RealWardScreen,
  "ed-board": EdBoardPage,
  "legal-forms": LegalFormsScreen,
  patient: PatientNowBackdrop,
  "add-patient": AddPatientForm,
  movements: MovementsPage,
  handover: HandoverScreen,
  discharges: DischargesScreen,
  eds: EdsScreen,
  referrals: ReferralsScreen,
  stays: StaysScreen,
  patients: PatientsScreen,
  wards: WardsScreen,
  alerts: AlertsScreen,
  "out-of-area": OutOfAreaScreen,
  "on-call": OnCallScreen,
  seclusion: SeclusionScreen,
  governance: GovernanceScreen,
  "bed-meeting-tv": BedMeetingTvScreen,
  agenda: AgendaScreen,
  downtime: DowntimeScreen,
  chronology: ChronologyScreen,
  places: PlacesScreen,
  community: CommunityIndexScreen,
  "community-team": CommunityTeamScreen,
  "ward-answer": WardAnswerScreen,
  settings: SettingsScreen,
  "sign-in": SignInScreen,
  "statistics-list": StatisticsListScreen,
  "statistics-unit": StatisticsUnitScreen,
  "statistics-network": StatisticsNetworkScreen,
  "ed-department": EdDepartmentScreen,
  transport: TransportScreen,
  "triage-risk": TriageRiskScreen,
  "triage-start": TriageStartScreen,
} satisfies Record<BuiltPageSlug, ComponentType<MockupPageProps>>;
