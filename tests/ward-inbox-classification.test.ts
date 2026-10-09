import { readFileSync } from "node:fs";
import ts from "typescript";

import { describe, expect, it } from "vitest";

import { buildActionInbox, type InboxItem } from "../src/components/ward-management/ward-derivations";
import {
  INBOX_CATEGORIES,
  inboxItemKindOf,
  seedWardFlowState,
  wardFlowReducer,
  type InboxItemKind,
} from "../src/components/ward-management/ward-flow-reducer";
import { type Decline, type Movement } from "../src/components/ward-management/ward-model";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const DERIVATIONS = "src/components/ward-management/ward-derivations.ts";

const KINDS: readonly InboxItemKind[] = ["fact", "commitment"];

/** Follow the builder's actual composition, including categories dormant in today's fixtures. */
function emittingInboxCategories(source: string): string[] {
  const file = ts.createSourceFile(DERIVATIONS, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const functions = new Map(
    file.statements.filter(ts.isFunctionDeclaration).map((declaration) => [declaration.name?.text, declaration]),
  );
  const factory = functions.get("actionInboxItem");
  const factoryReturn = factory?.body?.statements[0];
  if (
    !factoryReturn ||
    !ts.isReturnStatement(factoryReturn) ||
    !factoryReturn.expression ||
    !ts.isObjectLiteralExpression(factoryReturn.expression)
  )
    throw new Error("Missing classified row factory");
  const properties = factoryReturn.expression.properties.filter(ts.isPropertyAssignment);
  const kind = properties.find((property) => property.name.getText(file) === "kind")?.initializer;
  const id = properties.find((property) => property.name.getText(file) === "id")?.initializer;
  function categoryProperty(node: ts.Node | undefined, property: string): boolean {
    return (
      !!node &&
      ts.isPropertyAccessExpression(node) &&
      node.name.text === property &&
      ts.isElementAccessExpression(node.expression) &&
      node.expression.expression.getText(file) === "INBOX_CATEGORIES" &&
      node.expression.argumentExpression.getText(file) === "category"
    );
  }
  if (
    !categoryProperty(kind, "kind") ||
    !id ||
    !ts.isTemplateExpression(id) ||
    !categoryProperty(id.templateSpans[0]?.expression, "idPrefix")
  )
    throw new Error("Row identity and kind must use the declared category table entry");
  const builder = functions.get("buildActionInbox");
  if (!builder?.body || builder.body.statements.length !== 1) throw new Error("Unexpected inbox composition");
  const statement = builder.body.statements[0];
  if (!ts.isReturnStatement(statement) || !statement.expression || !ts.isArrayLiteralExpression(statement.expression))
    throw new Error("Inbox composition must return its category array");
  const categories: string[] = [];
  for (const element of statement.expression.elements) {
    if (
      !ts.isSpreadElement(element) ||
      !ts.isCallExpression(element.expression) ||
      !ts.isIdentifier(element.expression.expression)
    )
      throw new Error("Unclassified row in inbox composition");
    const helper = functions.get(element.expression.expression.text);
    if (!helper?.body) throw new Error("Missing inbox category helper");
    const finalStatement = helper.body.statements.at(-1);
    if (
      !finalStatement ||
      !ts.isReturnStatement(finalStatement) ||
      !finalStatement.expression ||
      !ts.isIdentifier(finalStatement.expression)
    )
      throw new Error("A category helper must return its local row array");
    const arrayName = finalStatement.expression.text;
    const localArray = helper.body.statements
      .filter(ts.isVariableStatement)
      .flatMap((statement) => [...statement.declarationList.declarations])
      .find((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === arrayName);
    if (
      !localArray?.initializer ||
      !ts.isArrayLiteralExpression(localArray.initializer) ||
      localArray.initializer.elements.length !== 0
    )
      throw new Error("The returned row array must be locally initialised empty");
    const pushes: ts.CallExpression[] = [];
    const returns: ts.ReturnStatement[] = [];
    function visit(node: ts.Node): void {
      if (ts.isReturnStatement(node)) returns.push(node);
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "push"
      )
        pushes.push(node);
      ts.forEachChild(node, visit);
    }
    visit(helper.body);
    if (returns.length !== 1) throw new Error("A category helper must not emit additional return rows");
    if (pushes.length !== 1) throw new Error("Each category helper must have exactly one row-emitting block");
    const push = pushes[0].expression;
    if (!ts.isPropertyAccessExpression(push) || !ts.isIdentifier(push.expression) || push.expression.text !== arrayName)
      throw new Error("The classified push must fill the returned row array");
    const row = pushes[0].arguments[0];
    if (
      pushes[0].arguments.length !== 1 ||
      !row ||
      !ts.isCallExpression(row) ||
      !ts.isIdentifier(row.expression) ||
      row.expression.text !== "actionInboxItem"
    )
      throw new Error("Unclassified row-emitting block");
    const category = row.arguments[1];
    if (!category || !ts.isStringLiteral(category)) throw new Error("A row-emitting block must declare its category");
    categories.push(category.text);
  }
  if (categories.length === 0) throw new Error("The scan found no row-emitting blocks");
  if (new Set(categories).size !== categories.length) throw new Error("Duplicate row-emitting category");
  if (categories.some((category) => !Object.hasOwn(INBOX_CATEGORIES, category)))
    throw new Error("Unclassified category");
  if (categories.length !== Object.keys(INBOX_CATEGORIES).length) throw new Error("Missing row-emitting category");
  return categories;
}

/**
 * A real, valid, open fixture movement to spread from — same template and the same `Object.assign`
 * reason as `tests/ward-derivations.test.ts`'s `movementFrom` (a spread widens every overridden
 * field back to optional under TypeScript's spread-merge rules).
 */
const baseMovement = wardMovements.find((movement) => movement.id === "WF-002");
if (!baseMovement)
  throw new Error("Fixture movement WF-002 is required as a template for the inbox classification tests");

function movementFrom(id: string, overrides: Partial<Movement>): Movement {
  return Object.assign({}, baseMovement, overrides, { id: id as Movement["id"] });
}

/**
 * ⚠️ **EVERY CATEGORY, INCLUDING THE TWO THE REAL FIXTURE LEAVES EMPTY.** Measured on 2026-09-06,
 * the seeded state emits only three of the five categories — no breached statutory form and no
 * unlawful destination exist in it. A classification test that ran only over the seed would
 * therefore never look at the two rows the whole safety property was written for. These injected
 * movements exist so all five are exercised; the seeded state is asserted separately below,
 * because it is the population the running app actually shows.
 */
function movementsCoveringEveryCategory(): Movement[] {
  return [
    // destination_unlawful — a private ward that is never authorised to hold an involuntary patient.
    movementFrom("WF-T01", { legalStatus: "Involuntary inpatient", acceptedUnitId: "sjgs-adult-open" }),
    // legal_timing_breached — a form carrying a deadline already in the past.
    movementFrom("WF-T02", { legalForm: { code: "4A", kind: "transport", dueAt: NOW - 90 } }),
    // bed_pull_expired — a hold that has lapsed.
    movementFrom("WF-T03", { stage: "pulled", pullExpiresAt: NOW - 30 }),
    // destinations_declined — the real fixture movement that already carries five declines.
    wardMovements.find((movement) => movement.id === "WF-009")!,
    // transport_awaiting_departure — the real fixture movement whose transport has not set off.
    wardMovements.find((movement) => movement.id === "WF-005")!,
  ];
}

function categoryKeyOf(item: InboxItem): string | undefined {
  return Object.entries(INBOX_CATEGORIES).find(([, entry]) => item.id.startsWith(entry.idPrefix))?.[0];
}

describe("every action-inbox category is classified as a fact or a commitment", () => {
  /**
   * 🔴 **THE ENUMERATION, DERIVED FROM THE CODE RATHER THAN FROM A LIST WRITTEN HERE.** The rows
   * come from `buildActionInbox` itself and the categories from `INBOX_CATEGORIES`; nothing in this
   * test names a category. A sixth category added to the builder emits rows whose id matches no
   * table prefix, so `categoryKeyOf` returns `undefined` and this goes red until somebody has
   * decided what kind of thing the new row is — which is the point.
   */
  it("gives every row a kind, and every row's kind is the one its category declares", () => {
    const items = buildActionInbox(movementsCoveringEveryCategory(), NOW, allUnits());

    // ANTI-VACUITY. Without this the whole test passes over an empty array — the enumeration
    // "silently returning nothing" failure. Five categories, at least one row each.
    expect(items.length, "the injected movements no longer populate the inbox at all").toBeGreaterThanOrEqual(
      Object.keys(INBOX_CATEGORIES).length,
    );

    const unclassified = items.filter((item) => categoryKeyOf(item) === undefined);
    expect(
      unclassified.map((item) => item.id),
      "a row whose id matches no INBOX_CATEGORIES prefix is a category nobody has classified",
    ).toEqual([]);

    for (const item of items) {
      const key = categoryKeyOf(item) as keyof typeof INBOX_CATEGORIES;
      expect(KINDS, `${item.id} carries a kind outside the union`).toContain(item.kind);
      // The row and the reducer's refusal must classify identically. Two lists that agree today
      // is exactly the drift this asserts away: both read the same table entry.
      expect(item.kind, `${item.id} disagrees with INBOX_CATEGORIES.${key}`).toBe(INBOX_CATEGORIES[key].kind);
      expect(inboxItemKindOf(item.id), `${item.id} is classified differently by id than by row`).toBe(item.kind);
    }

    // ANTI-VACUITY, second half: every category in the table was actually reached. A table entry
    // no row can produce would otherwise sit here unexercised, and a category deleted from the
    // builder while its entry remained would pass silently.
    const covered = new Set(items.map((item) => categoryKeyOf(item)));
    expect([...covered].sort()).toEqual(Object.keys(INBOX_CATEGORIES).sort());
  });

  /**
   * ⚠️ **THE ROT GUARD, AND IT READS THE SOURCE BECAUSE NOTHING ELSE CAN SEE A CATEGORY THAT WAS
   * NEVER GIVEN A TABLE ENTRY.** The runtime test above catches a new category only when the
   * fixture happens to populate it; two of the five are empty on the real seed, so "a category
   * exists but nothing triggers it" is a real state this inbox has been in for months. Follow the
   * builder's category helpers and each helper's row-emitting block, rather than fixture coverage.
   */
  it("has exactly one INBOX_CATEGORIES entry per row-emitting block in buildActionInbox", () => {
    const source = readFileSync(DERIVATIONS, "utf8");
    const categories = emittingInboxCategories(source);
    // Anti-vacuity on the scan itself: a body that matched nothing would agree with an empty table.
    expect(categories.length, "the scan found no row-emitting blocks — it is measuring the wrong text").toBeGreaterThan(
      0,
    );
    expect(categories.sort()).toEqual(Object.keys(INBOX_CATEGORIES).sort());
  });

  it.each([
    {
      label: "empty composition",
      before: "...unlawfulDestinationInbox(movements, units),",
      after: "",
      removeAll: true,
    },
    { label: "missing category", before: "...unlawfulDestinationInbox(movements, units),", after: "" },
    { label: "duplicate category", before: '"destination_unlawful", {', after: '"legal_timing_breached", {' },
    { label: "unclassified category", before: '"destination_unlawful", {', after: '"future_unclassified", {' },
    {
      label: "unclassified row",
      before: 'actionInboxItem(movement, "destination_unlawful", {',
      after: 'unknownRowFactory(movement, "destination_unlawful", {',
    },
    { label: "factory kind bypass", before: "kind: INBOX_CATEGORIES[category].kind", after: 'kind: "commitment"' },
    { label: "factory prefix bypass", before: "INBOX_CATEGORIES[category].idPrefix", after: '"unclassified-"' },
    {
      label: "extra emitting block",
      before: 'actionInboxItem(movement, "destination_unlawful", {',
      after: 'actionInboxItem(movement, "destination_unlawful", {',
      extraPush: true,
    },
    {
      label: "additional conditional return row",
      before: "return items;",
      after: 'if (rareCondition) return [...items, { id: "unclassified-row" }]; return items;',
    },
    {
      label: "push receiver differs from returned array",
      before: 'actionInboxItem(movement, "destination_unlawful", {',
      after: 'actionInboxItem(movement, "destination_unlawful", {',
      wrongReceiver: true,
    },
  ])(
    "the source guard rejects $label even without a triggering movement",
    ({ before, after, removeAll, extraPush, wrongReceiver }) => {
      const source = readFileSync(DERIVATIONS, "utf8");
      expect(source).toContain(before);
      const changed = removeAll
        ? source.replace(/\.\.\.[A-Za-z]+Inbox\(movements[^\n]*\),/g, "")
        : wrongReceiver
          ? source.replace("items.push(", "otherArray.push(")
          : extraPush
            ? source.replace(
                "const noLongerLawful = movements",
                "items.push(unclassifiedRow);\n  const noLongerLawful = movements",
              )
            : source.replace(before, after);
      expect(changed).not.toBe(source);
      expect(() => emittingInboxCategories(changed)).toThrow();
    },
  );

  /**
   * 🔴 **THE ANTI-VACUITY ASSERTION THE BRIEF ASKED FOR, IN THE ONLY HONEST FORM AVAILABLE.**
   *
   * The brief required BOTH kinds to be non-empty in the seeded state. They are not, and forcing
   * that would have meant classifying a row as a commitment to make a test pass — the exact failure
   * this task exists to prevent. What it was guarding against was a classification that made
   * everything a commitment, or an enumeration that measured nothing; both are caught here instead:
   * the seeded inbox is non-empty, and every row in it is a fact, so flipping the table wholesale to
   * `"commitment"` goes red on this line rather than passing quietly.
   *
   * ⚠️ **THIS DOES NOT ASSERT THAT NO COMMITMENT MAY EVER EXIST.** It asserts what today's seed
   * holds. When a genuine commitment category is added, this reads `factRows > 0 && commitmentRows
   * >= 0` — so widen the second half then, and do not weaken the first.
   */
  it("the seeded state really contains fact rows — the refusal below is not tested over an empty list", () => {
    const state = seedWardFlowState();
    const items = buildActionInbox(state.movements, NOW, state.units);

    expect(items.length, "the seeded state produces no inbox rows at all").toBeGreaterThan(0);
    const factRows = items.filter((item) => item.kind === "fact");
    expect(factRows.length, "no fact rows in the seed leaves the completion refusal untested").toBeGreaterThan(0);

    /*
     * 🔴 **THE TWO THAT CAN NEVER BE ANYTHING BUT FACTS, PINNED SO NO LATER RULING CAN MOVE THEM.**
     * The other three are the owner's to classify; a breached statutory form and a placement the
     * Mental Health Act does not authorise are not. Asserted against the table rather than against
     * today's rows, because both categories are empty on this fixture — an assertion over the
     * seeded rows alone would pass over nothing at all, which is how a category with no current
     * population goes unguarded (this inbox has been in that state for months).
     *
     * ⚠️ A blanket "the seed contains no commitments" was written here first and removed: it would
     * go red the day the owner correctly rules one of the two provisional categories a commitment,
     * which is a guard reddening on the work it exists to permit.
     */
    expect(INBOX_CATEGORIES.legal_timing_breached.kind).toBe("fact");
    expect(INBOX_CATEGORIES.destination_unlawful.kind).toBe("fact");
  });
});

describe("COMPLETE_INBOX_ITEM refuses a fact", () => {
  /**
   * 🔴 **THE SAFETY PROPERTY: nobody may silence a live legal breach by ticking a box.**
   *
   * Every row the real seeded state shows a coordinator, one at a time — not one representative
   * row, because a refusal that fires on the first category and not the fourth would look identical
   * to this test if it only checked one.
   */
  it("refuses every fact row the seeded state actually shows, and records nothing against it", () => {
    const state = seedWardFlowState();
    const items = buildActionInbox(state.movements, NOW, state.units).filter((item) => item.kind === "fact");
    expect(items.length, "no fact rows to refuse — this test would pass over nothing").toBeGreaterThan(0);

    for (const item of items) {
      const next = wardFlowReducer(state, {
        type: "COMPLETE_INBOX_ITEM",
        role: "coordinator",
        now: NOW,
        inboxItemId: item.id,
      });
      expect(next.rejections, `${item.id} was ticked off despite stating a live fact`).toHaveLength(1);
      expect(next.rejections[0].reason).toContain("live fact");
      expect(next.inboxCompletions[item.id]).toBeUndefined();
    }
  });

  /**
   * The two categories the seed leaves empty are the two the safety property was written for — a
   * breached statutory form and an unlawful destination. Injected, because a guard that never walks
   * them is a guard that has never been tested on the case that matters.
   */
  it("refuses the breached-form and unlawful-destination rows, which the real seed never produces", () => {
    const state = seedWardFlowState();
    const injected = movementsCoveringEveryCategory();
    const items = buildActionInbox(injected, NOW, allUnits()).filter(
      (item) =>
        item.id.startsWith(INBOX_CATEGORIES.legal_timing_breached.idPrefix) ||
        item.id.startsWith(INBOX_CATEGORIES.destination_unlawful.idPrefix),
    );
    expect(items.map((item) => item.id).sort()).toEqual(["destination-unlawful-WF-T01", "legal-WF-T02"]);

    for (const item of items) {
      const next = wardFlowReducer(state, {
        type: "COMPLETE_INBOX_ITEM",
        role: "coordinator",
        now: NOW,
        inboxItemId: item.id,
      });
      expect(next.rejections, `${item.id} was ticked off`).toHaveLength(1);
      expect(next.inboxCompletions[item.id]).toBeUndefined();
    }
  });

  /**
   * ⚠️ **FAILS CLOSED.** An id no category claims cannot be ticked off either — otherwise a sixth
   * category added without a table entry would be silently completable, and the enumeration test
   * above would be the only thing standing between that and a coordinator ticking away a breach.
   */
  it("refuses an id no category claims, rather than letting an unclassified row through", () => {
    const state = seedWardFlowState();
    const next = wardFlowReducer(state, {
      type: "COMPLETE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId: "some-future-category-WF-001",
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0].reason).toContain("not a classified inbox category");
    expect(inboxItemKindOf("some-future-category-WF-001")).toBeUndefined();
  });

  /**
   * ACKNOWLEDGEMENT IS THE THING A FACT DOES HAVE. The refusal above would be a removal of function
   * rather than a safeguard if it left a coordinator with no way to say "I am on this" — so the
   * same row that cannot be completed is asserted here to be acknowledgeable, and the row is
   * asserted to survive the acknowledgement unchanged.
   */
  it("still lets a coordinator acknowledge the fact it refuses to let them tick off", () => {
    const state = seedWardFlowState();
    const before = buildActionInbox(state.movements, NOW, state.units);
    const fact = before.find((item) => item.kind === "fact");
    expect(fact, "no fact row to acknowledge").toBeDefined();

    const next = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId: fact!.id,
    });
    expect(next.rejections).toEqual([]);
    expect(next.inboxAcknowledgements[fact!.id]).toHaveLength(1);
    expect(buildActionInbox(next.movements, NOW, next.units)).toEqual(before);
  });
});

/**
 * Item 20, owner decision 2026-09-17: the "Multiple destinations declined" row used to ignore
 * acceptance entirely — `movement.declines.length >= PARALLEL_REFERRAL_CAP` alone, with no check
 * on `acceptedUnitId`. A movement declined by three wards and then accepted by a fourth kept
 * warning the coordinator to widen a search that was already over.
 */
describe("destinations_declined respects acceptance (item 20)", () => {
  function decline(unitId: string, at: number): Decline {
    return { unitId, at, reason: "no_bed" };
  }

  it("raises no row for a movement that has since been accepted, even with the cap of declines on record", () => {
    const accepted = movementFrom("WF-T-RA2-01", {
      referredUnitIds: [],
      acceptedUnitId: "bty-adult-secure",
      declines: [
        decline("rph-adult-secure", NOW - 90),
        decline("fsh-adult-secure", NOW - 60),
        decline("gry-adult-secure", NOW - 30),
      ],
    });

    const items = buildActionInbox([accepted], NOW, allUnits());
    expect(
      items.find((item) => item.movementId === "WF-T-RA2-01"),
      "an accepted movement should raise no inbox row at all here — nothing is unresolved",
    ).toBeUndefined();
  });

  it("control: the same three declines with nothing accepted still raise the row", () => {
    const stillOpen = movementFrom("WF-T-RA2-02", {
      referredUnitIds: [],
      declines: [
        decline("rph-adult-secure", NOW - 90),
        decline("fsh-adult-secure", NOW - 60),
        decline("gry-adult-secure", NOW - 30),
      ],
    });

    const items = buildActionInbox([stillOpen], NOW, allUnits());
    const row = items.find((item) => item.movementId === "WF-T-RA2-02");
    expect(row?.id, "the control must still raise the row, or the exclusion above proves nothing").toBe(
      `${INBOX_CATEGORIES.destinations_declined.idPrefix}WF-T-RA2-02`,
    );
  });
});
