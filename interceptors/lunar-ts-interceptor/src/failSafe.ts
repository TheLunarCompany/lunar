import { logger } from './logger'
import { loadNumberFromEnv } from "./environment"
import { type IncomingHttpHeaders } from 'http'
import { translateProxyError } from './helper'

const DEFAULT_MAX_ERROR_ALLOWED = 5
const DEFAULT_FAILSAFE_COOLDOWN_SEC = 10
export const HEADER_ERROR_KEY = "x-lunar-error"

export class FailSafe {
    private _stateOk: boolean
    private _errorCounter: number
    private _cooldownStartedAt: number
    private readonly _maxErrorAllowed: number
    private readonly _cooldownTime: number

    public constructor() {
        this._stateOk = true
        this._errorCounter = 0
        this._cooldownStartedAt = 0
        this._maxErrorAllowed = loadNumberFromEnv('LUNAR_ENTER_COOLDOWN_AFTER_ATTEMPTS', DEFAULT_MAX_ERROR_ALLOWED)
        this._cooldownTime = loadNumberFromEnv('LUNAR_EXIT_COOLDOWN_AFTER_SEC', DEFAULT_FAILSAFE_COOLDOWN_SEC) * 1000
    }

    private ensureEnterFailSafe(): void {
        if (this._maxErrorAllowed > this._errorCounter) return

        this._stateOk = false
        this._cooldownStartedAt = Date.now()
    }

    private ensureExitFailSafe(): void {
        if (!this._stateOk && (Date.now() - this._cooldownStartedAt) >= this._cooldownTime) {
            this._stateOk = true
        }
    }

    public onError(error: Error, withStackTrace: boolean): void {
        logger.warn(`FailSafe::Error communicating with Lunar Proxy, Error: ${error.message}`)
        if (withStackTrace) {
            logger.debug(`Traceback: ${error.stack}`)
        }
        this._errorCounter++
        this.ensureEnterFailSafe()
    }

    public onSuccess(): void {
        this._errorCounter = 0
    }

    public stateOk(): boolean {
        this.ensureExitFailSafe()
        return this._stateOk
    }

    public validateHeaders(headers: IncomingHttpHeaders | undefined): boolean {
        if (headers === undefined) return true
        
        if (Object.prototype.hasOwnProperty.call(headers, HEADER_ERROR_KEY)) {
            const error = headers[HEADER_ERROR_KEY]
            logger.warn(`
                FailSafe::Error communicating with Lunar Proxy,
                Error: ${headers[HEADER_ERROR_KEY] as string}
                Message: ${translateProxyError(error as string)}
            `)
            return true
        }

        return false
    }
}
