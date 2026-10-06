"use client";

import Link from "next/link";
import { Search } from "lucide-react";
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
      <p className={styles.note}>
        Prototype directory. Ward extensions are from this prototype. Community numbers marked Published are from the
        public directory and are not call-tested. Desks marked Prototype use extension 94xx and are not live lines.
      </p>
      <label className={styles.search}>
        <Search aria-hidden="true" />
        <input
          aria-label="Search directory"
          placeholder="Search name, place, number or email"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className={styles.chips} role="group" aria-label="Directory categories">
        {DIRECTORY_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            aria-pressed={filter === category.id}
            onClick={() => setFilter(category.id)}
          >
            {category.label} {counts.get(category.id) ?? 0}
          </button>
        ))}
      </div>
      {filter === "all" || filter === "community" ? <p className={styles.note}>{REFERENCE_TEAM_CAVEAT}</p> : null}
      <p className={styles.status} role="status">
        {matches.length} of {filter === "all" ? entries.length : (counts.get(filter) ?? 0)}
        {matches.length === 0 ? " · No matching locations." : ""}
      </p>
      <ul className={styles.list} aria-label="Directory results">
        {matches.map((item) => (
          <li key={item.id} className={styles.row}>
            <div className={styles.head}>
              <span className={styles.kind}>{DIRECTORY_CATEGORY_LABEL[item.category]}</span>
              {item.provenance === "prototype" ? (
                <span className={styles.chip} data-provenance="prototype">
                  Prototype
                </span>
              ) : item.provenance === "published" ? (
                <span className={styles.chip} data-provenance="published">
                  Published
                </span>
              ) : null}
            </div>
            {item.href ? (
              <Link href={item.href} onClick={onNavigate}>
                {item.name}
              </Link>
            ) : (
              <strong>{item.name}</strong>
            )}
            <p className={styles.place}>
              {item.place}
              {item.detail ? ` · ${item.detail}` : ""}
            </p>
            {item.phone || item.email ? (
              <p className={styles.contact}>
                <span>{item.phone ?? "Number not held"}</span>
                {item.email ? <a href={`mailto:${item.email}`}>{item.email}</a> : <span>Email not held</span>}
                <button
                  type="button"
                  className={styles.copy}
                  disabled={item.phone === null}
                  aria-label={item.phone ? `Copy ${item.name} number` : `${item.name} number not held`}
                  onClick={() => {
                    if (item.phone) void copyPhone(item.id, item.phone);
                  }}
                >
                  {copiedId === item.id ? "Copied" : "Copy"}
                </button>
              </p>
            ) : (
              <p className={styles.missing}>Number and email not held</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
