import {
  CreateTargetServerRequest,
  TargetServer,
  UpdateTargetServerRequest,
} from "@mcpx/shared-model";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { Logger } from "winston";

const MCPX_SERVER_URL =
  process.env["MCPX_SERVER_URL"] || "http://127.0.0.1:9000";

export class TargetServersService {
  private logger: Logger;
  private client: AxiosInstance;

  constructor(logger: Logger) {
    this.logger = logger.child({ service: "TargetServer" });
    this.client = axios.create({
      baseURL: MCPX_SERVER_URL,
    });
  }

  async create({
    payload,
  }: {
    payload: CreateTargetServerRequest;
  }): Promise<AxiosResponse<TargetServer>> {
    this.logger.debug(`Creating target server: ${JSON.stringify(payload)}`);
    return this.client.post<TargetServer>("/target-server", payload);
  }

  async update({
    name,
    payload,
  }: {
    name: string;
    payload: UpdateTargetServerRequest;
  }): Promise<AxiosResponse<TargetServer>> {
    this.logger.debug(
      `Updating target server: ${name} ${JSON.stringify(payload)}`,
    );
    return this.client.patch(`/target-server/${name}`, payload);
  }

  async delete({ name }: { name: string }): Promise<void> {
    this.logger.debug(`Deleting target server: ${name}`);
    return this.client.delete(`/target-server/${name}`);
  }
}
