import { logger } from './logger'
import { FailSafe } from "./failSafe"
import { TrafficFilter } from "./trafficFilter"
import { type ConnectionInformation, generateUrl } from "./helper"
import { FetchHelper } from './fetchHelper'
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

    private fetchHelper!: FetchHelper
    private originalFetch!: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

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
        http.request = this.httpHookRequestFunc.bind(this, HTTP_TYPE, REQUEST);
        // @ts-expect-error: TS2322
        http.get = this.httpHookGetFunc.bind(this, HTTP_TYPE);
        // @ts-expect-error: TS2322
        https.request = this.httpHookRequestFunc.bind(this, HTTPS_TYPE, REQUEST);
        // @ts-expect-error: TS2322
        https.get = this.httpHookGetFunc.bind(this, HTTPS_TYPE);
        
        
        if (typeof(fetch) !== 'undefined') {
            this.originalFetch = fetch;
            this.fetchHelper = new FetchHelper();

            // @ts-expect-error: TS2322
            // eslint-disable-next-line no-global-assign, no-import-assign
            fetch = this.fetchHookFunc.bind(this);
        }
    }
    
    private async fetchHookFunc(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        // Normalize input to always be a Request object for consistent handling
        if (!(input instanceof Request)) {
            // Convert URL object to string URL if needed
            const urlString = input instanceof URL ? input.href : input;
            input = new Request(urlString, init);
        }

        // Now 'input' is always a Request object, and 'url' is derived from 'input.url'
        const url = new URL(input.url);

        // Convert modified fetch init headers to OutgoingHttpHeaders for traffic filter check                
        const outgoingHeaders = this.fetchHelper.ConvertHeadersToOutgoingHttpHeaders(input.headers, init?.headers);
        if (this._proxyConnInfo.isInfoValid && this._failSafe.stateOk() && this._trafficFilter.isAllowed(url.host, outgoingHeaders)) {
            logger.debug(`Fetch request to ${url.href} is being processed through Lunar Proxy`);            
            const { modifiedInput, modifiedInit } = this.modifyFetchRequest(input, url, init);                               
            const response = await this.fetchHandler(input, modifiedInput, init, modifiedInit);
            return response;
        } 
        logger.debug(`Will perform fetch ${url.href} without Lunar Proxy`);
        return await this.originalFetch(input, init);
    }   
 
    private async fetchHandler(originalInput: RequestInfo, modifiedInput: RequestInfo, init?: RequestInit, modifiedInit?: RequestInit, gotError: boolean = false): Promise<Response> {
        if (!gotError && this._failSafe.stateOk()) {
            try {
                // Attempt the fetch call
                const response = await this.originalFetch(modifiedInput, modifiedInit);

                gotError = this.fetchHelper.ValidateHeaders(response.headers)
                
                if (gotError) {                    
                    this._failSafe.onError(new Error('An error occurs on the Proxy side'))
                    return await this.fetchHandler(originalInput, modifiedInput, init, modifiedInit, true);
                } else {
                    const requestInputUrl = (modifiedInput as Request).url;
                    if (requestInputUrl?.includes(this._proxyConnInfo.proxyHost)) {
                        this._failSafe.onSuccess()
                    }

                    const sequenceID = await this.fetchHelper.PrepareForRetry(LUNAR_RETRY_AFTER_HEADER_KEY, LUNAR_SEQ_ID_HEADER_KEY, response.headers)
                    if (sequenceID != null) {
                        if (modifiedInput instanceof Request && modifiedInput.headers != null) {
                            modifiedInput.headers.set(LUNAR_SEQ_ID_HEADER_KEY, sequenceID);                            
                            modifiedInit = { ...modifiedInit, headers: modifiedInput.headers };
                        }                        
                        return await this.fetchHandler(originalInput, modifiedInput, init, modifiedInit, false);
                    }
                    logger.debug(`Fetch request was processed through Lunar Proxy`);
                    return response;
                }                     
            } catch (error) {
                this._failSafe.onError(
                    error instanceof Error ?
                        error : new Error('An unknown error occurred while communicating with the Proxy')
                );            
            }            
        } 
        return await this.originalFetch(originalInput, init);
    }
     
    private modifyFetchRequest(input: Request, url: URL, init?: RequestInit): {modifiedInput: Request, modifiedInit: RequestInit} {
        const modifiedInit: RequestInit = (init != null) ? { ...this.deepClone(init) } : {};    
        if (modifiedInit.headers == null) {
            modifiedInit.headers = new Headers();
        }

        // Apply header manipulations
        modifiedInit.headers = this.fetchHelper.ManipulateHeadersForFetch(modifiedInit.headers, url, this._proxyConnInfo);        

        // Construct the modified URL based on proxy settings and original request path/query
        const proxyUrl = new URL(url.toString());
        proxyUrl.protocol = `${this._proxyConnInfo.proxyScheme}:`;
        proxyUrl.hostname = this._proxyConnInfo.proxyHost;
        proxyUrl.port = this._proxyConnInfo.proxyPort.toString();
        
        // Use the pathname and search from the original input URL
        proxyUrl.pathname = url.pathname;
        proxyUrl.search = url.search;
    
        logger.debug(`Modified fetch URL to: ${proxyUrl.href}`);
        return { modifiedInput: new Request(proxyUrl.href, { ...input, ...modifiedInit }), modifiedInit };
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
            const modifiedOptions = this.generateModifiedOptions(options, url)
            return this.requestHandler(url, options, modifiedOptions, callback, false, null, null, ...args)
        }
        logger.debug(`Will send ${url.href} without using Lunar Proxy`)
        // @ts-expect-error: TS2345
        return this.getFunctionFromMap(scheme, functionName)(arg0, arg1, arg2, ...args)
    }

    private deepClone(srcObj: any): any | null | unknown[] {
        if (typeof srcObj !== 'object' || srcObj === null) return srcObj;

        if (Array.isArray(srcObj)) {
            return srcObj.map(this.deepClone);
        }
        const newObj: any = {};
        for (const key in srcObj) {
            newObj[key] = srcObj[key];
        }
        
        return newObj;
    };

    private getFunctionFromMap(scheme: string | null | undefined, functionName: string): OriginalFunctionMap["request"] | OriginalFunctionMap["get"] {
        const funcMap: OriginalFunctionMap = scheme === HTTPS_TYPE ? this.originalFunctions.https : this.originalFunctions.http;
        return functionName === GET ? funcMap.get : funcMap.request;
    }

    private prepareForRetry(headers?: IncomingHttpHeaders ): string | null {
        if (headers == null) return null

        let rawRetryAfter = headers[LUNAR_RETRY_AFTER_HEADER_KEY];
        if (rawRetryAfter === undefined) return null
        
        const sequenceID = headers[LUNAR_SEQ_ID_HEADER_KEY];        
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
            response.socket.authorized = true;
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
        modifiedOptions.agent = undefined;
        modifiedOptions.host = modifiedOptions.hostname = this._proxyConnInfo.proxyHost;
        modifiedOptions.port = this._proxyConnInfo.proxyPort;
        modifiedOptions.protocol = `${this._proxyConnInfo.proxyScheme}:`;
        const modifiedURL = generateUrl(modifiedOptions, modifiedOptions.protocol)
        logger.debug(`Modified request URL to: ${modifiedURL.href}`)
        modifiedOptions.href = modifiedURL
        this.manipulateHeaders(modifiedOptions, url)

        return modifiedOptions
    }

    private requestHandler(url: URL, originalOptions: RequestOptions, modifiedOptions: LunarOptions, callback: (res: IncomingMessage) => void, gotError: boolean, dataObj: unknown, sequenceID: string | null, ...requestArguments: unknown[]): ClientRequest {
        // TODO: We should also take care of handling event based requests.
        let req: LunarClientRequest
        const originalFunc = this.getFunctionFromMap(originalOptions.protocol, REQUEST)
        let func: OriginalFunctionMap["request"]
        
        if (!gotError && this._failSafe.stateOk()) {
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
