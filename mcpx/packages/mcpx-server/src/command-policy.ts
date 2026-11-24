// Defense-in-depth argument policy for stdio MCP servers.
//
// IMPORTANT: this is harm reduction, NOT a security boundary. The allowlisted
// commands (node/npx/uvx/docker) exist to execute arbitrary code, so no
// argument check can make them "safe" - the durable control is runtime
// isolation of the workload (tracked separately). This layer only blocks the
// most direct inline-exec and host-access vectors so a single malicious config
// line cannot trivially read secrets or break out.

// node flags that evaluate inline code or preload arbitrary modules.
const NODE_INLINE_EXEC_FLAGS = [
  "-e",
  "--eval",
  "-p",
  "--print",
  "-r",
  "--require",
  "--import",
];

// docker run flags that grant host filesystem, host namespaces, or extra
// privileges. The interception path adds the flags it needs itself, so these
// only ever come from the untrusted config.
const DANGEROUS_DOCKER_FLAGS = [
  "--privileged",
  "-v",
  "--volume",
  "--mount",
  "--pid",
  "--cap-add",
  "--device",
  "--ipc",
  "--userns",
];

function forbiddenFlagsFor(command: string): string[] {
  switch (command) {
    case "node":
      return NODE_INLINE_EXEC_FLAGS;
    case "docker":
      return DANGEROUS_DOCKER_FLAGS;
    default:
      // npx/uvx run arbitrary packages by design - argument filtering buys
      // nothing there, so we do not pretend to guard them here.
      return [];
  }
}

function matchesFlag(arg: string, flag: string): boolean {
  if (arg === flag || arg.startsWith(`${flag}=`)) {
    return true;
  }
  // single-dash short flags can be glued to their value, e.g. `-e"code"`.
  const isShortFlag = flag.length === 2 && flag[0] === "-" && flag[1] !== "-";
  return isShortFlag && arg.startsWith(flag) && arg.length > flag.length;
}

/**
 * Returns the first argument that is forbidden for the given command, or
 * undefined if all arguments are allowed.
 */
export function findForbiddenArg(
  command: string,
  args: string[],
): string | undefined {
  const flags = forbiddenFlagsFor(command);
  if (flags.length === 0) {
    return undefined;
  }
  for (const arg of args) {
    if (flags.some((flag) => matchesFlag(arg, flag))) {
      return arg;
    }
  }
  return undefined;
}
