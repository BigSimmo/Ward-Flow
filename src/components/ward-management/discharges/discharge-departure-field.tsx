"use client";

// The discharge sheet's "Going to" choice for a confirmed release (A4-21), moved out of
// discharge-board.tsx, and item 18's transport question beside it. While the release still has
// transport outstanding the sheet asks, as the ward board does, whether the person is still
// waiting for it, so someone leaving the ward to wait on site lands on the ward's Waiting for
// transport list. Nothing is chosen until the person answers; someone who did not return is not
// on site, so it is never asked for them.
import { useState } from "react";
import { Field, Segmented, Select } from "@/components/wf";
import { LEAVING_DESTINATIONS, type LeavingDestination } from "@/components/ward-management/ward-admissions";
import type { BedRelease } from "@/components/ward-management/ward-model-bed-release";
import {
  leftWardAllowedFor,
  releaseTransportPending,
  transportPendingFor,
} from "@/components/ward-management/ward-left-ward";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import pageStyles from "./discharges-third-edition.module.css";

const TRANSPORT_ITEMS: { id: "" | "waiting" | "collected"; label: string }[] = [
  { id: "waiting", label: "Still waiting" },
  { id: "collected", label: "Gone with transport" },
];

/**
 * The fields, and the answer to pass to `recordWardDeparture`. `release` is the confirmed release
 * the sheet can record a departure for, or undefined when it cannot.
 */
export function useDischargeDepartureField(
  release: BedRelease | undefined,
  destination: LeavingDestination,
  setDeparture: (choice: { releaseId: string; destination: LeavingDestination }) => void,
) {
  const [answer, setAnswer] = useState<{ releaseId: string; waiting: boolean } | null>(null);
  const { admissions } = useWardFlowSelect("admissions");
  if (!release) return { field: null, unanswered: false, awaitingTransport: false };
  // The same reading as the ward board and the reducer: the stay's own hold-up counts too.
  const stay = admissions.find((admission) => admission.id === release.admissionId);
  const pending = stay ? transportPendingFor(stay, [release]) : releaseTransportPending(release);
  const asks = pending && leftWardAllowedFor(destination);
  const waiting = asks && answer?.releaseId === release.id ? answer.waiting : undefined;
  const field = (
    <>
      <Field label="Going to" className={pageStyles.departDest}>
        <Select
          aria-label="Where are they going?"
          data-testid="ward-discharge-departure-destination"
          value={destination}
          onChange={(event) =>
            setDeparture({ releaseId: release.id, destination: event.target.value as LeavingDestination })
          }
        >
          {LEAVING_DESTINATIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      {asks ? (
        <div className={pageStyles.departDest} data-testid="ward-discharge-departure-transport">
          {/* Kit radio choices, named by the group's own label; the line above is what is read. */}
          <p aria-hidden="true">Has their transport come?</p>
          <Segmented
            label="Has their transport come?"
            items={TRANSPORT_ITEMS}
            value={waiting === undefined ? "" : waiting ? "waiting" : "collected"}
            onChange={(choice) => setAnswer({ releaseId: release.id, waiting: choice === "waiting" })}
          />
        </div>
      ) : null}
    </>
  );
  return { field, unanswered: asks && waiting === undefined, awaitingTransport: waiting === true };
}
