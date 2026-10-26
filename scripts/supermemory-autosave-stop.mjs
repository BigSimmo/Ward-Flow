#!/usr/bin/env node
/**
 * supermemory-autosave-stop — Claude Code Stop hook for Ward Flow cloud threads.
 *
 * The Supermemory Claude Code plugin on Josh's PC auto-saves by posting each
 * session transcript to Supermemory with an API key. Cloud threads only have the
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
 * Contract: never trap a session. It acts only in Claude Code cloud containers
 * (CLAUDE_CODE_REMOTE=true), blocks at most once per stop chain
 * (stop_hook_active), and allows the stop on any read or parse failure.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const SPACE = "wardflow_design";

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

const SAVE_TOOL = /supermemory.*(add_memory|guided-save|upload-file)/i;

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
  const saveCalls = new Set();
  let saved = false;
  for (const entry of entries.slice(start + 1)) {
    if (entry?.isSidechain) continue;
    if (entry?.type === "user" && Array.isArray(entry.message?.content)) {
      for (const b of entry.message.content) {
        if (b?.type === "tool_result" && saveCalls.has(b.tool_use_id) && !b.is_error) saved = true;
      }
    }
    if (entry?.type === "attachment" && entry.attachment?.type === "queued_command") {
      human.push(humanText(entry.attachment.prompt));
    } else if (entry?.type === "user" && isPrompt(entry)) {
      human.push(humanText(blockText(entry.message.content)));
    } else if (entry?.type === "assistant" && Array.isArray(entry.message?.content)) {
      for (const b of entry.message.content) {
        if (b?.type === "text") agent.push(b.text);
        if (b?.type === "tool_use" && SAVE_TOOL.test(b.name ?? "")) saveCalls.add(b.id);
        if (b?.type === "tool_use" && /hearthbot__post_message/.test(b.name ?? ""))
          agent.push(String(b.input?.text ?? ""));
      }
    }
  }
  return { human: human.join("\n"), agent: agent.join("\n"), saved };
}

export function hasSignal(turn) {
  if (!turn || turn.saved) return false;
  return HUMAN_SIGNALS.some((r) => r.test(turn.human)) || AGENT_SIGNALS.some((r) => r.test(turn.agent));
}

export const REASON = [
  `Ward Flow memory check: this turn may hold something lasting. Before stopping, save each lasting fact from it to Supermemory with add_memory and namespace "${SPACE}" (never another space), one short memory per fact, tagged with its D-xx or WT number where there is one. Search "${SPACE}" first and skip anything already saved.`,
  "Save only: decisions Josh made, design and wording rules, gotchas from fixing bugs, and where key things live.",
  "Do not save: progress updates, PR status, code already in the repo, secrets, or any patient or real data.",
  "If nothing in this turn qualifies, stop without saving. Either way do not post another message to the person about this check.",
].join(" ");

/** Returns the hook's stdout object, or null to allow the stop. */
export function decide(input, env, readTranscript) {
  if (env.CLAUDE_CODE_REMOTE !== "true") return null;
  if (!input || input.stop_hook_active) return null;
  if (typeof input.transcript_path !== "string" || input.transcript_path === "") return null;
  let entries;
  try {
    entries = readTranscript(input.transcript_path)
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
  const turn = readTurn(entries);
  if (turn && typeof input.last_assistant_message === "string") turn.agent += `\n${input.last_assistant_message}`;
  return hasSignal(turn) ? { decision: "block", reason: REASON } : null;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const input = JSON.parse(readFileSync(0, "utf8") || "{}");
    const out = decide(input, process.env, (p) => readFileSync(p, "utf8"));
    if (out) process.stdout.write(JSON.stringify(out));
  } catch {
    // Never trap a session.
  }
  process.exit(0);
}
