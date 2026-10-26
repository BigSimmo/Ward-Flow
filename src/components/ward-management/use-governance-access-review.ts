"use client";

/**
 * Where Governance's break glass rows and record views come from (D-80 item 14): the server in the
 * signed-in shared workspace, or the local demo's synthetic ones plus this tab's own openings. See
 * `governance-access-review.ts` for the rows themselves.
 */
import { useContext, useEffect, useMemo, useState } from "react";

import type { AuditEvent } from "./ward-audit";
import type { Instant } from "./ward-clock";
import { WardFlowContext, useOptionalWardFlowSelect } from "./ward-flow-provider";
import { NEWEST_SEED_MINUTES_BEFORE } from "./ward-governance-seed";
import { resolveSubjectPatient } from "./ward-patient-resolver";
import { accessIsWholeNetwork } from "./ward-role-access";
import type { SharedBreakGlassOpening, SharedRecordView } from "./ward-shared-client";
import {
  markBreakGlass,
  serverOpenings,
  serverViews,
  syntheticAccessReview,
  type AccessOpening,
  type RecordView,
} from "./governance-access-review";
import { UnscopedWardFlowContext } from "./shell/ward-access-context";
import { breakGlassOpeningsForReview, useEffectiveWardAccess, useWardAccessSnapshot } from "./shell/ward-access-store";
import { SharedAccessContext } from "./shell/ward-shared-access-context";
import { useWardFeatureFlag } from "./shell/ward-feature-flag-store";

/** The shared workspace's list is read again this often while Governance is open. */
const READ_EVERY_MS = 60_000;

export type AccessReviewSource = {
  readonly openings: readonly AccessOpening[];
  readonly views: readonly RecordView[];
  /** "server": read from the shared workspace. "demo": the local demo's synthetic rows. */
  readonly from: "server" | "demo";
  /** The server could not be read; the rows are the last ones read, or none. */
  readonly problem: boolean;
};

type Loaded = {
  readonly openings: readonly SharedBreakGlassOpening[];
  readonly views: readonly SharedRecordView[];
  readonly at: Instant | null;
  readonly problem: boolean;
};

/**
 * `governanceEvents` are the captured and seeded governance entries: the demo times its synthetic
 * openings from the newest seeded one, so they sit with the rest of the demonstration night.
 */
export function useGovernanceAccessReview(governanceEvents: readonly AuditEvent[], now: Instant): AccessReviewSource {
  const access = useEffectiveWardAccess();
  // The local demo has break glass only with the Role access switch on, so its rows follow it.
  const roleAccess = useWardFeatureFlag("role-access");
  const read = useContext(SharedAccessContext)?.api.readRecordAccess;
  // Optional reads: the workbench also renders on its own, without the provider (its tests do).
  const scoped = useOptionalWardFlowSelect("patients", "movements", "referrals");
  const unscoped = useContext(UnscopedWardFlowContext);
  const provided = useContext(WardFlowContext);
  const world = unscoped ?? provided;
  const { records: tabOpenings } = useWardAccessSnapshot();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!read) return;
    let cancelled = false;
    const load = () =>
      read().then(
        (value) => {
          if (!cancelled) setLoaded({ openings: value.openings, views: value.views, at: null, problem: false });
        },
        () => {
          if (!cancelled) setLoaded((current) => (current ? { ...current, problem: true } : null) ?? EMPTY_FAILED);
        },
      );
    void load();
    const timer = window.setInterval(() => void load(), READ_EVERY_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [read]);
  // Stamped with the demo clock on the first render after it arrives (as the Access tab does).
  if (loaded && loaded.at === null) setLoaded({ ...loaded, at: now });

  const seedAnchor = useMemo(() => {
    const seeded = governanceEvents.filter((event) => event.origin === "synthetic-seed" && event.at !== null);
    return seeded.length ? Math.max(...seeded.map((event) => event.at as number)) : null;
  }, [governanceEvents]);

  const demo = useMemo(() => {
    if (read || !roleAccess || seedAnchor === null || !world) return { openings: [], views: [] };
    // People with a current stay away from the first ward, one per ward, so the openings spread
    // across the network as break glass would.
    const first = world.units[0]?.id;
    const seen = new Set<string>();
    const records: string[] = [];
    for (const stay of world.admissions) {
      const person = resolveSubjectPatient(stay, world).patient?.id;
      if (stay.unitId === first || stay.leftAt !== null || !person || seen.has(stay.unitId)) continue;
      seen.add(stay.unitId);
      records.push(person);
    }
    return syntheticAccessReview({ start: seedAnchor + NEWEST_SEED_MINUTES_BEFORE, units: world.units, records });
  }, [read, roleAccess, seedAnchor, world]);

  return useMemo(() => {
    // A service coordinator keeps the records in its own part of the workspace; the server does the
    // same for the shared workspace, so this only narrows the demo.
    const patients = scoped?.patients ?? [];
    const ids: (string | undefined)[] = [
      ...patients.map((patient) => patient.id),
      ...(scoped?.movements ?? []).flatMap((movement) => [
        movement.id,
        resolveSubjectPatient(movement, { patients }).patient?.id,
      ]),
      ...(scoped?.referrals ?? []).map((referral) => resolveSubjectPatient(referral, { patients }).patient?.id),
    ];
    const own = new Set(ids.filter((id): id is string => typeof id === "string"));
    const mine = <T extends { record: string }>(rows: readonly T[]) =>
      accessIsWholeNetwork(access) ? [...rows] : rows.filter((row) => own.has(row.record));
    const units = world?.units ?? [];
    // A movement page logged before its patient was known carries the WF- number: match it by patient.
    const patientRecord = (record: string) =>
      record.startsWith("WF-")
        ? (world?.movements.find((movement) => movement.id === record)?.patientId ?? record)
        : record;
    if (read) {
      const at = loaded?.at ?? now;
      const openings = serverOpenings(loaded?.openings ?? [], at, units);
      return {
        openings,
        views: markBreakGlass(
          serverViews(loaded?.views ?? [], at, units).map((view) => ({ ...view, record: patientRecord(view.record) })),
          openings,
        ),
        from: "server",
        problem: loaded?.problem ?? false,
      };
    }
    const openings = mine([...demo.openings, ...breakGlassOpeningsForReview(tabOpenings)]);
    const tabViews: RecordView[] = breakGlassOpeningsForReview(tabOpenings).map((opening) => ({
      key: `view-${opening.key}`,
      at: opening.at,
      record: opening.record,
      desk: opening.desk,
      place: opening.place,
      surface: "patient",
      breakGlass: true,
    }));
    return { openings, views: mine([...demo.views, ...tabViews]), from: "demo", problem: false };
  }, [access, demo, loaded, now, read, scoped, tabOpenings, world]);
}

const EMPTY_FAILED: Loaded = { openings: [], views: [], at: null, problem: true };
