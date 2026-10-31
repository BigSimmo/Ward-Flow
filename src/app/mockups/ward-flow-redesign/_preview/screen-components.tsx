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
  import("@/components/ward-management/legal-forms/legal-forms-screen").then((module) => () => (
    <module.LegalFormsScreen />
  )),
);
// The patient record is built into the app (lane L, 31 Oct 2026). Its slug stays as the backdrop the
// Medical clearance pop-up draws over: the real screen, opened on the sample record's coded address
// `/ward-flow/people/196zcp24w5t0` and resolved the same way the route does.
const PatientNowBackdrop = dynamic<MockupPageProps>(() =>
  Promise.all([
    import("@/components/ward-management/patients/patient-now-screen"),
    import("@/components/ward-management/shell/ward-record-address"),
  ]).then(([screen, address]) => () => {
    const id = address.decodeRecordAddress("196zcp24w5t0") ?? "196zcp24w5t0";
    return (
      <screen.PatientNowScreen
        patientId={id.startsWith("PT-") ? id : undefined}
        movementId={id.startsWith("WF-") ? id : undefined}
      />
    );
  }),
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
const AsWardStatisticsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ward-statistics/as-ward-statistics-page").then(
    (module) => module.AsWardStatisticsPage,
  ),
);
const AsWardSettingsPage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ward-settings/as-ward-settings-page").then(
    (module) => module.AsWardSettingsPage,
  ),
);
const AsEdHomePage = dynamic<MockupPageProps>(() =>
  import("@/components/ward-redesign/as-ed-home/as-ed-home-page").then((module) => module.AsEdHomePage),
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
  home: BuiltHome,
  waiting: WaitingPage,
  "new-referral": NewReferralRedesign,
  ward: RealWardScreen,
  "ed-board": EdBoardPage,
  "legal-forms": LegalFormsScreen,
  patient: PatientNowBackdrop,
  "add-patient": AddPatientPage,
  settings: SettingsPage,
  "statistics-compare": StatisticsComparePage,
  "statistics-list": StatisticsListPage,
  "statistics-unit": StatisticsUnitPage,
  "statistics-weekly": StatisticsWeeklyPage,
  "as-ward-statistics": AsWardStatisticsPage,
  "as-ward-settings": AsWardSettingsPage,
  "as-ed-home": AsEdHomePage,
  "as-executive-settings": AsExecutiveSettingsPage,
  "as-admin-home": AsAdminHomePage,
} satisfies Record<BuiltPageSlug, ComponentType<MockupPageProps>>;
