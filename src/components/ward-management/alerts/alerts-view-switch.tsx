"use client";

// Alerts redesign (1 Nov 2026): the Urgency, Lanes and Owner switch, at the end of the tab row.
import { Columns3, List, Users } from "lucide-react";

import { Segmented } from "@/components/wf";

import parts from "./alerts-screen-parts.module.css";

export type ArrangeBy = "urgency" | "lanes" | "owner";

export function ArrangeSwitch({
  value,
  onChange,
  withOwner,
}: {
  value: ArrangeBy;
  onChange: (next: ArrangeBy) => void;
  /** A desk with no owner to pick (the transport officer) has no Owner arrangement. */
  withOwner: boolean;
}) {
  return (
    <div className={parts.viewSwitch}>
      <Segmented
        label="Arrange by"
        value={value}
        onChange={onChange}
        items={[
          {
            id: "urgency" as const,
            label: (
              <>
                <List size={14} aria-hidden="true" /> Urgency
              </>
            ),
          },
          {
            id: "lanes" as const,
            label: (
              <>
                <Columns3 size={14} aria-hidden="true" /> Lanes
              </>
            ),
          },
          ...(withOwner
            ? [
                {
                  id: "owner" as const,
                  label: (
                    <>
                      <Users size={14} aria-hidden="true" /> Owner
                    </>
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
