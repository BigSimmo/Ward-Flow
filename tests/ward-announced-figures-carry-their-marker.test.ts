import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * 🔴 **EVERY FIGURE THAT IS ANNOUNCED CARRIES ITS MARKER IN THE UTTERANCE IT IS ANNOUNCED IN.**
 *
 * **The defect class, in one line.** A figure travels into a live region. Its "these numbers are
 * invented" marker stays behind in the visible layer. **Nothing contradicts anything — there is
 * just a number, announced bare.** Errata §U2 names the shape and says why the refusal guard's
 * form cannot reach it: a refusal is a sentence that must be ALONE, so its catching assertion is
 * NEGATIVE and works because there is a contradiction to detect. **A marker is a sentence that
 * must be TOGETHER with something, and there is no contradiction to find.** This file is the
 * positive-over-the-whole-surface form that §U2 says the class needs.
 *
 * ---
 *
 * ## 🔴 THE SHAPE QUESTION WAS ASKED FIRST, AND THIS IS THE ANSWER
 *
 * Errata §AH/§AK: this codebase already refuses three times to let a figure travel without the
 * words that make it mean something — `ShellFigure = { value, noun }`, a wait that carries its
 * site, a `Notice` that stores its sentence instead of re-deriving it. **A type that cannot be
 * separated beats any guard, because it stops the separation being written rather than catching
 * it afterwards.** So: can an ANNOUNCED figure carry its marker the same way?
 *
 * **Partly, and the part that works is the one nobody had named.** An announcement is a composed
 * sentence, not a value object, so there is no single type through which every announcement must
 * pass — `aria-live` is an attribute any element may carry, and nothing can make that attribute
 * demand a value object. **The shape is therefore not available as a total replacement for this
 * guard.**
 *
 * 🔴 **But `ShellFigure`'s actual move — the provenance rides in the NOUN — is available, and it
 * dissolves the keystroke trap that made the obvious fix unacceptable.** The trap (Lane C,
 * measured on a typeahead) is that a live region fires on every keystroke, so a marker APPENDED as
 * a clause is heard twenty times while somebody types a surname and is ignored by the twenty-first
 * — worse than one omission, because it destroys the marker everywhere. **That trap belongs to the
 * appended clause. It does not exist for a qualified noun.** A count whose noun already says what
 * the rows are costs nothing on repeat, because the noun was going to be spoken anyway.
 *
 * **So this guard accepts two satisfactions and deliberately prefers the first:**
 *
 *     (a) THE QUALIFIED NOUN — the provenance sits in the same announced run as the figure,
 *         attached to what is being counted. No extra sentence, nothing to habituate to.
 *     (b) A MARKER SENTENCE elsewhere in the same live region, AND `aria-atomic="true"`.
 *
 * 🔴 **(b) REQUIRES `aria-atomic="true"` AND THAT IS NOT A TECHNICALITY.** Without it a live region
 * presents only the node that changed, so a static marker sitting beside a changing count is not
 * spoken with the count. **A marker in a non-atomic region is the same defect one element closer.**
 * The shell's own announcer (`shell/ward-live-region.tsx`) already sets `aria-atomic="true"`; every
 * other live region in this tree does not.
 *
 * ⚠️ **WHAT THIS GUARD DOES NOT DECIDE: when.** It requires the marker to be IN the utterance. It
 * does not and cannot decide that a given screen should announce less often. If a future owner
 * ruling says a settled-query announcement replaces a per-keystroke one, that is a change to the
 * screen, not to this rule — this rule is satisfied either way.
 *
 * ---
 *
 * ## The two populations, and why there are two
 *
 *     P1   live regions written as JSX in this tree
 *     P2   call sites of `announceToWardShell`
 *
 * 🔴 **P2 exists because the shell announcer launders provenance.** Its region renders `{text}` —
 * an opaque string — so every figure composed into that string is invisible to any guard that
 * reads the region. Errata §U3: a shared, shell-owned announcer is a component no lane owns, no
 * lane's brief lists, and every lane's screen inherits. **A guard that walked only P1 would go
 * green on the shell forever.**
 *
 * ## What counts as a figure — and why a digit in the source is wrong twice over
 *
 * A digit misses `{count}` interpolations, which render as digits and are not digits in source;
 * and it hits ordinals, dates, times and stage indices that are not provenance problems at all.
 *
 * 🔴 **The subject here is narrower and is decidable from source: A COUNT OF ROWS.** An expression
 * that reaches the announced text and yields the cardinality of a collection — `.length`, a
 * `.total`/`.count` property, an identifier named for a count. **An ordinal, a date, a beat number,
 * a stage index and a wait duration are never the cardinality of a collection**, so the
 * false-positive class is excluded by construction rather than by exemption one site at a time.
 *
 * ⚠️ **Counts reached only through a CONDITION are not announced.** `items.length === 0 ? "none" :
 * "some"` states no figure. The walk skips the condition of every conditional and the whole of
 * every comparison, so only expressions that can reach the output string are read.
 *
 * ## What counts as "carries its marker"
 *
 * **Same page is not enough and that is the whole point of the class** — the located instance in
 * `community/community-index.tsx` carries a badge sixty-odd lines above its result line, in the
 * visible layer, and a reader of the live region never meets it. The line drawn here:
 *
 *     the RUN   the nearest enclosing JSX element that announces something besides the count
 *     tier (a)  marker in the RUN                                   -> satisfied, atomic or not
 *     tier (b)  marker anywhere in the live region + aria-atomic    -> satisfied
 *     anything further away                                          -> NOT satisfied
 *
 * ## 🔴 The predicate is a CLAIM, never a bare word
 *
 * A substring test has no polarity — the older provenance checker's first predicate accepted the
 * sentence DENYING invention, because that sentence contains the word it denies. Here a marker is
 * an unreality word **adjacent to a data noun** (`invented figures`, `names are synthetic`), and a
 * match inside a negation window does not count. Both halves have self-tests below, including one
 * proving the negation still fails.
 *
 * ## Anti-vacuity is RELATIVE, never a constant floor
 *
 * A constant floor catches only the last unit that stops being measured. Instead:
 *
 *   - every `.tsx` file under the root is parsed, and the parsed count must equal the walked count;
 *   - a deliberately dumb raw-text witness scans the same files for live-region markers, and **any
 *     file the witness flags where the AST walk found nothing is NAMED and fails the run**;
 *   - the same witness counts `announceToWardShell` call sites, and a shortfall is NAMED;
 *   - **an unresolvable `role` or `aria-live` on an intrinsic element is a FAILURE, never a skip**;
 *   - the population sizes are printed by the run itself, so a reader can watch them shrink.
 *
 * ## 🔴 THE HONEST SILENCES, stated so this file is never quoted as more than it is
 *
 *   - It reads SOURCE. A live region rendered by a component defined outside
 *     `src/components/ward-management` and mounted on a ward screen is not in P1.
 *   - It reads a count of rows. **An invented wait, an invented date, an invented bed number that
 *     is not a cardinality is announced bare and this file says nothing about it.** That is the
 *     largest silence and it is deliberate: the alternative is a digit rule that reddens on every
 *     ordinal and gets turned off.
 *   - It cannot see a live region created imperatively (`setAttribute`, a portal, a library).
 *   - It says nothing about WHETHER a screen should announce at all, or how often.
 */

const ROOT = join("src", "components", "ward-management");

/** Roles that make an element a live region. `aria-live` is handled separately. */
const LIVE_ROLES = new Set(["status", "alert", "log"]);

/** The shell announcer. Its region renders an opaque string, so its CALL SITES are the population. */
const ANNOUNCER = "announceToWardShell";

/**
 * 🔴 **AN UNREALITY WORD IS NOT A MARKER. A CLAIM ABOUT THE DATA IS.**
 *
 * Pairing an unreality word with the noun it qualifies is what gives the predicate polarity a bare
 * word cannot have. Both orders are accepted because both are ordinary English and either may be
 * what the standard settles on; §W's rule is that a guard pins the PROPERTY and leaves the WORDING
 * to the standard, and an adjective-beside-its-noun is the property.
 */
const UNREAL_WORDS = [
  "invented",
  "synthetic",
  "prototype",
  "sample",
  "placeholder",
  "fictional",
  "made-up",
  "made up",
  "not real",
];

const DATA_NOUNS = [
  "figure",
  "figures",
  "number",
  "numbers",
  "record",
  "records",
  "name",
  "names",
  "person",
  "people",
  "patient",
  "patients",
  "bed",
  "beds",
  "count",
  "counts",
  "result",
  "results",
  "team",
  "teams",
  "match",
  "matches",
  "row",
  "rows",
  "entry",
  "entries",
  "unit",
  "units",
  "referral",
  "referrals",
  "movement",
  "movements",
  "task",
  "tasks",
  "data",
];

const UNREAL_ALTERNATION = UNREAL_WORDS.map((word) => word.replace(/[-]/gu, "[- ]")).join("|");
const NOUN_ALTERNATION = DATA_NOUNS.join("|");

/** `invented figures` — the unreality word immediately qualifying what is counted. */
const MARKER_ADJECTIVE_FIRST = new RegExp(`\\b(?:${UNREAL_ALTERNATION})\\s+(?:${NOUN_ALTERNATION})\\b`, "giu");

/**
 * `every bed figure below is invented` — the same claim as a sentence.
 *
 * ⚠️ **The gap is BOUNDED and it is bounded because this codebase's own marker sentences need it.**
 * `capacity-screen.tsx` says a bed count "on this screen is invented"; a strict adjacency rule
 * would reject the house wording and the guard would then be reddening on correct work. Five words
 * between the noun and its verb, two between the verb and the claim — enough for the real
 * sentences, short enough that the noun and the claim are still one clause.
 */
const MARKER_NOUN_FIRST = new RegExp(
  `\\b(?:${NOUN_ALTERNATION})\\b(?:\\s+[\\p{L}']+){0,5}\\s+(?:is|are)(?:\\s+[\\p{L}']+){0,2}\\s+(?:${UNREAL_ALTERNATION})\\b`,
  "giu",
);

/**
 * ⚠️ **A DENIAL CONTAINS THE WORDS IT DENIES.** Thirty characters is enough to carry every ordinary
 * negator in front of a claim and short enough not to swallow a preceding sentence that happened to
 * contain "no".
 *
 * 🔴 **The MATCHED text is checked too, not only what precedes it.** The bounded gap above will
 * happily span a negator — *"every figure below is not invented"* matches the shape with `not`
 * sitting inside the match, where a look-behind window can never see it.
 */
const NEGATION_WINDOW = 30;
const NEGATOR = /\b(?:not|no|never|nothing|none|n't|aren't|isn't|aren|isn)\b/iu;

/** Does this announced text carry a provenance claim that is not being denied? */
export function carriesMarker(text: string): boolean {
  const haystack = text.replace(/\s+/gu, " ");
  for (const pattern of [MARKER_ADJECTIVE_FIRST, MARKER_NOUN_FIRST]) {
    pattern.lastIndex = 0;
    let match = pattern.exec(haystack);
    while (match !== null) {
      const before = haystack.slice(Math.max(0, match.index - NEGATION_WINDOW), match.index);
      // `not real figures` IS the claim, so its own negator must not cancel it.
      const selfNegating = /^not\s+real\b/iu.test(match[0]);
      const denied = !selfNegating && (NEGATOR.test(before) || NEGATOR.test(match[0]));
      if (!denied) return true;
      match = pattern.exec(haystack);
    }
  }
  return false;
}

type AttributeValue =
  { kind: "absent" } | { kind: "literals"; values: string[] } | { kind: "unresolved"; text: string };

function jsxAttributes(node: ts.JsxElement | ts.JsxSelfClosingElement): ts.NodeArray<ts.JsxAttributeLike> {
  return ts.isJsxElement(node) ? node.openingElement.attributes.properties : node.attributes.properties;
}

function tagNameOf(node: ts.JsxElement | ts.JsxSelfClosingElement): string {
  return ts.isJsxElement(node) ? node.openingElement.tagName.getText() : node.tagName.getText();
}

/** Every literal string a value expression can evaluate to, or `unresolved` if that is not knowable. */
function resolveLiterals(expression: ts.Expression): { values: string[] } | null {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return { values: [expression.text] };
  }
  if (expression.kind === ts.SyntaxKind.UndefinedKeyword) return { values: [] };
  if (ts.isIdentifier(expression) && expression.text === "undefined") return { values: [] };
  if (expression.kind === ts.SyntaxKind.NullKeyword) return { values: [] };
  if (ts.isParenthesizedExpression(expression)) return resolveLiterals(expression.expression);
  if (ts.isConditionalExpression(expression)) {
    const whenTrue = resolveLiterals(expression.whenTrue);
    const whenFalse = resolveLiterals(expression.whenFalse);
    if (whenTrue === null || whenFalse === null) return null;
    return { values: [...whenTrue.values, ...whenFalse.values] };
  }
  return null;
}

function attributeValue(node: ts.JsxElement | ts.JsxSelfClosingElement, name: string): AttributeValue {
  for (const property of jsxAttributes(node)) {
    if (!ts.isJsxAttribute(property)) continue;
    if (property.name.getText() !== name) continue;
    const initializer = property.initializer;
    if (initializer === undefined) return { kind: "literals", values: ["true"] };
    if (ts.isStringLiteral(initializer)) return { kind: "literals", values: [initializer.text] };
    if (ts.isJsxExpression(initializer)) {
      const inner = initializer.expression;
      if (inner === undefined) return { kind: "literals", values: [] };
      const resolved = resolveLiterals(inner);
      if (resolved === null) return { kind: "unresolved", text: initializer.getText() };
      return { kind: "literals", values: resolved.values };
    }
    return { kind: "unresolved", text: property.getText() };
  }
  return { kind: "absent" };
}

const COUNT_PROPERTY = /^(?:length|total|count|size)$/iu;
const COUNT_IDENTIFIER = /^(?:count|total)$|(?:Count|Total)$/u;

function isCountNode(node: ts.Node): boolean {
  if (ts.isPropertyAccessExpression(node)) return COUNT_PROPERTY.test(node.name.text);
  if (ts.isIdentifier(node)) return COUNT_IDENTIFIER.test(node.text);
  return false;
}

/**
 * 🔴 **ONE ALTERNATIVE IS ONE THING A SCREEN READER COULD ACTUALLY HEAR.**
 *
 * This exists because flattening a component's branches into one string made the guard redden on
 * correct work, and the way it did so is worth keeping: `ward-global-search.tsx` announces either
 * an empty-result sentence **or** a count sentence, never both. Flattened, the empty-result
 * sentence's leading negative word sat thirty characters in front of the count sentence's marker
 * and cancelled it. **Two sentences that can never be spoken together must never be read as one
 * utterance** — a marker in branch A does not clear a count in branch B, and a negation in branch A
 * does not spoil a marker in branch B.
 */
type Alternative = { text: string; counts: ts.Node[] };

const EMPTY_ALTERNATIVE: Alternative[] = [{ text: "", counts: [] }];

/** See the template branch below: merging beyond this cap can only add context, never remove it. */
const TEMPLATE_ALTERNATIVE_CAP = 64;

/** Every count reachable anywhere inside a node — used where the rendered text is unknowable. */
function countsAnywhere(node: ts.Node): ts.Node[] {
  const found: ts.Node[] = [];
  const descend = (candidate: ts.Node) => {
    // Stop at the count itself. Descending further re-finds `total` inside `noBed.total` as a bare
    // identifier and reports one defect twice.
    if (isCountNode(candidate)) {
      found.push(candidate);
      return;
    }
    candidate.forEachChild(descend);
  };
  descend(node);
  return found;
}

/** Concatenation: every left option paired with every right option. */
function concatAlternatives(left: Alternative[], right: Alternative[]): Alternative[] {
  const out: Alternative[] = [];
  for (const a of left) {
    for (const b of right) out.push({ text: `${a.text} ${b.text}`, counts: [...a.counts, ...b.counts] });
  }
  return out;
}

function literalAlternative(text: string): Alternative[] {
  return [{ text, counts: [] }];
}

/** What this expression can render, one entry per mutually exclusive possibility. */
function expressionAlternatives(expression: ts.Expression): Alternative[] {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return literalAlternative(expression.text);
  }
  if (ts.isParenthesizedExpression(expression)) return expressionAlternatives(expression.expression);
  if (ts.isConditionalExpression(expression)) {
    // The CONDITION is never spoken. Its branches are alternatives, never a concatenation.
    return [...expressionAlternatives(expression.whenTrue), ...expressionAlternatives(expression.whenFalse)];
  }
  if (ts.isBinaryExpression(expression)) {
    const operator = expression.operatorToken.kind;
    switch (operator) {
      case ts.SyntaxKind.EqualsEqualsToken:
      case ts.SyntaxKind.EqualsEqualsEqualsToken:
      case ts.SyntaxKind.ExclamationEqualsToken:
      case ts.SyntaxKind.ExclamationEqualsEqualsToken:
      case ts.SyntaxKind.LessThanToken:
      case ts.SyntaxKind.LessThanEqualsToken:
      case ts.SyntaxKind.GreaterThanToken:
      case ts.SyntaxKind.GreaterThanEqualsToken:
      case ts.SyntaxKind.InstanceOfKeyword:
      case ts.SyntaxKind.InKeyword:
        return EMPTY_ALTERNATIVE;
      case ts.SyntaxKind.AmpersandAmpersandToken:
        return [...EMPTY_ALTERNATIVE, ...expressionAlternatives(expression.right)];
      case ts.SyntaxKind.BarBarToken:
      case ts.SyntaxKind.QuestionQuestionToken:
        return [...expressionAlternatives(expression.left), ...expressionAlternatives(expression.right)];
      case ts.SyntaxKind.PlusToken:
        return concatAlternatives(expressionAlternatives(expression.left), expressionAlternatives(expression.right));
      default:
        // Arithmetic over counts renders a number and no words.
        return [{ text: "", counts: countsAnywhere(expression) }];
    }
  }
  if (ts.isTemplateExpression(expression)) {
    let out = literalAlternative(expression.head.text);
    for (const span of expression.templateSpans) {
      const spanOptions = expressionAlternatives(span.expression);
      // A cross product is the right semantics and the only place this can grow. Beyond the cap the
      // branches are merged rather than dropped: merging can only ADD context, never remove a
      // count, so the failure direction is a missed flag in a pathological template and never a
      // false one. No template in this tree is anywhere near the cap; see the population output.
      out =
        out.length * spanOptions.length > TEMPLATE_ALTERNATIVE_CAP
          ? concatAlternatives(out, [
              {
                text: spanOptions.map((option) => option.text).join(" "),
                counts: spanOptions.flatMap((option) => option.counts),
              },
            ])
          : concatAlternatives(out, spanOptions);
      out = concatAlternatives(out, literalAlternative(span.literal.text));
    }
    return out;
  }
  if (ts.isJsxElement(expression) || ts.isJsxFragment(expression)) return elementAlternatives(expression);
  if (ts.isJsxSelfClosingElement(expression)) return EMPTY_ALTERNATIVE;
  if (ts.isCallExpression(expression)) {
    // A call's return string is unknowable, but markup and literals inside its arguments (a `.map`
    // callback's JSX, a `join(", ")`) are rendered. UNION, never a cross product — this is the one
    // place a cross could explode, and a union is the conservative direction.
    const out: Alternative[] = [{ text: "", counts: isCountNode(expression) ? [expression] : [] }];
    for (const argument of expression.arguments) out.push(...expressionAlternatives(argument));
    if (ts.isPropertyAccessExpression(expression.expression)) {
      out.push({ text: "", counts: countsAnywhere(expression.expression) });
    }
    return out;
  }
  if (ts.isArrowFunction(expression)) {
    const body = expression.body;
    if (ts.isBlock(body)) {
      const out: Alternative[] = [];
      const descend = (node: ts.Node) => {
        if (ts.isReturnStatement(node) && node.expression) out.push(...expressionAlternatives(node.expression));
        else node.forEachChild(descend);
      };
      body.forEachChild(descend);
      return out.length > 0 ? out : EMPTY_ALTERNATIVE;
    }
    return expressionAlternatives(body);
  }
  if (ts.isArrayLiteralExpression(expression)) {
    const out: Alternative[] = [];
    for (const element of expression.elements) out.push(...expressionAlternatives(element));
    return out.length > 0 ? out : EMPTY_ALTERNATIVE;
  }
  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
    return [{ text: "", counts: isCountNode(expression) ? [expression] : countsAnywhere(expression) }];
  }
  if (ts.isIdentifier(expression)) {
    return [{ text: "", counts: isCountNode(expression) ? [expression] : [] }];
  }
  return [{ text: "", counts: countsAnywhere(expression) }];
}

/**
 * Every literal a subtree can render, in one pass.
 *
 * 🔴 **This exists because the first version built a sibling's backdrop by joining that sibling's
 * own alternatives, and the text then multiplied at every level of nesting** — the seven-thousand
 * character live panel in `ward-management-network.tsx` blew the string length limit outright. A
 * subtree's text is a property of the subtree, not of how many ways it can be said.
 */
const subtreeTextCache = new WeakMap<ts.Node, string>();
function subtreeText(node: ts.Node): string {
  const cached = subtreeTextCache.get(node);
  if (cached !== undefined) return cached;
  const parts: string[] = [];
  const descend = (candidate: ts.Node) => {
    if (ts.isJsxAttribute(candidate) || ts.isJsxAttributes(candidate)) return;
    if (ts.isJsxText(candidate)) {
      parts.push(candidate.text);
      return;
    }
    if (
      ts.isStringLiteral(candidate) ||
      ts.isNoSubstitutionTemplateLiteral(candidate) ||
      ts.isTemplateHead(candidate) ||
      ts.isTemplateMiddle(candidate) ||
      ts.isTemplateTail(candidate)
    ) {
      parts.push(candidate.text);
    }
    candidate.forEachChild(descend);
  };
  descend(node);
  const text = parts.join(" ");
  subtreeTextCache.set(node, text);
  return text;
}

/**
 * What a JSX element can announce.
 *
 * **Siblings are a BACKDROP, the count's own child is split into ALTERNATIVES.** Siblings really
 * are spoken alongside each other, so their text is simply present; the branches of the child that
 * holds the count are the only thing that must be kept apart, because only one of them is ever
 * spoken. That is linear in the size of the subtree, and it errs towards MORE context around a
 * count — the direction that avoids false positives.
 */
function elementAlternatives(node: ts.JsxElement | ts.JsxFragment): Alternative[] {
  const children: Alternative[][] = [];
  for (const child of node.children) {
    if (ts.isJsxText(child)) {
      children.push(literalAlternative(child.text));
      continue;
    }
    if (ts.isJsxExpression(child)) {
      children.push(child.expression ? expressionAlternatives(child.expression) : EMPTY_ALTERNATIVE);
      continue;
    }
    if (ts.isJsxElement(child) || ts.isJsxFragment(child)) {
      children.push(elementAlternatives(child));
      continue;
    }
    children.push(EMPTY_ALTERNATIVE);
  }
  const backdrop = node.children.map((child) => subtreeText(child));
  const out: Alternative[] = [];
  for (let index = 0; index < children.length; index += 1) {
    for (const option of children[index]) {
      out.push({
        text: [...backdrop.slice(0, index), option.text, ...backdrop.slice(index + 1)].join(" "),
        counts: option.counts,
      });
    }
  }
  return out.length > 0 ? out : [{ text: backdrop.join(" "), counts: [] }];
}

function normalise(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

/** The nearest enclosing JSX element that announces something besides the count itself. */
function runElementFor(countNode: ts.Node, region: ts.JsxElement | ts.JsxFragment): ts.JsxElement | ts.JsxFragment {
  let current: ts.Node | undefined = countNode.parent;
  let best: ts.JsxElement | ts.JsxFragment = region;
  while (current !== undefined) {
    if (ts.isJsxElement(current) || ts.isJsxFragment(current)) {
      best = current;
      const spoken = elementAlternatives(current)
        .map((alternative) => alternative.text)
        .join(" ");
      if (spoken.replace(/[^\p{L}]/gu, "").length > 0) return current;
    }
    if (current === region) break;
    current = current.parent;
  }
  return best;
}

type CountSite = { expression: string; satisfied: boolean; atomicWouldHelp: boolean };

type Region = {
  file: string;
  line: number;
  tag: string;
  atomic: boolean;
  countSites: CountSite[];
};

type AnnouncerCall = { file: string; line: number; counts: string[]; satisfied: boolean };

type ScanResult = {
  files: string[];
  regions: Region[];
  announcerCalls: AnnouncerCall[];
  unresolved: { file: string; line: number; attribute: string; text: string }[];
};

function tsxFilesUnder(directory: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) out.push(...tsxFilesUnder(path));
    else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) out.push(path);
  }
  return out.sort();
}

/**
 * Every alternative that can carry this count must carry a marker. **One branch clearing itself
 * says nothing about the branch beside it**, which is the whole reason alternatives exist.
 */
function everyAlternativeCarrying(alternatives: Alternative[], countNode: ts.Node): boolean {
  const carrying = alternatives.filter((alternative) => alternative.counts.includes(countNode));
  if (carrying.length === 0) return false;
  return carrying.every((alternative) => carriesMarker(normalise(alternative.text)));
}

function analyseFile(file: string, source: string, into: ScanResult): void {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lineOf = (node: ts.Node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = tagNameOf(node);
      // Only intrinsic elements carry the ARIA attributes. A capitalised tag's `role` prop is a
      // component's own prop (this tree has two), and any live region that component renders is
      // found where the component is DEFINED — inside this same walk.
      if (/^[a-z]/u.test(tag)) {
        const live = attributeValue(node, "aria-live");
        const role = attributeValue(node, "role");
        let isLive = false;
        if (live.kind === "unresolved") {
          into.unresolved.push({ file, line: lineOf(node), attribute: "aria-live", text: live.text });
        } else if (live.kind === "literals" && live.values.some((value) => value !== "off")) {
          isLive = true;
        }
        if (role.kind === "unresolved") {
          into.unresolved.push({ file, line: lineOf(node), attribute: "role", text: role.text });
        } else if (role.kind === "literals" && role.values.some((value) => LIVE_ROLES.has(value))) {
          isLive = true;
        }
        if (isLive && ts.isJsxElement(node)) {
          const atomicAttribute = attributeValue(node, "aria-atomic");
          const atomic =
            atomicAttribute.kind === "literals" &&
            atomicAttribute.values.length > 0 &&
            atomicAttribute.values.every((value) => value === "true");
          const regionAlternatives = elementAlternatives(node);
          const countSites: CountSite[] = [];
          const seenCount = new Set<ts.Node>();
          for (const alternative of regionAlternatives) {
            for (const countNode of alternative.counts) {
              if (seenCount.has(countNode)) continue;
              seenCount.add(countNode);
              const runAlternatives = elementAlternatives(runElementFor(countNode, node));
              const tierA = everyAlternativeCarrying(runAlternatives, countNode);
              const tierB = atomic && everyAlternativeCarrying(regionAlternatives, countNode);
              countSites.push({
                expression: normalise(countNode.getText(sourceFile)),
                satisfied: tierA || tierB,
                atomicWouldHelp: !tierA && !atomic && everyAlternativeCarrying(regionAlternatives, countNode),
              });
            }
          }
          into.regions.push({ file, line: lineOf(node), tag, atomic, countSites });
        }
      }
    }

    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const calleeName = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : "";
      if (calleeName === ANNOUNCER && node.arguments.length > 0) {
        const alternatives = expressionAlternatives(node.arguments[0]);
        const counts = new Set<ts.Node>();
        for (const alternative of alternatives) for (const countNode of alternative.counts) counts.add(countNode);
        const satisfied = Array.from(counts).every((countNode) => everyAlternativeCarrying(alternatives, countNode));
        into.announcerCalls.push({
          file,
          line: lineOf(node),
          counts: Array.from(counts).map((countNode) => normalise(countNode.getText(sourceFile))),
          satisfied,
        });
      }
    }

    node.forEachChild(visit);
  };
  visit(sourceFile);
}

function scan(root: string): ScanResult {
  const files = tsxFilesUnder(root);
  const result: ScanResult = { files, regions: [], announcerCalls: [], unresolved: [] };
  for (const file of files) analyseFile(file, readFileSync(file, "utf8"), result);
  return result;
}

/** A violation, named by locator only — the offending sentence is deliberately never quoted here. */
type Violation = { locator: string; expression: string; why: string };

function violationsIn(result: ScanResult): Violation[] {
  const out: Violation[] = [];
  /** One line per (locator, expression). A branchy sentence naming the same count in six arms is
   *  one defect to fix, and printing it six times buries the other five sites. */
  const seen = new Set<string>();
  const add = (violation: Violation) => {
    const key = `${violation.locator}|${violation.expression}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(violation);
  };
  for (const region of result.regions) {
    for (const site of region.countSites) {
      if (site.satisfied) continue;
      add({
        locator: `${region.file.split(sep).join("/")}:${region.line}`,
        expression: site.expression,
        why: site.atomicWouldHelp
          ? "announced count; a provenance claim sits elsewhere in the region, but the region is not aria-atomic, so only the changed node is spoken"
          : "announced count; no provenance claim in the announced run",
      });
    }
  }
  for (const call of result.announcerCalls) {
    if (call.counts.length === 0 || call.satisfied) continue;
    add({
      locator: `${call.file.split(sep).join("/")}:${call.line}`,
      expression: call.counts.join(", "),
      why: `announced count composed into ${ANNOUNCER}(); the sentence carries no provenance claim`,
    });
  }
  return out;
}

/** Parse a fragment through the SAME walk the tree gets, so a self-test proves the real code path. */
function scanFragment(fragment: string): { regions: Region[]; violations: Violation[] } {
  const file = join(ROOT, "__fragment__.tsx");
  const result: ScanResult = { files: [file], regions: [], announcerCalls: [], unresolved: [] };
  analyseFile(file, fragment, result);
  return { regions: result.regions, violations: violationsIn(result) };
}

const scanned = scan(ROOT);

/**
 * 🔴 **A SECOND ENUMERATOR, WRITTEN DIFFERENTLY ON PURPOSE, AND IT EXISTS BECAUSE A MUTATION PROVED
 * THE FIRST VERSION OF THIS FLOOR WAS WORTHLESS.**
 *
 * The floor originally compared the scan's file list against `tsxFilesUnder(ROOT)` — the very
 * function the scan uses. Teaching that one function to skip a directory removed those files from
 * BOTH sides, and from the raw-text witness downstream of it, and **the whole guard went green while
 * silently no longer reading the patient search at all.** A baseline taken from the subject vouches
 * for the subject.
 *
 * This walk is iterative where the scanner's is recursive, and matches extensions by pattern where
 * the scanner tests suffixes. **One edit cannot satisfy both.**
 */
function enumerateSourceFilesIndependently(root: string): string[] {
  const found: string[] = [];
  const pending: string[] = [root];
  while (pending.length > 0) {
    const directory = pending.pop() as string;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (/\.tsx?$/u.test(entry.name)) found.push(path);
    }
  }
  return found.sort();
}

const independentFiles = enumerateSourceFilesIndependently(ROOT);

describe("the population this guard walks", () => {
  it("states its own size, so a reader can watch it shrink", () => {
    const withCounts = scanned.regions.filter((region) => region.countSites.length > 0);
    const announcerWithCounts = scanned.announcerCalls.filter((call) => call.counts.length > 0);
    // The population IS the finding. A green that does not state what it walked is the exact thing
    // errata §AL added a fourth report line for. The default reporter hides this on a green run —
    // `npx vitest run <this file> --reporter=verbose` shows it.
    console.log(
      [
        "",
        "POPULATION — announced-figure marker guard",
        `  root                             ${ROOT.split(sep).join("/")}`,
        `  source files parsed              ${scanned.files.length}`,
        `  P1 live regions found            ${scanned.regions.length}`,
        `  P1 regions announcing a count    ${withCounts.length}`,
        `  P1 regions that are atomic       ${scanned.regions.filter((region) => region.atomic).length}`,
        `  P2 ${ANNOUNCER} call sites    ${scanned.announcerCalls.length}`,
        `  P2 call sites carrying a count   ${announcerWithCounts.length}`,
        `  unresolved live-region markers   ${scanned.unresolved.length}`,
        `  REGISTERED OPEN DEFECTS          ${KNOWN_OPEN.size}  <- this green does NOT cover these`,
        "",
      ].join("\n"),
    );
    expect(scanned.files.length).toBeGreaterThan(0);
  });

  it("🔴 parses exactly the files a SECOND, independently written enumerator finds", () => {
    const parsed = new Set(scanned.files);
    const unparsed = independentFiles.filter((file) => !parsed.has(file));
    const phantom = scanned.files.filter((file) => !independentFiles.includes(file));
    expect(
      unparsed.map((file) => file.split(sep).join("/")),
      "these source files exist under the root and this guard did not parse them — its walk has stopped measuring them",
    ).toEqual([]);
    expect(
      phantom.map((file) => file.split(sep).join("/")),
      "this guard claims to have parsed files a plain directory walk cannot find",
    ).toEqual([]);
  });

  it("finds a live region in every file a dumb raw-text witness says has one, and NAMES any it misses", () => {
    const witnessPattern = /aria-live\s*=|role\s*=\s*(?:"(?:status|alert|log)"|\{[^}]*"(?:status|alert|log)")/u;
    // 🔴 The witness reads the INDEPENDENT file list. Reading the scan's own list was the defect a
    // mutation found: a walk that drops a directory drops it from its own witness too.
    const witnessFiles = independentFiles.filter((file) => witnessPattern.test(readFileSync(file, "utf8")));
    const astFiles = new Set(scanned.regions.map((region) => region.file));
    const missed = witnessFiles.filter((file) => !astFiles.has(file));
    expect(
      missed.map((file) => file.split(sep).join("/")),
      "a raw-text witness sees a live-region marker in these files and the AST walk found none — the walk has stopped measuring them",
    ).toEqual([]);
    // 🔴 AND THE OTHER DIRECTION, because a mutation proved this one alone is vacuous: blinding the
    // witness pattern so it matches nothing empties `missed` and the test passes. A witness that
    // cannot say yes cannot mean anything by no — so every file the scan found a region in must be
    // a file the witness independently flags.
    const blindTo = Array.from(astFiles).filter((file) => !witnessFiles.includes(file));
    expect(
      blindTo.map((file) => file.split(sep).join("/")),
      "the raw-text witness cannot see a live region the AST walk found in these files — the witness has gone blind and its silence is worth nothing",
    ).toEqual([]);
    expect(astFiles.size, "no live regions found at all — the scan is measuring nothing").toBeGreaterThan(0);
  });

  it(`finds every ${ANNOUNCER} call site the raw-text witness can see, and NAMES any it misses`, () => {
    const perFile = independentFiles.map((file) => {
      const text = readFileSync(file, "utf8");
      const calls = text.match(new RegExp(`${ANNOUNCER}\\s*\\(`, "gu"));
      // The definition site is `export function announceToWardShell(` — a declaration, not a call.
      const declarations = text.match(new RegExp(`function\\s+${ANNOUNCER}\\s*\\(`, "gu"));
      const expected = (calls ? calls.length : 0) - (declarations ? declarations.length : 0);
      const seen = scanned.announcerCalls.filter((call) => call.file === file).length;
      return { file: file.split(sep).join("/"), expected, seen };
    });
    expect(
      perFile.filter((entry) => entry.expected !== entry.seen),
      `a raw-text witness counts a different number of ${ANNOUNCER} call sites than the AST walk found`,
    ).toEqual([]);
  });

  it("FAILS on any live-region marker it cannot resolve, rather than skipping it", () => {
    expect(
      scanned.unresolved.map(
        (entry) => `${entry.file.split(sep).join("/")}:${entry.line} ${entry.attribute}=${entry.text}`,
      ),
      "these intrinsic elements carry a role/aria-live this guard cannot evaluate — resolve them or teach the scanner, never skip",
    ).toEqual([]);
  });

  it("🔴 CAN report an unresolvable marker — the floor above is empty today and would otherwise never have run", () => {
    const file = join(ROOT, "__fragment__.tsx");
    const probe: ScanResult = { files: [file], regions: [], announcerCalls: [], unresolved: [] };
    analyseFile(file, `const x = <p role={whicheverRole}>{rows.length} shown</p>;`, probe);
    expect(probe.unresolved.map((entry) => entry.attribute)).toEqual(["role"]);
    const liveProbe: ScanResult = { files: [file], regions: [], announcerCalls: [], unresolved: [] };
    analyseFile(file, `const x = <p aria-live={politeness}>{rows.length} shown</p>;`, liveProbe);
    expect(liveProbe.unresolved.map((entry) => entry.attribute)).toEqual(["aria-live"]);
  });
});

describe("the detector can say yes AND no — positive controls before any absence is believed", () => {
  it("flags a bare announced count", () => {
    const { regions, violations } = scanFragment(`const x = <p aria-live="polite">{rows.length} shown</p>;`);
    expect(regions).toHaveLength(1);
    expect(regions[0].countSites).toHaveLength(1);
    expect(violations).toHaveLength(1);
  });

  it("clears a count whose NOUN carries the provenance — the ShellFigure move, tier (a)", () => {
    const { violations } = scanFragment(`const x = <p aria-live="polite">{rows.length} invented figures shown</p>;`);
    expect(violations).toEqual([]);
  });

  it("clears a count with a marker elsewhere in an ATOMIC region — tier (b)", () => {
    const { violations } = scanFragment(
      `const x = (
         <div aria-live="polite" aria-atomic="true">
           <span>{rows.length} shown</span>
           <span>Every number here is an invented figure.</span>
         </div>
       );`,
    );
    expect(violations).toEqual([]);
  });

  it("🔴 still flags that same marker when the region is NOT atomic — only the changed node is spoken", () => {
    const { violations } = scanFragment(
      `const x = (
         <div aria-live="polite">
           <span>{rows.length} shown</span>
           <span>Every number here is an invented figure.</span>
         </div>
       );`,
    );
    expect(violations).toHaveLength(1);
  });

  it("🔴 is NOT satisfied by the sentence that DENIES invention — the substring trap, proved", () => {
    const denials = [
      `<p aria-live="polite">{rows.length} shown. These are not invented figures.</p>`,
      `<p aria-live="polite">{rows.length} shown. No synthetic records appear here.</p>`,
      `<p aria-live="polite">{rows.length} shown. The names are never invented.</p>`,
    ];
    for (const denial of denials) {
      expect(scanFragment(`const x = ${denial};`).violations, denial).toHaveLength(1);
    }
  });

  it("🔴 is NOT satisfied by an unreality word that qualifies NOTHING — the half a mutation proved was unguarded", () => {
    // Widening the predicate to a bare word left every other self-test green, because they all turn
    // on the negation window rather than on the word being attached to what is counted. These are
    // the cases that separate a CLAIM about the data from a word that merely appears near it.
    const passingMentions = [
      `<p aria-live="polite">{rows.length} shown in prototype mode.</p>`,
      `<p aria-live="polite">{rows.length} shown. Synthetic control is on.</p>`,
      `<p aria-live="polite">{rows.length} shown — sample of the day.</p>`,
      `<p aria-live="polite">{rows.length} invented</p>`,
      `<p aria-live="polite">{rows.length} shown. Placeholder layout while this loads.</p>`,
    ];
    for (const mention of passingMentions) {
      expect(scanFragment(`const x = ${mention};`).violations, mention).toHaveLength(1);
    }
  });

  it("clears the wording this codebase already uses for a marker, so the guard does not redden on the house style", () => {
    // Copied in shape, not in words, from `capacity-screen.tsx` and `hub-screen.tsx`. A guard that
    // rejects the wording the project has settled on is a guard that gets turned off.
    const houseStyle = [
      `<p aria-live="polite">{rows.length} shown. Every bed count on this screen is invented.</p>`,
      `<p aria-live="polite">{rows.length} shown. Every bed, wait and referral figure below is invented.</p>`,
      `<p aria-live="polite">{rows.length} shown. No figure here describes a real ward; the beds are synthetic.</p>`,
    ];
    for (const wording of houseStyle) {
      expect(scanFragment(`const x = ${wording};`).violations, wording).toEqual([]);
    }
  });

  it("🔴 rejects that same house wording when it is NEGATED inside the claim, where a look-behind cannot see", () => {
    const denials = [
      `<p aria-live="polite">{rows.length} shown. Every bed count on this screen is not invented.</p>`,
      `<p aria-live="polite">{rows.length} shown. The figures below are never invented.</p>`,
    ];
    for (const denial of denials) {
      expect(scanFragment(`const x = ${denial};`).violations, denial).toHaveLength(1);
    }
  });

  it("does not fire on a live region that announces no count at all", () => {
    const { regions, violations } = scanFragment(
      `const x = <p aria-live="polite">Beat {beat} of {LAST_BEAT} — {caption.heading} at {formatInstant(at)}</p>;`,
    );
    expect(regions).toHaveLength(1);
    expect(regions[0].countSites).toEqual([]);
    expect(violations).toEqual([]);
  });

  it("does not fire on a count used only as a CONDITION — a test is not an announcement", () => {
    const { violations } = scanFragment(
      `const x = <p aria-live="polite">{rows.length === 0 ? "Nothing here." : "Something here."}</p>;`,
    );
    expect(violations).toEqual([]);
  });

  it("🔴 does not fire on a VISIBLE count — the chip counts are excluded structurally, not exempted", () => {
    const { regions, violations } = scanFragment(
      `const x = (
         <div className={styles.chips} role="group" aria-label="Filter the list">
           <button>All names <span>{allTeams.length}</span></button>
           <button>Names that read alike <span>{namesInCollisions}</span></button>
         </div>
       );`,
    );
    expect(regions, "role=group is not a live region, so a visible chip count is never in the population").toEqual([]);
    expect(violations).toEqual([]);
  });

  it(`flags a count laundered through ${ANNOUNCER}, and clears it when the noun carries provenance`, () => {
    expect(scanFragment(`${ANNOUNCER}(\`Tasks opened. \${items.length} outstanding.\`);`).violations).toHaveLength(1);
    expect(
      scanFragment(`${ANNOUNCER}(\`Tasks opened. \${items.length} invented tasks outstanding.\`);`).violations,
    ).toEqual([]);
  });

  it("resolves a role that is conditionally a live region, rather than reporting it unresolvable", () => {
    const { regions } = scanFragment(
      `const x = <p role={attempted ? "alert" : undefined}>{rows.length} outstanding</p>;`,
    );
    expect(regions).toHaveLength(1);
  });
});

/**
 * 🔴 **TWO OPEN DEFECTS, REGISTERED BECAUSE THEIR FIX IS THE OWNER'S TO WRITE — NOT EXEMPTIONS.**
 *
 * ⚠️ **A GREEN RUN OF THIS FILE DOES NOT COVER THESE TWO. IT COVERS EVERYTHING ELSE.** They are
 * measured instances of exactly the class this file exists for, and they are listed here rather
 * than fixed because each needs a decision this guard has no standing to make:
 *
 *   referrals/referral-match.tsx  `noBed.total`
 *       A `role="alert"` refusal whose sentences have been through three named review rounds. Its
 *       counts are of UNITS, which the hub banner calls the real network this prototype models —
 *       but the acceptance verdicts that rule them out are invented, so the announced claim is
 *       invented and the marker's wording is a clinical-refusal wording question. Errata §U also
 *       governs what may be said in the same breath as a refusal. **Owner call.**
 *
 *   ward-management-network.tsx   `primary.verdict.gates.length`
 *       A seven-thousand-character comparison panel marked `aria-live="polite"` in its entirety,
 *       with no provenance claim anywhere inside it. The flagged expression is a control's own
 *       label, and it is the weakest figure in the panel — the bed counts and capacity figures
 *       beside it are worse and this guard's subject does not reach them. **The fix is probably
 *       not a marker at all: it is whether a panel that size should be a live region. Owner call.**
 *
 * The register is EXACT-MATCH in both directions. A new bare announcement fails because it is not
 * registered; a registered one that gets fixed fails because it is still registered. **Neither can
 * happen quietly, which is the only thing that makes a register different from an exemption.**
 */
const KNOWN_OPEN = new Map<string, string>([
  [
    "src/components/ward-management/referrals/referral-match.tsx|noBed.total",
    "refusal wording is the owner's; see the block above",
  ],
  [
    "src/components/ward-management/ward-management-network.tsx|primary.verdict.gates.length",
    "a whole-panel live region; the fix is a design decision, see the block above",
  ],
]);

function registerKeyOf(violation: Violation): string {
  return `${violation.locator.replace(/:\d+$/u, "")}|${violation.expression}`;
}

describe("🔴 every announced count in the ward tree carries its marker", () => {
  it("names every live region and every shell announcement that announces a figure bare", () => {
    const violations = violationsIn(scanned);
    const unregistered = violations.filter((violation) => !KNOWN_OPEN.has(registerKeyOf(violation)));
    expect(
      unregistered.map((violation) => `${violation.locator}  [${violation.expression}]  ${violation.why}`),
      [
        "An announced figure is a claim a screen-reader user cannot check against anything on screen.",
        "Fix it in the utterance, not on the page:",
        "  (a) preferred — put the provenance in the NOUN the figure counts, in the same run as the figure;",
        '  (b) or put a provenance claim in the live region AND set aria-atomic="true" on it.',
        "Appending a marker clause to a per-keystroke announcement is NOT the fix — see this file's header.",
      ].join("\n"),
    ).toEqual([]);
  });

  it("🔴 fails when a REGISTERED open defect has been fixed, so the register can never overstate itself", () => {
    const open = new Set(violationsIn(scanned).map(registerKeyOf));
    const stale = Array.from(KNOWN_OPEN.keys()).filter((key) => !open.has(key));
    expect(
      stale,
      "these are registered as open and this guard can no longer find them. If they were fixed, DELETE each line from KNOWN_OPEN — a register that outlives its defects is how a guard's green starts covering nothing.",
    ).toEqual([]);
  });
});
