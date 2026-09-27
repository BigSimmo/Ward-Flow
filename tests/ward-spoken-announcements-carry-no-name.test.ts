import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Privacy review, 27 Sept 2026: a spoken screen-reader announcement (announceToWardShell, an
// aria-live region) never carries the patient's name, though the visible text may. This guard
// reads every announceToWardShell(...) call in the ward screens and refuses a call whose own
// arguments reach for a patient's identity directly. A message built into a variable first is
// out of its reach, so those sites pass a separate name-free spoken string instead.
const ROOT = join(process.cwd(), "src/components/ward-management");
const IDENTITY = /nameFor\(|\.who\b|\bwho\b\s*\}|displayName|formalName|umrn|hit\.name/iu;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/u.test(entry) ? [path] : [];
  });
}

function announcementArguments(source: string): string[] {
  const calls: string[] = [];
  const marker = "announceToWardShell(";
  let from = source.indexOf(marker);
  while (from !== -1) {
    let depth = 1;
    let index = from + marker.length;
    while (index < source.length && depth > 0) {
      if (source[index] === "(") depth += 1;
      if (source[index] === ")") depth -= 1;
      index += 1;
    }
    calls.push(source.slice(from + marker.length, index - 1));
    from = source.indexOf(marker, index);
  }
  return calls;
}

describe("spoken ward announcements carry no patient name", () => {
  const files = sourceFiles(ROOT);

  it("finds the ward announcement calls it guards", () => {
    const total = files.reduce((count, file) => count + announcementArguments(readFileSync(file, "utf8")).length, 0);
    expect(total).toBeGreaterThan(10);
  });

  it("no announceToWardShell call interpolates a patient's identity", () => {
    const offenders = files.flatMap((file) =>
      announcementArguments(readFileSync(file, "utf8"))
        .filter((args) => IDENTITY.test(args))
        .map((args) => `${file.replace(process.cwd(), "")}: ${args.trim().slice(0, 120)}`),
    );
    expect(offenders).toEqual([]);
  });
});
