import { Connections } from "./connections.js";
import { DAL } from "./dal.js";
import { Hub } from "./hub.js";

export class Services {
  private _connections: Connections;
  private _dal: DAL;
  private _hub: Hub;

  constructor() {
    this._connections = new Connections();
    this._dal = new DAL();
    this._hub = new Hub(this._connections);
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
}
