import { CLINICAL_VALUES } from "../ward-clinical-values";
import type { ReleasedCount } from "./executive-statistics-contract";
import { smallNumberParts, SMALL_NUMBER_NOT_SHOWN } from "../ward-access-scope-records";

/** Private release keys name measures, never subjects. They are not part of the wire contract. */
export type ReportingCount = { readonly reportingCount: string };
type Cell = { value: number; shown: boolean; priority: number; minimum: number; maximum: number };
type Equation = Map<string, number>;
type IntegerWitness = Map<string, number>;
const EPSILON = 1e-8;

function reduce(row: Equation, basis: Map<string, Equation>): Equation {
  const result = new Map(row);
  const pending = [...result.keys()];
  for (let index = 0; index < pending.length; index++) {
    const pivot = pending[index]!;
    const known = basis.get(pivot);
    if (!known) continue;
    const factor = result.get(pivot) ?? 0;
    if (Math.abs(factor) < EPSILON) continue;
    for (const [key, value] of known) {
      const next = (result.get(key) ?? 0) - factor * value;
      if (Math.abs(next) < EPSILON) result.delete(key);
      else {
        if (!result.has(key)) pending.push(key);
        result.set(key, next);
      }
    }
  }
  return result;
}

function insert(row: Equation, basis: Map<string, Equation>): string | null {
  const reduced = reduce(row, basis);
  const first = reduced.entries().next().value as [string, number] | undefined;
  if (!first) return null;
  const [pivot, scale] = first;
  basis.set(pivot, new Map([...reduced].map(([key, value]) => [key, value / scale])));
  return pivot;
}

/**
 * One release decision for the complete supplied bundle. Relationships are explicit, checked
 * against the private measurements and never inferred from equal numeric values. Genuine
 * partitions and subset complements are equations; urgent and unplaced are separate subsets.
 *
 * Candidates retain insertion/priority order. An additional exact value is refused if it makes
 * any small cell (including an unshown complement) exactly recoverable through the registered
 * equations/tag bounds. Every accepted bundle also requires a checked integer alternative for
 * every protected cell; approximate propagation and a floating search basis never approve it.
 * This is current-bundle complementary protection, not a promise against temporal observations,
 * the approved exact-bed exception or external knowledge.
 */
export class ExecutiveCountRelease {
  private readonly cells = new Map<string, Cell>();
  private readonly equations: Equation[] = [];
  private readonly equationLinks = new Map<string, number[]>();
  private readonly partitions: { total: string; parts: string[] }[] = [];
  private readonly components = new Map<string, ReadonlySet<string>>();
  private readonly equationProofs = new Map<string, boolean>();
  private resolved: Map<string, ReleasedCount> | null = null;
  readonly threshold = CLINICAL_VALUES.smallNumberHidden.value;

  count(key: string, value: number, priority = 10): ReportingCount {
    if (this.resolved) throw new Error("Reporting release is already final.");
    if (!key || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid reporting measure.");
    const previous = this.cells.get(key);
    if (previous && previous.value !== value) throw new Error(`Conflicting reporting measure: ${key}`);
    this.cells.set(key, {
      value,
      shown: true,
      priority: Math.min(previous?.priority ?? priority, priority),
      minimum: previous?.minimum ?? 0,
      maximum: previous?.maximum ?? Number.MAX_SAFE_INTEGER,
    });
    return { reportingCount: key };
  }

  partition(total: ReportingCount, parts: readonly ReportingCount[]): void {
    if (this.resolved) throw new Error("Reporting release is already final.");
    const row: Equation = new Map([[total.reportingCount, 1]]);
    for (const part of parts) row.set(part.reportingCount, (row.get(part.reportingCount) ?? 0) - 1);
    this.addEquation(row);
    this.partitions.push({ total: total.reportingCount, parts: parts.map((part) => part.reportingCount) });
  }

  subset(total: ReportingCount, part: ReportingCount): void {
    const parent = this.cell(total.reportingCount);
    const child = this.cell(part.reportingCount);
    const value = parent.value - child.value;
    if (value < 0) throw new Error("Reporting subset exceeds its population.");
    const key = `complement:${total.reportingCount}:${part.reportingCount}`;
    if (!this.cells.has(key))
      this.cells.set(key, { value, shown: false, priority: Infinity, minimum: 0, maximum: Number.MAX_SAFE_INTEGER });
    this.partition(total, [part, { reportingCount: key }]);
  }

  sum(key: string, parts: readonly ReportingCount[], priority = 10): ReportingCount {
    const total = this.count(
      key,
      parts.reduce((value, part) => value + this.cell(part.reportingCount).value, 0),
      priority,
    );
    this.partition(total, parts);
    return total;
  }

  /** Bounds already observable from an unchanged selector's published/absent measure. */
  bounds(token: ReportingCount, minimum: number, maximum = Number.MAX_SAFE_INTEGER): void {
    if (this.resolved) throw new Error("Reporting release is already final.");
    if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || minimum < 0 || maximum < minimum)
      throw new Error("Invalid reporting observable bounds.");
    const cell = this.cell(token.reportingCount);
    cell.minimum = Math.max(cell.minimum, minimum);
    cell.maximum = Math.min(cell.maximum, maximum);
    if (cell.value < cell.minimum || cell.value > cell.maximum)
      throw new Error("Reporting observable bounds disagree with the selector.");
  }

  private cell(key: string): Cell {
    const cell = this.cells.get(key);
    if (!cell) throw new Error("Unknown reporting measure.");
    return cell;
  }

  private addEquation(row: Equation): void {
    for (const [key, coefficient] of row) if (coefficient === 0) row.delete(key);
    const actual = [...row].reduce(
      (sum, [key, coefficient]) => sum + BigInt(this.cell(key).value) * BigInt(coefficient),
      0n,
    );
    if (actual !== 0n) throw new Error("Reporting relationship does not match its measured population.");
    if (row.size) {
      this.equationProofs.clear();
      const index = this.equations.length;
      this.equations.push(row);
      for (const key of row.keys()) this.equationLinks.set(key, [...(this.equationLinks.get(key) ?? []), index]);
    }
  }

  private rangesExposeSmall(exact: ReadonlySet<string>, withheld: ReadonlySet<string>): Set<string> {
    const ranges = new Map<string, [number, number]>();
    for (const [key, cell] of this.cells) {
      const small = cell.value > 0 && cell.value < this.threshold;
      // Existing smallNumberParts can promote small values to not-shown for complementary
      // protection. A withheld tag therefore honestly covers any positive count. Only a
      // retained small tag says 1..threshold-1. Unshown internal complements say nothing.
      const range: [number, number] = exact.has(key)
        ? [cell.value, cell.value]
        : cell.shown
          ? [cell.value === 0 ? 0 : 1, small && !withheld.has(key) ? this.threshold - 1 : Infinity]
          : [0, Infinity];
      ranges.set(key, [Math.max(range[0], cell.minimum), Math.min(range[1], cell.maximum)]);
    }
    // The equations and initial ranges are unchanged. Revisit an equation only when one of
    // its inputs tightened, rather than scanning the complete bundle on every propagation pass.
    const pending = this.equations.map((_, index) => index);
    const queued = new Uint8Array(this.equations.length).fill(1);
    const maximumVisits = (this.cells.size * 2 + 1) * Math.max(1, this.equations.length);
    for (let cursor = 0; cursor < pending.length; cursor++) {
      if (cursor >= maximumVisits) throw new Error("Reporting release propagation exceeded its bound.");
      const index = pending[cursor]!;
      queued[index] = 0;
      const equation = this.equations[index]!;
      for (const [key, coefficient] of equation) {
        let low = 0;
        let high = 0;
        for (const [other, factor] of equation) {
          if (other === key) continue;
          const [minimum, maximum] = ranges.get(other)!;
          low += factor > 0 ? factor * minimum : factor * maximum;
          high += factor > 0 ? factor * maximum : factor * minimum;
        }
        const old = ranges.get(key)!;
        const proposedLow = coefficient > 0 ? -high / coefficient : -low / coefficient;
        const proposedHigh = coefficient > 0 ? -low / coefficient : -high / coefficient;
        const next: [number, number] = [
          Math.max(old[0], Math.ceil(proposedLow - EPSILON)),
          Math.min(old[1], Math.floor(proposedHigh + EPSILON)),
        ];
        if (next[0] !== old[0] || next[1] !== old[1]) {
          ranges.set(key, next);
          for (const affected of this.equationLinks.get(key) ?? [])
            if (!queued[affected]) {
              pending.push(affected);
              queued[affected] = 1;
            }
          const cell = this.cell(key);
          if (cell.value > 0 && cell.value < this.threshold && next[0] === next[1]) return new Set([key]);
        }
      }
    }
    return new Set();
  }

  private component(key: string): ReadonlySet<string> {
    const cached = this.components.get(key);
    if (cached) return cached;
    const connected = new Set([key]);
    const pending = [key];
    for (let cursor = 0; cursor < pending.length; cursor++)
      for (const index of this.equationLinks.get(pending[cursor]!) ?? []) {
        for (const other of this.equations[index]!.keys())
          if (!connected.has(other)) {
            connected.add(other);
            pending.push(other);
          }
      }
    for (const member of connected) this.components.set(member, connected);
    return connected;
  }

  /** A witness is a private INTEGER change from the actual assignment, never a wire value.
   * Verify original equations independently of the floating-point search basis. Search failure
   * cannot approve a release; it only causes further protection or refusal of an exact candidate. */
  private validWitness(delta: IntegerWitness, exact: ReadonlySet<string>, withheld: ReadonlySet<string>): boolean {
    for (const [key, change] of delta) {
      if (!Number.isSafeInteger(change)) return false;
      const cell = this.cell(key);
      const alternative = cell.value + change;
      if (
        !Number.isSafeInteger(alternative) ||
        alternative < cell.minimum ||
        alternative > cell.maximum ||
        (exact.has(key) && change !== 0)
      )
        return false;
      if (cell.shown && !exact.has(key)) {
        if (alternative < 1) return false;
        if (cell.value < this.threshold && !withheld.has(key) && alternative >= this.threshold) return false;
      }
    }
    for (const key of exact) if ((delta.get(key) ?? 0) !== 0) return false;
    // Only the homogeneous equation certificate is reusable. Tag/bound checks and every
    // current exact constraint above run on EVERY call. Equations invalidate this cache.
    const certificate = JSON.stringify(
      [...delta].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
    );
    const cached = this.equationProofs.get(certificate);
    if (cached !== undefined) return cached;
    for (const equation of this.equations) {
      let changed = 0n;
      for (const [key, coefficient] of equation) {
        const value = delta.get(key) ?? 0;
        if (value !== 0) changed += BigInt(coefficient) * BigInt(value);
      }
      if (changed !== 0n) {
        if (this.equationProofs.size < 4096) this.equationProofs.set(certificate, false);
        return false;
      }
    }
    if (this.equationProofs.size < 4096) this.equationProofs.set(certificate, true);
    return true;
  }

  private alternateWitnesses(
    protectedKeys: readonly string[],
    exact: ReadonlySet<string>,
    basis: Map<string, Equation>,
    withheld: ReadonlySet<string>,
    previous: ReadonlyMap<string, IntegerWitness>,
    addedExact?: string,
  ) {
    const witnesses = new Map<string, IntegerWitness>();
    const missing = new Set(protectedKeys);
    // Equations/actual values/tag domains are unchanged, or widened during baseline fallback.
    // A previously checked alternative remains valid iff the new exact cell does not change.
    for (const [key, witness] of previous)
      if (!addedExact || (witness.get(addedExact) ?? 0) === 0) {
        witnesses.set(key, witness);
        missing.delete(key);
      }
    const cover = (delta: IntegerWitness) => {
      for (const [key, change] of delta)
        if (change !== 0 && missing.has(key)) {
          witnesses.set(key, delta);
          missing.delete(key);
        }
    };
    const tryDirection = (direction: ReadonlyMap<string, number>): boolean => {
      if (![...direction].some(([key, change]) => missing.has(key) && Math.abs(change) > EPSILON)) return false;
      for (let scale = 1; scale <= 8; scale++)
        for (const sign of [1, -1]) {
          const delta: IntegerWitness = new Map();
          let integer = true;
          for (const [key, value] of direction) {
            const scaled = value * scale * sign;
            const rounded = Math.round(scaled);
            if (!Number.isSafeInteger(rounded) || Math.abs(scaled - rounded) > EPSILON) {
              integer = false;
              break;
            }
            if (rounded !== 0) delta.set(key, rounded);
          }
          if (integer && this.validWitness(delta, exact, withheld)) {
            cover(delta);
            return true;
          }
        }
      return false;
    };
    // Unconnected measures and components with no fixed positive count have cheap exact
    // alternatives. Doubling a component respects homogeneous equations and exact zeroes;
    // it is accepted only when all emitted tag bounds also pass the independent check above.
    const visited = new Set<ReadonlySet<string>>();
    for (const key of [...missing]) {
      const component = this.component(key);
      if (visited.has(component)) continue;
      visited.add(component);
      if (component.size === 1) {
        tryDirection(new Map([[key, 1]]));
        continue;
      }
      if (![...component].some((member) => exact.has(member) && this.cell(member).value > 0)) {
        tryDirection(
          new Map(
            [...component]
              .filter((member) => this.cell(member).value !== 0)
              .map((member) => [member, this.cell(member).value]),
          ),
        );
      }
    }
    if (!missing.size) return { witnesses, missing };
    const rows = [...basis];
    const dependents = new Map<string, number[]>();
    rows.forEach(([pivot, row], index) => {
      for (const key of row.keys()) if (key !== pivot) dependents.set(key, [...(dependents.get(key) ?? []), index]);
    });
    const relevant = new Set([...missing].map((key) => this.component(key)));
    const free = [...new Set([...missing, ...this.cells.keys()])].filter(
      (key) => !basis.has(key) && relevant.has(this.component(key)),
    );
    // Finite search, shared across every protected key. Failure simply refuses that candidate.
    for (const freeKey of free.slice(0, 1024)) {
      const affected = new Set<number>();
      const pending = [freeKey];
      for (let cursor = 0; cursor < pending.length; cursor++)
        for (const index of dependents.get(pending[cursor]!) ?? []) {
          if (!affected.has(index)) {
            affected.add(index);
            pending.push(rows[index]![0]);
          }
        }
      const direction = new Map<string, number>([[freeKey, 1]]);
      for (const index of [...affected].sort((left, right) => right - left)) {
        const [pivot, row] = rows[index]!;
        let value = 0;
        for (const [key, coefficient] of row) if (key !== pivot) value -= coefficient * (direction.get(key) ?? 0);
        if (Math.abs(value) > EPSILON) direction.set(pivot, value);
      }
      tryDirection(direction);
      if (!missing.size) break;
    }
    return { witnesses, missing };
  }

  finish(): ReadonlyMap<string, ReleasedCount> {
    if (this.resolved) return this.resolved;
    const protectedKeys = [...this.cells]
      .filter(([, cell]) => cell.value > 0 && cell.value < this.threshold)
      .map(([key]) => key);
    const basis = new Map<string, Equation>();
    for (const equation of this.equations) insert(equation, basis);
    const exact = new Set<string>();
    for (const [key, cell] of this.cells)
      if (cell.shown && cell.value === 0) {
        insert(new Map([[key, 1]]), basis);
        exact.add(key);
      }
    const withheld = new Set<string>();
    const aliases = new Map<string, Set<string>>();
    for (const partition of this.partitions)
      if (partition.parts.length === 1) {
        const left = partition.total;
        const right = partition.parts[0]!;
        const group = new Set([...(aliases.get(left) ?? [left]), ...(aliases.get(right) ?? [right])]);
        for (const key of group) aliases.set(key, group);
      }
    const propagateWithheld = () => {
      for (const key of withheld) for (const alias of aliases.get(key) ?? []) withheld.add(alias);
    };
    for (const partition of this.partitions) {
      if (!this.cell(partition.total).shown || partition.parts.some((key) => !this.cell(key).shown)) continue;
      const parts = smallNumberParts(partition.parts.map((key) => this.cell(key).value));
      parts.forEach((part, index) => {
        if (part === SMALL_NUMBER_NOT_SHOWN) withheld.add(partition.parts[index]!);
      });
    }
    propagateWithheld();
    // Tags alone can pin a small partition (for example four positive parts and a small total).
    // Before trying exact candidates, use the documented safe fallback on that connected
    // breakdown: stop saying its small cells are below the line. Semantic keys propagate it
    // everywhere, including alias equations and repeated weeks/pages.
    let verifiedWitnesses = new Map<string, IntegerWitness>();
    for (;;) {
      let missing = this.rangesExposeSmall(exact, withheld);
      if (!missing.size) {
        const proof = this.alternateWitnesses(protectedKeys, exact, basis, withheld, verifiedWitnesses);
        verifiedWitnesses = proof.witnesses;
        missing = proof.missing;
      }
      if (!missing.size) break;
      const connected = new Set([...missing].flatMap((key) => [...this.component(key)]));
      let changed = false;
      for (const key of connected) {
        const cell = this.cell(key);
        if (cell.shown && cell.value > 0 && cell.value < this.threshold && !withheld.has(key)) {
          withheld.add(key);
          changed = true;
        }
      }
      if (!changed) throw new Error("Reporting tags cannot be released safely.");
      propagateWithheld();
    }
    const candidates = [...this.cells]
      .filter(([key, cell]) => cell.shown && cell.value >= this.threshold && !withheld.has(key))
      .sort((a, b) => a[1].priority - b[1].priority);
    for (const [key] of candidates) {
      const pivot = insert(new Map([[key, 1]]), basis);
      exact.add(key);
      let exposed =
        protectedKeys.some((hidden) => reduce(new Map([[hidden, 1]]), basis).size === 0) ||
        this.rangesExposeSmall(exact, withheld).size > 0;
      if (!exposed) {
        const proof = this.alternateWitnesses(protectedKeys, exact, basis, withheld, verifiedWitnesses, key);
        exposed = proof.missing.size > 0;
        if (!exposed) verifiedWitnesses = proof.witnesses;
      }
      if (exposed) {
        exact.delete(key);
        if (pivot) basis.delete(pivot);
      }
    }
    if (protectedKeys.some((key) => !verifiedWitnesses.has(key)))
      throw new Error("Reporting release has an unproved protected count.");
    this.resolved = new Map(
      [...this.cells]
        .filter(([, cell]) => cell.shown)
        .map(([key, cell]) => [
          key,
          exact.has(key)
            ? { kind: "exact", value: cell.value }
            : cell.value < this.threshold && !withheld.has(key)
              ? { kind: "small" }
              : { kind: "withheld" },
        ]),
    );
    return this.resolved;
  }

  /** Resolve only explicit measure tokens; numeric beds/durations/public place counts survive. */
  resolve<T>(value: T): unknown {
    if (!this.resolved) {
      const emitted = new Set<string>();
      const collect = (item: unknown): void => {
        if (Array.isArray(item)) {
          item.forEach(collect);
          return;
        }
        if (!item || typeof item !== "object") return;
        if (Object.keys(item).length === 1 && "reportingCount" in item) {
          emitted.add((item as ReportingCount).reportingCount);
          return;
        }
        Object.values(item).forEach(collect);
      };
      collect(value);
      for (const [key, cell] of this.cells) cell.shown = cell.shown && emitted.has(key);
    }
    const counts = this.finish();
    const visit = (item: unknown): unknown => {
      if (Array.isArray(item)) return item.map(visit);
      if (!item || typeof item !== "object") return item;
      if (Object.keys(item).length === 1 && "reportingCount" in item) {
        const count = counts.get((item as ReportingCount).reportingCount);
        if (!count) throw new Error("Unknown released reporting measure.");
        return count;
      }
      return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, visit(child)]));
    };
    return visit(value);
  }
}
