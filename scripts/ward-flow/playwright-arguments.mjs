/** Partition Playwright arguments before replacing file filters for groups/shards. */
export function splitPlaywrightArguments(args) {
  const options = [],
    files = [];
  const takesValue =
    /^(?:--(?:project|workers|reporter|output|shard|timeout|retries|max-failures|config|grep|grep-invert|global-timeout|repeat-each|test-list|test-list-invert)|-[cg])$/u;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg.startsWith("-")) {
      files.push(arg);
      continue;
    }
    options.push(arg);
    if (takesValue.test(arg)) {
      if (!args[index + 1] || args[index + 1].startsWith("-")) throw new Error(`${arg} requires a value`);
      options.push(args[++index]);
      if (arg === "--project")
        while (args[index + 1] && !args[index + 1].startsWith("-") && !/[\\/]|\.[cm]?[jt]sx?$/u.test(args[index + 1]))
          options.push(args[++index]);
    }
  }
  return { options, files };
}
