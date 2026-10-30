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
} satisfies Record<BuiltPageSlug, ComponentType<MockupPageProps>>;
