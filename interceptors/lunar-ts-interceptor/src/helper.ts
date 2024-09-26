import { logger } from './logger'
import { EngineVersion } from './engineVersion'

import { URL } from 'url'
import { type RequestOptions, type Agent as httpsAgent } from 'https'
import { type OutgoingHttpHeader, type Agent as httpAgent } from 'http'
import { INTERCEPTOR_VERSION, LUNAR_PROXY_ERROR_TRANSLATOR } from './constants'
import { type EnvironmentInfo } from './environment'
import { randomUUID } from 'crypto'


export function copyAgentData(agent: httpsAgent | httpAgent, targetAgent: httpsAgent | httpAgent): void {
    for (const key in agent) {
        if (Object.prototype.hasOwnProperty.call(agent, key)) {
            if (key === 'port' || key === 'host' || key === 'hostname' || key === 'protocol') {
                continue;
            }
            // @ts-expect-error: TS2339
            targetAgent[key] = agent[key];
        }
    }
  }

export function generateUUID(): string {
    return randomUUID();
}

export function translateProxyError(code: string): string {
    if (code in LUNAR_PROXY_ERROR_TRANSLATOR) {
        return LUNAR_PROXY_ERROR_TRANSLATOR[code] as string;
    } else {
        return "Unknown error, Please check the Proxy logs for more information.";
    }
}

export function generateUrl(options: RequestOptions, scheme: string): URL {
    let host = options.host
    let port = options.port
    let path = options.path
    if (host == null || host === undefined || host === "") {
        if (options.hostname == null || options.hostname === undefined) {
            host = ""
        } else {
            host = options.hostname
        }
    }
    if (port == null || port === undefined || port === "") {
        port = scheme === 'https:' ? 443 : 80;
    }
    if (path == null || path === undefined || path === "") {
        // @ts-expect-error: TS2339
        path = options.pathname
    }
    host = host.split(":")[0]
    return new URL(`${scheme}//${host}:${port}${path}`)
}


export function getEngineVersion(): EngineVersion | null {
    const version = process.versions.node.split('.')
    if (version.length <= 2) {
        return null
    }

    const major = version[0]
    const minor = version[1]
    const fix = version[2]

    if (major === undefined || minor === undefined  || fix === undefined) {
        return null
    }

    return new EngineVersion(parseInt(major), parseInt(minor), parseInt(fix))
}

export function isEngineVersionSupported(engineVersion: EngineVersion): boolean {

    if (engineVersion === null) {
        logger.error("Could not determine the version of NodeJS, Lunar Interceptor is disabled.")
        return false
    }

    if (engineVersion.isEqualOrGreaterThan(new EngineVersion(16, 0, 0))) return true

    return engineVersion.inRange(new EngineVersion(15, 7, 0), new EngineVersion(16, 0 ,0)) ||
           engineVersion.inRange(new EngineVersion(14, 18, 0), new EngineVersion(15, 0 ,0))

}

export function popHeaderValue(key: string, headers?: NodeJS.Dict<OutgoingHttpHeader>): string | number | string[] | undefined {
    if (headers === undefined || headers === null) return undefined
    const value = headers[key];

    if (value !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete headers[key];
    }
    return value;
}

export function debugInfo(connInfo: EnvironmentInfo): void {
    logger.debug(`
    \nLunar Interceptor has loaded in debug mode.
    The current configuration are
        * Interceptor Version: ${INTERCEPTOR_VERSION}
        * Lunar Proxy Host: ${connInfo.proxyConnectionInfo?.proxyHost}
        * Lunar Proxy Port: ${connInfo.proxyConnectionInfo?.proxyPort}
        * Lunar Proxy Handshake Port: ${connInfo.proxyConnectionInfo?.proxyHandshakePort}

    Environment details:
        * NodeJS Engine Version: ${process.versions.node}
    `)
}
