import { logger } from './logger'
import { getInterceptor } from './interceptor'
import { isEngineVersionSupported, getEngineVersion } from "./helper"

const engineVersion = getEngineVersion()

if (engineVersion === null) {
    logger.error("Could not determine the version of NodeJS, Lunar Interceptor is disabled.")
} else if (isEngineVersionSupported(engineVersion))
{
    getInterceptor()
} else { // Unsupported node version.
    logger.error(`
    Lunar Interceptor could not be loaded because the installed Node.js version is unsupported. 
        Your Node.js engine version: "${engineVersion.major}.${engineVersion.minor}.${engineVersion.minor}".
        Please ensure that your Node.js version is within the supported range.\n
        For a list of supported Node.js versions, refer to the Lunar Interceptor documentation:
        https://docs.lunar.dev/installation-configuration/interceptors/#supported-languages
        `)
}
