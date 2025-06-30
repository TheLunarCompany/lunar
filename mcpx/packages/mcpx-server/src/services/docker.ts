import { Logger } from "winston";
import { Docker } from "docker-cli-js";
import { z } from "zod";
import { promises as fsPromises } from "fs";
import * as path from "path";
import * as os from "os";
import * as util from "util";
import { exec } from "child_process";
import { generateDockerFile, parseDockerArgs } from "./docker-helpers.js";

const execPromise = util.promisify(exec);
const CA_CERT_FILENAME = "mitm_proxy.crt";
export class DockerService {
  private docker: Docker;
  private logger: Logger;
  private certPath: string;

  constructor(certPath: string, logger: Logger) {
    const echo = logger.level === "verbose" || logger.level === "silly";
    this.docker = new Docker({ echo });
    this.certPath = certPath;
    this.logger = logger.child({ service: "DockerService" });
  }

  public async createImageWithCa(args: string[]): Promise<string[]> {
    if (!this.certPath) {
      return Promise.reject(
        `CA certificate path is not set. Please provide a valid path.`,
      );
    }
    await fsPromises.access(this.certPath).catch((accessError) => {
      return Promise.reject(
        `CA certificate at '${this.certPath}' is not accessible. Error: ${accessError}`,
      );
    });

    const dockerArgs = parseDockerArgs(args);

    if (!dockerArgs.image) {
      return Promise.reject(`Failed to parse Docker command.`);
    }

    this.logger.debug(
      `Starting to modify lunar.dev Intercepted Docker image from ${dockerArgs.originalImage}`,
    );
    const detectedOsRaw = await this.detectImageOs(dockerArgs.originalImage);
    const detectedOs = z
      .enum(["debian", "ubuntu", "alpine", "centos", "rhel", "fedora"])
      .safeParse(detectedOsRaw || "");
    if (!detectedOs.success) {
      return Promise.reject(
        `Failed to detect OS for image ${dockerArgs.originalImage}.`,
      );
    }
    const tempDir = await fsPromises
      .mkdtemp(path.join(os.tmpdir(), "docker-ca-build-"))
      .catch((mkdtempError) => {
        return Promise.reject(
          `Failed to create temporary directory for Docker build: ${mkdtempError}`,
        );
      });

    const dockerfilePath = path.join(tempDir, "Dockerfile");

    const caCertTempPath = path.join(tempDir, CA_CERT_FILENAME);
    await fsPromises
      .copyFile(this.certPath, caCertTempPath)
      .catch((copyError) => {
        return Promise.reject(
          `Failed to copy CA certificate to ${caCertTempPath}: ${copyError}`,
        );
      });

    let originalUser = "root";
    await this.docker
      .command(`pull ${dockerArgs.originalImage}`)
      .catch((pullError) => {
        return Promise.reject(
          `Failed to pull original image ${dockerArgs.originalImage}. Error: ${pullError}`,
        );
      });

    const inspectOutput = await this.docker.command(
      `inspect ${dockerArgs.originalImage}`,
    );
    const inspectData = JSON.parse(inspectOutput.raw);
    if (
      inspectData &&
      inspectData.length > 0 &&
      inspectData[0].Config &&
      inspectData[0].Config.User
    ) {
      if (inspectData[0].Config.User !== "") {
        originalUser = inspectData[0].Config.User;
      }
    }

    const dockerFileContent = generateDockerFile(detectedOs.data)({
      originalImageName: dockerArgs.originalImage,
      originalUser,
      caCertFilename: CA_CERT_FILENAME,
    });

    await fsPromises
      .writeFile(dockerfilePath, dockerFileContent, "utf8")
      .catch((writeError) => {
        return Promise.reject(
          `Failed to write Dockerfile at ${dockerfilePath}. Error: ${writeError}`,
        );
      });

    this.logger.debug(
      `Building lunar.dev modified Docker image from ${dockerArgs.originalImage}`,
    );
    const buildCommand = `docker build -q -t ${dockerArgs.image} .`;
    const { stderr } = await execPromise(buildCommand, { cwd: tempDir }).catch(
      (error) => {
        return Promise.reject(
          `Failed to build Docker image ${dockerArgs.image}: ${error}`,
        );
      },
    );
    if (stderr) {
      return Promise.reject(
        `Failed to build Docker image ${dockerArgs.image}.`,
      );
    }
    this.logger.debug(`Successfully built Docker image ${dockerArgs.image}.`);

    fsPromises
      .rm(tempDir, { recursive: true, force: true })
      .catch((cleanupError) => {
        this.logger.error(
          `Error cleaning up temporary directory ${tempDir}:`,
          cleanupError,
        );
      });

    return dockerArgs.args;
  }

  private async detectImageOs(imageName: string): Promise<string> {
    await this.docker.command(`pull ${imageName}`).catch((pullError) => {
      return Promise.reject(
        `Failed to pull image ${imageName}. Error: ${pullError}`,
      );
    });

    const commandToRun = `run --rm --entrypoint "" ${imageName} sh -c 'grep -E "^ID=" /etc/os-release | cut -d= -f2'`;
    const { raw } = await this.docker.command(commandToRun).catch((error) => {
      return Promise.reject(
        `Failed to run command to detect OS for image ${imageName}. Error: ${error}`,
      );
    });
    return raw.trim();
  }
}
