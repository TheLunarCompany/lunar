import { Logger } from "winston";
import { AppConfigService } from "./app-config.js";
import { Connections } from "./connections.js";
import { DAL } from "./dal.js";
import { Hub } from "./hub.js";
import { TargetServersService } from "./target-server.js";

export class Services {
  private _connections: Connections;
  private _dal: DAL;
  private _hub: Hub;
  private _appConfig: AppConfigService;
  private _targetServers: TargetServersService;

  constructor(logger: Logger) {
    this._connections = new Connections();
    this._dal = new DAL();
    this._hub = new Hub(this._connections, logger);
    this._appConfig = new AppConfigService(logger);
    this._targetServers = new TargetServersService(logger);
  }

  get connections(): Connections {
    return this._connections;
  }

  get hub(): Hub {
    return this._hub;
  }

  get dal(): DAL {
    return this._dal;
  }

  get appConfig(): AppConfigService {
    return this._appConfig;
  }

  get targetServers(): TargetServersService {
    return this._targetServers;
  }
}
