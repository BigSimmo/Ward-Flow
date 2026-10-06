"use client";

import Link from "next/link";
import { Check, Copy, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { REFERENCE_TEAM_CAVEAT } from "@/components/ward-management/reference/ward-reference-teams";
import type { Unit } from "@/components/ward-management/ward-model";

import {
  buildDirectory,
  DIRECTORY_CATEGORIES,
  DIRECTORY_CATEGORY_LABEL,
  filterDirectoryEntries,
  type DirectoryFilter,
} from "./tools-directory";
import styles from "./tools-directory.module.css";

export function ToolsDirectoryPanel({ units, onNavigate }: { units: readonly Unit[]; onNavigate: () => void }) {
  const [filter, setFilter] = useState<DirectoryFilter>("all");
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const entries = useMemo(() => buildDirectory(units), [units]);
  const matches = useMemo(() => filterDirectoryEntries(entries, filter, query), [entries, filter, query]);
  const counts = useMemo(() => {
    const tally = new Map<DirectoryFilter, number>([["all", entries.length]]);
    for (const item of entries) tally.set(item.category, (tally.get(item.category) ?? 0) + 1);
    return tally;
  }, [entries]);

  async function copyPhone(id: string, phone: string) {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedId(id);
    } catch {
      setCopiedId(null);
    }
  }

  return (
    <div className={styles.wrap}>
      <label className={styles.search}>
        <Search aria-hidden="true" />
        <input
          aria-label="Search directory"
          placeholder="Search name, place, number or email"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className={styles.filterBar}>
        <div className={styles.chips} role="group" aria-label="Directory categories">
          {DIRECTORY_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={filter === category.id}
              onClick={() => setFilter(category.id)}
            >
              {category.label} <span>{counts.get(category.id) ?? 0}</span>
            </button>
          ))}
        </div>
        <p className={styles.status} role="status">
          {matches.length} of {filter === "all" ? entries.length : (counts.get(filter) ?? 0)}
          {matches.length === 0 ? " · No matching locations." : ""}
        </p>
      </div>
      <ul className={styles.list} aria-label="Directory results">
        {matches.map((item) => (
          <li key={item.id} className={styles.row}>
            <div className={styles.identity}>
              {item.href ? (
                <Link href={item.href} onClick={onNavigate}>
                  {item.name}
                </Link>
              ) : (
                <strong>{item.name}</strong>
              )}
              <p>
                {DIRECTORY_CATEGORY_LABEL[item.category]} · {item.place}
                {item.detail ? ` · ${item.detail}` : ""}
                {item.provenance === "prototype" ? <em data-provenance="prototype">Prototype</em> : null}
                {item.provenance === "published" ? <em data-provenance="published">Published</em> : null}
              </p>
            </div>
            {item.phone || item.email ? (
              <p className={styles.contact}>
                <span>{item.phone ?? "Number not held"}</span>
                {item.email ? <a href={`mailto:${item.email}`}>{item.email}</a> : <span>Email not held</span>}
              </p>
            ) : (
              <p className={styles.missing}>Number and email not held</p>
            )}
            <button
              type="button"
              className={styles.copy}
              disabled={item.phone === null}
              aria-label={item.phone ? `Copy ${item.name} number` : `${item.name} number not held`}
              onClick={() => {
                if (item.phone) void copyPhone(item.id, item.phone);
              }}
            >
              {copiedId === item.id ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        Prototype desks use extension 94xx and are not live lines. Published community numbers are not call-tested.
        {filter === "all" || filter === "community" ? ` ${REFERENCE_TEAM_CAVEAT}` : ""}
      </p>
    </div>
  );
}
