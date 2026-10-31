"use client";

// Each page and popup loads on its own, so a frame compiles and downloads only what it draws.
import dynamic from "next/dynamic";

import type { ComponentType } from "react";

// Capacity is built into the app (lane R, 31 Oct 2026). Its slug stays as the backdrop the Loading
// state pop-up draws over, so it shows the real screen, fed by the preview world.
const CapacityScreen = dynamic<MockupPageProps>(() =>
  import("@/components/ward-management/capacity/capacity-screen").then((module) => module.CapacityScreen),
);
const HomeActivityPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/home-activity/home-activity-page").then((module) => module.HomeActivityPage),
);
const NewReferralRedesign = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/new-referral/new-referral-redesign").then((module) => module.NewReferralRedesign),
);
const ReferralsRedesign = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/referrals/referrals-redesign").then((module) => module.ReferralsRedesign),
);
const MovementsRedesign = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/movements/movements-redesign").then((module) => module.MovementsRedesign),
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
const PatientsRedesign = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/patients/patients-redesign").then((module) => module.PatientsRedesign),
);
const AlertsRedesign = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/alerts/alerts-redesign").then((module) => module.AlertsRedesign),
);
const LegalFormsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/legal-forms/legal-forms-page").then((module) => module.LegalFormsPage),
);
const OnCallRedesign = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/on-call/on-call-redesign").then((module) => module.OnCallRedesign),
);
const CommunityTeamPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/community-team/community-team-page").then((module) => module.CommunityTeamPage),
);
const PatientPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/patient/patient-page").then((module) => module.PatientPage),
);
const AddPatientPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/add-patient/add-patient-page").then((module) => module.AddPatientPage),
);
const SettingsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/settings/settings-page").then((module) => module.SettingsPage),
);
const StatisticsComparePage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/statistics-compare/statistics-compare-page").then(
    (module) => module.StatisticsComparePage,
  ),
);
const StatisticsListPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/statistics-list/statistics-list-page").then((module) => module.StatisticsListPage),
);
const StatisticsUnitPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/statistics-unit/statistics-unit-page").then((module) => module.StatisticsUnitPage),
);
const StatisticsWeeklyPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/statistics-weekly/statistics-weekly-page").then(
    (module) => module.StatisticsWeeklyPage,
  ),
);
const AsWardReferralsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ward-referrals/as-ward-referrals-page").then(
    (module) => module.AsWardReferralsPage,
  ),
);
const AsWardLegalFormsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ward-legal-forms/as-ward-legal-forms-page").then(
    (module) => module.AsWardLegalFormsPage,
  ),
);
const AsWardStatisticsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ward-statistics/as-ward-statistics-page").then(
    (module) => module.AsWardStatisticsPage,
  ),
);
const AsWardAlertsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ward-alerts/as-ward-alerts-page").then((module) => module.AsWardAlertsPage),
);
const AsWardSettingsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ward-settings/as-ward-settings-page").then(
    (module) => module.AsWardSettingsPage,
  ),
);
const AsEdHomePage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ed-home/as-ed-home-page").then((module) => module.AsEdHomePage),
);
const AsEdReferralsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ed-referrals/as-ed-referrals-page").then((module) => module.AsEdReferralsPage),
);
const AsEdLegalFormsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ed-legal-forms/as-ed-legal-forms-page").then(
    (module) => module.AsEdLegalFormsPage,
  ),
);
const AsEdStatisticsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ed-statistics/as-ed-statistics-page").then(
    (module) => module.AsEdStatisticsPage,
  ),
);
const AsCommunityHomePage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-community-home/as-community-home-page").then(
    (module) => module.AsCommunityHomePage,
  ),
);
const AsCommunityReferralsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-community-referrals/as-community-referrals-page").then(
    (module) => module.AsCommunityReferralsPage,
  ),
);
const AsCommunityMovementsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-community-movements/as-community-movements-page").then(
    (module) => module.AsCommunityMovementsPage,
  ),
);
const AsCommunityPatientPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-community-patient/as-community-patient-page").then(
    (module) => module.AsCommunityPatientPage,
  ),
);
const AsCommunityStatisticsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-community-statistics/as-community-statistics-page").then(
    (module) => module.AsCommunityStatisticsPage,
  ),
);
const AsOfficerAlertsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-officer-alerts/as-officer-alerts-page").then(
    (module) => module.AsOfficerAlertsPage,
  ),
);
const AsBedManagerReferralsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-bed-manager-referrals/as-bed-manager-referrals-page").then(
    (module) => module.AsBedManagerReferralsPage,
  ),
);
const AsExecutiveSettingsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-executive-settings/as-executive-settings-page").then(
    (module) => module.AsExecutiveSettingsPage,
  ),
);
const AsAdminHomePage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-admin-home/as-admin-home-page").then((module) => module.AsAdminHomePage),
);

import type { BuiltPageSlug } from "./built-pages";

export type MockupPageProps = { openOnLoad?: string };

/** Preview only: the redesigned page drawn for each mock-up slug. */
export const MOCKUP_PAGES: Readonly<Record<string, ComponentType<MockupPageProps>>> = {
  capacity: CapacityScreen,
  home: HomeActivityPage,
  movements: MovementsRedesign,
  waiting: WaitingPage,
  referrals: ReferralsRedesign,
  "new-referral": NewReferralRedesign,
  ward: RealWardScreen,
  "ed-board": EdBoardPage,
  patients: PatientsRedesign,
  alerts: AlertsRedesign,
  "legal-forms": LegalFormsPage,
  "on-call": OnCallRedesign,
  "community-team": CommunityTeamPage,
  patient: PatientPage,
  "add-patient": AddPatientPage,
  settings: SettingsPage,
  "statistics-compare": StatisticsComparePage,
  "statistics-list": StatisticsListPage,
  "statistics-unit": StatisticsUnitPage,
  "statistics-weekly": StatisticsWeeklyPage,
  "as-ward-referrals": AsWardReferralsPage,
  "as-ward-legal-forms": AsWardLegalFormsPage,
  "as-ward-statistics": AsWardStatisticsPage,
  "as-ward-alerts": AsWardAlertsPage,
  "as-ward-settings": AsWardSettingsPage,
  "as-ed-home": AsEdHomePage,
  "as-ed-referrals": AsEdReferralsPage,
  "as-ed-legal-forms": AsEdLegalFormsPage,
  "as-ed-statistics": AsEdStatisticsPage,
  "as-community-home": AsCommunityHomePage,
  "as-community-referrals": AsCommunityReferralsPage,
  "as-community-movements": AsCommunityMovementsPage,
  "as-community-patient": AsCommunityPatientPage,
  "as-community-statistics": AsCommunityStatisticsPage,
  "as-officer-alerts": AsOfficerAlertsPage,
  "as-bed-manager-referrals": AsBedManagerReferralsPage,
  "as-executive-settings": AsExecutiveSettingsPage,
  "as-admin-home": AsAdminHomePage,
} satisfies Record<BuiltPageSlug, ComponentType<MockupPageProps>>;
