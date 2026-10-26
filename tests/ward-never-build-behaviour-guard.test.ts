import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { buildActionInbox } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-events";
import { LEGAL_CLOCK_FORM_CODES } from "@/components/ward-management/ward-legal-clock";
import { legalFormReadinessLine } from "@/components/ward-management/movements/movement-workspace-derivations";
import { formTimeLeft } from "@/components/ward-management/legal-forms/legal-form-time-left";
import { elapsedFraction } from "@/components/ward-management/legal-forms/legal-forms-view";
import { queueOrder, waitFactors } from "@/components/ward-management/ward-priority";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Never-build guard, behaviour half (Stream I, 26 Oct 2026). Josh's standing never-build list:
 * risk or acuity scores, "best match" ward suggestions, automatic placement, re-sorting the ED
 * queue, computed Mental Health Act times or expiry (including the under-18 periods), auto-release
 * of held or pulled beds, and patient details in emails.
 *
 * `ward-never-build-drift-guard.test.ts` scans copy for suggesting words, scores and mail links and
 * pins the exec email summary. `ward-priority.test.ts` pins the Home queue order and the legal-figure
 * sweeps pin every form's `dueAt`. This file covers what those leave open:
 * - time passing changes nothing but the clock, so nothing places, releases or expires by itself;
 * - the ED board's own sort offers a person's choice only, and no queue comparator reads urgency;
 * - a recorded under-18 age band or a young date of birth changes no legal time anywhere;
 * - no event, export or backend timer can place a patient or change the shared record on its own.
 */

const WARD = "src/components/ward-management";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/u.test(name) && !/\.test\.tsx?$/u.test(name) ? [path] : [];
  });
}

/** Code lines only: comment lines explain the rule and may name what is forbidden. */
function codeLines(path: string): { line: number; text: string }[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .map((text, index) => ({ line: index + 1, text }))
    .filter(({ text }) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/u.test(text));
}

const FILES = [...sourceFiles(WARD), ...sourceFiles("src/app")];

function hits(pattern: RegExp, files: string[] = FILES): string[] {
  return files.flatMap((file) =>
    codeLines(file)
      .filter(({ text }) => pattern.test(text))
      .map(({ line, text }) => `${relative(process.cwd(), file)}:${line}: ${text.trim().slice(0, 120)}`),
  );
}

/** The text of a block that starts at `opener` and ends at its matching closing bracket. */
function blockFrom(source: string, opener: string): string {
  const start = source.indexOf(opener);
  expect(start, `"${opener}" must still exist; update this guard if it moved`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(" || char === "{") depth += 1;
    if (char === ")" || char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return source.slice(start);
}

const URGENCY_WORDS = /urgen|tier|flag|legal|risk|acuity|score|priority|security|cohort/iu;

/** Everything in the shared world except the clock offset, for comparison. */
function withoutClock(state: WardFlowState): Omit<WardFlowState, "clockOffsetMinutes"> {
  const { clockOffsetMinutes, ...rest } = state;
  void clockOffsetMinutes;
  return rest;
}

describe("never-build: nothing happens because time passes", () => {
  it.each([1, 4 * 60, 72 * 60, 30 * 24 * 60])(
    "advancing the clock %i minutes changes only the clock: no placement, release or expiry",
    (minutes) => {
      const seeded = seedWardFlowState();
      const later = wardFlowReducer(seeded, { type: "ADVANCE_CLOCK", role: "demo", now: NOW_ANCHOR, minutes });
      expect(later.clockOffsetMinutes).toBe(seeded.clockOffsetMinutes + minutes);
      expect(withoutClock(later)).toEqual(withoutClock(seeded));
    },
  );

  it("a lapsed pull still holds its bed and only asks a person to act", () => {
    const seeded = seedWardFlowState();
    const lapsed = seeded.movements.filter((movement) => movement.pullExpiresAt !== undefined);
    expect(lapsed.length, "the seed must hold a pull with a recorded time limit").toBeGreaterThan(0);
    const farLater = Math.max(...lapsed.map((movement) => movement.pullExpiresAt!)) + 24 * 60;
    const before = new Set(buildActionInbox(seeded.movements, NOW_ANCHOR, seeded.units).map((item) => item.id));
    const after = buildActionInbox(seeded.movements, farLater, seeded.units);
    // Inbox rows are prompts for a person; none of them is an action already taken.
    for (const item of after.filter((entry) => !before.has(entry.id))) {
      expect(item.title, item.id).not.toMatch(/\b(released|auto|automatically|freed)\b/iu);
    }
  });
});

describe("never-build: the ED queue is never re-sorted by need", () => {
  it("the ED board's Sort offers only current order, longest in ED and patient name", () => {
    const board = readFileSync(`${WARD}/ed/ed-screen-board.tsx`, "utf8");
    const start = board.indexOf("<select value={patientSort}");
    expect(start, "the ED board Sort control must still exist").toBeGreaterThanOrEqual(0);
    const select = board.slice(start, board.indexOf("</select>", start));
    const options = [...select.matchAll(/<option value="([^"]*)"/gu)].map((match) => match[1]);
    expect(options).toEqual(["current", "longest", "name"]);
  });

  it("the ED board's comparator reads wait or name only", () => {
    const derivations = readFileSync(`${WARD}/ed/ed-screen-derivations.ts`, "utf8");
    const comparator = blockFrom(derivations, "[...patients].sort(");
    expect(comparator).toMatch(/openedAt/u);
    expect(comparator).not.toMatch(URGENCY_WORDS);
  });

  it("the ED bays are filled by arrival order alone", () => {
    const model = readFileSync(`${WARD}/ed/ed-screen-model.ts`, "utf8");
    const comparator = blockFrom(model, "[...movements].sort(");
    expect(comparator).toMatch(/openedAt/u);
    expect(comparator).not.toMatch(URGENCY_WORDS);
  });

  it("the Home queue order reads no urgency, flag, tier or legal field", () => {
    const priority = readFileSync(`${WARD}/ward-priority.ts`, "utf8");
    const start = priority.indexOf("export function queueOrder(");
    expect(start, "queueOrder must still exist").toBeGreaterThanOrEqual(0);
    const body = priority.slice(start, priority.indexOf("\n}\n", start));
    expect(body).toMatch(/\.sort\(/u);
    expect(body.replace(/\bisOpen\b/gu, "")).not.toMatch(URGENCY_WORDS);
  });

  it("raising every movement to tier 1 and flagging it urgent leaves the queue order unchanged", () => {
    const { movements } = seedWardFlowState();
    const raised = movements.map((movement) => ({ ...movement, urgency: 1, flaggedUrgent: true }) as Movement);
    const ids = (list: Movement[]) => queueOrder(list, NOW_ANCHOR).map((movement) => movement.id);
    expect(ids(raised)).toEqual(ids(movements));
  });
});

describe("never-build: no computed Mental Health Act time, including the under-18 periods", () => {
  it("the recorded age band is only stored and shown: no line pairs it with a time or a sum", () => {
    const paired = hits(/\b(ageBand|under_18|LegalClockAgeBand)\b/u).filter((hit) =>
      /\b(dueAt|expiresAt|minutes?|hours?|days?|MINUTES|HOURS|DAYS)\b|\d\s*\*\s*60|\+\s*\d/u.test(
        hit.split(": ").slice(1).join(": "),
      ),
    );
    expect(paired).toEqual([]);
  });

  it("nothing writes a computed legal clock: the legacy field is only ever cleared", () => {
    expect(hits(/\blegalClock:(?!\s*undefined\b)/u)).toEqual([]);
  });

  it("no copy puts a duration beside an under-18 or child period", () => {
    const young = String.raw`(under[- ]?18|under eighteen|child(ren)?|young person|minor|adolescent)`;
    const duration = String.raw`\d+\s*(hours?|hrs?|days?|weeks?|months?)\b`;
    const pattern = new RegExp(`${young}[^"\`]{0,60}\\b${duration}|\\b${duration}[^"\`]{0,60}${young}`, "iu");
    expect(hits(pattern)).toEqual([]);
  });

  it("a form's time left, readiness line and wait reasons are identical for an under-18 and an adult", () => {
    const { movements } = seedWardFlowState();
    const formed = movements.filter((movement) => movement.legalForm !== undefined);
    expect(formed.length, "the seed must hold a movement under a legal form").toBeGreaterThan(0);
    expect(
      formed.some((movement) => movement.legalForm!.dueAt !== undefined),
      "the seed must hold a typed expiry",
    ).toBe(true);
    const band = (movement: Movement, ageBand: "adult" | "under_18" | undefined): Movement => ({
      ...movement,
      legalForm: { ...movement.legalForm!, ageBand },
    });
    for (const now of [NOW_ANCHOR, NOW_ANCHOR + 6 * 60, NOW_ANCHOR + 4 * 24 * 60]) {
      for (const movement of formed) {
        const read = (subject: Movement) => ({
          timeLeft: formTimeLeft(subject, now, DEFAULT_DUE_SOON_THRESHOLDS),
          readiness: legalFormReadinessLine(subject.legalForm!, now),
          elapsed: elapsedFraction(subject, now),
          reasons: waitFactors(subject, now, DEFAULT_DUE_SOON_THRESHOLDS),
        });
        const adult = read(band(movement, "adult"));
        expect(read(band(movement, "under_18")), movement.id).toEqual(adult);
        expect(read(band(movement, undefined)), movement.id).toEqual(adult);
      }
    }
  });

  it("recording a form for an under-18 stores the paper's time only, never a computed one", () => {
    const seeded = seedWardFlowState();
    const source = seeded.movements.find((movement) => !movement.closure)!;
    const paper = NOW_ANCHOR + 9 * 60;
    const record = (
      code: string,
      ageBand: "adult" | "under_18",
      region: "metro" | "country",
      paperExpiresAt?: number,
    ) => {
      const movementId: `WF-${string}` = `WF-NB-${code}`;
      const before: WardFlowState = {
        ...seeded,
        movements: [
          ...seeded.movements,
          { ...source, id: movementId, legalForm: undefined, legalClock: undefined, closure: undefined },
        ],
      };
      const written = wardFlowReducer(before, {
        type: "RECORD_LEGAL_FORM_WRITTEN",
        role: "ed",
        now: NOW_ANCHOR,
        movementId,
        formCode: code,
        writtenAt: NOW_ANCHOR - 30,
        region,
        ageBand,
        ...(paperExpiresAt === undefined ? {} : { paperExpiresAt }),
      });
      const continued = wardFlowReducer(written, {
        type: "RECORD_LEGAL_FORM_CONTINUATION",
        role: "ed",
        now: NOW_ANCHOR + 60,
        movementId,
        formCode: code,
        startedAt: NOW_ANCHOR + 60,
        region,
        ageBand,
        ...(paperExpiresAt === undefined ? {} : { paperExpiresAt }),
      });
      return [written, continued].map((state) => {
        const movement = state.movements.find((candidate) => candidate.id === movementId)!;
        return { code: movement.legalForm?.code, dueAt: movement.legalForm?.dueAt, clock: movement.legalClock };
      });
    };
    let recorded = 0;
    for (const code of LEGAL_CLOCK_FORM_CODES) {
      for (const region of ["metro", "country"] as const) {
        for (const paperExpiresAt of [undefined, paper]) {
          const adult = record(code, "adult", region, paperExpiresAt);
          const young = record(code, "under_18", region, paperExpiresAt);
          expect(young, `Form ${code}, ${region}`).toEqual(adult);
          for (const step of young) {
            expect(step.clock, `Form ${code}`).toBeUndefined();
            if (step.code !== undefined) {
              recorded += 1;
              expect([undefined, paper], `Form ${code} dueAt`).toContain(step.dueAt);
            }
          }
        }
      }
    }
    expect(recorded, "at least some forms must record").toBeGreaterThan(0);
  });

  it("making every patient fifteen changes no legal time or act-now prompt", () => {
    const seeded = seedWardFlowState();
    const fifteen = new Date(NOW_ANCHOR * 60_000);
    fifteen.setUTCFullYear(fifteen.getUTCFullYear() - 15);
    const young: WardFlowState = {
      ...seeded,
      patients: seeded.patients.map((patient) => ({ ...patient, dateOfBirth: fifteen.toISOString().slice(0, 10) })),
      movements: seeded.movements.map((movement) =>
        movement.legalForm
          ? { ...movement, legalForm: { ...movement.legalForm, ageBand: "under_18" as const } }
          : movement,
      ),
    };
    for (const now of [NOW_ANCHOR, NOW_ANCHOR + 12 * 60, NOW_ANCHOR + 7 * 24 * 60]) {
      const inbox = (state: WardFlowState) =>
        buildActionInbox(state.movements, now, state.units).map(({ id, title }) => ({ id, title }));
      expect(inbox(young)).toEqual(inbox(seeded));
      const times = (state: WardFlowState) =>
        state.movements.map((movement) => formTimeLeft(movement, now, DEFAULT_DUE_SOON_THRESHOLDS));
      expect(times(young)).toEqual(times(seeded));
    }
  });
});

describe("never-build: nothing places a patient or changes the record by itself", () => {
  it("no event type suggests, ranks, matches or acts automatically", () => {
    const events = Object.keys(EVENT_ROLE);
    expect(events.length, "the event list must be readable").toBeGreaterThan(20);
    expect(
      events.filter((type) => /(^|_)(AUTO|SUGGEST|SUGGESTED|RECOMMEND|RANK|BEST|MATCH|SCORE|EXPIRE)(_|$)/u.test(type)),
    ).toEqual([]);
  });

  it("no export is named for suggesting, recommending, scoring or auto-acting", () => {
    expect(
      hits(
        /export (async )?(function|const) (suggest|recommend|bestMatch|bestFit|autoPlace|autoAssign|autoRelease|autoExpire|riskScore|acuityScore|scorePatient|rankWard|rankPatient)\w*/iu,
      ),
    ).toEqual([]);
  });

  it("the backend's only timer re-checks phone alerts and never applies a command", () => {
    const server = readFileSync("backend/ward-flow/server.mjs", "utf8");
    const intervals = [...server.matchAll(/setInterval\(/gu)];
    expect(intervals.length).toBe(1);
    expect(blockFrom(server, "setInterval(")).toMatch(/sweepPush\(sharedStore\)/u);

    const store = readFileSync("backend/ward-flow/postgres.mjs", "utf8");
    expect(store).not.toMatch(/setInterval\(/u);
    const sweep = blockFrom(store, "async sweepPush() {");
    expect(sweep).not.toMatch(/applyCommand|UPDATE ward_flow\.workspaces|saveWorld|planSave/u);
    // The one place a command changes the shared world is the command path.
    expect([...store.matchAll(/engine\.applyCommand\(/gu)].length).toBe(1);
  });

  it("the backend sends no email, so no patient detail can leave by mail", () => {
    const manifest = JSON.parse(readFileSync("backend/ward-flow/package.json", "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const mailers = /mail|smtp|sendgrid|resend|postmark|mailgun|\bses\b/iu;
    expect(Object.keys(manifest.dependencies ?? {}).filter((name) => mailers.test(name))).toEqual([]);
    const backend = readdirSync("backend/ward-flow")
      .filter((name) => /\.(mjs|ts)$/u.test(name) && !/\.test(-support)?\.mjs$/u.test(name))
      .map((name) => join("backend/ward-flow", name));
    expect(hits(/nodemailer|createTransport\(|smtp:\/\/|sendMail\(/iu, backend)).toEqual([]);
  });
});
