import {
  InitiateServerAuthResult,
  TargetServer,
  TargetServerRequest,
  UpdateTargetServerRequest,
} from "@mcpx/shared-model";
import { loggableError } from "@mcpx/toolkit-core/logging";
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
    payload: TargetServerRequest;
  }): Promise<AxiosResponse<TargetServer>> {
    const { env: _env, ...clean } = payload as unknown as Record<
      string,
      unknown
    >;
    this.logger.debug(`Creating target server: ${JSON.stringify(clean)}`);
    return this.client.post<TargetServer>("/target-server", payload);
  }

  async update({
    name,
    payload,
  }: {
    name: string;
    payload: UpdateTargetServerRequest;
  }): Promise<AxiosResponse<TargetServer>> {
    const { env: _env, ...clean } = payload as unknown as Record<
      string,
      unknown
    >;
    this.logger.debug(
      `Updating target server: ${name} ${JSON.stringify(clean)}`,
    );
    return this.client.patch(
      `/target-server/${encodeURIComponent(name)}`,
      payload,
    );
  }

  async delete({ name }: { name: string }): Promise<void> {
    this.logger.debug(`Deleting target server: ${name}`);
    return this.client.delete(`/target-server/${encodeURIComponent(name)}`);
  }

  async initiateAuth({
    name,
    callbackUrl,
  }: {
    name: string;
    callbackUrl?: string;
  }): Promise<InitiateServerAuthResult> {
    this.logger.debug(`Initiating auth for target server: ${name}`);
    try {
      const { data, status } = await this.client.post<
        InitiateServerAuthResult["data"]
      >(`/auth/initiate/${encodeURIComponent(name)}`, {
        callbackUrl,
      });
      if (status !== 200 && status !== 202) {
        throw new Error(`Unexpected status code: ${status}`);
      }
      return { data, status } as InitiateServerAuthResult;
    } catch (e) {
      const error = loggableError(e);
      this.logger.error(
        `Failed to initiate auth for target server: ${name}`,
        error,
      );
      throw e;
    }
  }

  async oauthCallback({
    code,
    state,
    error,
  }: {
    code?: unknown;
    state?: unknown;
    error?: unknown;
  }): Promise<string> {
    this.logger.debug(`Handling auth callback`, { code, error, state });
    const result = await this.client.get(`/oauth/callback`, {
      params: { code, error, state },
      headers: {
        "Content-Type": "application/json",
      },
    });
    this.logger.debug(`Auth callback successful`, { result: result.data });
    return result.data;
  }
}
