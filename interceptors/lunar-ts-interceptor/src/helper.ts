import { logger } from './logger'

import http from 'http'
import https from 'https'

const PROXY_HOST_KEY = "LUNAR_PROXY_HOST"
const HEALTH_CHECK_PORT_KEY = "LUNAR_HEALTHCHECK_PORT"
const TENANT_ID_KEY = "LUNAR_TENANT_ID"
const SUPPORT_TLS_KEY = "LUNAR_PROXY_SUPPORT_TLS"
const INTERCEPTOR_ID = "lunar-ts-interceptor/1.0.0"
const PROXY_DEFAULT_HEALTHCHECK_PORT = 8040

export type ConnectionInformation = {
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

    if (proxyHost != "null") {
        let proxyHostAndPort: string[] = proxyHost.split(':')

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

    let handShakePort: number = loadNumberFromEnv(HEALTH_CHECK_PORT_KEY, PROXY_DEFAULT_HEALTHCHECK_PORT)
    let tenantID: string = loadStrFromEnv(TENANT_ID_KEY, "unknown")
    let proxyScheme: string
    if (loadStrFromEnv(SUPPORT_TLS_KEY, "0") === "1") proxyScheme = "https"
    else proxyScheme = "http"


    return {
        proxyScheme: proxyScheme,
        proxyHost: proxyHost,
        proxyPort: proxyPort,
        handShakePort: handShakePort,
        tenantID: tenantID,
        managed: false,
        interceptorID: INTERCEPTOR_ID,
        isInfoValid: proxyHost === 'null' ? false : true
    }
}

export function loadStrFromEnv(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue
}

export function loadNumberFromEnv(key: string, defaultValue: number): number {
    return Number(process.env[key] || defaultValue)
}

function doRequest(connectionInfo: ConnectionInformation) {
    return new Promise<string>((resolve, reject) => {
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
        connectionInfo.managed = JSON.parse(res)["managed"] || false
    } catch (error) {
        connectionInfo.isInfoValid = false
    }

    return connectionInfo
}
