import { env } from "./env.js";
import { StdioTargetServer } from "./model.js";
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
      const modifiedArgs = await dockerService
        .createImageWithCa(args)
        .catch((error) => {
          return Promise.reject(
            `Failed to create Docker image with CA: ${error}`,
          );
        });
      return {
        command,
        args: modifiedArgs,
      };
    }

    default:
      return { command, args };
  }
}
