
import http, { type ClientRequest } from "http"

import { logger } from './logger'
import { type LunarOptions,  type BodyDataObject, type HookedEvent, LunarClientRequest } from './lunarObjects';


// @ts-expect-error: TS2345
const originalAddRequest = http.Agent.prototype.addRequest;
// @ts-expect-error: TS2345
http.Agent.prototype.addRequest = function (req: ClientRequest, options: LunarOptions) {
  if (req.constructor.name === LunarClientFacade.name) {
    return {};
  }

    return originalAddRequest.call(this, req, options);
};

export class LunarClientFacade extends LunarClientRequest{
  private writeData: BodyDataObject[] = [];
  private EndData: BodyDataObject[] = [];
  private readonly clientRegisterEventsQueue: Record<string, any> = {};
  private readonly requestID?: string;
  
  constructor(options: LunarOptions, requestID?: string) {
    super(options);
    this.requestID = requestID;
  }

  public write(data: any, ...args: any[]): any {
    logger.verbose(`${this.requestID} - write::Got write event from client request, adding to the queue...`);
    if (this.writeData === null) {
      this.writeData = [];
    }
    const newObject: BodyDataObject = {data, args};
    this.writeData.push(newObject);
  }
    
  public end(data: any, ...args: any[]): this {
    logger.verbose(`${this.requestID} - end::Got end event from client request, adding to the queue...`);
    if (this.EndData === null) {
      this.EndData = [];
    }
    const newObject: BodyDataObject = {data, args};
    this.EndData.push(newObject);
    return this;
  }

  public on(eventName: string, callback: ((...args: unknown[]) => void) | (() => void)): this {
    logger.verbose(`${this.requestID} - on::Adding event '${eventName}' to the queue...`);
    if (this.clientRegisterEventsQueue[eventName] === undefined) {
      this.clientRegisterEventsQueue[eventName] = [];
    }
    this.clientRegisterEventsQueue[eventName].push(callback);
    return this;
  }

  public emitEventFromQueue(event: HookedEvent): void {
    logger.verbose(`${this.requestID} - emitEventFromQueue::Checking if '${event.eventName}' event was added to clientRegisterEventsQueue...`);
    const callbacks = this.clientRegisterEventsQueue[event.eventName];
    if (callbacks === undefined) {
      logger.verbose(`${this.requestID} - emitEventFromQueue::No '${event.eventName}' event was added to clientRegisterEventsQueue...`);
      return
    }

    logger.verbose(`${this.requestID} - emitEventFromQueue::Found '${event.eventName}' event in clientRegisterEventsQueue...`);
    callbacks.forEach((callback: (...args: unknown[]) => void) => {
        logger.verbose(`${this.requestID} - emitEventFromQueue::Emitting event '${event.eventName}'`);

        (callback as (...args: unknown[]) => void).bind(this)(...event.args);
    });

    this.clientRegisterEventsQueue[event.eventName] = undefined;
  }

  public getWriteData(): BodyDataObject[] {
    return this.writeData;
  }

  public getEndData(): BodyDataObject[] {
    return this.EndData;
  }
}
