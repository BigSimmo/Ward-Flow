import { NOW_ANCHOR } from "./ward-sites";
import { readScenarioFileLater } from "./ward-flow-demo-storage";

export type ScenarioFileLoader = (
  text: string | Promise<string>,
  isCurrent?: () => boolean,
) => Promise<{ ok: true } | { ok: false; reason: string }>;

/** Own both the browser file read and schema loading; an older import may never replace newer work. */
export async function readOwnedScenario(
  text: string | Promise<string>,
  sequence: { current: number },
  owner: { current: { world: object; active: boolean } },
  isCurrent: () => boolean,
) {
  const selected = ++sequence.current;
  const startedWorld = owner.current.world;
  const current = () =>
    selected === sequence.current && owner.current.active && owner.current.world === startedWorld && isCurrent();
  const obsolete = { ok: false as const, reason: "The demo changed while the file was loading. Nothing was loaded." };
  let source: string;
  try {
    source = await text;
  } catch {
    return { ok: false as const, reason: "That file could not be read, so nothing was loaded." };
  }
  if (!current()) return obsolete;
  const read = await readScenarioFileLater(source);
  if (!read.ok) return read;
  if (read.now < NOW_ANCHOR + read.state.clockOffsetMinutes)
    return { ok: false as const, reason: "This scenario file is damaged or incomplete, so nothing was loaded." };
  return { ...read, isCurrent: current };
}
