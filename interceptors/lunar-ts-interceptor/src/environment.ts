import { logger } from "./logger"
import { HANDSHAKE_PORT_KEY, INTERCEPTOR_ID, PROXY_DEFAULT_HANDSHAKE_PORT, PROXY_HOST_KEY, SUPPORT_TLS_KEY, TENANT_ID_KEY } from "./constants"

export interface ProxyConnectionInfo {
  proxyHost: string
  proxyPort: number
  proxyHandshakePort: number
  proxyScheme: string
}

export interface EnvironmentInfo {
  proxyConnectionInfo: ProxyConnectionInfo | undefined
  managed: boolean
  tenantID: string
  interceptorID: string
}

export function loadEnvironmentProxyInfo(): EnvironmentInfo {
  const tenantID: string = loadStrFromEnv(TENANT_ID_KEY, "unknown")

  return {
    proxyConnectionInfo: getProxyConnInfo(),
    managed: false,
    tenantID,
    interceptorID: INTERCEPTOR_ID
  }
}

function getProxyConnInfo(): ProxyConnectionInfo | undefined {
  const proxyHostValue: string = loadStrFromEnv(PROXY_HOST_KEY, "null")
  const proxyHandshakePort: number = loadNumberFromEnv(HANDSHAKE_PORT_KEY, PROXY_DEFAULT_HANDSHAKE_PORT)
  
  let proxyScheme: string
  if (loadStrFromEnv(SUPPORT_TLS_KEY, "0") === "1") proxyScheme = "https"
  else proxyScheme = "http"
  
  if (proxyHostValue === "null") {
    logger.warn(`Could not obtain the Host value of Lunar Proxy from environment variables,
    please set ${PROXY_HOST_KEY} to the Lunar Proxy's host/IP and port in order to allow the interceptor to be loaded.`)
    return undefined
  }

  const proxyHostAndPort: string[] = proxyHostValue.split(':')

  if (proxyHostAndPort.length === 0) {
    logger.warn(`
    Could not obtain the Host value of Lunar Proxy from environment variables,
    please set ${PROXY_HOST_KEY} to the Lunar Proxy's host/IP and port in.
    current value: ${proxyHostValue}`)
    return undefined
  }

  if (proxyHostAndPort.length === 1) {
    logger.warn(`
    Could not obtain the Port value of Lunar Proxy from environment variables,
    please set ${PROXY_HOST_KEY} to the Lunar Proxy's host/IP and port in
    order to allow the interceptor to be loaded.
    current value: ${proxyHostValue}`)
    return undefined
  }

  if (proxyHostAndPort.length > 2) {
    logger.warn(`
    Could not parse the Host value of Lunar Proxy from environment variables,
    please set ${PROXY_HOST_KEY} to the Lunar Proxy's host/IP and port in with the format of 'host:port'.
    Please note that the value should not contain any additional ':' such as Protocol in order to allow the interceptor to be loaded.
    current value: ${proxyHostValue}`)
    return undefined
  }

  const proxyHost = String(proxyHostAndPort[0])
  let proxyPort = 0

  try {
    proxyPort = Number(proxyHostAndPort[1])
  } catch (e) {
    logger.warn(`
      could not parse the port value of Lunar Proxy from environment variables,
      please set ${PROXY_HOST_KEY} to the Lunar Proxy's host/IP and port in with the format of 'host:port'.
      please note that the Port should be a valid number in order to allow the interceptor to be loaded.
      current value: ${proxyHostValue}`)
      return undefined
  }
  
  return {
    proxyHost,
    proxyPort,
    proxyHandshakePort,
    proxyScheme
  }
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