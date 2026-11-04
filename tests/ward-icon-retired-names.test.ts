import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Icon audit guard (3 Nov 2026, design system section 4 "Icons and status marks"). Ward Flow uses
 * Lucide's current names and one icon per meaning: one bed (BedSingle) and one transport icon
 * (Ambulance). This stops a PR bringing an old alias or a retired icon back.
 *
 * LEGACY_FILES is a ratchet, not an allow-list to grow. It holds the files that open PRs were
 * still changing when the guard landed (phase 2 of the audit sweeps them). Remove a file once it
 * is swapped; the second test fails if a listed file no longer needs its place. Never add a file.
 */
const RETIRED: Record<string, string> = {
  BedDouble: "BedSingle",
  Truck: "Ambulance",
  AlertTriangle: "TriangleAlert",
  AlertCircle: "CircleAlert",
  CheckCircle2: "CircleCheck",
  BarChart3: "ChartColumn",
  Loader2: "LoaderCircle",
  MoreHorizontal: "Ellipsis",
};

const LEGACY_FILES = new Set<string>([
  "src/components/ward-management/capacity/planned-admissions-panel.tsx",
  "src/components/ward-management/coordinator/shortlist-panel.tsx",
  "src/components/ward-management/help/ward-help-jobs.tsx",
  "src/components/ward-management/movements/movement-workspace-cockpit.tsx",
  "src/components/ward-management/patients/patient-history-tab.tsx",
  "src/components/ward-management/patients/patient-now-panel.tsx",
  "src/components/ward-management/patients/patient-status-card.tsx",
  "src/components/ward-management/referrals/upload-forms-modal.tsx",
  "src/components/ward-management/reports/patient-chronology-screen.tsx",
  "src/components/ward-management/statistics/statistics-capacity-chart.tsx",
  "src/components/ward-management/statistics/statistics-journey-view.tsx",
  "src/components/ward-management/statistics/statistics-service-screen.tsx",
  "src/components/ward-management/statistics/statistics-ward-screen.tsx",
  "src/components/ward-management/tools/ward-tools-sheet.tsx",
  "src/components/ward-management/ward-tasks-drawer.tsx",
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

function retiredImports(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*"lucide-react"/g)) {
    for (const part of match[1].split(",")) {
      const name = part
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0];
      if (Object.hasOwn(RETIRED, name)) found.push(name);
    }
  }
  return found;
}

const FILES = sourceFiles("src").map((path) => path.split("\\").join("/"));

describe("icon audit: retired Lucide names", () => {
  it("no file outside the phase 2 list imports a retired icon name", () => {
    const offenders = FILES.filter((path) => !LEGACY_FILES.has(path)).flatMap((path) =>
      retiredImports(readFileSync(path, "utf8")).map((name) => `${path}: ${name} (use ${RETIRED[name]})`),
    );
    expect(offenders).toEqual([]);
  });

  it("every file on the phase 2 list still needs its place, so the list only shrinks", () => {
    const stale = [...LEGACY_FILES].filter((path) => retiredImports(readFileSync(path, "utf8")).length === 0);
    expect(stale).toEqual([]);
  });
});
