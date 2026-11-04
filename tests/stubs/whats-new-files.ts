import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { WhatsNewEntry, WhatsNewFile } from "@/components/ward-management/help/whats-new-list";

/** Vitest stand-in for the bundler's `require.context`: the same folder, read from disk. */
const folder = path.resolve(import.meta.dirname, "../../src/components/ward-management/help/whats-new");

export const WHATS_NEW_FILES: readonly WhatsNewFile[] = readdirSync(folder)
  .filter((name) => name.endsWith(".json"))
  .map((name) => ({ name, entry: JSON.parse(readFileSync(path.join(folder, name), "utf8")) as WhatsNewEntry }));
