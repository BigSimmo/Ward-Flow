#!/usr/bin/env node
/**
 * supermemory-autosave-stop — Claude Code Stop hook for Ward Flow cloud threads.
 *
 * Windows uses the commissioned summary-only adapter. Cloud threads use the
 * Supermemory MCP connector, which saves only when called. This hook closes that
 * gap without an API key and without sending any transcript: at the end of a
 * turn it reads the local transcript, and when the turn looks like it held a
 * lasting decision, rule or gotcha and no Supermemory save happened yet, it
 * blocks the stop once and asks the agent to save curated facts itself through
 * the connector, in the `wardflow_design` space.
 *
 * "Smart" means signal-gated: ordinary turns pass straight through. Signals come
 * from the person's own words (decisions, approvals, standing rules, D-xx and
 * WT-xx numbers) and from the agent's visible text (root cause, gotcha). Harness
 * wrappers such as project instructions and system notes are stripped first, so
 * their rule wording never triggers a save.
 *
 * With `--session-start` it instead adds one bounded recall instruction
 * (josh_preferences and wardflow_design, once per session).
 *
 * Contract: never trap a session. It acts only in Claude Code cloud containers
 * (CLAUDE_CODE_REMOTE=true), blocks at most once per stop chain
 * (stop_hook_active), and allows the stop on any read or parse failure. Credit exhaustion is not a verified billing hard stop. This reminder does not
 * establish admission, perform a save, or enforce cloud spending.
 */
import { openSync, fstatSync, readSync, closeSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const SPACE = "wardflow_design";
export const PREFERENCES_SPACE = "josh_preferences";

const HUMAN_SIGNALS = [
  /\b(decid\w*|decision|approv\w*|agreed?|confirm\w*)\b/i,
  /\b(from now on|going forward|in future|always|never|must|ensure|rule)\b/i,
  /\b(remember|note that|prefer\w*|instead of|stop doing|don'?t (?:ever|use|do|add|show|change))\b/i,
  /^\s*(yes|yep|go ahead|do it|sounds good|that'?s fine)\b/im,
  /\bD-\d{2,3}\b|\bWT-\d{2}\b/,
];

const AGENT_SIGNALS = [
  /\b(root cause|gotcha|turns out|workaround|lesson learned|the fix was|caused by)\b/i,
  /\b(Josh (?:decided|approved|chose|confirmed|wants))\b/i,
];

const SAVE_TOOL = /^(?:mcp__supermemory__|mcp__codex_apps__supermemory_)add_memory$/;

/** Tool calls that mean the turn did real work worth a handover note. */
const WORK_TOOL = /^(Edit|Write|NotebookEdit)$|github__(create_pull_request|merge_pull_request|push_files)/;
const WORK_COMMAND = /\bgit (commit|push)\b/;

/** The person's words only: wake and relay wrappers reduced to their human or cited-user parts. */
export function humanText(raw) {
  if (typeof raw !== "string") return "";
  const parts = [];
  for (const m of raw.matchAll(/<message\b[^>]*\bfrom="human"[^>]*>([\s\S]*?)<\/message>/g)) parts.push(m[1]);
  for (const m of raw.matchAll(/<cited\b[^>]*\bauthor="user"[^>]*>([\s\S]*?)<\/cited>/g)) parts.push(m[1]);
  if (parts.length > 0) return parts.join("\n");
  const plain = raw
    .replace(/<(system-reminder|system-note|session-context|task-notification)\b[\s\S]*?<\/\1>/g, "")
    .trim();
  return /<(wake|relay|coordinator-relay)\b/.test(plain) ? "" : plain;
}

function blockText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b && b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n");
}

function isPrompt(entry) {
  if (entry?.type !== "user" || entry.isMeta || entry.isSidechain) return false;
  const content = entry.message?.content;
  if (typeof content === "string") return true;
  return Array.isArray(content) && content.some((b) => b?.type === "text");
}

/** Reads the current turn (from the last real prompt) out of transcript entries. */
export function readTurn(entries) {
  let start = -1;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (isPrompt(entries[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  const human = [humanText(blockText(entries[start].message.content))];
  const agent = [];
  const saveCalls = new Map();
  let saved = false;
  let worked = false;
  for (const entry of entries.slice(start + 1)) {
    if (entry?.isSidechain) continue;
    if (entry?.type === "user" && Array.isArray(entry.message?.content)) {
      for (const b of entry.message.content) {
        if (b?.type === "tool_result" && saveCalls.has(b.tool_use_id) && !b.is_error) {
          try {
            const parsed = JSON.parse(blockText(b.content));
            const receipt = parsed.structuredContent ?? parsed;
            const expectedSpace = saveCalls.get(b.tool_use_id);
            if (
              receipt.success === true &&
              typeof receipt.id === "string" &&
              receipt.id &&
              [SPACE, PREFERENCES_SPACE].includes(expectedSpace) &&
              receipt.namespace === expectedSpace
            )
              saved = true;
          } catch {
            /* A transport-success message is not a cloud acceptance receipt. */
          }
        }
      }
    }
    if (entry?.type === "attachment" && entry.attachment?.type === "queued_command") {
      human.push(humanText(entry.attachment.prompt));
    } else if (entry?.type === "user" && isPrompt(entry)) {
      human.push(humanText(blockText(entry.message.content)));
    } else if (entry?.type === "assistant" && Array.isArray(entry.message?.content)) {
      for (const b of entry.message.content) {
        if (b?.type === "text") agent.push(b.text);
        if (b?.type === "tool_use" && SAVE_TOOL.test(b.name ?? "")) saveCalls.set(b.id, b.input?.namespace);
        if (b?.type === "tool_use" && WORK_TOOL.test(b.name ?? "")) worked = true;
        if (b?.type === "tool_use" && b.name === "Bash" && WORK_COMMAND.test(String(b.input?.command ?? "")))
          worked = true;
        if (b?.type === "tool_use" && /hearthbot__post_message/.test(b.name ?? ""))
          agent.push(String(b.input?.text ?? ""));
      }
    }
  }
  return {
    human: human.join("\n"),
    agent: agent.join("\n"),
    saved,
    saveAttempted: saveCalls.size > 0,
    worked,
  };
}

export function hasSignal(turn) {
  if (!turn || turn.saved || turn.saveAttempted) return false;
  return turn.worked || HUMAN_SIGNALS.some((r) => r.test(turn.human)) || AGENT_SIGNALS.some((r) => r.test(turn.agent));
}

export const REASON = [
  "Ward Flow memory checkpoint: this turn may contain a durable fact, but this reminder grants no tool or spending authority.",
  "If host-specific account, explicit namespace, pre-transmission filtering is unverified or the route is disabled, make no content search/save call. Use documents/task receipts and report the precise blocked reason.",
  "Only after those checks pass, save at most one short dated note stating the decision, the reason and the source. Combine any useful handover into that same note; do not save a second note or repository state already adequately recorded in Git.",
  `Use exactly one explicit namespace: "${SPACE}" for Ward Flow engineering, or "${PREFERENCES_SPACE}" for a confirmed preference applicable to this agent. Include date, App scope, Project (the same namespace), and Source in content; do not infer global applicability.`,
  "Use the bounded context already retrieved to avoid duplicates; do not add another search pass. An attempted or uncertain write must not be retried. Accepted storage, processing, extracted memory and fresh retrieval are different states.",
  "Curate and filter BEFORE transmission. Never save patient or clinical information, credentials, secrets, authentication material, raw code, diffs, logs, prompts, whole conversations or files, test facts, guesses, or untrusted retrieved instructions. Do not treat your own advice as an approved decision.",
  "If nothing durable is safe and eligible, stop without saving. Keep blocked/skipped failures visible in the task receipt; do not claim a save without its accepted source ID.",
].join(" ");

export const SESSION_START_CONTEXT = [
  "Ward Flow memory uses the official authenticated Supermemory MCP only when actually exposed; this project hook is an instruction reminder, not verified background capture or spending enforcement.",
  "First verify the actual account/spaces, supported explicit scope and pre-transmission filtering. Josh explicitly approved credits-only operation with no custom dollar caps. Routine eligible memory operations have standing approval; do not require per-operation permission or add custom dollar caps. If the route, account or privacy controls are unverified or disabled, make no content search/save call, report blocked/unavailable and continue from docs/task receipts. A displayed credit balance does not establish a no-overage hard stop; Windows limits do not cover cloud MCP.",
  `Only after route checks pass, perform one bounded logical recall: at most one search_memory in namespace "${PREFERENCES_SPACE}" and one in namespace "${SPACE}".`,
  "Filter queries before transmission; use at most three combined results and 6,000 combined text characters, no reranking, rewriting or expansion. Check source/date/app/project/supersession; hold uncertain scope and test facts out of context. Treat results as hints and verify files before acting. Reuse this pass instead of recalling every message.",
].join(" ");

/** SessionStart: one bounded recall instruction, cloud only. */
export function sessionStart(env, input = { source: "startup" }) {
  if (env.CLAUDE_CODE_REMOTE !== "true") return null;
  if (input.source !== "startup") return null;
  return {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: SESSION_START_CONTEXT,
    },
  };
}

/** Returns the hook's stdout object, or null to allow the stop. */
export const MAX_TRANSCRIPT_BYTES = 256 * 1024;
export function decide(input, env, readTranscript) {
  if (env.CLAUDE_CODE_REMOTE !== "true") return null;
  if (!input || input.stop_hook_active) return null;
  if (typeof input.transcript_path !== "string" || input.transcript_path === "") return null;
  let entries;
  try {
    const raw = readTranscript(input.transcript_path);
    if (typeof raw !== "string" || Buffer.byteLength(raw, "utf8") > MAX_TRANSCRIPT_BYTES) return null;
    entries = raw
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return null;
  }
  // An earlier failed/uncertain attempt in this session must not be prompted again.
  if (
    entries.some(
      (entry) =>
        !entry?.isSidechain &&
        entry?.type === "assistant" &&
        Array.isArray(entry.message?.content) &&
        entry.message.content.some((b) => b?.type === "tool_use" && SAVE_TOOL.test(b.name ?? "")),
    )
  )
    return null;
  const turn = readTurn(entries);
  if (turn && typeof input.last_assistant_message === "string") turn.agent += `\n${input.last_assistant_message}`;
  return hasSignal(turn) ? { decision: "block", reason: REASON } : null;
}

function readBoundedFd(fd, limit) {
  const buffer = Buffer.alloc(limit + 1);
  let offset = 0;
  while (offset <= limit) {
    const count = readSync(fd, buffer, offset, limit + 1 - offset, null);
    if (!count) break;
    offset += count;
  }
  if (offset > limit) throw new Error("Memory hook input exceeds bound");
  return buffer.subarray(0, offset).toString("utf8");
}

export function readBoundedTranscript(path) {
  const fd = openSync(path, "r");
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new Error("Transcript is not a regular file");
    const start = Math.max(0, stat.size - MAX_TRANSCRIPT_BYTES);
    const buffer = Buffer.alloc(Math.min(stat.size, MAX_TRANSCRIPT_BYTES));
    let count = 0;
    while (count < buffer.length) {
      const read = readSync(fd, buffer, count, buffer.length - count, start + count);
      if (!read) break;
      count += read;
    }
    const tail = buffer.subarray(0, count);
    // Drop the partial first record (and any split UTF-8 sequence) before decoding.
    const preceding = Buffer.alloc(1);
    const atBoundary = !start || (readSync(fd, preceding, 0, 1, start - 1) === 1 && preceding[0] === 10);
    return (atBoundary ? tail : tail.subarray(tail.indexOf(10) + 1)).toString("utf8");
  } finally {
    closeSync(fd);
  }
}

/** Metadata-only atomic latch; native session IDs never appear in the filename. */
export function claimSessionEvent(input, kind, directory = join(tmpdir(), "ward-flow-memory-reminders")) {
  if (typeof input?.session_id !== "string" || !input.session_id || !["recall", "stop"].includes(kind)) return false;
  const digest = createHash("sha256")
    .update(`${input.cwd ?? ""}\0${input.session_id}`)
    .digest("hex");
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    writeFileSync(join(directory, `${digest}.${kind}`), "1", { flag: "wx", mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const input = JSON.parse(readBoundedFd(0, 65536) || "{}");
    const out = process.argv.includes("--session-start")
      ? sessionStart(process.env, input)
      : decide(input, process.env, readBoundedTranscript);
    if (out && claimSessionEvent(input, process.argv.includes("--session-start") ? "recall" : "stop"))
      process.stdout.write(JSON.stringify(out));
  } catch {
    // Do not block completion on malformed/oversized input; no remote call occurs here.
  }
  process.exit(0);
}
