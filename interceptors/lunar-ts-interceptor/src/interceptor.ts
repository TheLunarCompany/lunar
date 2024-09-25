import { logger } from './logger'
import { FailSafe } from "./failSafe"
import { FetchHelper } from './fetchHelper'
import { LunarRequest } from "./lunarRequest"
import { TrafficFilter } from "./trafficFilter"
import { copyAgentData, generateUrl, generateUUID } from "./helper"
import { type LunarOptions, type OriginalFunctionMap, type SchemeToFunctionsMap } from './lunarObjects';
import { REQUEST, HTTP_TYPE, HTTPS_TYPE, GET, LUNAR_SEQ_ID_HEADER_KEY, LUNAR_HOST_HEADER, LUNAR_INTERCEPTOR_HEADER,
     LUNAR_SCHEME_HEADER, 
     LUNAR_REQ_ID_HEADER_KEY} from './constants'

import https from 'https'
import * as urlModule from 'url'
import http, { type ClientRequest, type IncomingMessage, type RequestOptions } from "http"
import { LunarConnect } from './lunarConnect'

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
    private readonly lunarConnect: LunarConnect = LunarConnect.getInstance();
    
    private static _instance: LunarInterceptor | null = null;
    private readonly _trafficFilter: TrafficFilter = TrafficFilter.getInstance();   
    private readonly _failSafe: FailSafe = new FailSafe()

    private constructor() {
        if (this.lunarConnect.isProxyListening() === false) {
            logger.warn('Lunar Proxy is not listening, hooks will not be applied');
            return
        }

        this.initHooks()
    }

    private initHooks(): void {

        http.request = this.httpHookRequestFunc.bind(this, HTTP_TYPE, REQUEST) as typeof http.request;
        http.get = this.httpHookGetFunc.bind(this, HTTP_TYPE) as typeof http.get;
        https.request = this.httpHookRequestFunc.bind(this, HTTPS_TYPE, REQUEST) as typeof https.request;
        https.get = this.httpHookGetFunc.bind(this, HTTPS_TYPE) as typeof https.get;
        
        if (typeof(fetch) !== 'undefined') {
            this.originalFetch = fetch;
            this.fetchHelper = new FetchHelper();

            // @ts-expect-error: TS2322
            // eslint-disable-next-line no-global-assign
            fetch = this.fetchHookFunc.bind(this) as typeof fetch;
        }
    }
    
    private removeHooks(): void {
        logger.warn('Lunar Proxy is not listening, removing hooks.');
        http.request = this.originalFunctions.http.request;
        http.get = this.originalFunctions.http.get;
        https.request = this.originalFunctions.https.request;
        https.get = this.originalFunctions.https.get;

        if (typeof(fetch) !== 'undefined') {
            // @ts-expect-error: TS2322
            // eslint-disable-next-line no-global-assign
            fetch = this.originalFetch;
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
        if (this.lunarConnect.isProxyListening() === undefined || this.lunarConnect.isProxyListening() === true)  {
            if (this._failSafe.stateOk() && this._trafficFilter.isAllowed(url.host, outgoingHeaders)) {
                logger.debug(`Fetch request to ${url.href} is being processed through Lunar Proxy`);            
                const { modifiedInput, modifiedInit } = this.modifyFetchRequest(input, url, init);                               
                const response = await this.fetchHandler(input, modifiedInput, init, modifiedInit);
                return response;
            } 
         } else if (this.lunarConnect.isProxyListening() === false) {
            logger.debug('Fetch request is being processed without Lunar Proxy as Lunar Proxy is not listening');
            this.removeHooks();
         }

        logger.debug(`Will perform fetch ${url.href} without Lunar Proxy`);
        return await this.originalFetch(input, init);
    }   
 
    private async fetchHandler(originalInput: RequestInfo, modifiedInput: RequestInfo, init?: RequestInit, modifiedInit?: RequestInit, gotError: boolean = false): Promise<Response> {
        const reqID = (modifiedInit?.headers as Headers).get(LUNAR_REQ_ID_HEADER_KEY);
        if (!gotError && this._failSafe.stateOk()) {
            try {
                // Attempt the fetch call
                const response = await this.originalFetch(modifiedInput, modifiedInit);

                gotError = this.fetchHelper.ValidateHeaders(response.headers)
                
                if (gotError) {                    
                    this._failSafe.onError(new Error('An error occurs on the Proxy side'), false)
                    this._failSafe.onError(new Error('An error occurs on the Proxy side'), false)
                    return await this.fetchHandler(originalInput, modifiedInput, init, modifiedInit, true);
                } else {
                    const requestInputUrl = (modifiedInput as Request).url;
                    // @ts-expect-error: TS2532
                    if (requestInputUrl?.includes(this.lunarConnect.getEnvironmentInfo().proxyConnectionInfo.proxyHost)) {
                        this._failSafe.onSuccess()
                    }

                    const sequenceID = await this.fetchHelper.PrepareForRetry(response.headers)
                    if (sequenceID != null) {
                        if (modifiedInput instanceof Request && modifiedInput.headers != null) {
                            modifiedInput.headers.set(LUNAR_SEQ_ID_HEADER_KEY, sequenceID);                            
                            modifiedInit = { ...modifiedInit, headers: modifiedInput.headers };
                        }                        
                        return await this.fetchHandler(originalInput, modifiedInput, init, modifiedInit, false);
                    }
                    
                    logger.debug(`Fetch request ${reqID} was processed through Lunar Proxy`);
                    return response;
                }                     
            } catch (error) {
                this._failSafe.onError(
                    error instanceof Error ?
                        error : new Error(`Request ${reqID} - An unknown error occurred while communicating with the Proxy`),
                    true
                );            
            }            
        } 
        return await this.originalFetch(originalInput, init);
    }

    private modifyFetchRequest(input: Request, url: URL, init?: RequestInit): {modifiedInput: Request, modifiedInit: RequestInit} {
        // @ts-expect-error: TS2339
        const modifiedInit: RequestInit = (init != null) ? { ...this.deepClone(init) } : {};    
        if (modifiedInit.headers == null) {
            modifiedInit.headers = new Headers();
        }

        // Apply header manipulations
        modifiedInit.headers = this.fetchHelper.ManipulateHeadersForFetch(modifiedInit.headers, url, this.lunarConnect.getEnvironmentInfo());        
        // Construct the modified URL based on proxy settings and original request path/query
        const proxyUrl = new URL(url.toString());
        // @ts-expect-error: TS2532
        proxyUrl.protocol = `${this.lunarConnect.getProxyConnectionInfo().proxyScheme}:`;
        // @ts-expect-error: TS2532
        proxyUrl.hostname = this.lunarConnect.getProxyConnectionInfo().proxyHost;
        // @ts-expect-error: TS2532
        proxyUrl.port = this.lunarConnect.getProxyConnectionInfo().proxyPort.toString();
        
        // Use the pathname and search from the original input URL
        proxyUrl.pathname = url.pathname;
        proxyUrl.search = url.search;
    
        logger.debug(`Modified fetch URL to: ${proxyUrl.href}`);
        return { modifiedInput: new Request(proxyUrl.href, { ...input, ...modifiedInit }), modifiedInit };
    }

    private getFunctionFromMap(scheme: string | null | undefined, functionName: string): OriginalFunctionMap["request"] | OriginalFunctionMap["get"] {
        const funcMap: OriginalFunctionMap = scheme === HTTPS_TYPE ? this.originalFunctions.https : this.originalFunctions.http;
        return functionName === GET ? funcMap.get : funcMap.request;
    }
      
    private httpHookGetFunc(scheme: string, arg0: unknown, arg1: unknown, arg2: unknown, ...args: unknown[]): ClientRequest {
        return this.httpHookRequestFunc(scheme, GET, arg0, arg1, arg2, ...args)
    }

    // https://github.com/nodejs/node/blob/717e233cd95602f79256c5b70c49703fa699174b/lib/_http_client.js#L130
    private httpHookRequestFunc(scheme: string, functionName: string, arg0: unknown, arg1: unknown, arg2: unknown, ...args: unknown[]): ClientRequest {
        let url: URL;
        let options: LunarOptions;
        let modifiedOptions: LunarOptions | null = null;

        let callback: (res: IncomingMessage) => void;
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

        if (this.lunarConnect.isProxyListening() === undefined || this.lunarConnect.isProxyListening() === true)  {
            if (this._failSafe.stateOk() && this._trafficFilter.isAllowed(url.host, options.headers)) {
                logger.debug(`Forwarding the request to ${url.href} using Lunar Proxy`);
                
                modifiedOptions = this.generateModifiedOptions(options, url);
                if (options.agent !== undefined && typeof options.agent === "object") {
                    modifiedOptions.agent = new http.Agent({ keepAlive: true });
                    copyAgentData(options.agent, modifiedOptions.agent);
                }

                const lunarRequest = new LunarRequest({ scheme, functionName, arg0, arg1, arg2, args }, 
                    modifiedOptions, callback, this._failSafe, this.originalFunctions);
                
                lunarRequest.startRequest();
                return lunarRequest.getFacade();
            }
        } else if (this.lunarConnect.isProxyListening() === false) {
            logger.debug('HTTP(S) request is being processed without Lunar Proxy as Lunar Proxy is not listening');
            this.removeHooks();
        }
        
        logger.debug(`Forwarding the request to ${url.href} using the original function`);
        const originalFunction = this.getFunctionFromMap(scheme, functionName);
        // @ts-expect-error: TS2345
        return originalFunction(arg0, arg1, arg2, ...args);

}
 
    private deepClone(srcObj: any): LunarOptions | null | unknown[] {
        if (typeof srcObj !== 'object' || srcObj === null) {
            return srcObj;
        }

        if (Array.isArray(srcObj)) {
            return srcObj.map(this.deepClone);
        }

        const newObj: any = {};
        for (const key in srcObj) {
            newObj[key] = srcObj[key];
        }
        
        return newObj;
    };

    private generateModifiedOptions(originalOptions: RequestOptions, url: URL): LunarOptions {
        const modifiedOptions = this.deepClone(originalOptions) as LunarOptions;
        modifiedOptions.agent = undefined;
        // @ts-expect-error: TS2532
        modifiedOptions.host = this.lunarConnect.getProxyConnectionInfo().proxyHost;
        // @ts-expect-error: TS2532
        modifiedOptions.hostname = this.lunarConnect.getProxyConnectionInfo().proxyHost;
        // @ts-expect-error: TS2532
        modifiedOptions.port = this.lunarConnect.getProxyConnectionInfo().proxyPort;
        // @ts-expect-error: TS2532
        modifiedOptions.protocol = `${this.lunarConnect.getProxyConnectionInfo().proxyScheme}:`;
        if (url.pathname !== undefined && url.pathname != null && url.pathname.length > 0) {
            // In case the URL has a query string and path, we need to append the query string to the path
            modifiedOptions.pathname = url.pathname + url.search;
        }
        modifiedOptions.ID = generateUUID();
        const modifiedURL = generateUrl(modifiedOptions, modifiedOptions.protocol)
        logger.debug(`Modified request URL to: ${modifiedURL.href}`)
        modifiedOptions.href = modifiedURL
        this.manipulateHeaders(modifiedOptions, url)

        return modifiedOptions
    }

    private manipulateHeaders(options: LunarOptions, url: URL): void {
        if (options.headers == null) {
            options.headers = {}
        }

        options.headers[LUNAR_HOST_HEADER] = url.host
        options.headers[LUNAR_REQ_ID_HEADER_KEY] = options.ID
        options.headers[LUNAR_INTERCEPTOR_HEADER] = this.lunarConnect.getEnvironmentInfo().interceptorID
        options.headers[LUNAR_SCHEME_HEADER] = url.protocol.substring(0, url.protocol.length - 1)
    }

    public static getInstance(): LunarInterceptor {
        if (LunarInterceptor._instance == null) {
            LunarInterceptor._instance = new LunarInterceptor();
        }
        return LunarInterceptor._instance;
    }
}

export function getInterceptor(): LunarInterceptor {
    return LunarInterceptor.getInstance()
}
