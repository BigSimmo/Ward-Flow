import { describe, expect, it } from "vitest";
import {
  decide,
  humanText,
  PREFERENCES_SPACE,
  REASON,
  SESSION_SAVE_CAP,
  sessionStart,
  SPACE,
} from "../scripts/supermemory-autosave-stop.mjs";

/**
 * The cloud Supermemory save hook must nudge only on turns that look like they hold a lasting
 * fact, never on harness wrapper wording, never twice in one stop chain, never off the cloud,
 * and never after a save already happened in the turn.
 */

type Entry = Record<string, unknown>;

const prompt = (content: string): Entry => ({ type: "user", message: { role: "user", content } });
const toolResult = (isError = false, id = "t1"): Entry => ({
  type: "user",
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: "ok", is_error: isError }] },
});
const assistantText = (text: string): Entry => ({ type: "assistant", message: { content: [{ type: "text", text }] } });
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

  it("still nudges when the save call failed or has no result yet", () => {
    const decision = wake("we decided to keep Railway");
    expect(run([prompt(decision), toolUse("mcp__supermemory__add_memory"), toolResult(true)])).not.toBeNull();
    expect(run([prompt(decision), toolUse("mcp__supermemory__add_memory")])).not.toBeNull();
  });

  it("stops asking once the session reached its save cap", () => {
    const earlier = Array.from({ length: SESSION_SAVE_CAP }, (_, i) => [
      toolUse("mcp__supermemory__add_memory", `s${i}`),
      toolResult(false, `s${i}`),
    ]).flat();
    expect(run([prompt(wake("ok")), ...earlier, prompt(wake("we decided to keep Railway"))])).toBeNull();
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
