// @ts-check
/** Offline migration-history lint, not proof of database permissions or live RLS. */
/** @param {string} sql */
function tokens(sql) {
  const words = [];
  let cursor = 0;
  while (cursor < sql.length) {
    const rest = sql.slice(cursor);
    if (rest.startsWith("--")) {
      const end = sql.indexOf("\n", cursor);
      cursor = end < 0 ? sql.length : end + 1;
    } else if (rest.startsWith("/*")) {
      let depth = 1;
      cursor += 2;
      while (cursor < sql.length && depth) {
        if (sql.startsWith("/*", cursor)) {
          depth++;
          cursor += 2;
        } else if (sql.startsWith("*/", cursor)) {
          depth--;
          cursor += 2;
        } else cursor++;
      }
      if (depth) return ["invalid-sql"];
    } else if (rest[0] === "'") {
      const literal = /^'(?:''|[^'])*'/.exec(rest);
      if (!literal) return ["invalid-sql"];
      cursor += literal[0].length;
    } else if (/^\$(?:[A-Za-z_]\w*)?\$/.test(rest)) {
      const tag = /^\$(?:[A-Za-z_]\w*)?\$/.exec(rest)?.[0];
      if (!tag) return ["invalid-sql"];
      const end = sql.indexOf(tag, cursor + tag.length);
      if (end < 0) return ["invalid-sql"];
      cursor = end + tag.length;
    } else {
      const token = /^(?:"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9$]*|[.;])/.exec(rest);
      if (token) {
        words.push(token[0].startsWith('"') ? token[0] : token[0].toLowerCase());
        cursor += token[0].length;
      } else cursor++;
    }
  }
  return words;
}

/** @param {{name:string,sql:string}[]} migrations */
export function migrationPolicyIssues(migrations) {
  const tables = new Map();
  const unsupported = [];
  for (const { name, sql } of [...migrations].sort((a, b) => a.name.localeCompare(b.name))) {
    const words = tokens(sql);
    if (words.includes("invalid-sql")) unsupported.push(`${name}: unterminated SQL requires policy review`);
    const identifier = (word) => (word?.startsWith('"') ? word.slice(1, -1).replaceAll('""', '"') : word);
    const qualified = (index) =>
      words[index + 1] === "."
        ? { name: `${identifier(words[index])}.${identifier(words[index + 2])}`, end: index + 3 }
        : null;
    for (let index = 0; index < words.length; index++) {
      if (
        words[index] === "create" &&
        ["table", "unlogged", "temporary", "temp", "foreign"].includes(words[index + 1])
      ) {
        let start = index + 1;
        if (words[start] !== "table") start++;
        if (words[start] !== "table") continue;
        start++;
        if (words.slice(start, start + 3).join(" ") === "if not exists") start += 3;
        const table = qualified(start);
        if (!table) {
          unsupported.push(`${name}: unqualified CREATE TABLE requires explicit policy review`);
          continue;
        }
        if (!tables.has(table.name)) tables.set(table.name, { rls: false, policies: new Set(), source: name });
      }
      if (words[index] === "drop" && words[index + 1] === "table")
        unsupported.push(`${name}: table removal requires explicit policy review`);
      if (words[index] === "alter" && words[index + 1] === "table") {
        let start = index + 2;
        if (words.slice(start, start + 2).join(" ") === "if exists") start += 2;
        if (words[start] === "only") start++;
        const table = qualified(start);
        if (table && words[table.end] === "rename")
          unsupported.push(`${name}: table rename requires explicit policy review`);
        const state = table && tables.get(table.name);
        if (state && words.slice(table.end + 1, table.end + 4).join(" ") === "row level security") {
          if (words[table.end] === "enable") state.rls = true;
          if (words[table.end] === "disable") state.rls = false;
        }
      }
      if (["create", "drop"].includes(words[index]) && words[index + 1] === "policy") {
        const start = words.slice(index + 2, index + 4).join(" ") === "if exists" ? index + 4 : index + 2;
        const on = words[start + 1] === "on" ? start + 2 : -1;
        const table = on > 0 ? qualified(on) : null;
        const state = table && tables.get(table.name);
        if (state) {
          if (words[index] === "create") state.policies.add(identifier(words[start]));
          else state.policies.delete(identifier(words[start]));
        }
      }
    }
  }
  return [
    ...unsupported,
    ...[...tables].flatMap(([table, state]) => [
      ...(!state.rls ? [`${table} (${state.source}): RLS is not enabled`] : []),
      ...(!state.policies.size ? [`${table} (${state.source}): no policy`] : []),
    ]),
  ];
}
