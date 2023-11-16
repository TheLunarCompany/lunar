import { FailSafe } from "./failSafe"
import { TrafficFilter } from "./trafficFilter"
import { logger } from './logger'
import { type ConnectionInformation } from "./helper"
import { ClientRequest, type RequestOptions, type IncomingHttpHeaders } from 'http'

const http = require('http')
const https = require('https')
const nodejsUrl = require('node:url')

const LUNAR_SEQ_ID_HEADER_KEY = "x-lunar-sequence-id"
const LUNAR_RETRY_AFTER_HEADER_KEY = "x-lunar-retry-after"

class LunarClientRequest extends ClientRequest {
    public lunarRetry!: Function;
    public lunarRetryOnError!: Function;
    public originalWrite!: Function;
    public originalEmit!: Function;
}


interface OriginalFunctionMap {
    request: Function,
    get: Function,
    protocolModule: Function,
}

interface SchemeToFunctionsMap {
    http: OriginalFunctionMap,
    https: OriginalFunctionMap
}


class LunarInterceptor {
    private readonly originalFunctions: SchemeToFunctionsMap = {
        http: {
            request: http.request,
            get: http.get,
            protocolModule: http
        },
        https: {
            request: https.request,
            get: https.get,
            protocolModule: https
        }
    }

    private static _instance: LunarInterceptor;
    private _proxyConnInfo!: ConnectionInformation
    private readonly _trafficFilter: TrafficFilter = new TrafficFilter()
    private readonly _failSafe: FailSafe = new FailSafe()

    private constructor() {
    }

    public setOptions(conn: ConnectionInformation) {
        this._proxyConnInfo = conn
        this._trafficFilter.setManaged(this._proxyConnInfo.managed)
        this.initHooks()
    }

    private initHooks() {
        http.request = this.httpHookRequestFunc.bind(this, 'http:', 'request')
        http.get = this.httpHookGetFunc.bind(this, 'http:')

        https.request = this.httpHookRequestFunc.bind(this, 'https:', 'request')
        https.get = this.httpHookGetFunc.bind(this, 'https:')
    }

    private normalizeOptions(options: RequestOptions, scheme: string, url: URL) {
        if (!options.host) {
            options.host = options.hostname
        }

        if (!options.protocol) {
            options.protocol = scheme
        }

        if (!options.port) {
            if (url.port) {
                options.port = url.port
            } else {
                options.port = scheme == 'http:' ? 80 : 443;
            }
        }

        if (!(options as any).href) (options as any).href = url

        if ((options as any).pathname === undefined) (options as any).pathname = options.path;

        return options
    }

    private httpHookGetFunc(scheme: string, arg0: any, arg1: any, arg2: any, ...args: any[]) {
        return this.httpHookRequestFunc(scheme, 'get', arg0, arg1, arg2, ...args).end()
    }

    // https://github.com/nodejs/node/blob/717e233cd95602f79256c5b70c49703fa699174b/lib/_http_client.js#L130
    private httpHookRequestFunc(scheme: string, functionName: string, arg0: any, arg1: any, arg2: any, ...args: any[]) {
        let url: URL;
        let options: RequestOptions;
        let callback: Function;

        // get(url, options, callback?)
        if (typeof arg0 === 'string' && typeof arg1 === 'object') {
            url = new URL(arg0)
            options = arg1
            callback = arg2
        }

        // get(url, callback?)
        else if (typeof arg0 === 'string') {
            url = new URL(arg0)
            options = nodejsUrl.urlToHttpOptions(url)
            callback = arg1
        }

        // get(options, callback?)
        else if (typeof arg0 === 'object') {
            options = arg0
            const port = scheme == 'https:' ? 443 : 80;
            url = new URL(`${scheme}//${options.host || options.hostname}:${options.port || port}${(options as any).pathname || options.path}`)
            callback = arg1
        }
        // fml
        else {
            logger.error('Unexpected input on http.request')
            throw 'unexpected params'
        }

        if (this._proxyConnInfo.isInfoValid && this._failSafe.stateOk() && this._trafficFilter.isAllowed(url.host)) {
            options = this.normalizeOptions(options, scheme, url)
            return this.requestHandler(url, options, null, callback, false, null, null, ...args)
        }

        return this.getFunctionFromMap(scheme, functionName)(arg0, arg1, arg2, ...args)
    }

    private getFunctionFromMap(scheme: string, functionName: string): Function {
        const funcMap: OriginalFunctionMap = scheme == 'https:' ? this.originalFunctions.https : this.originalFunctions.http;
        return functionName == 'get' ? funcMap.get : funcMap.request;
    }

    private getFunctionWithProtocolFromMap(scheme: string | null | undefined, functionName: string): Function {
        const funcMap: OriginalFunctionMap = scheme == 'https:' ? this.originalFunctions.https : this.originalFunctions.http;
        return functionName == 'get' ? funcMap.get.bind(funcMap.protocolModule) : funcMap.request.bind(funcMap.protocolModule);
    }

    private deepClone(srcObj: any) {
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

    private prepareForRetry(headers: IncomingHttpHeaders): string | null {
        let rawRetryAfter = headers[LUNAR_RETRY_AFTER_HEADER_KEY]

        if (rawRetryAfter === undefined) return null

        const sequenceID = headers[LUNAR_SEQ_ID_HEADER_KEY]
        if (sequenceID === undefined) {
            logger.debug(`Retry required, but ${LUNAR_SEQ_ID_HEADER_KEY} is missing!`)
            return null
        }
        function sleepSync(ms: number) {
            const start = Date.now();
            while ((Date.now() - start) < ms) { }
        }
        if (Array.isArray(rawRetryAfter)) rawRetryAfter = rawRetryAfter[0]
        try {
            const retryAfter = parseFloat(String(rawRetryAfter))
            logger.debug(`Retry required, will retry in ${retryAfter} seconds...`)
            sleepSync(retryAfter * 1000)
            return String(sequenceID)

        } catch (error) {
            logger.debug(`Retry required, but parsing header ${LUNAR_RETRY_AFTER_HEADER_KEY} as float failed (${rawRetryAfter})`)
        }

        return null
    }

    // TODO: Modify options only for proxied traffic and dont affect the real object
    private callbackHook(callback: Function, ...requestArguments: any[]) {
        return (...args: any[]) => {
            const response: any = args[0]
            const originalRequest: ClientRequest = response.req;
            const gotError = this._failSafe.validateHeaders(response.headers)

            if (gotError) {
                this._failSafe.onError()
                return (originalRequest as LunarClientRequest).lunarRetryOnError(null, null, ...requestArguments)

            } else {
                if ((originalRequest as any).baseURL?.includes(this._proxyConnInfo.proxyHost)) {
                    this._failSafe.onSuccess()
                }
            }
            const sequenceID = this.prepareForRetry(response.headers)
            if (sequenceID != null) return (originalRequest as LunarClientRequest).lunarRetry(null, sequenceID, ...requestArguments)

            return callback(...args)
        }
    }

    private generateModifiedOptions(originalOptions: RequestOptions, url: URL): RequestOptions {
        const modifiedOptions = this.deepClone(originalOptions);

        modifiedOptions.host = modifiedOptions.hostname = this._proxyConnInfo.proxyHost;
        modifiedOptions.port = this._proxyConnInfo.proxyPort;
        modifiedOptions.protocol = `${this._proxyConnInfo.proxyScheme}:`;
        (modifiedOptions).href = `${modifiedOptions.protocol}//${modifiedOptions.host}:${modifiedOptions.port}${modifiedOptions.path}`;

        this.manipulateHeaders(modifiedOptions, url)

        return modifiedOptions
    }

    private requestHandler(url: URL, originalOptions: RequestOptions, modifiedOptions: RequestOptions | null, callback: Function, gotError: boolean, dataObj: any, sequenceID: string | null, ...requestArguments: any[]) {
        // TODO: We should also take care of handling event based requests.
        let req: LunarClientRequest
        let originalFunc: Function
        let func: Function

        originalFunc = this.getFunctionWithProtocolFromMap(originalOptions.protocol, 'request')

        if (!gotError && this._failSafe.stateOk()) {
            if (modifiedOptions === null) modifiedOptions = this.generateModifiedOptions(originalOptions, url)
            if (sequenceID !== null && modifiedOptions.headers) modifiedOptions.headers[LUNAR_SEQ_ID_HEADER_KEY] = sequenceID

            func = this.getFunctionWithProtocolFromMap(modifiedOptions.protocol, 'request')


            const callbackWrapper = this.callbackHook(callback, ...requestArguments)
            let writeData: any
            try {

                req = func(modifiedOptions, callbackWrapper, ...requestArguments);
                req.lunarRetry = this.requestHandler.bind(this, url, originalOptions, modifiedOptions, callback, false);
                req.lunarRetryOnError = this.requestHandler.bind(this, url, originalOptions, modifiedOptions, callback, true);
                req.originalWrite = (req as any).write;

                (req as any).write = function (data: any, ...args: any[]) {
                    if (args) { }
                    writeData = data;
                    req.originalWrite(data, ...args)
                };

                req.originalEmit = req.emit;
                req.emit = function (event: any, ...args: any[]): boolean {

                    if (event === 'error') { }
                    else {
                        req.originalEmit(event, ...args)
                    }

                    return true
                }

                req.on('socket', (socket: any) => {
                    socket.originalEmit = socket.emit
                    socket.emit = function (event: any, ...args: any[]): boolean {

                        if (event === 'error') {
                            req.socket?.destroy();
                            req.destroy();

                            req.lunarRetryOnError(writeData, null, ...requestArguments)


                        } else {
                            socket.originalEmit(event, ...args)
                        }

                        return true
                    }

                });
                if (sequenceID !== null && sequenceID !== undefined) {
                    req.end()
                }

                return req

            } catch (error) {
                this._failSafe.onError()
            }
        }

        const revertedRequest = originalFunc(originalOptions, callback, ...requestArguments)
        if (gotError) {
            if (dataObj !== null && dataObj !== undefined) {
                revertedRequest.write(dataObj)
            }
            revertedRequest.end()
        }

        return revertedRequest
    }

    private manipulateHeaders(options: RequestOptions, url: URL) {
        if (!options.headers) options.headers = {}

        options.headers.host = url.host
        options.headers['x-lunar-interceptor'] = this._proxyConnInfo.interceptorID
        options.headers['x-lunar-scheme'] = url.protocol.substring(0, url.protocol.length - 1)
    }

    public static getInstance(): LunarInterceptor {
        if (!LunarInterceptor._instance) {
            LunarInterceptor._instance = new LunarInterceptor();
        }

        return LunarInterceptor._instance;
    }
}

export function getInterceptor(): LunarInterceptor {
    return LunarInterceptor.getInstance()
}
