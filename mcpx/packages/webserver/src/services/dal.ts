import { SerializedAppConfig, SystemState } from "@mcpx/shared-model";

export class DAL {
  private _currentSystemState: SystemState | null = null;
  private _currentAppConfig: SerializedAppConfig | null = null;

  async fetchCurrentSystemState(): Promise<SystemState | null> {
    return Promise.resolve(this._currentSystemState);
  }

  async fetchCurrentAppConfig(): Promise<SerializedAppConfig | null> {
    return Promise.resolve(this._currentAppConfig);
  }

  async updateCurrentSystemState(state: SystemState): Promise<void> {
    return new Promise((resolve) => {
      this._currentSystemState = state;
      resolve();
    });
  }

  async updateCurrentAppConfig(config: SerializedAppConfig): Promise<void> {
    return new Promise((resolve) => {
      this._currentAppConfig = config;
      resolve();
    });
  }
}
