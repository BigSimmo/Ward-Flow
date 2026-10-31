import { describe, expect, it } from "vitest";
import { ExecutiveCountRelease } from "../src/components/ward-management/statistics/executive-statistics-release";
import type { ReleasedCount } from "../src/components/ward-management/statistics/executive-statistics-contract";

describe("one executive release decision across the supplied bundle", () => {
  it.each([0, 1, 4, 5, 12])("retains the existing threshold at %i", (value) => {
    const release = new ExecutiveCountRelease();
    const token = release.count("measure", value);
    expect(release.resolve(token)).toEqual(value === 0 || value >= 5 ? { kind: "exact", value } : { kind: "small" });
  });

  it("releases eight but protects the six complement of a small two", () => {
    const release = new ExecutiveCountRelease();
    const total = release.count("total", 8, 0);
    const small = release.count("part:small", 2);
    const large = release.count("part:large", 6);
    release.partition(total, [small, large]);
    expect(release.resolve({ total, small, large })).toEqual({
      total: { kind: "exact", value: 8 },
      small: { kind: "small" },
      large: { kind: "withheld" },
    });
  });

  it("protects unshown small residuals and keeps an unrelated safe count exact", () => {
    const release = new ExecutiveCountRelease();
    const total = release.count("population", 7, 0);
    const subset = release.count("measured", 6);
    release.subset(total, subset);
    const independent = release.count("unrelated", 20);
    expect(release.resolve({ total, subset, independent })).toEqual({
      total: { kind: "exact", value: 7 },
      subset: { kind: "withheld" },
      independent: { kind: "exact", value: 20 },
    });
  });

  it("does not expose one through six = one + five when complementary promotion changes the tags", () => {
    const release = new ExecutiveCountRelease();
    const total = release.count("total", 6, 0);
    const small = release.count("small", 1);
    const large = release.count("large", 5);
    release.partition(total, [small, large]);
    const shown = release.resolve({ total, small, large }) as Record<string, ReleasedCount>;
    const fits = (value: number, figure: ReleasedCount) =>
      figure.kind === "exact"
        ? value === figure.value
        : figure.kind === "small"
          ? value >= 1 && value <= 4
          : value >= 1;
    const alternatives = new Set<number>();
    for (let left = 0; left <= 20; left++)
      for (let right = 0; right <= 20; right++) {
        if (fits(left, shown.small!) && fits(right, shown.large!) && fits(left + right, shown.total!))
          alternatives.add(left);
      }
    expect(alternatives.has(1)).toBe(true);
    expect(alternatives.size).toBeGreaterThan(1);
    expect(shown.small).toEqual({ kind: "withheld" });
  });

  it("uses existing not-shown promotion when small parts would be pinned at their upper endpoint", () => {
    const release = new ExecutiveCountRelease();
    const total = release.count("total", 8, 0);
    const left = release.count("left", 4);
    const right = release.count("right", 4);
    release.partition(total, [left, right]);
    expect(release.resolve({ total, left, right })).toEqual({
      total: { kind: "exact", value: 8 },
      left: { kind: "withheld" },
      right: { kind: "withheld" },
    });
  });

  it("propagates complementary small-tag promotion through an explicitly repeated semantic cell", () => {
    const release = new ExecutiveCountRelease();
    const total = release.count("total", 8, 0);
    const left = release.count("left", 4);
    const right = release.count("right", 4);
    const detailLeft = release.count("detail:left", 4);
    release.partition(total, [left, right]);
    release.partition(detailLeft, [left]);
    expect(release.resolve({ total, left, right, detailLeft })).toEqual({
      total: { kind: "exact", value: 8 },
      left: { kind: "withheld" },
      right: { kind: "withheld" },
      detailLeft: { kind: "withheld" },
    });
  });

  it("reuses a semantic decision on every page instead of comparing coincidentally equal values", () => {
    const release = new ExecutiveCountRelease();
    const network = release.count("shared:waiting", 12);
    const detail = release.count("shared:waiting", 12);
    const different = release.count("different:waiting", 12);
    expect(release.resolve({ network, detail, different })).toEqual({
      network: { kind: "exact", value: 12 },
      detail: { kind: "exact", value: 12 },
      different: { kind: "exact", value: 12 },
    });
    expect(() => new ExecutiveCountRelease().count("invalid", -1)).toThrow();
    const conflicting = new ExecutiveCountRelease();
    conflicting.count("same", 12);
    expect(() => conflicting.count("same", 13)).toThrow(/Conflicting/);
  });

  it("keeps a protected matrix cell ambiguous after both margins and all other released cells", () => {
    const release = new ExecutiveCountRelease();
    const all = release.count("all", 20, 0);
    const rowA = release.count("row:a", 8, 1);
    const rowB = release.count("row:b", 12, 1);
    const colA = release.count("col:a", 8, 1);
    const colB = release.count("col:b", 12, 1);
    const cells = [release.count("a:a", 2), release.count("a:b", 6), release.count("b:a", 6), release.count("b:b", 6)];
    release.partition(all, [rowA, rowB]);
    release.partition(all, [colA, colB]);
    release.partition(rowA, cells.slice(0, 2));
    release.partition(rowB, cells.slice(2));
    release.partition(colA, [cells[0]!, cells[2]!]);
    release.partition(colB, [cells[1]!, cells[3]!]);
    const shown = release.resolve({ all, rowA, rowB, colA, colB, cells }) as {
      all: ReleasedCount;
      rowA: ReleasedCount;
      rowB: ReleasedCount;
      colA: ReleasedCount;
      colB: ReleasedCount;
      cells: ReleasedCount[];
    };
    const fits = (value: number, figure: ReleasedCount) =>
      figure.kind === "exact"
        ? value === figure.value
        : figure.kind === "small"
          ? value >= 1 && value <= 4
          : value >= 1;
    const alternatives = new Set<number>();
    for (let a = 0; a <= 20; a++)
      for (let b = 0; b <= 20; b++)
        for (let c = 0; c <= 20; c++)
          for (let d = 0; d <= 20; d++) {
            if (
              [a, b, c, d].every((value, index) => fits(value, shown.cells[index]!)) &&
              fits(a + b, shown.rowA) &&
              fits(c + d, shown.rowB) &&
              fits(a + c, shown.colA) &&
              fits(b + d, shown.colB) &&
              fits(a + b + c + d, shown.all)
            )
              alternatives.add(a);
          }
    expect(alternatives.has(2)).toBe(true);
    expect(alternatives.size).toBeGreaterThan(1);
    expect(shown.all).toEqual({ kind: "exact", value: 20 });
  });

  it("rejects a claimed partition or subset that disagrees with the selectors", () => {
    const release = new ExecutiveCountRelease();
    const parent = release.count("parent", 8);
    const part = release.count("part", 9);
    expect(() => release.subset(parent, part)).toThrow(/exceeds/);
    expect(() => release.partition(parent, [part])).toThrow(/does not match/);
  });

  it("protects the small outside-window remainder beside summed offered-week counts", () => {
    const release = new ExecutiveCountRelease();
    const lifetime = release.count("lifetime", 12, 0);
    const priorWeek = release.count("week:prior", 5);
    const currentWeek = release.count("week:current", 6);
    release.subset(lifetime, release.sum("offered-weeks", [priorWeek, currentWeek]));
    const shown = release.resolve({ lifetime, priorWeek, currentWeek }) as Record<string, ReleasedCount>;
    expect(
      shown.lifetime.kind === "exact" && shown.priorWeek.kind === "exact" && shown.currentWeek.kind === "exact",
    ).toBe(false);
    expect(shown).not.toHaveProperty("offered-weeks");
    expect(shown.lifetime).toEqual({ kind: "exact", value: 12 });
  });

  it("protects integer bounds created by several overlapping released partitions", () => {
    const release = new ExecutiveCountRelease();
    const first = release.count("first", 6, 0);
    const second = release.count("second", 6, 0);
    const third = release.count("third", 6, 0);
    const x = release.count("x", 4);
    const y = release.count("y", 2);
    const z = release.count("z", 2);
    const w = release.count("w", 2);
    release.partition(first, [x, y]);
    release.partition(second, [x, z]);
    release.partition(third, [y, z, w]);
    const shown = release.resolve({ first, second, third, x, y, z, w }) as Record<string, ReleasedCount>;
    const fits = (value: number, figure: ReleasedCount) =>
      figure.kind === "exact"
        ? value === figure.value
        : figure.kind === "small"
          ? value >= 1 && value <= 4
          : value >= 1;
    const alternatives = new Set<number>();
    for (let a = 1; a <= 10; a++)
      for (let b = 1; b <= 10; b++)
        for (let c = 1; c <= 10; c++)
          for (let d = 1; d <= 10; d++) {
            if (
              fits(a, shown.x!) &&
              fits(b, shown.y!) &&
              fits(c, shown.z!) &&
              fits(d, shown.w!) &&
              fits(a + b, shown.first!) &&
              fits(a + c, shown.second!) &&
              fits(b + c + d, shown.third!)
            )
              alternatives.add(a);
          }
    expect(alternatives.has(4)).toBe(true);
    expect(alternatives.size).toBeGreaterThan(1);
  });

  it("keeps existing published/absent duration-sample bounds when a count tag is promoted", () => {
    const release = new ExecutiveCountRelease();
    const total = release.count("total", 6, 0);
    const belowFloor = release.count("belowFloor", 1);
    const published = release.count("published", 5);
    release.bounds(belowFloor, 0, 4);
    release.bounds(published, 5);
    release.partition(total, [belowFloor, published]);
    const shown = release.resolve({ total, belowFloor, published }) as Record<string, ReleasedCount>;
    const fits = (value: number, figure: ReleasedCount) =>
      figure.kind === "exact"
        ? value === figure.value
        : figure.kind === "small"
          ? value >= 1 && value <= 4
          : value >= 1;
    const alternatives = new Set<number>();
    for (let left = 0; left <= 4; left++)
      for (let right = 5; right <= 20; right++)
        if (fits(left, shown.belowFloor!) && fits(right, shown.published!) && fits(left + right, shown.total!))
          alternatives.add(left);
    expect(alternatives.has(1)).toBe(true);
    expect(alternatives.size).toBeGreaterThan(1);
    expect(shown.total.kind).not.toBe("exact");
    const invalid = new ExecutiveCountRelease();
    expect(() => invalid.bounds(invalid.count("sample", 4), 5)).toThrow(/disagree/);
  });

  it("rechecks current exact/bound constraints and invalidates a memoised equation certificate", () => {
    const release = new ExecutiveCountRelease();
    const total = release.count("total", 10);
    const left = release.count("left", 5);
    const right = release.count("right", 5);
    const alias = release.count("alias", 5);
    release.partition(total, [left, right]);
    const validate = Reflect.get(release, "validWitness") as (
      this: ExecutiveCountRelease,
      delta: Map<string, number>,
      exact: ReadonlySet<string>,
      withheld: ReadonlySet<string>,
    ) => boolean;
    const delta = new Map([
      ["left", 1],
      ["right", -1],
    ]);
    expect(validate.call(release, delta, new Set(), new Set())).toBe(true);
    expect(validate.call(release, delta, new Set(["left"]), new Set())).toBe(false);
    release.bounds(left, 0, 5);
    expect(validate.call(release, delta, new Set(), new Set())).toBe(false);
    const other = new Map([
      ["left", -1],
      ["right", 1],
    ]);
    expect(validate.call(release, other, new Set(), new Set())).toBe(true);
    release.partition(alias, [left]);
    expect(validate.call(release, other, new Set(), new Set())).toBe(false);
  });
});
