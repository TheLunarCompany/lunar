import { type RequestOptions, type request as httpRequest, type get as httpGet, IncomingMessage, ClientRequest } from "http"
import { type request as httpsRequest, type get as httpsGet } from 'https'
import { Socket } from 'net';

export interface LunarOptions extends RequestOptions {
    href?: URL | null | undefined
    pathname?: string | null | undefined
}

export class LunarClientRequest extends ClientRequest {
    baseURL?: string | null = null
    public lunarRetry!: (...args: unknown[]) => ClientRequest;
    public lunarRetryOnError!: (...args: unknown[]) => ClientRequest;
    public originalWrite!: NodeJS.WritableStream;
    public originalEmit!: NodeJS.WritableStream["emit"];
}

export class LunarIncomingMessage extends IncomingMessage {
    req!: LunarClientRequest
}
export interface OriginalFunctionMap {
    request: typeof httpRequest | typeof httpsRequest,
    get: typeof httpGet | typeof httpsGet,
}

export interface SchemeToFunctionsMap {
    http: OriginalFunctionMap,
    https: OriginalFunctionMap
}

export class LunarSocket extends Socket {
    public originalEmit!: NodeJS.WritableStream["emit"];
}
