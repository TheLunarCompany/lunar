import { logger } from './logger'

const DEFAULT_MAX_ERROR_ALLOWED = 5
const DEFAULT_FAILSAFE_COOLDOWN_SEC = 10
const HEADER_ERROR_KEY = "x-lunar-error"

export class FailSafe {
    private _stateOk: boolean
    private _errorCounter: number
    private _cooldownStartedAt: number
    private _maxErrorAllowed: number
    private _cooldownTime: number

    public constructor() {
        this._stateOk = true
        this._errorCounter = 0
        this._cooldownStartedAt = 0
        this._maxErrorAllowed = Number(process.env['LUNAR_ENTER_COOLDOWN_AFTER_ATTEMPTS'] || DEFAULT_MAX_ERROR_ALLOWED)
        this._cooldownTime = Number(process.env['LUNAR_EXIT_COOLDOWN_AFTER_SEC'] || DEFAULT_FAILSAFE_COOLDOWN_SEC) * 1000
    }

    private ensureEnterFailSafe() {
        if (this._maxErrorAllowed > this._errorCounter) return

        this._stateOk = false
        this._cooldownStartedAt = Date.now()
    }

    private ensureExitFailSafe() {
        if (!this._stateOk && (Date.now() - this._cooldownStartedAt) >= this._cooldownTime) {
            this._stateOk = true
        }
    }

    public onError() {
        logger.warn("FailSafe::Error communicating with Lunar Proxy")
        this._errorCounter++
        this.ensureEnterFailSafe()
    }

    public onSuccess() {
        this._errorCounter = 0
    }

    public stateOk(): boolean {
        this.ensureExitFailSafe()
        return this._stateOk
    }

    public validateHeaders(headers: Record<string, string>): boolean {
        console.log(headers)
        console.log(headers.hasOwnProperty(HEADER_ERROR_KEY))

        return headers.hasOwnProperty(HEADER_ERROR_KEY);
    }
}