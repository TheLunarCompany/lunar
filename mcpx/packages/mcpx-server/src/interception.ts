import { TargetServer } from "./model.js";

// This function prepares the command and arguments for the target server.
// It allows to wire Lunar Interceptor to the target server command.
export function prepareCommand(targetServer: TargetServer): {
  command: string;
  args: string[] | undefined;
} {
  const command = targetServer.command;
  const args = targetServer.args;
  if (!args) {
    return { command, args };
  }
  switch (command) {
    case "npx":
      return { command, args: prepareNpxArgs(args) };
    default:
      return { command, args };
  }
}

function prepareNpxArgs(args: string[]): string[] {
  return ["--node-options", "-r ./lunar-interceptor.ts", ...args];
}
