import { logger } from './logger'
import { FailSafe } from "./failSafe"
import { TrafficFilter } from "./trafficFilter"
import { type ConnectionInformation, generateUrl } from "./helper"
import { type LunarOptions, type SchemeToFunctionsMap, type OriginalFunctionMap, type LunarClientRequest, type LunarIncomingMessage } from "./lunarObjects"

import https from 'https'
import { type Socket } from 'net';
import * as urlModule from 'url'
import http, { type IncomingMessage, type ClientRequest, type RequestOptions, type IncomingHttpHeaders } from "http"



const LUNAR_SEQ_ID_HEADER_KEY = "x-lunar-sequence-id"
const LUNAR_RETRY_AFTER_HEADER_KEY = "x-lunar-retry-after"
const GET = "get"
const REQUEST = "request"
const HTTP_TYPE = "http:"
const HTTPS_TYPE = "https:"
const MS_IN_SECOND = 1000

class LunarInterceptor {
    private readonly originalFunctions: SchemeToFunctionsMap = {
        http: {
            request: http.request,
            get: http.get,
        },
        https: {
            request: https.request,
            get: https.get,
        }
    }

    private static _instance: LunarInterceptor | null = null;
    private _proxyConnInfo!: ConnectionInformation
    private readonly _trafficFilter: TrafficFilter = new TrafficFilter()
    private readonly _failSafe: FailSafe = new FailSafe()

    private constructor() {
    }

    public setOptions(conn: ConnectionInformation): void {
        this._proxyConnInfo = conn
        this._trafficFilter.setManaged(this._proxyConnInfo.managed)
        this.initHooks()
    }

    private initHooks(): void {
        // @ts-expect-error: TS2322
        http.request = this.httpHookRequestFunc.bind(this, HTTP_TYPE, REQUEST)
        // @ts-expect-error: TS2322
        http.get = this.httpHookGetFunc.bind(this, HTTP_TYPE)
        // @ts-expect-error: TS2322
        https.request = this.httpHookRequestFunc.bind(this, HTTPS_TYPE, REQUEST)
        // @ts-expect-error: TS2322
        https.get = this.httpHookGetFunc.bind(this, HTTPS_TYPE)

    }

    private normalizeOptions(options: LunarOptions, scheme: string, url: URL): RequestOptions {
        if (options.host == null) {
            options.host = options.hostname
        }

        if (options.protocol == null) {
            options.protocol = scheme
        }

        if (options.port == null) {
            if (url.port !== "") {
                options.port = url.port
            } else {
                options.port = scheme === HTTP_TYPE ? 80 : 443;
            }
        }

        if (options.href == null) options.href = url
        if (options.pathname === undefined) options.pathname = options.path;

        return options
    }

    private httpHookGetFunc(scheme: string, arg0: unknown, arg1: unknown, arg2: unknown, ...args: unknown[]): ClientRequest {
        return this.httpHookRequestFunc(scheme, GET, arg0, arg1, arg2, ...args).end()
    }

    // https://github.com/nodejs/node/blob/717e233cd95602f79256c5b70c49703fa699174b/lib/_http_client.js#L130
    private httpHookRequestFunc(scheme: string, functionName: string, arg0: unknown, arg1: unknown, arg2: unknown, ...args: unknown[]): ClientRequest {
        let url: URL;
        let options: LunarOptions;
        let callback: (res: IncomingMessage) => void

        // get(url, options, callback?)
        if (typeof arg0 === 'string' && typeof arg1 === 'object' && arg1 != null) {
            url = new URL(arg0)
            options = arg1
            callback = arg2 as (res: IncomingMessage) => void
        }

        // get(url, callback?)
        else if (typeof arg0 === 'string') {
            url = new URL(arg0)
            options = urlModule.urlToHttpOptions(url)
            callback = arg1 as (res: IncomingMessage) => void
        }

        // get(options, callback?)
        else if (typeof arg0 === 'object' && arg0 != null) {
            options = arg0
            url = generateUrl(options, scheme)
            callback = arg1 as (res: IncomingMessage) => void
        }
        // fml
        else {
            logger.debug('Unexpected input on http.request')
            // @ts-expect-error: TS2345
            return this.getFunctionFromMap(scheme, functionName)(arg0, arg1, arg2, ...args)
        }

        if (this._proxyConnInfo.isInfoValid && this._failSafe.stateOk() && this._trafficFilter.isAllowed(url.host, options.headers)) {
            logger.debug(`Forwarding the request to ${url.href} using Lunar Proxy`)
            options = this.normalizeOptions(options, scheme, url)
            return this.requestHandler(url, options, null, callback, false, null, null, ...args)
        }
        logger.debug(`Will send ${url.href} without using Lunar Proxy`)
        // @ts-expect-error: TS2345
        return this.getFunctionFromMap(scheme, functionName)(arg0, arg1, arg2, ...args)
    }

    private getFunctionFromMap(scheme: string | null | undefined, functionName: string): OriginalFunctionMap["request"] | OriginalFunctionMap["get"] {
        const funcMap: OriginalFunctionMap = scheme === HTTPS_TYPE ? this.originalFunctions.https : this.originalFunctions.http;
        return functionName === GET ? funcMap.get : funcMap.request;
    }

    private deepClone(srcObj: any): LunarOptions | null | unknown[] {
        if (srcObj === null) return null;
        const clone = Object.assign({}, srcObj);
        Object.keys(clone).forEach(
            key =>
            (clone[key] =
                typeof srcObj[key] === 'object' ? this.deepClone(srcObj[key]) : srcObj[key])
        );

        if (Array.isArray(srcObj)) {
            clone.length = srcObj.length;
            return Array.from(clone);
        }

        return clone;
    };

    private prepareForRetry(headers?: IncomingHttpHeaders): string | null {
        if (headers == null) return null
        let rawRetryAfter = headers[LUNAR_RETRY_AFTER_HEADER_KEY]
        if (rawRetryAfter === undefined) return null
        const sequenceID = headers[LUNAR_SEQ_ID_HEADER_KEY]

        if (sequenceID === undefined) {
            logger.debug(`Retry required, but ${LUNAR_SEQ_ID_HEADER_KEY} is missing!`)
            return null
        }

        function sleepSync(ms: number): void {
            const end = Date.now() + ms;
            // TODO: We should find a better way yo make a sync timer.
            while (Date.now() < end) { /* empty */ }
        }

        if (Array.isArray(rawRetryAfter)) rawRetryAfter = rawRetryAfter[0]
        try {
            const retryAfter = parseFloat(String(rawRetryAfter))
            logger.debug(`Retry required, will retry in ${retryAfter} seconds...`)
            sleepSync(retryAfter * MS_IN_SECOND)
            return String(sequenceID)

        } catch (error) {
            logger.debug(`Retry required, but parsing header ${LUNAR_RETRY_AFTER_HEADER_KEY} as float failed (${rawRetryAfter})`)
        }

        return null
    }

    private callbackHook(callback: (res: IncomingMessage) => void, ...requestArguments: unknown[]) {
        return (response: LunarIncomingMessage) => {
            const originalRequest: LunarClientRequest = response.req;
            const gotError = this._failSafe.validateHeaders(response.headers)

            if (gotError) {
                this._failSafe.onError(new Error("An error occurs on the Proxy side"))
                return originalRequest.lunarRetryOnError(null, null, ...requestArguments)

            } else {
                const baseURL = originalRequest.baseURL
                if ((baseURL?.includes(this._proxyConnInfo.proxyHost)) === true) {
                    this._failSafe.onSuccess()
                }

                const sequenceID = this.prepareForRetry(response?.headers)

                if (sequenceID != null) return originalRequest.lunarRetry(null, sequenceID, ...requestArguments)
                if (callback !== undefined && callback != null) callback(response)
            }
            return undefined
        }
    }

    private generateModifiedOptions(originalOptions: RequestOptions, url: URL): LunarOptions {
        const modifiedOptions = this.deepClone(originalOptions) as LunarOptions;

        modifiedOptions.host = modifiedOptions.hostname = this._proxyConnInfo.proxyHost;
        modifiedOptions.port = this._proxyConnInfo.proxyPort;
        modifiedOptions.protocol = `${this._proxyConnInfo.proxyScheme}:`;
        const modifiedURL = generateUrl(modifiedOptions, modifiedOptions.protocol)
        logger.debug(`Modified request URL to: ${modifiedURL.href}`)
        modifiedOptions.href = modifiedURL
        this.manipulateHeaders(modifiedOptions, url)

        return modifiedOptions
    }

    private requestHandler(url: URL, originalOptions: RequestOptions, modifiedOptions: LunarOptions | null, callback: (res: IncomingMessage) => void, gotError: boolean, dataObj: unknown, sequenceID: string | null, ...requestArguments: unknown[]): ClientRequest {
        // TODO: We should also take care of handling event based requests.
        let req: LunarClientRequest
        const originalFunc = this.getFunctionFromMap(originalOptions.protocol, REQUEST)
        let func: OriginalFunctionMap["request"]

        if (!gotError && this._failSafe.stateOk()) {
            if (modifiedOptions === null) modifiedOptions = this.generateModifiedOptions(originalOptions, url)
            if (sequenceID !== null && (modifiedOptions.headers != null)) modifiedOptions.headers[LUNAR_SEQ_ID_HEADER_KEY] = sequenceID

            func = this.getFunctionFromMap(modifiedOptions.protocol, REQUEST)

            const callbackWrapper = this.callbackHook(callback, ...requestArguments)
            let writeData: unknown
            try {
                // @ts-expect-error: TS2345
                req = func(modifiedOptions, callbackWrapper, ...requestArguments);
                // @ts-expect-error: TS2339
                req.lunarRetry = this.requestHandler.bind(this, url, originalOptions, modifiedOptions, callback, false);
                // @ts-expect-error: TS2339
                req.lunarRetryOnError = this.requestHandler.bind(this, url, originalOptions, modifiedOptions, callback, true);
                // @ts-expect-error: TS2339
                req.originalWrite = req.write;
                // @ts-expect-error: TS2339
                req.write = function (data: unknown, ...args: unknown[]) {
                    writeData = data;
                    // @ts-expect-error: TS2349
                    req.originalWrite(data, ...args)
                };
                // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                if (!req.originalEmit) req.originalEmit = req.emit;

                req.emit = function (event: string | symbol, ...args: unknown[]): boolean {
                    // @ts-expect-error: TS2722
                    if (event !== 'error') req.originalEmit(event, ...args)
                    return true
                }

                req.on('socket', (socket: Socket) => {
                    socket.on('error', (error: string) => {
                        this._failSafe.onError(new Error(error))
                        req.socket?.destroy();
                        req.destroy();
                        req.lunarRetryOnError(writeData, null, ...requestArguments)
                    });
                });

                if (sequenceID !== null && sequenceID !== undefined) req.end()
                return req

            } catch (error) {
                this._failSafe.onError(
                    error instanceof Error ?
                        error : new Error('An unknown error occurred while communicating with the Proxy')
                )
            }
        }

        // @ts-expect-error: TS2345
        const revertedRequest = originalFunc(originalOptions, callback, ...requestArguments)
        if (gotError) {
            if (dataObj !== null && dataObj !== undefined) {
                revertedRequest.write(dataObj)
            }
            revertedRequest.end()
        }

        return revertedRequest
    }

    private manipulateHeaders(options: RequestOptions, url: URL): void {
        if (options.headers == null) options.headers = {}

        options.headers['x-lunar-host'] = url.host
        options.headers['x-lunar-interceptor'] = this._proxyConnInfo.interceptorID
        options.headers['x-lunar-scheme'] = url.protocol.substring(0, url.protocol.length - 1)
    }

    public static getInstance(): LunarInterceptor {
        if (LunarInterceptor._instance == null) LunarInterceptor._instance = new LunarInterceptor();
        return LunarInterceptor._instance;
    }
}

export function getInterceptor(): LunarInterceptor {
    return LunarInterceptor.getInstance()
}
