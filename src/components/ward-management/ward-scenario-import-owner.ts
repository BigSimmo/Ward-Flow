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
  owner: { current: { world: { worldGeneration: number }; sequence: number; active: boolean } },
  isCurrent: () => boolean,
  // The board's day 0: the file's typed calendar days move onto it, as its timed records do (CC-4).
  boardDayZero?: Date,
) {
  const selected = ++sequence.current;
  // Newer work is a command dispatched after this import began, or a reset or replaced world. Adopting
  // the saved session, and settling a command dispatched before the import began, are not newer work.
  const startedCommand = owner.current.sequence;
  const startedGeneration = owner.current.world.worldGeneration;
  const current = () =>
    selected === sequence.current &&
    owner.current.active &&
    owner.current.sequence === startedCommand &&
    owner.current.world.worldGeneration === startedGeneration &&
    isCurrent();
  const obsolete = { ok: false as const, reason: "The demo changed while the file was loading. Nothing was loaded." };
  let source: string;
  try {
    source = await text;
  } catch {
    return { ok: false as const, reason: "That file could not be read, so nothing was loaded." };
  }
  if (!current()) return obsolete;
  const read = await readScenarioFileLater(source, boardDayZero);
  if (!read.ok) return read;
  if (read.now < NOW_ANCHOR + read.state.clockOffsetMinutes)
    return { ok: false as const, reason: "This scenario file is damaged or incomplete, so nothing was loaded." };
  return { ...read, isCurrent: current };
}
