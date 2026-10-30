"use client";

// New for the site bed manager's Capacity (D-80): every other site as bed counts only. Mounted only
// in the `bed_manager` branch of `capacity-redesign.tsx`; it reads place information, never a patient.

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Card, CardHead } from "@/components/wf";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { siteByCode } from "@/components/ward-management/ward-sites";

import type { CapacityModel } from "./use-capacity-model";
import styles from "./other-sites-counts.module.css";

const percent = (inUse: number, beds: number) => (beds > 0 ? `${((inUse / beds) * 100).toFixed(1)}%` : "No beds");

/**
 * The rest of the network for a site desk: one row per health service with its ready beds, closed
 * beds and share in use, which opens to its wards' counts. No row links to a ward, because a site
 * bed manager opens only its own site's wards.
 */
export function OtherSitesCounts({ model, focusUnitId }: { model: CapacityModel; focusUnitId?: string }) {
  const { otherSiteGroups, site } = model;
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const groups = otherSiteGroups.filter((group) => group.wards.length > 0);
  // A ward chosen from Ready beds by road time opens its service once; the reader can fold it again.
  const [seenFocus, setSeenFocus] = useState<string | undefined>(undefined);
  if (focusUnitId !== seenFocus) {
    setSeenFocus(focusUnitId);
    const service = groups.find((group) => group.wards.some((ward) => ward.unit.id === focusUnitId))?.service;
    if (service !== undefined && !open.has(service)) setOpen(new Set([...open, service]));
  }
  if (groups.length === 0) return null;
  const all = groups.flatMap((group) => group.wards);
  const ready = all.reduce((sum, ward) => sum + ward.ready, 0);
  const beds = all.reduce((sum, ward) => sum + ward.unit.beds, 0);
  const toggle = (service: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(service)) next.delete(service);
      else next.add(service);
      return next;
    });

  return (
    <Card aria-labelledby="bm-other-sites-title">
      <CardHead
        id="bm-other-sites-title"
        title="Other sites"
        meta={`Bed counts only · ${ready} ready of ${beds} beds on ${all.length} wards`}
      />
      <ul className={styles.groups}>
        {groups.map((group) => {
          const groupReady = group.wards.reduce((sum, ward) => sum + ward.ready, 0);
          const groupClosed = group.wards.reduce((sum, ward) => sum + ward.closed, 0);
          const groupBeds = group.wards.reduce((sum, ward) => sum + ward.unit.beds, 0);
          const groupInUse = group.wards.reduce((sum, ward) => sum + ward.occupied + ward.pulled, 0);
          // A ward chosen from Ready beds by road time opens its service and is marked.
          const isOpen = open.has(group.service);
          const panelId = `bm-other-${group.service.replace(/\W+/g, "-").toLowerCase()}`;
          return (
            <li key={group.service} className={styles.group}>
              <button
                type="button"
                className={styles.toggle}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(group.service)}
              >
                {isOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                <span className={styles.name}>{group.service}</span>
                <span className={styles.muted}>{group.wards.length} wards</span>
                <span className={styles.figures}>
                  <b>{groupReady} ready</b> · {groupClosed} closed · {percent(groupInUse, groupBeds)} in use
                </span>
              </button>
              <table id={panelId} hidden={!isOpen} className={styles.table}>
                <caption className={styles.srOnly}>{group.service} wards, bed counts</caption>
                <thead>
                  <tr>
                    <th scope="col">Ward</th>
                    <th scope="col">Ready</th>
                    <th scope="col">Beds</th>
                    <th scope="col">In use</th>
                  </tr>
                </thead>
                <tbody>
                  {group.wards.map((ward) => (
                    <tr
                      key={ward.unit.id}
                      id={`bm-other-${ward.unit.id}`}
                      className={ward.unit.id === focusUnitId ? styles.focus : undefined}
                    >
                      <th scope="row">
                        <SpelledCodes text={ward.unit.name} />
                        <span className={styles.site}>
                          {siteByCode(ward.unit.siteCode)?.name ?? ward.unit.siteCode}
                        </span>
                      </th>
                      <td>{ward.ready}</td>
                      <td>{ward.unit.beds}</td>
                      <td>{percent(ward.occupied + ward.pulled, ward.unit.beds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </li>
          );
        })}
      </ul>
      <p className={styles.foot}>
        Your desk opens the wards at {site?.name ?? "your site"} only. Other sites show beds, never the people in them.
      </p>
    </Card>
  );
}
