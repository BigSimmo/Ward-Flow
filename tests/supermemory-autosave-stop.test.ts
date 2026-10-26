import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  decide,
  humanText,
  PREFERENCES_SPACE,
  REASON,
  readTurn,
  readBoundedTranscript,
  claimSessionEvent,
  sessionStart,
  SPACE,
} from "../scripts/supermemory-autosave-stop.mjs";

/**
 * The cloud Supermemory save hook must nudge only on turns that look like they hold a lasting
 * fact, never on harness wrapper wording, never twice in one stop chain, never off the cloud,
 * and never after a save already happened in the turn.
 */

type Entry = Record<string, unknown>;

const prompt = (content: string): Entry => ({
  type: "user",
  message: { role: "user", content },
});
const toolResult = (isError = false, id = "t1"): Entry => ({
  type: "user",
  message: {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: id,
        content: "ok",
        is_error: isError,
      },
    ],
  },
});
const assistantText = (text: string): Entry => ({
  type: "assistant",
  message: { content: [{ type: "text", text }] },
});
const toolUse = (name: string, id = "t1"): Entry => ({
  type: "assistant",
  message: { content: [{ type: "tool_use", id, name, input: {} }] },
});
const wake = (text: string) =>
  `<wake reason="mention"><project id="p"><thread ts="t"><message trigger="true" from="human" trust="principal" author="Josh" id="m">${text}</message></thread></project><system-note>Thread state: rule never always</system-note></wake>`;

const cloud = { CLAUDE_CODE_REMOTE: "true" };

function run(entries: Entry[], env: Record<string, string> = cloud, extra: Record<string, unknown> = {}) {
  const jsonl = entries.map((e) => JSON.stringify(e)).join("\n");
  return decide({ transcript_path: "/t.jsonl", ...extra }, env, () => jsonl);
}

describe("supermemory autosave stop hook", () => {
  it("nudges when the person makes a decision", () => {
    const out = run([prompt(wake("Decision: held is only for a patient's own bed")), assistantText("Done.")]);
    expect(out).toEqual({ decision: "block", reason: REASON });
    expect(REASON).toContain(`"${SPACE}"`);
    expect(REASON).toContain(`"${PREFERENCES_SPACE}"`);
    expect(REASON).toMatch(/dated note stating the decision, the reason and the source/);
  });

  it("nudges on an agent-found root cause", () => {
    expect(
      run([prompt(wake("why does the board flicker?")), assistantText("The root cause is a stale memo.")]),
    ).not.toBeNull();
  });

  it("nudges for a handover when the turn changed files, committed or pushed", () => {
    expect(run([prompt(wake("tidy the header")), toolUse("Edit")])).not.toBeNull();
    const push: Entry = {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            id: "b1",
            name: "Bash",
            input: { command: "git push -u origin x" },
          },
        ],
      },
    };
    expect(run([prompt(wake("ship it later")), push])).not.toBeNull();
    expect(REASON).toMatch(/handover/);
  });

  it("passes an ordinary turn", () => {
    expect(run([prompt(wake("what time is the release?")), assistantText("6 am Perth.")])).toBeNull();
  });

  it("ignores rule wording that lives only in harness wrappers", () => {
    expect(humanText(wake("thanks"))).toBe("thanks");
    expect(run([prompt("<session-context>Always save. Never omit the rule.</session-context>")])).toBeNull();
  });

  it("passes once a Supermemory save already happened this turn", () => {
    const entries = [prompt(wake("we decided to keep Railway")), toolUse("mcp__supermemory__add_memory"), toolResult()];
    expect(run(entries)).toBeNull();
  });

  it("never prompts a retry when a save failed or delivery is uncertain", () => {
    const decision = wake("we decided to keep Railway");
    expect(run([prompt(decision), toolUse("mcp__supermemory__add_memory"), toolResult(true)])).toBeNull();
    expect(run([prompt(decision), toolUse("mcp__supermemory__add_memory")])).toBeNull();
  });

  it("asks for one bounded recall at session start, cloud only", () => {
    const out = sessionStart(cloud);
    expect(out?.hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(out?.hookSpecificOutput.additionalContext).toContain(`"${PREFERENCES_SPACE}"`);
    expect(out?.hookSpecificOutput.additionalContext).toContain(`"${SPACE}"`);
    expect(sessionStart({})).toBeNull();
  });

  it("only looks at the current turn", () => {
    const entries = [prompt(wake("we decided to keep Railway")), assistantText("ok"), prompt(wake("thanks"))];
    expect(run(entries)).toBeNull();
  });

  it("never blocks twice, off the cloud, or on an unreadable transcript", () => {
    const entries = [prompt(wake("from now on use full names"))];
    expect(run(entries, cloud, { stop_hook_active: true })).toBeNull();
    expect(run(entries, {})).toBeNull();
    expect(
      decide({ transcript_path: "/missing" }, cloud, () => {
        throw new Error("ENOENT");
      }),
    ).toBeNull();
  });
});

describe("cloud memory receipt and bounded-input regressions", () => {
  it("does not count a transport-success failure body as an accepted cloud save", () => {
    const attempted = toolUse("mcp__supermemory__add_memory");
    const failedBody = {
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "t1",
            content: JSON.stringify({ success: false }),
            is_error: false,
          },
        ],
      },
    };
    expect(readTurn([prompt("Decision: use the reviewed mockup."), attempted, failedBody])?.saved).toBe(false);
  });

  it("requires a source ID and the explicitly requested namespace for acceptance", () => {
    const attempted = {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "mcp__supermemory__add_memory",
            input: { namespace: SPACE },
          },
        ],
      },
    };
    const receipt = (namespace: string) => ({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "t1",
            content: JSON.stringify({
              success: true,
              id: "synthetic-source",
              namespace,
              status: "queued",
            }),
            is_error: false,
          },
        ],
      },
    });
    expect(readTurn([prompt("Decision: use the reviewed mockup."), attempted, receipt(SPACE)])?.saved).toBe(true);
    expect(readTurn([prompt("Decision: use the reviewed mockup."), attempted, receipt(PREFERENCES_SPACE)])?.saved).toBe(
      false,
    );
  });

  it("skips oversized transcript content without parsing or saving", () => {
    expect(run([prompt("Decision: use the reviewed mockup."), assistantText("x".repeat(300000))])).toBeNull();
  });
});

describe("session lifecycle regression fixes", () => {
  it("reads a bounded tail so a small new turn survives a large old transcript", () => {
    const dir = mkdtempSync(join(tmpdir(), "memory-tail-fixture-"));
    const path = join(dir, "synthetic.jsonl");
    const current = [prompt("Decision: keep the synthetic export label."), assistantText("Confirmed.")]
      .map((x) => JSON.stringify(x))
      .join("\n");
    writeFileSync(path, JSON.stringify(assistantText("x".repeat(300000))) + "\n" + current);
    const tail = readBoundedTranscript(path);
    expect(Buffer.byteLength(tail, "utf8")).toBeLessThanOrEqual(262144);
    expect(decide({ transcript_path: path }, cloud, () => tail)).not.toBeNull();
  });
  it("does not prompt again after an earlier uncertain session write", () => {
    expect(
      run([
        prompt("Decision: use the mockup."),
        toolUse("mcp__supermemory__add_memory"),
        prompt("Continue the same task."),
        toolUse("Edit"),
      ]),
    ).toBeNull();
  });
  it("does not repeat startup recall for resume or compaction", () => {
    expect(sessionStart(cloud, { source: "resume" })).toBeNull();
    expect(sessionStart(cloud, { source: "compact" })).toBeNull();
    expect(sessionStart(cloud, { source: "startup" })).not.toBeNull();
  });
  it("atomically grants only one reminder of each kind per native session", () => {
    const directory = mkdtempSync(join(tmpdir(), "memory-session-fixture-"));
    const input = { session_id: "synthetic-native-session", cwd: "synthetic-repository" };
    expect(claimSessionEvent(input, "stop", directory)).toBe(true);
    expect(claimSessionEvent(input, "stop", directory)).toBe(false);
    expect(claimSessionEvent(input, "recall", directory)).toBe(true);
    expect(claimSessionEvent({}, "stop", directory)).toBe(false);
  });
});

it("retains a complete prompt exactly at the bounded-tail boundary", () => {
  const dir = mkdtempSync(join(tmpdir(), "memory-boundary-fixture-"));
  const path = join(dir, "synthetic.jsonl");
  const promptLine = JSON.stringify(prompt("Decision: use the synthetic mockup.")) + "\n";
  const final = JSON.stringify(assistantText(""));
  const tail = promptLine + JSON.stringify(assistantText("x".repeat(262144 - Buffer.byteLength(promptLine + final))));
  expect(Buffer.byteLength(tail)).toBe(262144);
  writeFileSync(path, JSON.stringify(assistantText("old")) + "\n" + tail);
  expect(decide({ transcript_path: path }, cloud, readBoundedTranscript)).not.toBeNull();
});
