"use client";

// Each page and popup loads on its own, so a frame compiles and downloads only what it draws.
import dynamic from "next/dynamic";

import type { ComponentType } from "react";

const CapacityRedesign = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/capacity/capacity-redesign").then((module) => module.CapacityRedesign),
);
const HandoverRedesign = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/handover/handover-redesign").then((module) => module.HandoverRedesign),
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
const WaitingRedesign = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/waiting/waiting-redesign").then((module) => module.WaitingRedesign),
);
const WardRedesign = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/ward/ward-redesign").then((module) => module.WardRedesign),
);
const StaysPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/stays/stays-page").then((module) => module.StaysPage),
);
const EdBoardPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/ed-board/ed-board-page").then((module) => module.EdBoardPage),
);
const PatientsRedesign = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/patients/patients-redesign").then((module) => module.PatientsRedesign),
);
const DischargesPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/discharges/discharges-page").then((module) => module.DischargesPage),
);
const WardsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/wards/wards-page").then((module) => module.WardsPage),
);
const StatisticsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/statistics/statistics-page").then((module) => module.StatisticsPage),
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
const SeclusionRedesign = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/seclusion/seclusion-redesign").then((module) => module.SeclusionRedesign),
);
const GovernancePage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/governance/governance-page").then((module) => module.GovernancePage),
);
const BedMeetingTvPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/bed-meeting-tv/bed-meeting-tv-page").then((module) => module.BedMeetingTvPage),
);
const DowntimePage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/downtime/downtime-page").then((module) => module.DowntimePage),
);
const ChronologyPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/chronology/chronology-page").then((module) => module.ChronologyPage),
);
const PlacesPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/places/places-page").then((module) => module.PlacesPage),
);
const CommunityPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/community/community-page").then((module) => module.CommunityPage),
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
const WardAnswerPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/ward-answer/ward-answer-page").then((module) => module.WardAnswerPage),
);
const SettingsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/settings/settings-page").then((module) => module.SettingsPage),
);
const SignInPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/sign-in/sign-in-page").then((module) => module.SignInPage),
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
const AgendaRedesign = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/agenda/agenda-redesign").then((module) => module.AgendaRedesign),
);
const AsWardHomePage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ward-home/as-ward-home-page").then((module) => module.AsWardHomePage),
);
const AsWardStaysPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ward-stays/as-ward-stays-page").then((module) => module.AsWardStaysPage),
);
const AsWardDischargesPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ward-discharges/as-ward-discharges-page").then(
    (module) => module.AsWardDischargesPage,
  ),
);
const AsWardReferralsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ward-referrals/as-ward-referrals-page").then(
    (module) => module.AsWardReferralsPage,
  ),
);
const AsWardWaitingPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ward-waiting/as-ward-waiting-page").then((module) => module.AsWardWaitingPage),
);
const AsWardLegalFormsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ward-legal-forms/as-ward-legal-forms-page").then(
    (module) => module.AsWardLegalFormsPage,
  ),
);
const AsWardHandoverPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ward-handover/as-ward-handover-page").then(
    (module) => module.AsWardHandoverPage,
  ),
);
const AsWardStatisticsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ward-statistics/as-ward-statistics-page").then(
    (module) => module.AsWardStatisticsPage,
  ),
);
const AsWardSeclusionPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ward-seclusion/as-ward-seclusion-page").then(
    (module) => module.AsWardSeclusionPage,
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
const AsEdWaitingPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ed-waiting/as-ed-waiting-page").then((module) => module.AsEdWaitingPage),
);
const AsEdLegalFormsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ed-legal-forms/as-ed-legal-forms-page").then(
    (module) => module.AsEdLegalFormsPage,
  ),
);
const AsEdHandoverPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ed-handover/as-ed-handover-page").then((module) => module.AsEdHandoverPage),
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
const AsBedManagerHomePage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-bed-manager-home/as-bed-manager-home-page").then(
    (module) => module.AsBedManagerHomePage,
  ),
);
const AsBedManagerWardsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-bed-manager-wards/as-bed-manager-wards-page").then(
    (module) => module.AsBedManagerWardsPage,
  ),
);
const AsBedManagerPlacesPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-bed-manager-places/as-bed-manager-places-page").then(
    (module) => module.AsBedManagerPlacesPage,
  ),
);
const AsBedManagerWardPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-bed-manager-ward/as-bed-manager-ward-page").then(
    (module) => module.AsBedManagerWardPage,
  ),
);
const AsBedManagerDischargesPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-bed-manager-discharges/as-bed-manager-discharges-page").then(
    (module) => module.AsBedManagerDischargesPage,
  ),
);
const AsBedManagerReferralsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-bed-manager-referrals/as-bed-manager-referrals-page").then(
    (module) => module.AsBedManagerReferralsPage,
  ),
);
const AsBedManagerStatisticsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-bed-manager-statistics/as-bed-manager-statistics-page").then(
    (module) => module.AsBedManagerStatisticsPage,
  ),
);
const AsBedManagerSeclusionPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-bed-manager-seclusion/as-bed-manager-seclusion-page").then(
    (module) => module.AsBedManagerSeclusionPage,
  ),
);
const AsExecutiveHomePage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-executive-home/as-executive-home-page").then(
    (module) => module.AsExecutiveHomePage,
  ),
);
const AsExecutiveCapacityPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-executive-capacity/as-executive-capacity-page").then(
    (module) => module.AsExecutiveCapacityPage,
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
const AsAdminGovernancePage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-admin-governance/as-admin-governance-page").then(
    (module) => module.AsAdminGovernancePage,
  ),
);

import type { BuiltPageSlug } from "./built-pages";

export type MockupPageProps = { openOnLoad?: string };

/** Preview only: the redesigned page drawn for each mock-up slug. */
export const MOCKUP_PAGES: Readonly<Record<string, ComponentType<MockupPageProps>>> = {
  capacity: CapacityRedesign,
  home: HomeActivityPage,
  movements: MovementsRedesign,
  waiting: WaitingRedesign,
  referrals: ReferralsRedesign,
  "new-referral": NewReferralRedesign,
  handover: HandoverRedesign,
  ward: WardRedesign,
  stays: StaysPage,
  "ed-board": EdBoardPage,
  patients: PatientsRedesign,
  discharges: DischargesPage,
  wards: WardsPage,
  statistics: StatisticsPage,
  alerts: AlertsRedesign,
  "legal-forms": LegalFormsPage,
  "on-call": OnCallRedesign,
  seclusion: SeclusionRedesign,
  governance: GovernancePage,
  "bed-meeting-tv": BedMeetingTvPage,
  downtime: DowntimePage,
  chronology: ChronologyPage,
  places: PlacesPage,
  community: CommunityPage,
  "community-team": CommunityTeamPage,
  patient: PatientPage,
  "add-patient": AddPatientPage,
  "ward-answer": WardAnswerPage,
  settings: SettingsPage,
  "sign-in": SignInPage,
  "statistics-compare": StatisticsComparePage,
  "statistics-list": StatisticsListPage,
  "statistics-unit": StatisticsUnitPage,
  "statistics-weekly": StatisticsWeeklyPage,
  agenda: AgendaRedesign,
  "as-ward-home": AsWardHomePage,
  "as-ward-stays": AsWardStaysPage,
  "as-ward-discharges": AsWardDischargesPage,
  "as-ward-referrals": AsWardReferralsPage,
  "as-ward-waiting": AsWardWaitingPage,
  "as-ward-legal-forms": AsWardLegalFormsPage,
  "as-ward-handover": AsWardHandoverPage,
  "as-ward-statistics": AsWardStatisticsPage,
  "as-ward-seclusion": AsWardSeclusionPage,
  "as-ward-alerts": AsWardAlertsPage,
  "as-ward-settings": AsWardSettingsPage,
  "as-ed-home": AsEdHomePage,
  "as-ed-referrals": AsEdReferralsPage,
  "as-ed-waiting": AsEdWaitingPage,
  "as-ed-legal-forms": AsEdLegalFormsPage,
  "as-ed-handover": AsEdHandoverPage,
  "as-ed-statistics": AsEdStatisticsPage,
  "as-community-home": AsCommunityHomePage,
  "as-community-referrals": AsCommunityReferralsPage,
  "as-community-movements": AsCommunityMovementsPage,
  "as-community-patient": AsCommunityPatientPage,
  "as-community-statistics": AsCommunityStatisticsPage,
  "as-officer-alerts": AsOfficerAlertsPage,
  "as-bed-manager-home": AsBedManagerHomePage,
  "as-bed-manager-wards": AsBedManagerWardsPage,
  "as-bed-manager-places": AsBedManagerPlacesPage,
  "as-bed-manager-ward": AsBedManagerWardPage,
  "as-bed-manager-discharges": AsBedManagerDischargesPage,
  "as-bed-manager-referrals": AsBedManagerReferralsPage,
  "as-bed-manager-statistics": AsBedManagerStatisticsPage,
  "as-bed-manager-seclusion": AsBedManagerSeclusionPage,
  "as-executive-home": AsExecutiveHomePage,
  "as-executive-capacity": AsExecutiveCapacityPage,
  "as-executive-settings": AsExecutiveSettingsPage,
  "as-admin-home": AsAdminHomePage,
  "as-admin-governance": AsAdminGovernancePage,
} satisfies Record<BuiltPageSlug, ComponentType<MockupPageProps>>;
