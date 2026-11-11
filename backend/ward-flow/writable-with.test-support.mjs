// @ts-check
// Test support for offline pool doubles. The store writes a save's steps in one statement (a
// data-modifying WITH, so they commit or fail together in one round trip). A double written for
// the separate statements splits it back here: each step comes out on its own, with its
// placeholders renumbered from $1 in the order they had, and its own values.

/**
 * The steps of `WITH a AS (step), b AS (step) final`, or the statement itself when it is not one
 * whose first step writes.
 * @param {string} sql
 * @param {unknown[]} [values]
 * @returns {Array<{ sql: string, values: unknown[] }>}
 */
function statementSteps(sql, values = []) {
  if (!/^WITH \w+ AS \((INSERT|UPDATE|DELETE) /.test(sql)) return [{ sql, values }];
  const steps = [];
  let index = "WITH ".length;
  for (;;) {
    const head = /^(\w+) AS \(/.exec(sql.slice(index));
    if (!head) break;
    const start = index + head[0].length;
    let depth = 1;
    let end = start;
    for (; end < sql.length && depth; end++) {
      if (sql[end] === "(") depth++;
      else if (sql[end] === ")") depth--;
    }
    steps.push(sql.slice(start, end - 1));
    index = end;
    if (sql.startsWith(", ", index)) index += 2;
    else break;
  }
  steps.push(sql.slice(index).trimStart());
  return steps.map((step) => {
    // Each step's own placeholders, lowest first, become $1, $2 and so on.
    const used = [...new Set([...step.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])))].sort((a, b) => a - b);
    return {
      sql: step.replace(/\$(\d+)/g, (_, number) => `$${used.indexOf(Number(number)) + 1}`),
      values: used.map((number) => values[number - 1]),
    };
  });
}

/**
 * A double's `query` that takes such a statement as its steps, in order, and answers with the
 * last step's result, as PostgreSQL answers with the final statement's.
 * @param {(sql: string, values: any[]) => Promise<any>} query
 * @returns {(sql: string, values?: any[]) => Promise<any>}
 */
export function throughSteps(query) {
  return async (sql, values = []) => {
    let result;
    for (const step of statementSteps(sql, values)) result = await query(step.sql, step.values);
    return result;
  };
}
