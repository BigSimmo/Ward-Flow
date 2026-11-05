"use client";

// Alerts overhaul (Josh review, 4 Nov 2026): on a phone the owner menu ends the filter row instead
// of taking a full-width line of its own. Yours is a filter chip, so it lists the other owners.

import { ownerShort, type QueueEntry } from "./alerts-queue";
import { OwnerMenu } from "./alerts-queue-groups";

export function PhoneOwnerMenu({
  owners,
  coordDesk,
  value,
  onChange,
  entries,
}: {
  owners: readonly string[];
  coordDesk: boolean;
  value: string | null;
  onChange: (owner: string | null) => void;
  entries: readonly QueueEntry[];
}) {
  const others = owners.filter((owner) => ownerShort(owner, coordDesk) !== "You");
  if (others.length === 0) return null;
  return (
    <OwnerMenu
      owners={others}
      value={value}
      onChange={onChange}
      labelFor={(owner) => ownerShort(owner, coordDesk)}
      countFor={(owner) => entries.filter((entry) => entry.owner === owner).length}
    />
  );
}
