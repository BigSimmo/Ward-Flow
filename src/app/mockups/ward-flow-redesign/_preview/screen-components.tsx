"use client";

// Each page and popup loads on its own, so a frame compiles and downloads only what it draws.
import dynamic from "next/dynamic";

import type { ComponentType } from "react";

// Capacity is built into the app (lane R, 31 Oct 2026). Its slug stays as the backdrop the Loading
// state pop-up draws over, so it shows the real screen, fed by the preview world.
const CapacityScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/capacity/capacity-screen").then((module) => module.CapacityScreen),
);
// Home is built into the app (lane H): the preview draws the real screen (built-home.tsx).
const BuiltHome = dynamic<MockupPageProps>(() => import("./built-home").then((module) => module.BuiltHome));
const NewReferralRedesign = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/new-referral/new-referral-redesign").then((module) => module.NewReferralRedesign),
);
// Built into the app (31 Oct 2026): Waiting draws the real screen, kept here as the backdrop for
// the Loading (Waiting) pop-up.
const WaitingPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/delays/delays-screen").then(
    (module) =>
      function WaitingScreen() {
        return <module.DelaysScreen />;
      },
  ),
);
// My ward is built (31 Oct 2026); its preview draws the real screen, kept as the page the Shift brief
// pop-up opens over.
const RealWardScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/ward/ward-screen").then((module) => {
    const RealWard = () => <module.WardScreen unitId="rph-adult-secure" />;
    return RealWard;
  }),
);
const EdBoardPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/ed-board/ed-board-page").then((module) => module.EdBoardPage),
);
// Legal forms is built into the app (lane L, 31 Oct 2026). Its slug stays as the backdrop the Record
// exam pop-up draws over, so it shows the real screen, fed by the preview world.
const LegalFormsScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/legal-forms/legal-forms-screen").then(
    (module) =>
      function LegalFormsBackdrop() {
        return <module.LegalFormsScreen />;
      },
  ),
);
// The patient record is built into the app (lane L, 31 Oct 2026). Its slug stays as the backdrop the
// Medical clearance pop-up draws over: the real screen, opened on the sample record's coded address
// `/ward-flow/people/196zcp24w5t0` and resolved the same way the route does.
const PatientNowBackdrop = dynamic<MockupPageProps>(() =>
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
);
// Add a patient is built into the app (lane L, 31 Oct 2026). Its slug stays as the backdrop the
// Leave with unsaved changes pop-up draws over, so it shows the real form, fed by the preview world.
const AddPatientForm = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/patients/add-patient").then(
    (module) =>
      function AddPatientBackdrop() {
        return <module.AddPatientForm />;
      },
  ),
);

// Movements mock-up (1 Nov 2026): the real screen with the redesign drawn in place.
const MovementsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/movements/movements-screen").then(
    (module) =>
      function MovementsPreview() {
        return <module.MovementsScreen />;
      },
  ),
);

// Handover mock-up (1 Nov 2026): the real screen with the proposed changes, fed by the preview world.
const HandoverScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/handover/handover-page").then(
    (module) =>
      function HandoverBackdrop() {
        return <module.HandoverPage />;
      },
  ),
);

// Discharges mock-up (1 Nov 2026): the real board with the redesign drawn in place. Its pop-up opens
// a held-up release (Glasswell, Delia) on load, as a click on that row does.
const DischargesScreen = dynamic<MockupPageProps>(() =>
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
);

// Q218 (Josh, 2 Nov 2026): pages with no approved redesign draw main's real screen in the newest shell,
// fed by the preview world, so the master design shows their current content.

const EdsScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/ed/ed-index").then(
    (module) =>
      function EdsScreenPreview() {
        return <module.EdIndex />;
      },
  ),
);

const ReferralsScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/referrals/referral-board").then(
    (module) =>
      function ReferralsScreenPreview() {
        return <module.ReferralBoard defaultSelectFirst />;
      },
  ),
);

const StaysScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/board/ward-board").then(
    (module) =>
      function StaysScreenPreview() {
        return <module.WardBoard unitId="rph-adult-secure" />;
      },
  ),
);

const PatientsScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/search/patient-search").then(
    (module) =>
      function PatientsScreenPreview() {
        return <module.PatientSearchPage />;
      },
  ),
);

const WardsScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/wards/ward-index").then(
    (module) =>
      function WardsScreenPreview() {
        return <module.WardIndex />;
      },
  ),
);

// Its Broadcast pop-up opens from the page's own More menu, as a click does (Q221).
const AlertsScreen = dynamic<MockupPageProps>(() =>
  Promise.all([import("@/components/ward-management/alerts/alerts-screen"), import("./open-on-load")]).then(
    ([module, open]) =>
      function AlertsScreenPreview({ openOnLoad }: MockupPageProps) {
        open.useOpenOnLoad(openOnLoad, ALERTS_POPUPS);
        return <module.AlertsScreen />;
      },
  ),
);
const ALERTS_POPUPS = { broadcast: ["More alert actions", "Broadcast alert"] } as const;

const OutOfAreaScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/out-of-area/out-of-area-board").then(
    (module) =>
      function OutOfAreaScreenPreview() {
        return <module.OutOfAreaBoard />;
      },
  ),
);

const OnCallScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/on-call/on-call-screen").then(
    (module) =>
      function OnCallScreenPreview() {
        return <module.OnCallScreen />;
      },
  ),
);

const SeclusionScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/restrictive-practice/seclusion-screen").then(
    (module) =>
      function SeclusionScreenPreview() {
        return <module.SeclusionScreen />;
      },
  ),
);

const GovernanceScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/ward-management-modes").then(
    (module) =>
      function GovernanceScreenPreview() {
        return <module.WardModeWorkspace mode="governance" />;
      },
  ),
);

const BedMeetingTvScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/bed-meeting/bed-meeting-tv").then(
    (module) =>
      function BedMeetingTvScreenPreview() {
        return <module.BedMeetingTvScreen />;
      },
  ),
);

const AgendaScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/bed-meeting/bed-meeting-agenda-screen").then(
    (module) =>
      function AgendaScreenPreview() {
        return <module.BedMeetingAgendaScreen />;
      },
  ),
);

const DowntimeScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/reports/downtime-pack-screen").then(
    (module) =>
      function DowntimeScreenPreview() {
        return <module.DowntimePackScreen />;
      },
  ),
);

const ChronologyScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/reports/patient-chronology-screen").then(
    (module) =>
      function ChronologyScreenPreview() {
        return <module.PatientChronologyScreen />;
      },
  ),
);

const PlacesScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/hub/hub-screen").then(
    (module) =>
      function PlacesScreenPreview() {
        return <module.HubScreen />;
      },
  ),
);

const CommunityIndexScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/community/community-index").then(
    (module) =>
      function CommunityIndexScreenPreview() {
        return <module.CommunityIndex />;
      },
  ),
);

// Its Record contact pop-up opens from the page's own button, as a click does (Q221).
const CommunityTeamScreen = dynamic<MockupPageProps>(() =>
  Promise.all([import("@/components/ward-management/community/community-screen"), import("./open-on-load")]).then(
    ([module, open]) =>
      function CommunityTeamScreenPreview({ openOnLoad }: MockupPageProps) {
        open.useOpenOnLoad(openOnLoad, COMMUNITY_POPUPS);
        return <module.CommunityScreen teamId="midland" />;
      },
  ),
);
const COMMUNITY_POPUPS = { "community-note": ["Record contact"] } as const;

const WardAnswerScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/ward/ward-screen").then(
    (module) =>
      function WardAnswerScreenPreview() {
        return <module.WardScreen unitId="rph-adult-secure" presentation="answer" />;
      },
  ),
);

const SettingsScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/settings/settings-screen").then(
    (module) =>
      function SettingsScreenPreview() {
        return <module.SettingsScreen />;
      },
  ),
);

const SignInScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-flow-sign-in/ward-flow-sign-in-screen").then(
    (module) =>
      function SignInScreenPreview() {
        return <module.WardFlowSignInScreen />;
      },
  ),
);

const StatisticsListScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/statistics/statistics-wards-index").then(
    (module) =>
      function StatisticsListScreenPreview() {
        return <module.StatisticsWardsIndexScreen />;
      },
  ),
);

const StatisticsUnitScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/statistics/statistics-ward-screen").then(
    (module) =>
      function StatisticsUnitScreenPreview() {
        return <module.StatisticsWardScreen unitId="fsh-adult-secure" />;
      },
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
} satisfies Record<BuiltPageSlug, ComponentType<MockupPageProps>>;
