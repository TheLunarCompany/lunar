import { AppConfig } from "@mcpx/shared-model";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { Logger } from "winston";

const MCPX_SERVER_URL =
  process.env["MCPX_SERVER_URL"] || "http://localhost:9000";

export class AppConfigService {
  private logger: Logger;
  private client: AxiosInstance;

  constructor(logger: Logger) {
    this.logger = logger.child({ service: "AppConfigService" });
    this.client = axios.create({
      baseURL: MCPX_SERVER_URL,
    });
  }

  async update({
    payload,
  }: {
    payload: AppConfig;
  }): Promise<AxiosResponse<AppConfig>> {
    this.logger.info(`Updating app config: ${JSON.stringify(payload)}`);
    return this.client.patch("/app-config", payload);
  }
}
