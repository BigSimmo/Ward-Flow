/*
 * Small pieces the locked community team design repeats (design/community-team-2026-11). Ported
 * from the mock-up's helpers as React, wearing the kit's own components where the kit has one.
 */

import type { ReactNode } from "react";
import { StatusGlyph, type WfTone } from "@/components/wf";
import { STAFF_BY_ID, shortName, type DemoClient } from "./midland-demo";
import t from "./team-2026.module.css";

export function Person({ name, umrn, sub }: { name: string; umrn: string; sub?: string }) {
  return (
    <div className={t.person}>
      <span className={t.name}>{name}</span>
      <span className={t.sub}>
        <span className={t.mono}>{umrn}</span>
        {sub ? ` · ${sub}` : ""}
      </span>
    </div>
  );
}

export function Tag({ tone, children, glyph = true }: { tone: WfTone; children: ReactNode; glyph?: boolean }) {
  return (
    <span className={t.tag} data-tone={tone}>
      {glyph ? <StatusGlyph tone={tone} size={12} /> : null}
      {children}
    </span>
  );
}

export function Initials({ id, className }: { id: string; className?: string }) {
  return <span className={`${t.av} ${className ?? ""}`}>{STAFF_BY_ID[id]?.ini}</span>;
}

/** Case manager cell: avatar and short name, or "Psychiatrist only", or a Not allocated tag. */
export function CaseManagerCell({ client }: { client: Pick<DemoClient, "cm" | "psychOnly"> }) {
  if (client.cm) {
    return (
      <span className={t.cm}>
        <Initials id={client.cm} />
        {shortName(client.cm)}
      </span>
    );
  }
  if (client.psychOnly) return <span className={t.muted}>Psychiatrist only</span>;
  return <Tag tone="warning">Not allocated</Tag>;
}

/** Days since last seen: four weeks or more (case managed) carries the one warning mark. */
export function SeenCell({ client }: { client: Pick<DemoClient, "seen" | "psychOnly"> }) {
  const { seen, psychOnly } = client;
  if (seen == null) return <span className={t.muted}>Not yet</span>;
  if (seen >= 28 && !psychOnly) {
    return (
      <span className={t.strong}>
        <StatusGlyph tone="warning" size={12} />
        {seen}d
      </span>
    );
  }
  return <>{seen >= 35 ? `${Math.round(seen / 7)} weeks` : `${seen}d`}</>;
}

/** Initials of a "Surname, Given" name, given name first. */
export function initialsOf(name: string): string {
  return name
    .replace("Dr ", "")
    .split(", ")
    .map((part) => part[0] ?? "")
    .reverse()
    .join("");
}

/** The one demo-data line every demo block carries (Q107: a caveat that matters stays visible). */
export function DemoNote() {
  return <span className={t.meta}>Demo data</span>;
}
