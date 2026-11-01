"use client";

// Alerts redesign (Q149, 1 Nov 2026): Add units on a live broadcast. The same grouped desk list the
// composer's Choose units shows, less the desks the alert already asks. A bed call asks wards only.
import { useState } from "react";

import { Checkbox, Dialog } from "@/components/wf";
import type { Unit } from "@/components/ward-management/ward-model";

import { audienceGroups } from "./broadcast-audience";
import { askedDesks } from "./global-alert-view";
import { broadcastKind, type BroadcastAlert } from "./ward-broadcast-model";
import css from "./broadcast.module.css";

/** The groups and desks Add units can still offer for this alert. */
export function addableGroups(alert: BroadcastAlert, units: readonly Unit[]) {
  const asked = new Set(askedDesks(alert, units));
  const wardsOnly = broadcastKind(alert) === "bed_call";
  return audienceGroups(units)
    .map((group) => ({
      ...group,
      desks: group.desks.filter((desk) => !asked.has(desk.id) && (!wardsOnly || desk.kind === "ward")),
    }))
    .filter((group) => group.desks.length > 0);
}

export function AddUnitsDialog({
  alert,
  units,
  onClose,
  onAdd,
}: {
  alert: BroadcastAlert;
  units: readonly Unit[];
  onClose: () => void;
  onAdd: (unitIds: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const groups = addableGroups(alert, units);
  const toggle = (id: string) =>
    setPicked((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));
  const count = picked.length;
  return (
    <Dialog
      open
      onClose={onClose}
      title="Add units"
      description={`Ask more ${broadcastKind(alert) === "bed_call" ? "wards" : "units"} on "${alert.title}".`}
      closeLabel="Close dialog"
      size="md"
      secondary={[{ label: "Cancel", onAction: onClose }]}
      primary={{
        label: count === 1 ? "Add 1 unit" : `Add ${count} units`,
        onAction: () => onAdd(picked),
        disabledReason: count === 0 ? "Choose at least one unit." : undefined,
      }}
    >
      <div className={css.unitPick}>
        {groups.map((group) => {
          const ids = group.desks.map((desk) => desk.id);
          const on = ids.filter((id) => picked.includes(id)).length;
          const all = on === ids.length;
          return (
            <fieldset key={group.id}>
              <legend>
                <span>{group.label}</span>
                <button
                  type="button"
                  className={css.linkBtn}
                  aria-label={`${all ? "Clear" : "All"} ${group.label}`}
                  onClick={() =>
                    setPicked((list) =>
                      all ? list.filter((id) => !ids.includes(id)) : [...new Set([...list, ...ids])],
                    )
                  }
                >
                  {all ? "Clear" : "All"}
                </button>
                <small>
                  {on} of {ids.length}
                </small>
              </legend>
              {group.desks.map((desk) => (
                <div key={desk.id} className={css.unit}>
                  <Checkbox label={desk.name} checked={picked.includes(desk.id)} onChange={() => toggle(desk.id)} />
                </div>
              ))}
            </fieldset>
          );
        })}
      </div>
    </Dialog>
  );
}
