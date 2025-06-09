import { TargetServer } from "./model.js";

// This function prepares the command and arguments for the target server.
// It allows to wire Lunar Interceptor to the target server command.
export async function prepareCommand(targetServer: TargetServer): Promise<{
  command: string;
  args: string[] | undefined;
}> {
  const command = targetServer.command;
  const args = targetServer.args;
  if (!args) {
    return { command, args };
  }
  switch (command) {
    case "npx":
      return { command, args };
    case "docker":
      return { command, args: await prepareDockerArgs(args) };
    default:
      return { command, args };
  }
}

async function prepareDockerArgs(args: string[]): Promise<string[]> {
  if (args.includes("-q") || args.includes("--quiet")) {
    return args;
  }
  args = args.slice(1);
  return ["run", "--quiet", ...args];
}
