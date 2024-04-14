import { type RequestOptions, type request as httpRequest, type get as httpGet, IncomingMessage, ClientRequest } from "http"
import { type request as httpsRequest, type get as httpsGet } from 'https'

export interface LunarOptions extends RequestOptions {
    href?: URL | null | undefined
    pathname?: string | null | undefined
}

export enum LunarType {
    Proxified = 'Proxified',
    Direct = 'Direct',
    Facade = 'Facade',
  }

export interface BodyDataObject {
    data: any,
    args: any[],
  }
  
export interface HookedEvent {
    eventName: string,
    args: any[],
  }
  
export interface HookedEventByType {
    [LunarType.Proxified]: HookedEvent[],
    [LunarType.Direct]: HookedEvent[],
    [LunarType.Facade]: HookedEvent[],
  }
  
export interface DirectRequestData {
    scheme: string,
    functionName: string,
    arg0: unknown,
    arg1: unknown,
    arg2: unknown,
    args: unknown[],
  }

export interface LunarMetaData {
    type: LunarType,
}

export class LunarClientRequest extends ClientRequest {
    baseURL?: string | null = null
    _lunarMetaData!: LunarMetaData
}

export class LunarIncomingMessage extends IncomingMessage {
    req!: LunarClientRequest
    socket!: any
}
export interface OriginalFunctionMap {
    request: typeof httpRequest | typeof httpsRequest,
    get: typeof httpGet | typeof httpsGet,
}

export interface SchemeToFunctionsMap {
    http: OriginalFunctionMap,
    https: OriginalFunctionMap
}
