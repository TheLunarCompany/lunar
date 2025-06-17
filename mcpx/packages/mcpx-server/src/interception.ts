import { TargetServer } from "./model.js";
import { env } from "./env.js";
// # how to take the first 500: docker logs sandbox-lunar-proxy-2 in bash but with exception =  // -n 500

export async function prepareCommand(targetServer: TargetServer): Promise<{
  command: string;
  args: string[] | undefined;
  error: string | undefined;
}> {
  const command = targetServer.command;
  const args = targetServer.args;
  if (!args) {
    return { command, args, error: undefined };
  }
  switch (command) {
    case "npx":
      return { command, args, error: undefined };
    case "docker":
      if (!env.DIND_ENABLED) {
        return {
          command: "",
          args: [],
          error:
            "Not running in a privileged container/pod. Cannot start docker mcp server.",
        };
      }
      return { command, args: await prepareDockerArgs(args), error: undefined };

    default:
      return { command, args, error: undefined };
  }
}

async function prepareDockerArgs(args: string[]): Promise<string[]> {
  if (args.includes("-q") || args.includes("--quiet")) {
    return args;
  }
  args = args.slice(1);
  return ["run", "--quiet", ...args];
}
