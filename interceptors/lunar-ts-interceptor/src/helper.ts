import { logger } from './logger'

import http from 'http'
import { URL } from 'url'
import https, { type RequestOptions } from 'https'
import type Module from 'module'


const PROXY_HOST_KEY = "LUNAR_PROXY_HOST"
const HEALTH_CHECK_PORT_KEY = "LUNAR_HEALTHCHECK_PORT"
const TENANT_ID_KEY = "LUNAR_TENANT_ID"
const SUPPORT_TLS_KEY = "LUNAR_PROXY_SUPPORT_TLS"
const INTERCEPTOR_ID = "lunar-ts-interceptor/1.0.0"
const PROXY_DEFAULT_HEALTHCHECK_PORT = 8040
const LEGACY_URL_MODULE_VERSION = 15

export interface ConnectionInformation {
    proxyScheme: string
    proxyHost: string
    proxyPort: number
    handShakePort: number
    tenantID: string
    managed: boolean
    isInfoValid: boolean
    interceptorID: string
}

export function loadConnectionInformation(): ConnectionInformation {
    let proxyHost: string = loadStrFromEnv(PROXY_HOST_KEY, "null")
    let proxyPort: number = 0

    if (proxyHost !== "null") {
        const proxyHostAndPort: string[] = proxyHost.split(':')

        if (proxyHostAndPort.length !== 2) {
            logger.warn("Could not obtain the Port value of Lunar Proxy from environment variables,"
                + `please set ${PROXY_HOST_KEY} to the Lunar Proxy's host/IP and port in`
                + "order to allow the interceptor to be loaded.")
            proxyHost = "null"

        } else {
            proxyHost = String(proxyHostAndPort[0])
            proxyPort = Number(proxyHostAndPort[1])
        }

    } else {
        logger.warn("Could not obtain the Host value of Lunar Proxy from environment variables,"
            + `please set ${PROXY_HOST_KEY} to the Lunar Proxy's host/IP and port in`
            + "order to allow the interceptor to be loaded.")
    }

    const handShakePort: number = loadNumberFromEnv(HEALTH_CHECK_PORT_KEY, PROXY_DEFAULT_HEALTHCHECK_PORT)
    const tenantID: string = loadStrFromEnv(TENANT_ID_KEY, "unknown")
    let proxyScheme: string
    if (loadStrFromEnv(SUPPORT_TLS_KEY, "0") === "1") proxyScheme = "https"
    else proxyScheme = "http"


    return {
        proxyScheme,
        proxyHost,
        proxyPort,
        handShakePort,
        tenantID,
        managed: false,
        interceptorID: INTERCEPTOR_ID,
        isInfoValid: proxyHost !== 'null'
    }
}

export function generateUrl(options: RequestOptions, scheme: string): URL {
    let host = options.host
    let port = options.port
    let path = options.path
    if (host == null || host === undefined || host === "") {
        host = options.hostname
    }
    if (port == null || port === undefined || port === "") {
        port = scheme === 'https:' ? 443 : 80;
    }
    if (path == null || path === undefined || path === "") {
        // @ts-expect-error: TS2339
        path = options.pathname
    }

    return new URL(`${scheme}//${host}:${port}${path}`)
}

export function loadStrFromEnv(key: string, defaultValue: string): string {
    const envValue = process.env[key]
    if (envValue != null && envValue !== undefined) {
        return envValue
    }

    return defaultValue
}

export function loadNumberFromEnv(key: string, defaultValue: number): number {
    const envValue = process.env[key]
    if (envValue != null && envValue !== undefined) {
        return Number(envValue)
    }

    return defaultValue
}

async function doRequest(connectionInfo: ConnectionInformation): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
        const options = {
            hostname: connectionInfo.proxyHost,
            port: connectionInfo.handShakePort,
            path: '/handshake',
            method: 'GET',
            headers: {
                "x-lunar-tenant-id": connectionInfo.tenantID
            },
        };


        const protocol = connectionInfo.proxyScheme === 'https' ? https : http;
        const request = protocol.request(options, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                resolve(data);
            });
        });

        request.on('error', (error) => {
            reject(error);
        });

        request.end();
    });
}

export async function makeProxyConnection(): Promise<ConnectionInformation> {
    const connectionInfo: ConnectionInformation = loadConnectionInformation()
    let res: string
    if (!connectionInfo.isInfoValid) return connectionInfo

    try {
        res = await doRequest(connectionInfo)
        connectionInfo.managed = (Boolean(JSON.parse(res).managed)) || false
    } catch (error) {
        connectionInfo.isInfoValid = false
    }

    return connectionInfo
}

export function getUrlImport(): Module | null {
    const version = process.versions.node.split('.')

    if (version.length === 0) {
        logger.error("Could not determine the version of NodeJS, Lunar Interceptor is disabled.")
        return null
    }
    const major = version[0]
    let urlModule: Module | null = null

    if (major !== undefined) {
        const majorInt = parseInt(major)

        if (majorInt > LEGACY_URL_MODULE_VERSION) {
            urlModule = require('node:url');  // New import
        } else {
            urlModule = require('url');  // Legacy import
        }

        // @ts-expect-error: TS2339
        if (typeof urlModule.urlToHttpOptions === 'undefined') {
            logger.error("Could not find required `urlToHttpOptions` function, Lunar Interceptor is disabled.")
            return null
        }
    }
    return urlModule
}
