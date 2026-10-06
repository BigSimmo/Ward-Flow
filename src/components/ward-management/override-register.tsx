"use client";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { OverrideEntry } from "@/components/ward-management/ward-derivations";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import type { Unit } from "@/components/ward-management/ward-model";

import styles from "./override-register.module.css";

/**
 * THE READ SIDE OF THE OVERRIDE REGISTER — one presentation, two audiences, and it cannot tell
 * which one it is serving.
 *
 * Owner decision OD-3: a coordinator may overrule a failing bed-matching gate, the reason is kept
 * on `Movement.overrides`, and the record is **visible to the party overridden**. Until this
 * component existed, every caller of `allOverrides` and `overridesAgainstUnit` was a test — an
 * accountability record nobody could read, which is an audit trail wearing the other name.
 *
 * ⚠️ **THIS COMPONENT RECEIVES AN ALREADY-SCOPED LIST AND HAS NO WAY TO NARROW ONE.** It takes
 * `OverrideEntry[]` and never calls a derivation, so it cannot be handed the whole register "and
 * filter for the ward" — the construction OD-3 exists to forbid. The scoping decision is made
 * before anything reaches here: the coordinator screen calls `allOverrides`, the ward screen calls
 * `overridesAgainstUnit`, and neither fact is visible from inside this file. That is deliberate.
 * A component that knew which view it was serving could be *asked* to hide a row, and a hidden row
 * is one stylesheet away from a shown one.
 *
 * `tests/ward-override-register-render.dom.test.tsx` guards both halves: the rendered behaviour,
 * and — structurally, so no future column can undo it — that `ward-screen.tsx` never so much as
 * names `allOverrides`.
 */

/**
 * The empty state, in ONE place because both screens say it and a second copy is how two screens
 * start disagreeing about what an empty register means. It states that nothing has been recorded
 * rather than rendering an empty box: "no rows" and "this surface is not wired up" look identical
 * on screen, and only one of them is true.
 */
export const NO_OVERRIDE_RECORDED_NOTICE = "No overrides";

type OverrideRegisterProps = {
  /**
   * Already scoped by the caller. This component neither filters nor re-reads it — see the file
   * comment above for why that is the whole design.
   */
  entries: OverrideEntry[];
  /** Only for naming a unit id. Unit names are network-wide and public — the ward index lists
   *  every one of them — so this carries no scope of its own. */
  units: Unit[];
  now: Instant;
};

export function OverrideRegister({ entries, units, now }: OverrideRegisterProps) {
  const patientOf = usePatientOf();
  if (entries.length === 0) {
    return (
      <p className={styles.placeholder} data-testid="ward-override-register-empty">
        {NO_OVERRIDE_RECORDED_NOTICE}
      </p>
    );
  }

  // Newest first: an override register is read to find out what has just been decided. Sorted on a
  // copy, because `allOverrides` returns entries in movement order and a derivation's own array
  // must not be reordered under it.
  const newestFirst = [...entries].sort((a, b) => b.override.at - a.override.at);

  return (
    <ul className={styles.list} data-testid="ward-override-register" style={{ fontVariantNumeric: "tabular-nums" }}>
      {newestFirst.map((entry, index) => {
        const movementAny = entry.movement as { umrn?: string };
        const hasUmrn = typeof movementAny.umrn === "string" && movementAny.umrn.length > 0;

        return (
          // A movement can be overridden more than once (the reducer appends rather than replaces),
          // so the movement id alone is not a key. The index is over the sorted copy, which is
          // stable for a given render.
          <li
            key={`${entry.movement.id}-${entry.override.at}-${index}`}
            className={styles.entry}
            data-testid={`ward-override-entry-${entry.movement.id}`}
            style={{
              border: "1px solid var(--line-strong, var(--line, currentColor))",
              borderRadius: "var(--radius-md, 0.375rem)",
              backgroundColor: "var(--surface)",
              color: "var(--ink)",
              boxShadow: "0 1px 3px var(--scrim, transparent)",
            }}
          >
            <div
              className={styles.entryHeader}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>
                {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                <strong style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
                  {patientOf(entry.movement).formalName}
                </strong>
                {hasUmrn ? (
                  <span
                    className={styles.entryMeta}
                    style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-soft, var(--muted))" }}
                  >
                    UMRN: {movementAny.umrn}
                  </span>
                ) : null}
                <span
                  className={styles.entryMeta}
                  style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-soft, var(--muted))" }}
                >
                  {formatInstantWithDay(entry.override.at, now)}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
                <span
                  data-testid={`ward-override-status-pill-${entry.movement.id}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "0.125rem 0.5rem",
                    borderRadius: "var(--radius-full, 9999px)",
                    fontSize: "var(--text-3xs, 0.6875rem)",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    border: "1px solid var(--line-strong)",
                    backgroundColor: "var(--surface)",
                    color: "var(--ink)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {entry.override.gate === "high_acuity_staffing" ? "High-Acuity Override" : "Override"}
                </span>

                {entry.override.numConsulted ? (
                  <span
                    data-testid={`ward-override-consulted-pill-${entry.movement.id}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0.125rem 0.5rem",
                      borderRadius: "var(--radius-full, 9999px)",
                      fontSize: "var(--text-3xs, 0.6875rem)",
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      border: "1px solid var(--accent, var(--line-strong))",
                      backgroundColor: "var(--surface)",
                      color: "var(--accent, var(--ink))",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    NUM Consulted
                  </span>
                ) : null}
              </div>
            </div>

            {/*
              ⚠️ A ROLE, NEVER A PERSON. `Override.by` is written by the reducer from
              `WARD_FLOW_ROLE_LABELS[event.role]` and holds a role label such as "Flow coordinator".
              The wording below must never imply a named individual — "Decided by" plus a role reads
              as the role deciding, which is what happened.
            */}
            <span
              className={styles.entryMeta}
              data-testid={`ward-override-by-${entry.movement.id}`}
              style={{ color: "var(--ink-soft, var(--muted))" }}
            >
              Decided by {entry.override.by}
            </span>

            {/*
              The reason is rendered verbatim from `OVERRIDE_REASONS`. It is a whole sentence chosen
              from the owner's fixed list, so there is nothing here to relabel, expand or prefix — a
              second wording of a governance reason is a second reason.
            */}
            <span
              className={styles.entryReason}
              data-testid={`ward-override-reason-${entry.movement.id}`}
              style={{ color: "var(--ink)" }}
            >
              {entry.override.reason}
            </span>

            {/*
              Item 10, owner answers 17 September 2026. Rendered only when the override actually
              answered the high-acuity staffing gate AND the tick was recorded — `numConsulted` is
              never written `false` (see `Override.numConsulted`'s own doc comment), so this reads as
              a plain presence check rather than a truthiness one that could be fooled by a stray
              `false`.
            */}
            {entry.override.gate === "high_acuity_staffing" && entry.override.numConsulted ? (
              <span
                className={styles.entryMeta}
                data-testid={`ward-override-num-consulted-${entry.movement.id}`}
                style={{ color: "var(--ink-soft, var(--muted))" }}
              >
                High-acuity staffing — nurse unit manager consulted
              </span>
            ) : null}

            <span
              className={styles.entryMeta}
              data-testid={`ward-override-units-${entry.movement.id}`}
              style={{ color: "var(--ink-soft, var(--muted))" }}
            >
              {/* The record holds a reason and destinations, not the historical gate verdict.
                  An override can also be recorded for an eligible target. */}
              Referred by override to{" "}
              {entry.override.unitIds
                // An id the live unit list cannot name still says the id rather than being dropped:
                // a missing row would understate the record, and inventing a name is worse than
                // showing the raw identifier.
                .map((unitId) => units.find((unit) => unit.id === unitId)?.name ?? unitId)
                .join(", ")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
