import { findForbiddenArg } from "./command-policy.js";
import { env } from "./env.js";
import { FailedToConnectToTargetServer } from "./errors.js";
import { StdioTargetServer } from "./model/target-servers.js";
import { injectEnvIntoDockerArgs } from "./services/docker-helpers.js";

// The returned error should be a FailedToConnectToTargetServer.
export async function prepareCommand(
  targetServer: StdioTargetServer,
  resolvedEnv: Record<string, string>,
): Promise<{
  command: string;
  args: string[];
}> {
  const command = targetServer.command;
  const args = targetServer.args || [];

  if (args.length === 0) {
    return Promise.reject(
      new FailedToConnectToTargetServer("No arguments specified."),
    );
  }

  // Defense-in-depth: reject the most direct inline-exec / host-access vectors
  // before spawning. This is harm reduction, not a boundary - see command-policy.ts.
  const forbiddenArg = findForbiddenArg(command, args);
  if (forbiddenArg) {
    return Promise.reject(
      new FailedToConnectToTargetServer(
        `Argument "${forbiddenArg}" is not allowed for command "${command}".`,
      ),
    );
  }

  switch (command) {
    case "npx":
      return { command, args };
    case "uvx":
      return { command, args };
    case "node":
      return { command, args };
    case "docker": {
      if (!env.DIND_ENABLED) {
        return Promise.reject(
          new FailedToConnectToTargetServer(
            "Docker in Docker is not enabled. Cannot start docker mcp server. Please try to run MCPX server with '--privileged' access and try again.",
          ),
        );
      }
      // Spawned via the SDK's StdioClientTransport with shell:false, so the
      // image and args are passed as an argv array (no host shell). We only
      // forward the resolved env into the container as -e KEY=VALUE flags.
      return { command, args: injectEnvIntoDockerArgs(args, resolvedEnv) };
    }

    default:
      return { command, args };
  }
}
