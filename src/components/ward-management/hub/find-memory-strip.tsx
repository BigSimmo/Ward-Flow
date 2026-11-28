"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Star, X } from "lucide-react";

import { Button, buttonClass, cx } from "@/components/wf";
import { networkNamedHolds } from "@/components/ward-management/ward-bed-states";
import { useWardFlowSelect, useWardNetwork } from "@/components/ward-management/ward-flow-provider";
import { usePageLive } from "@/components/ward-management/ward-page-live";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
import { toggleMyPatient, useMyPatients } from "@/components/ward-management/shell/ward-my-patients-store";
import { toggleMyWard, useMyWards } from "@/components/ward-management/shell/ward-my-wards-store";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";

import { recordHubVisit, toggleHubPin, usePinnedHubIds, useRecentHubIds } from "./hub-browser-memory";
import { hubEntries, type HubEntry } from "./hub-derivations";
import s from "./find-memory-strip.module.css";

/**
 * Find (simplification mock-up, 26 Nov 2026): Places' pinned and recently opened places come back as
 * one quiet strip on the first line under the Find tabs, on every tab. It reads the same two stores
 * as the old Places screen (ward, ED and region ids only, and this browser only), draws nothing until
 * one is used, and offers the pin from a recent place. People appear only as pinned (#114 below).
 */
/*
 * #114 Find part (audit two, 27 Nov 2026): one Pin for people and places, listed here. The strip's
 * Pinned group reads the three existing stores side by side (places pinned here, wards pinned as My
 * wards, people pinned from their page) without merging them: UI only. A ward in two stores shows
 * once, and its unpin clears both.
 */
/** True once a place has been pinned or opened, or a person pinned: the strip then has something to draw. */
export function useFindMemoryUsed(): boolean {
  return usePinnedHubIds().length + useRecentHubIds().length + useMyWards().length + useMyPatients().length > 0;
}

export function FindMemoryStrip() {
  const hubPinnedIds = usePinnedHubIds();
  const myWardIds = useMyWards();
  const myPatientIds = useMyPatients();
  const recentIds = useRecentHubIds();
  const canOpen = useCanOpenHref();
  const patientOf = usePatientOf();
  const nameFor = usePatientNameDisplay();
  const { units, bedReleases, admissions, leaveBeds, movements, referrals, patients } = useWardFlowSelect(
    "units",
    "bedReleases",
    "admissions",
    "leaveBeds",
    "movements",
    "referrals",
    "patients",
  );
  const { now } = usePageLive();
  const { sites } = useWardNetwork();
  const pinnedIds = useMemo(
    () => [...hubPinnedIds, ...myWardIds.filter((id) => !hubPinnedIds.includes(id))],
    [hubPinnedIds, myWardIds],
  );
  const used = pinnedIds.length + recentIds.length > 0;

  // Only worked out once a place has been pinned or opened.
  const byId = useMemo(() => {
    if (!used) return new Map<string, HubEntry>();
    const entries = hubEntries({
      units,
      bedReleases,
      admissions,
      leaveBeds,
      namedHolds: networkNamedHolds(movements, referrals),
      now,
      sites,
    });
    return new Map(entries.map((entry) => [entry.id, entry]));
  }, [used, units, bedReleases, admissions, leaveBeds, movements, referrals, now, sites]);

  const pinned = pinnedIds.flatMap((id) => byId.get(id) ?? []).filter((entry) => canOpen(entry.href));
  const recent = recentIds
    .filter((id) => !pinnedIds.includes(id))
    .flatMap((id) => byId.get(id) ?? [])
    .filter((entry) => canOpen(entry.href));
  const knownPatients = new Map<string, (typeof patients)[number]["id"]>(
    patients.map((patient) => [patient.id, patient.id]),
  );
  const pinnedPeople = myPatientIds
    .flatMap((pin) => {
      const id = knownPatients.get(pin);
      return id === undefined ? [] : [id];
    })
    .filter((id) => canOpen(patientHref(id)))
    .map((id) => {
      const who = patientOf({ patientId: id });
      return { id, name: nameFor(who.formalName, who.umrn), href: patientHref(id) };
    });
  if (pinned.length === 0 && pinnedPeople.length === 0 && recent.length === 0) return null;

  const unpinPlace = (id: string) => {
    if (hubPinnedIds.includes(id)) toggleHubPin(id);
    if (myWardIds.includes(id)) toggleMyWard(id);
  };

  const chip = (entry: HubEntry, isPinned: boolean) => (
    <li key={entry.id} className={s.pair}>
      <Link
        href={entry.href}
        className={cx(buttonClass({ variant: "sec", size: "sm" }), s.place)}
        title={[entry.site, entry.service].filter(Boolean).join(" · ") || undefined}
        onClick={() => recordHubVisit(entry.id)}
      >
        {entry.name}
      </Link>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        icon={isPinned ? X : Star}
        aria-label={isPinned ? `Unpin ${entry.name}` : `Pin ${entry.name}`}
        aria-pressed={isPinned}
        onClick={() => (isPinned ? unpinPlace(entry.id) : toggleHubPin(entry.id))}
      />
    </li>
  );
  const personChip = (person: { id: string; name: string; href: string }) => (
    <li key={`person-${person.id}`} className={s.pair}>
      <Link href={person.href} className={cx(buttonClass({ variant: "sec", size: "sm" }), s.place)}>
        {person.name}
      </Link>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        icon={X}
        aria-label={`Unpin ${person.name}`}
        aria-pressed
        onClick={() => toggleMyPatient(person.id)}
      />
    </li>
  );

  return (
    <div className={s.strip} role="group" aria-label="Pinned and recently opened" data-testid="find-memory-strip">
      {pinned.length + pinnedPeople.length === 0 ? null : (
        <div className={s.group}>
          <span className={s.label}>
            <Star size={12} aria-hidden="true" className={s.star} />
            Pinned
          </span>
          <ul className={s.list}>
            {pinned.map((entry) => chip(entry, true))}
            {pinnedPeople.map(personChip)}
          </ul>
        </div>
      )}
      {recent.length === 0 ? null : (
        <div className={s.group}>
          <span className={s.label}>Recently opened</span>
          <ul className={s.list}>{recent.map((entry) => chip(entry, false))}</ul>
        </div>
      )}
    </div>
  );
}
