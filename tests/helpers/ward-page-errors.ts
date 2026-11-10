import { test as base, expect, type BrowserContext, type ConsoleMessage, type Page } from "playwright/test";

/**
 * M108 (master audit list, 10 Nov 2026): no page errors in the journeys.
 *
 * The release-gate journeys import `test` and `expect` from here instead of from `playwright/test`.
 * An automatic fixture watches every page the test's own browser context opens and fails the test
 * after it finishes if any page threw (`pageerror`), logged a console error, or warned about
 * hydration or invalid nesting. React reports both of those through the console in development,
 * so a journey that hydrates badly or puts a <div> in a <p> goes red even when every click worked.
 * It adds no browser project and no CI run: the same journeys, in the same job, simply fail.
 *
 * Pages a spec opens from its own `browser.newContext()` are not watched automatically; pass that
 * context to `watchPageErrors` and check the list it returns.
 */

/** Console warnings that are errors in all but name. Everything at `error` level counts anyway. */
const PROBLEM_WARNING =
  /hydrat|did not match|cannot be a (?:descendant|child) of|cannot contain a nested|validateDOMNesting|In HTML, <\w+> cannot/i;

/**
 * Problems already known and filed, each matched by its exact text and the page it appears on. A
 * known problem is still attached to the test's report; it just does not fail the journey. Fixing
 * one means deleting its line here. Add a line only with an issue or audit item that tracks the fix.
 */
const KNOWN_PROBLEMS: readonly { page: RegExp; text: RegExp; why: string }[] = [
  {
    // Found by this fixture on its first run, 10 Nov 2026 (M108). React's development build says a
    // component on the Legal forms page sets state before it has mounted. No visible fault yet.
    page: /\/ward-flow\/legal-forms(?:[?#]|$)/,
    text: /^Can't perform a React state update on a component that hasn't mounted yet\./,
    why: "M108 defect: state set before mount on Legal forms; component not yet traced",
  },
];

function isKnown(problem: { url: string; text: string }): boolean {
  return KNOWN_PROBLEMS.some((known) => known.page.test(problem.url) && known.text.test(problem.text));
}

/** One line per problem, with the page address, so the failure says where it happened. */
export function describeConsoleProblem(
  message: Pick<ConsoleMessage, "type" | "text" | "location">,
  url: string,
): string | null {
  const type = message.type();
  if (type !== "error" && !(type === "warning" && PROBLEM_WARNING.test(message.text()))) return null;
  const at = message.location();
  const where = at?.url ? ` (${at.url.replace(/^https?:\/\/[^/]+/, "")}:${at.lineNumber})` : "";
  return `console ${type} on ${url}: ${message.text()}${where}`;
}

function watchPage(page: Page, problems: string[], known: string[]): void {
  page.on("pageerror", (error) => {
    const line = `page error on ${page.url()}: ${error.message}`;
    (isKnown({ url: page.url(), text: error.message }) ? known : problems).push(line);
  });
  page.on("console", (message) => {
    const problem = describeConsoleProblem(message, page.url());
    if (!problem) return;
    (isKnown({ url: page.url(), text: message.text() }) ? known : problems).push(problem);
  });
}

/** Watch every page a context has or opens. Returns the live list of problems found. */
export function watchPageErrors(context: BrowserContext, known: string[] = []): string[] {
  const problems: string[] = [];
  for (const page of context.pages()) watchPage(page, problems, known);
  context.on("page", (page) => watchPage(page, problems, known));
  return problems;
}

export const test = base.extend<{ failOnPageErrors: void }>({
  failOnPageErrors: [
    async ({ context }, use, testInfo) => {
      const known: string[] = [];
      const problems = watchPageErrors(context, known);
      await use();
      if (known.length > 0)
        await testInfo.attach("known-page-errors.txt", { body: known.join("\n"), contentType: "text/plain" });
      // A test that already failed keeps its own error; the page errors are attached beside it.
      if (problems.length > 0) {
        await testInfo.attach("page-errors.txt", { body: problems.join("\n"), contentType: "text/plain" });
        if (testInfo.status === testInfo.expectedStatus)
          expect(problems, "the journey raised page or console errors (M108)").toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect };
