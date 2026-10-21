"use client";

import { Pin, PinOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Select } from "@/components/wf";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";

import { useCanOpenHref } from "./ward-access";
import { unitHref } from "./ward-facade";
import { announceToWardShell } from "./ward-live-region";
import { MY_WARDS_LIMIT, toggleMyWard, useMyWards } from "./ward-my-wards-store";
import styles from "./ward-my-wards.module.css";

const WARD_PATH = /^\/ward-flow\/ward\/([^/?#]+)/;

/** The ward a ward page shows, from its address, or undefined on any other page. */
export function wardIdFromPath(pathname: string): string | undefined {
  const match = WARD_PATH.exec(pathname);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }
}

function pin(unit: Unit) {
  const outcome = toggleMyWard(unit.id);
  if (outcome === "pinned") announceToWardShell(`${unit.name} pinned to My wards.`);
  else if (outcome === "unpinned") announceToWardShell(`${unit.name} removed from My wards.`);
  else if (outcome === "full") announceToWardShell(`My wards holds ${MY_WARDS_LIMIT}. Remove one first.`);
}

/**
 * MY WARDS in the rail and the phone menu: links to the wards this person pinned on this device,
 * each with its own remove button, plus "Pin this ward" while a ward page is open. Nothing renders
 * on other pages until a ward is pinned, so the menus are unchanged for anyone not using it.
 *
 * Only wards in today's network that this desk may open are listed. A pin for any other ward stays
 * stored and comes back when the ward does.
 *
 * The phone menu is not reachable from a ward page (its header shows Back there), so the sheet
 * also offers a "Pin a ward" list of the wards this desk may open.
 */
export function WardMyWards({ variant, onNavigate }: { variant: "rail" | "sheet"; onNavigate?: () => void }) {
  const pinned = useMyWards();
  const pathname = usePathname() ?? "";
  const { units } = useWardFlowSelect("units");
  const canOpen = useCanOpenHref();

  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const shown = pinned
    .map((id) => byId.get(id))
    .filter((unit): unit is Unit => unit !== undefined && canOpen(unitHref(unit.id)));
  const currentId = wardIdFromPath(pathname);
  const current = currentId === undefined ? undefined : byId.get(currentId);
  const offerPin = current !== undefined && !pinned.includes(current.id);
  const pinnable =
    variant === "sheet" && pinned.length < MY_WARDS_LIMIT
      ? units
          .filter((unit) => !pinned.includes(unit.id) && canOpen(unitHref(unit.id)))
          .toSorted((left, right) => left.name.localeCompare(right.name, "en-AU"))
      : [];

  if (shown.length === 0 && !offerPin && pinnable.length === 0) return null;

  return (
    <section aria-label="My wards" className={styles.section} data-variant={variant} data-testid="ward-my-wards">
      <p className={styles.heading}>My wards</p>
      <ul className={styles.list}>
        {shown.map((unit) => {
          const href = unitHref(unit.id);
          const here = currentId === unit.id;
          return (
            <li key={unit.id} className={styles.row}>
              <Link
                href={href}
                className={styles.link}
                aria-current={here ? "page" : undefined}
                onClick={onNavigate}
                data-testid="ward-my-wards-link"
              >
                {unit.name}
              </Link>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={`Remove ${unit.name} from My wards`}
                title="Remove from My wards"
                onClick={() => pin(unit)}
                data-testid="ward-my-wards-unpin"
              >
                <PinOff aria-hidden="true" strokeWidth={1.75} />
              </button>
            </li>
          );
        })}
        {offerPin ? (
          <li className={styles.row}>
            <button
              type="button"
              className={styles.pinButton}
              aria-label={`Pin this ward, ${current.name}, to My wards`}
              onClick={() => pin(current)}
              data-testid="ward-my-wards-pin"
            >
              <Pin aria-hidden="true" strokeWidth={1.75} />
              Pin this ward
            </button>
          </li>
        ) : null}
      </ul>
      {pinnable.length ? (
        <Select
          aria-label="Pin a ward to My wards"
          boxClassName={styles.pinSelect}
          value=""
          onChange={(event) => {
            const unit = byId.get(event.target.value);
            if (unit) pin(unit);
          }}
          data-testid="ward-my-wards-add"
        >
          <option value="">Pin a ward</option>
          {pinnable.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {`${unit.name} (${unit.siteCode})`}
            </option>
          ))}
        </Select>
      ) : null}
    </section>
  );
}
