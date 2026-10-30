"use client";

import type { ComponentType } from "react";

import { CapacityRedesign } from "@/components/ward-redesign/capacity/capacity-redesign";
import { EdIndexRedesign } from "@/components/ward-redesign/eds/eds-redesign";
import { HandoverRedesign } from "@/components/ward-redesign/handover/handover-redesign";
import { HomeRedesign } from "@/components/ward-redesign/home/home-redesign";
import { NewReferralRedesign } from "@/components/ward-redesign/new-referral/new-referral-redesign";
import { ReferralsRedesign } from "@/components/ward-redesign/referrals/referrals-redesign";
import { MovementsRedesign } from "@/components/ward-redesign/movements/movements-redesign";
import { WaitingRedesign } from "@/components/ward-redesign/waiting/waiting-redesign";
import { WardRedesign } from "@/components/ward-redesign/ward/ward-redesign";
import { StaysPage } from "@/components/ward-redesign/stays/stays-page";
import { EdBoardPage } from "@/components/ward-redesign/ed-board/ed-board-page";
import { TransportRedesign } from "@/components/ward-redesign/transport/transport-redesign";
import { PatientsRedesign } from "@/components/ward-redesign/patients/patients-redesign";
import { DischargesPage } from "@/components/ward-redesign/discharges/discharges-page";
import { WardsPage } from "@/components/ward-redesign/wards/wards-page";
import { StatisticsPage } from "@/components/ward-redesign/statistics/statistics-page";
import { AlertsRedesign } from "@/components/ward-redesign/alerts/alerts-redesign";
import { LegalFormsPage } from "@/components/ward-redesign/legal-forms/legal-forms-page";
import { OutOfAreaPage } from "@/components/ward-redesign/out-of-area/out-of-area-page";
import { OnCallRedesign } from "@/components/ward-redesign/on-call/on-call-redesign";
import { SeclusionRedesign } from "@/components/ward-redesign/seclusion/seclusion-redesign";
import { GovernancePage } from "@/components/ward-redesign/governance/governance-page";
import { BedMeetingTvPage } from "@/components/ward-redesign/bed-meeting-tv/bed-meeting-tv-page";
import { DowntimePage } from "@/components/ward-redesign/downtime/downtime-page";
import { ChronologyPage } from "@/components/ward-redesign/chronology/chronology-page";
import { PlacesPage } from "@/components/ward-redesign/places/places-page";
import { CommunityPage } from "@/components/ward-redesign/community/community-page";
import { CommunityTeamPage } from "@/components/ward-redesign/community-team/community-team-page";
import { PatientPage } from "@/components/ward-redesign/patient/patient-page";
import { AddPatientPage } from "@/components/ward-redesign/add-patient/add-patient-page";
import { WardAnswerPage } from "@/components/ward-redesign/ward-answer/ward-answer-page";
import { SettingsPage } from "@/components/ward-redesign/settings/settings-page";
import { SignInPage } from "@/components/ward-redesign/sign-in/sign-in-page";
import { StatisticsComparePage } from "@/components/ward-redesign/statistics-compare/statistics-compare-page";
import { StatisticsListPage } from "@/components/ward-redesign/statistics-list/statistics-list-page";
import { StatisticsUnitPage } from "@/components/ward-redesign/statistics-unit/statistics-unit-page";
import { StatisticsWeeklyPage } from "@/components/ward-redesign/statistics-weekly/statistics-weekly-page";
import { AgendaRedesign } from "@/components/ward-redesign/agenda/agenda-redesign";
import { AsWardHomePage } from "@/components/ward-redesign/as-ward-home/as-ward-home-page";
import { AsWardStaysPage } from "@/components/ward-redesign/as-ward-stays/as-ward-stays-page";
import { AsWardDischargesPage } from "@/components/ward-redesign/as-ward-discharges/as-ward-discharges-page";
import { AsWardReferralsPage } from "@/components/ward-redesign/as-ward-referrals/as-ward-referrals-page";
import { AsWardWaitingPage } from "@/components/ward-redesign/as-ward-waiting/as-ward-waiting-page";
import { AsWardLegalFormsPage } from "@/components/ward-redesign/as-ward-legal-forms/as-ward-legal-forms-page";
import { AsWardHandoverPage } from "@/components/ward-redesign/as-ward-handover/as-ward-handover-page";
import { AsWardStatisticsPage } from "@/components/ward-redesign/as-ward-statistics/as-ward-statistics-page";
import { AsWardSeclusionPage } from "@/components/ward-redesign/as-ward-seclusion/as-ward-seclusion-page";
import { AsWardAlertsPage } from "@/components/ward-redesign/as-ward-alerts/as-ward-alerts-page";
import { AsWardSettingsPage } from "@/components/ward-redesign/as-ward-settings/as-ward-settings-page";
import { AsEdHomePage } from "@/components/ward-redesign/as-ed-home/as-ed-home-page";
import { AsEdReferralsPage } from "@/components/ward-redesign/as-ed-referrals/as-ed-referrals-page";
import { AsEdWaitingPage } from "@/components/ward-redesign/as-ed-waiting/as-ed-waiting-page";
import { AsEdLegalFormsPage } from "@/components/ward-redesign/as-ed-legal-forms/as-ed-legal-forms-page";
import { AsEdHandoverPage } from "@/components/ward-redesign/as-ed-handover/as-ed-handover-page";
import { AsEdStatisticsPage } from "@/components/ward-redesign/as-ed-statistics/as-ed-statistics-page";
import { AsCommunityHomePage } from "@/components/ward-redesign/as-community-home/as-community-home-page";
import { AsCommunityReferralsPage } from "@/components/ward-redesign/as-community-referrals/as-community-referrals-page";
import { AsCommunityMovementsPage } from "@/components/ward-redesign/as-community-movements/as-community-movements-page";
import { AsCommunityPatientPage } from "@/components/ward-redesign/as-community-patient/as-community-patient-page";
import { AsCommunityStatisticsPage } from "@/components/ward-redesign/as-community-statistics/as-community-statistics-page";
import { AsOfficerHomePage } from "@/components/ward-redesign/as-officer-home/as-officer-home-page";
import { AsOfficerAlertsPage } from "@/components/ward-redesign/as-officer-alerts/as-officer-alerts-page";
import { AsBedManagerHomePage } from "@/components/ward-redesign/as-bed-manager-home/as-bed-manager-home-page";
import { AsBedManagerWardsPage } from "@/components/ward-redesign/as-bed-manager-wards/as-bed-manager-wards-page";
import { AsBedManagerPlacesPage } from "@/components/ward-redesign/as-bed-manager-places/as-bed-manager-places-page";
import { AsBedManagerWardPage } from "@/components/ward-redesign/as-bed-manager-ward/as-bed-manager-ward-page";
import { AsBedManagerDischargesPage } from "@/components/ward-redesign/as-bed-manager-discharges/as-bed-manager-discharges-page";
import { AsBedManagerReferralsPage } from "@/components/ward-redesign/as-bed-manager-referrals/as-bed-manager-referrals-page";
import { AsBedManagerStatisticsPage } from "@/components/ward-redesign/as-bed-manager-statistics/as-bed-manager-statistics-page";
import { AsBedManagerSeclusionPage } from "@/components/ward-redesign/as-bed-manager-seclusion/as-bed-manager-seclusion-page";
import { AsExecutiveHomePage } from "@/components/ward-redesign/as-executive-home/as-executive-home-page";
import { AsExecutiveCapacityPage } from "@/components/ward-redesign/as-executive-capacity/as-executive-capacity-page";
import { AsAdminHomePage } from "@/components/ward-redesign/as-admin-home/as-admin-home-page";
import { AsAdminGovernancePage } from "@/components/ward-redesign/as-admin-governance/as-admin-governance-page";

import type { BuiltPageSlug } from "./built-pages";

export type MockupPageProps = { openOnLoad?: string };

/** Preview only: the redesigned page drawn for each mock-up slug. */
export const MOCKUP_PAGES: Readonly<Record<string, ComponentType<MockupPageProps>>> = {
  capacity: CapacityRedesign,
  home: HomeRedesign,
  movements: MovementsRedesign,
  waiting: WaitingRedesign,
  eds: EdIndexRedesign,
  referrals: ReferralsRedesign,
  "new-referral": NewReferralRedesign,
  handover: HandoverRedesign,
  ward: WardRedesign,
  stays: StaysPage,
  "ed-board": EdBoardPage,
  transport: TransportRedesign,
  patients: PatientsRedesign,
  discharges: DischargesPage,
  wards: WardsPage,
  statistics: StatisticsPage,
  alerts: AlertsRedesign,
  "legal-forms": LegalFormsPage,
  "out-of-area": OutOfAreaPage,
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
  "as-officer-home": AsOfficerHomePage,
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
  "as-admin-home": AsAdminHomePage,
  "as-admin-governance": AsAdminGovernancePage,
} satisfies Record<BuiltPageSlug, ComponentType<MockupPageProps>>;
