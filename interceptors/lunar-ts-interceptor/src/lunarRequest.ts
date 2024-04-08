import { type Socket } from "net";
import { type IncomingMessage, type IncomingHttpHeaders, ClientRequest } from "http"

import { logger } from './logger'
import { type FailSafe } from "./failSafe";
import { LunarClientFacade } from "./lunarFacade";
import { HTTPS_TYPE, GET, LUNAR_RETRY_AFTER_HEADER_KEY, LUNAR_SEQ_ID_HEADER_KEY, MS_IN_SECOND,
   EVENT_ERROR, LUNAR_EVENT_ERROR, EVENT_CONNECT, LUNAR_EVENT_RESPONSE, EVENT_RESPONSE, LUNAR_EVENT_SOCKET, EVENT_SOCKET, 
   LUNAR_EVENT_CONNECT, SOCKET_OPEN_STATE} from "./constants";
   import { type OriginalFunctionMap, type LunarClientRequest, type LunarIncomingMessage, type LunarOptions,
    type SchemeToFunctionsMap, LunarType, type DirectRequestData, type HookedEvent, type HookedEventByType } from './lunarObjects';


export class LunarRequest {
  private proxifiedRequest: LunarClientRequest | null = null;
  private directRequest!: LunarClientRequest;
  
  private readonly failSafe: FailSafe;
  private readonly modifiedOptions: LunarOptions
  private readonly lunarFacade: LunarClientFacade;
  private readonly directRequestData: DirectRequestData;
  private readonly originalFunctions: SchemeToFunctionsMap
  private readonly clientCallback: (res: IncomingMessage) => void
  private readonly hookedEvents: HookedEventByType = {
    [LunarType.Proxified]: [], [LunarType.Direct]: [], [LunarType.Facade]: []
  };

  constructor(directData: DirectRequestData, options: LunarOptions, callback: (res: IncomingMessage) => void, failSafe: FailSafe, originalFuncs: SchemeToFunctionsMap) {
    this.failSafe = failSafe;
    this.modifiedOptions = options;
    this.clientCallback = callback;
    this.directRequestData = directData;
    this.originalFunctions = originalFuncs;
    this.lunarFacade = new LunarClientFacade(options);
  }

  public startRequest(): this {
    return this.onProxifiedRequest(null);
  }

  public getFacade(): LunarClientFacade {
    this.prepareRequest(this.lunarFacade, LunarType.Facade);
    if (this.clientCallback !== undefined) {
      this.clientCallback.bind(this.lunarFacade);
    }

    return this.lunarFacade;
  }

  private makeDirectRequest(): this {
    logger.debug(`Making direct request...`);
    this.closeRequest(this.proxifiedRequest);
    this.proxifiedRequest = null;
    this.onDirectRequest();

    return this
  }

  private onProxifiedRequest (sequenceID: string | null): this {
    if (sequenceID !== null && (this.modifiedOptions.headers != null)) {
      this.modifiedOptions.headers[LUNAR_SEQ_ID_HEADER_KEY] = sequenceID;
    }
    const reqCall = this.getFunctionFromMap(this.modifiedOptions.protocol, this.directRequestData.functionName)
    this.proxifiedRequest = reqCall(this.modifiedOptions) as LunarClientRequest;
    this.prepareRequest(this.proxifiedRequest, LunarType.Proxified);

    if (sequenceID !== null && sequenceID !== undefined) {
      this.proxifiedRequest.end()
    }
    this.waitForSocketEventCondition(this.proxifiedRequest);
    return this
  }

  private onDirectRequest(): this {
    if (this.directRequestData === null){
       return this
    }
    const reqCall = this.getFunctionFromMap(this.directRequestData.scheme, this.directRequestData.functionName);
    // @ts-expect-error: TS2345
    this.directRequest = reqCall(this.directRequestData.arg0, this.directRequestData.arg1, this.directRequestData.arg2) as LunarClientRequest;
    this.prepareRequest(this.directRequest, LunarType.Direct);
    this.waitForSocketEventCondition(this.directRequest);
    return this
  }

  private emitHook(req: LunarClientRequest, eventName: string, ...args: any[]): boolean {
    logger.verbose(`emitHook::Got emitted event '${eventName}' from ${req._lunarMetaData.type} request...`);
    
    if (eventName === EVENT_ERROR){
      ClientRequest.prototype.emit.call(req, LUNAR_EVENT_ERROR, ...args);
      if (req._lunarMetaData.type === LunarType.Proxified) {
        logger.verbose(`emitHook::Error event emitted from Proxified request, making direct request...`);
        this.makeDirectRequest();
      }
    }

    if (eventName === EVENT_CONNECT) {
      ClientRequest.prototype.emit.call(req, LUNAR_EVENT_CONNECT, ...args);
    }
    if (eventName === EVENT_RESPONSE) {
      ClientRequest.prototype.emit.call(req, LUNAR_EVENT_RESPONSE, ...args);
    }
    if (eventName === EVENT_SOCKET) {
      ClientRequest.prototype.emit.call(req, LUNAR_EVENT_SOCKET, ...args);
    }

    this.hookedEvents[req._lunarMetaData.type].push({ eventName, args });
    return true;
  }

  private callEmittedEvents(req: LunarClientRequest): this {
    logger.verbose(`callEmittedEvents::Emitting events from ${req._lunarMetaData.type} request...`);
    this.hookedEvents[req._lunarMetaData.type].forEach((hookedEvent: HookedEvent) => {
      logger.verbose(`callEmittedEvents::Emitting event '${hookedEvent.eventName}' from ${req._lunarMetaData.type} request...`);
      this.lunarFacade.emitEventFromQueue(hookedEvent);
    });
    return this
  }

  private getFunctionFromMap(scheme: string | null | undefined, functionName: string): OriginalFunctionMap["request"] | OriginalFunctionMap["get"] {
    const funcMap: OriginalFunctionMap = scheme === HTTPS_TYPE ? this.originalFunctions.https : this.originalFunctions.http;
    return functionName === GET ? funcMap.get : funcMap.request;
  }

  private emitWriteEvents(req: LunarClientRequest): this {
    logger.verbose(`emitWriteEvents::Emitting write events from ${req._lunarMetaData.type} request...`);
    for (const data of this.lunarFacade.getWriteData()) {
      logger.verbose(`emitWriteEvents::Calling ${req._lunarMetaData.type}.write`);
      req.write(data.data, ...data.args);
    }
    return this
  }

  private emitEndEvents(req: LunarClientRequest): this {
    logger.verbose(`emitEndEvents::Emitting end events from ${req._lunarMetaData.type} request...`);
    for (const data of this.lunarFacade.getEndData()) {
      logger.verbose(`emitEndEvents::Calling ${req._lunarMetaData.type}Request.end`);
      req.end(data.data, ...data.args);
    }
    return this
  }

  private async prepareForRetry(headers?: IncomingHttpHeaders): Promise<string | null> {
    if (headers == null) {
      return null
    } 
    let rawRetryAfter = headers[LUNAR_RETRY_AFTER_HEADER_KEY]
    if (rawRetryAfter === undefined) {
      return null
    }
    
    const sequenceID = headers[LUNAR_SEQ_ID_HEADER_KEY]
    if (sequenceID === undefined) {
      logger.verbose(`Retry required, but ${LUNAR_SEQ_ID_HEADER_KEY} is missing!`)
      return null
    }

    if (Array.isArray(rawRetryAfter)) rawRetryAfter = rawRetryAfter[0]
    try {
        const retryAfter = parseFloat(String(rawRetryAfter))
        logger.debug(`Retry required, will retry in ${retryAfter} seconds...`)
        await new Promise((resolve) => {setTimeout(resolve, retryAfter * MS_IN_SECOND)})
        return String(sequenceID)

    } catch (error) {
        logger.debug(`Retry required, but parsing header ${LUNAR_RETRY_AFTER_HEADER_KEY} as float failed (${rawRetryAfter})`)
    }

    return null
  }

  private prepareRequest(req: LunarClientRequest, reqType: LunarType): this {
    if (req._lunarMetaData === undefined) {
      req._lunarMetaData = { type: reqType };
    } else {
      req._lunarMetaData.type = reqType;
    }
    req.emit = this.emitHook.bind(this, req) as NodeJS.WritableStream["emit"];
    return this
  }

  private onConnectionSuccess(req: LunarClientRequest): void {
      logger.debug(`${req._lunarMetaData.type} request succeeded, emitting write & end events to the original request...`);
      this.emitWriteEvents(req);
      this.emitEndEvents(req);
      this.waitForResponse(req)
  }

  private onResponse(response: LunarIncomingMessage): void {
        logger.debug(`Response has arrived, emitting queued events to the original request...`);
        if (this.clientCallback !== undefined) {
          this.clientCallback(response);
        } else {
          this.lunarFacade.emitEventFromQueue({ eventName: EVENT_RESPONSE, args: [response] });
        }
  }

  private closeRequest(req: LunarClientRequest | null): void {
    if (req === null) {
      return
    }
    req.removeAllListeners();
    req.destroy();
    req.socket?.removeAllListeners();
    req.socket?.destroy();
  }
  
  private onProxifiedResponse(response: LunarIncomingMessage): void {
      logger.debug(`Proxified response has arrived, validating proxy indication before emitting...`);
      response.socket.authorized = true;
      const gotError = this.failSafe.validateHeaders(response.headers);
      if (gotError) {
        this.failSafe.onError(new Error("An error occurs on the Proxy side"));
        this.makeDirectRequest();
        return
      }

      this.failSafe.onSuccess();
      this.prepareForRetry(response?.headers).then((sequenceID) => {
        if (sequenceID !== null) {
          this.onProxifiedRequest(sequenceID);
        } else {
          this.onResponse(response);
        }
      }).catch((error) => {
          logger.verbose(`Error on retry: ${error}`);
          this.makeDirectRequest();
      });
  }
  
  private onError(req: LunarClientRequest): void {
    logger.debug(`${req._lunarMetaData.type} request failed to connect, emitting queued events to the original request...`);
    if (req._lunarMetaData.type === LunarType.Direct ) {
      this.callEmittedEvents(req);
    }
  }

  private waitForResponse(req: LunarClientRequest | null): void {
    req?.on(LUNAR_EVENT_RESPONSE, (response: LunarIncomingMessage) => {
      logger.verbose(`Event '${LUNAR_EVENT_RESPONSE}' was emitted from ${req._lunarMetaData.type} Request...`)
      if (req._lunarMetaData.type === LunarType.Direct) {
        this.onResponse(response);
      } else {
        this.onProxifiedResponse(response);
      }

    })

    .on(LUNAR_EVENT_ERROR, (_args: unknown[]) => {
      logger.verbose(`Event '${LUNAR_EVENT_RESPONSE}' was emitted from ${req._lunarMetaData.type} Request...`)
      this.onError(req);
    });
  }

  private waitForSocketEventCondition(req: LunarClientRequest | null): void {
    req?.on(LUNAR_EVENT_SOCKET, (socket: Socket) => {
      if (socket.readyState === SOCKET_OPEN_STATE) {
        logger.verbose(`Socket 'readyState' is 'open' on ${req._lunarMetaData.type}`);
        this.onConnectionSuccess(req);
      }
      else {
        socket.on(EVENT_CONNECT, (_args: unknown[]) => {
          logger.verbose(`Socket connected on ${req._lunarMetaData.type}`);
          this.onConnectionSuccess(req);
        })

        .on(EVENT_ERROR, (_args: unknown[]) => {
          logger.verbose(`Socket error on ${req._lunarMetaData.type}`);
          this.onError(req);
        });
      } 
    })
  };
}
