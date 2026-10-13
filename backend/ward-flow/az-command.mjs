// Builds a shell-free Azure CLI invocation. On Windows `az` is a batch wrapper (az.cmd), which Node
// refuses to spawn without a shell, and `shell: true` would join arguments unescaped so values such
// as `||` in a JMESPath query or a crafted administrator name could run other commands. Instead we
// run cmd.exe ourselves with every argument quoted for the C runtime and every cmd metacharacter
// caret-escaped twice (once for cmd.exe, once more for the az.cmd wrapper's own re-parse).
const CMD_META = /([()\][%!^"`<>&|;, *?])/g;

/** Quote one argument so cmd.exe and then az.cmd hand it to Azure CLI unchanged. */
export function escapeWindowsArgument(value) {
  let arg = String(value);
  arg = arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, "$1$1");
  arg = `"${arg}"`;
  return arg.replace(CMD_META, "^$1").replace(CMD_META, "^$1");
}

/** Returns { command, args, options } for spawnSync; never uses `shell: true`. */
export function azInvocation(args, platform = process.platform, env = process.env) {
  for (const arg of args) {
    if (typeof arg !== "string") throw new TypeError("Azure CLI arguments must be strings");
    // cmd.exe cannot carry these safely, and no Ward Flow setting legitimately contains them.
    if (/[\0\r\n]/.test(arg)) throw new Error("Azure CLI argument contains a line break or NUL character");
  }
  const options = { encoding: "utf8", maxBuffer: 4 * 1024 * 1024, shell: false };
  if (platform !== "win32") return { command: "az", args: [...args], options };
  const line = ["az.cmd", ...args.map(escapeWindowsArgument)].join(" ");
  return {
    command: env.ComSpec || env.COMSPEC || "cmd.exe",
    args: ["/d", "/s", "/c", `"${line}"`],
    options: { ...options, windowsVerbatimArguments: true },
  };
}
