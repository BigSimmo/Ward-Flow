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
} satisfies Record<BuiltPageSlug, ComponentType<MockupPageProps>>;
