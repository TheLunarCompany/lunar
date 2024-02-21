import { logger } from './logger'
import { getInterceptor } from './interceptor'
import { loadConnectionInformation, isEngineVersionSupported, getEngineVersion, debugInfo } from "./helper"

const engineVersion = getEngineVersion()

if (engineVersion === null) {
    logger.error("Could not determine the version of NodeJS, Lunar Interceptor is disabled.")
} else if (isEngineVersionSupported(engineVersion))
{
    const connectionInfo = loadConnectionInformation()
    debugInfo(connectionInfo)
    const interceptor = getInterceptor()
    // TODO: We should here make the handshake with the Proxy using makeProxyConnection() instead of loadConnectionInformation()
    interceptor.setOptions(connectionInfo)
} else { // Unsupported node version.
    logger.error(`
    Lunar Interceptor could not be loaded because the installed Node.js version is unsupported. 
        Your Node.js engine version: "${engineVersion.major}.${engineVersion.minor}.${engineVersion.minor}".
        Please ensure that your Node.js version is within the supported range.\n
        For a list of supported Node.js versions, refer to the Lunar Interceptor documentation:
        https://docs.lunar.dev/installation-configuration/interceptors/#supported-languages
        `)
}
