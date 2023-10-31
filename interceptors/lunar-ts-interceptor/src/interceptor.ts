import { FailSafe } from "./failSafe"
import { TrafficFilter } from "./trafficFilter"
import { logger } from './logger'
import { ConnectionInformation } from "./helper"
import { ClientRequest, RequestOptions, IncomingHttpHeaders } from 'http'
import Module from "module"

var http = require('http')
var https = require('https')
const nodejsUrl = require('node:url')

const LUNAR_SEQ_ID_HEADER_KEY = "x-lunar-sequence-id"
const LUNAR_RETRY_AFTER_HEADER_KEY = "x-lunar-retry-after"

class LunarClientRequest extends ClientRequest {
    public lunarRetry!: Function;
    public lunarRetryOnError!: Function;
    public originalWrite!: Function;
    public originalEmit!: Function;
}

type OriginalFunctionsMap = {
    http: {
        request: Function,
        get: Function,
        protocolModule: Module,
    },
    https: {
        request: Function,
        get: Function,
        protocolModule: Module,
    }
}

class LunarInterceptor {
    private originalFunctions: OriginalFunctionsMap = {
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
    private _trafficFilter: TrafficFilter = new TrafficFilter()
    private _failSafe: FailSafe = new FailSafe()

    private constructor() {
    }

    public setOptions(conn: ConnectionInformation) {
        this._proxyConnInfo = conn
        this._trafficFilter.setManaged(this._proxyConnInfo.managed)
        this.initHooks()
    }

    private initHooks() {
        http.request = this.httpHookRequestFunc.bind(this, 'http:')
        http.get = this.httpHookGetFunc.bind(this, 'http:')

        https.request = this.httpHookRequestFunc.bind(this, 'https:')
        https.get = this.httpHookGetFunc.bind(this, 'https:')
    }

    private normalizeOptions(options: any, scheme: string) {
        if (!options.host) {
            options.host = options.hostname
        }

        if (!options.protocol) {
            options.protocol = scheme
        }

        if (!options.port) {
            if (scheme == 'http:') {
                options.port = 80
            } else if (scheme == 'https:') {
                options.port = 443
            }
        }

        if (!options.href) {
            options.href = new URL(`${options.protocol}//${options.host}:${options.port}${options.path}`)
        }
        if ((options as any).pathname === undefined) (options as any).pathname = options.path;
        return options
    }

    private httpHookGetFunc(scheme: string, arg0: any, arg1: any, arg2: any, ...args: any[]) {
        return this.httpHookRequestFunc(scheme, arg0, arg1, arg2, ...args).end()
    }

    //https://github.com/nodejs/node/blob/717e233cd95602f79256c5b70c49703fa699174b/lib/_http_client.js#L130
    private httpHookRequestFunc(scheme: string, arg0: any, arg1: any, arg2: any, ...args: any[]) {
        var url: URL;
        var options: any = null;
        var callback: Function;

        //get(url, options, callback?)
        if (typeof arg0 === 'string' && typeof arg1 == 'object') {
            url = new URL(arg0)
            options = this.normalizeOptions(arg1, scheme)
            callback = arg2
        }

        //get(url, callback?)
        else if (typeof arg0 === 'string') {
            url = new URL(arg0)
            options = this.normalizeOptions(nodejsUrl.urlToHttpOptions(url), scheme)
            callback = arg1
        }

        //get(options, callback?)
        else if (typeof arg0 === 'object') {
            options = this.normalizeOptions(arg0, scheme)
            url = new URL(options.href)
            callback = arg1
        }

        //fml
        else {
            logger.error('Unexpected input on http.request')
            throw 'unexpected params'
        }

        return this.requestHandler(url, options, null, callback, false, null, null, ...args)
    }

    private deepClone(srcObj: any) {
        if (srcObj === null) return null;
        let clone = Object.assign({}, srcObj);
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

        let sequenceID = headers[LUNAR_SEQ_ID_HEADER_KEY]
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
            let retryAfter = parseFloat(String(rawRetryAfter))
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
            let response: any = args[0]
            var originalRequest: ClientRequest = response.req;
            var gotError = this._failSafe.validateHeaders(response.headers)

            if (gotError) {
                this._failSafe.onError()
                return (originalRequest as LunarClientRequest).lunarRetryOnError(null, null, ...requestArguments)

            } else {
                if ((originalRequest as any).baseURL?.includes(this._proxyConnInfo.proxyHost)) {
                    this._failSafe.onSuccess()
                }
            }
            let sequenceID = this.prepareForRetry(response.headers)
            if (sequenceID != null) return (originalRequest as LunarClientRequest).lunarRetry(null, sequenceID, ...requestArguments)

            return callback(...args)
        }
    }

    private generateModifiedOptions(originalOptions: RequestOptions, url: URL): RequestOptions {
        var modifiedOptions = this.deepClone(originalOptions);

        modifiedOptions.host = modifiedOptions.hostname = this._proxyConnInfo.proxyHost;
        modifiedOptions.port = this._proxyConnInfo.proxyPort;
        modifiedOptions.protocol = `${this._proxyConnInfo.proxyScheme}:`;
        (modifiedOptions as any).href = `${modifiedOptions.protocol}//${modifiedOptions.host}:${modifiedOptions.port}${modifiedOptions.path}`;

        this.manipulateHeaders(modifiedOptions, url)

        return modifiedOptions
    }

    private requestHandler(url: URL, originalOptions: RequestOptions, modifiedOptions: RequestOptions | null, callback: Function, gotError: boolean, dataObj: any, sequenceID: string | null, ...requestArguments: any[]) {
        // TODO: We should also take care of handling event based requests.
        var req: LunarClientRequest

        let protocol: Module
        let originalProtocol: Module
        let originalFunc: Function
        let func: Function

        if (originalOptions.protocol == "http:") {
            originalProtocol = this.originalFunctions.http.protocolModule
            originalFunc = this.originalFunctions.http.request
        } else {
            originalProtocol = this.originalFunctions.https.protocolModule
            originalFunc = this.originalFunctions.https.request
        }

        if (!gotError && this._proxyConnInfo.isInfoValid && this._failSafe.stateOk() && this._trafficFilter.isAllowed(url.host)) {
            if (modifiedOptions === null) modifiedOptions = this.generateModifiedOptions(originalOptions, url)
            if (sequenceID !== null && modifiedOptions.headers) modifiedOptions.headers[LUNAR_SEQ_ID_HEADER_KEY] = sequenceID

            if (modifiedOptions.protocol == "http:") {
                protocol = this.originalFunctions.http.protocolModule
                func = this.originalFunctions.http.request
            } else {
                protocol = this.originalFunctions.https.protocolModule
                func = this.originalFunctions.https.request
            }

            var callbackWrapper = this.callbackHook(callback, ...requestArguments)
            var writeData: any
            try {

                req = func.call(protocol, modifiedOptions, callbackWrapper, ...requestArguments);
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

                    if ('error' === event) { }
                    else {
                        req.originalEmit(event, ...args)
                    }

                    return true
                }

                req.on('socket', (socket: any) => {
                    socket.originalEmit = socket.emit
                    socket.emit = function (event: any, ...args: any[]): boolean {

                        if ('error' === event) {
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

        var revertedRequest = originalFunc.call(originalProtocol, originalOptions, callback, ...requestArguments)
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

        options.headers['host'] = url.host
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
