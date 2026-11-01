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
} satisfies Record<BuiltPageSlug, ComponentType<MockupPageProps>>;
