import { env } from "./env.js";
import { StdioTargetServer } from "./model/target-servers.js";
import { DockerService } from "./services/docker.js";

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
    return Promise.reject(`No arguments specified.`);
  }

  switch (command) {
    case "npx":
      return { command, args };
    case "docker": {
      if (!env.DIND_ENABLED) {
        return Promise.reject(
          "Docker in Docker is not enabled. Cannot start docker mcp server.",
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
