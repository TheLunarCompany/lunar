import { getInterceptor } from './interceptor'
import { loadConnectionInformation } from "./helper"

const interceptor = getInterceptor()
// TODO: We should here make the handshake with the Proxy using makeProxyConnection() instead of loadConnectionInformation()
interceptor.setOptions(loadConnectionInformation())
