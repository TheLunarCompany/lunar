import { env } from "./env.js";
import { FailedToConnectToTargetServer } from "./errors.js";
import { StdioTargetServer } from "./model/target-servers.js";
import { DockerService } from "./services/docker.js";

// The returned error should be a FailedToConnectToTargetServer.
export async function prepareCommand(
  targetServer: StdioTargetServer,
  dockerService: DockerService,
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

      if (!env.INTERCEPTION_ENABLED) {
        return { command, args };
      }

      try {
        const modifiedArgs = await dockerService.createImageWithCa(args);
        return {
          command,
          args: modifiedArgs,
        };
      } catch (_) {
        return { command, args };
      }
    }

    default:
      return { command, args };
  }
}
