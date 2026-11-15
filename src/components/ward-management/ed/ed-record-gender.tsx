"use client";

import type { Dispatch, SetStateAction } from "react";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import type { Movement, ReferralGender } from "@/components/ward-management/ward-model";
import { GENDER_OPTIONS } from "./ed-screen-model";
import styles from "./ed.module.css";

export type GenderDrafts = Record<string, ReferralGender | "">;

/**
 * Record gender (Opus review round 2, 17 Sep 2026, P2; R-LEGAL-6 and D-234, Josh 14 Nov 2026): the
 * `gender_designation` gate refuses with "Record gender first", so the ED board offers the record
 * where the gender reads "Not yet recorded". A choice plus a separate submit, never dispatched on
 * change, with no answer chosen for the clinician. The same control on the referred list and the
 * row sheet; `testId` keeps each place's ids apart.
 */
export function EdRecordGender({
  movement,
  patientName,
  raise,
  drafts,
  setDrafts,
  testId = "ward-ed-record-gender",
}: {
  movement: Pick<Movement, "id" | "gender">;
  patientName: string;
  raise: WardRaise;
  drafts: GenderDrafts;
  setDrafts: Dispatch<SetStateAction<GenderDrafts>>;
  testId?: string;
}) {
  const draft = drafts[movement.id] ?? "";
  const unchanged = !draft || draft === movement.gender;
  const reasonId = `${testId}-reason-${movement.id}`;
  return (
    <div className={styles.tableActionGroup}>
      <select
        data-testid={`${testId}-${movement.id}`}
        aria-label={`Record gender for ${patientName}`}
        value={draft}
        onChange={({ target: { value } }) =>
          setDrafts((current) => ({ ...current, [movement.id]: value as ReferralGender | "" }))
        }
      >
        <option value="">Choose…</option>
        {GENDER_OPTIONS.map((gender) => (
          <option key={gender} value={gender}>
            {gender}
          </option>
        ))}
      </select>
      <button
        type="button"
        data-testid={`${testId}-submit-${movement.id}`}
        className={styles.acceptButton}
        aria-disabled={unchanged ? "true" : undefined}
        aria-describedby={unchanged ? reasonId : undefined}
        title={unchanged ? "Choose a new gender value to record first." : undefined}
        onClick={(event) => {
          if (unchanged) {
            ignoreUnavailableActivation(event);
            return;
          }
          raise("RECORD_MOVEMENT_GENDER", { movementId: movement.id, gender: draft });
          setDrafts((current) => ({ ...current, [movement.id]: "" }));
        }}
      >
        Record gender
      </button>
      {unchanged ? (
        <span id={reasonId} className="sr-only">
          Choose a new gender value to record first.
        </span>
      ) : null}
    </div>
  );
}
