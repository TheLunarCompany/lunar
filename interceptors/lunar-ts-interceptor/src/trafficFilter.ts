import { logger } from './logger'
import { type OutgoingHttpHeaders } from "http"
import { popHeaderValue } from "./helper"

const LIST_DELIMITER = ","
const ALLOW_LIST = "AllowList"
const BLOCK_LIST = "BlockList"
const ALLOWED_HEADER_KEY = "x-lunar-allow"
const ALLOWED_HEADER_VALUE = "true"
const IP_PATTERN = /^[\\d.]+$/
const HOST_PATTERN = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9])\\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\\-]*[A-Za-z0-9]){2,}$/

export class TrafficFilter {
    private _managed: boolean = false
    private _stateOk: boolean = false
    private _allowList: string[] | undefined
    private _blockList: string[] | undefined

    public constructor() {
        this._allowList = this.parseList(process.env["LUNAR_ALLOW_LIST"])
        this._blockList = this.parseList(process.env["LUNAR_BLOCK_LIST"])
    }

    private checkIfHostOrIPIsAllowed(hostOrIp: string): boolean {
        const isAllowed = this.checkAllowed(hostOrIp)

        if (isAllowed !== undefined) return isAllowed

        // TODO: Here we should also validate the IP destination to check if is an external address.
        return this.checkBlocked(hostOrIp)
    }

    private checkAllowed(hostOrIp: string): boolean | undefined {
        if (this._allowList === undefined) return undefined

        return this._allowList.includes(hostOrIp)
    }

    private checkBlocked(hostOrIp: string): boolean {
        if (this._blockList === undefined) return true

        else if (this._blockList.includes(hostOrIp)) return false

        return true
    }

    private parseList(valueToParse?: string): string[] | undefined {
        if (valueToParse === undefined) return undefined

        return valueToParse.split(LIST_DELIMITER)
    }

    private isAccessListValid(): boolean {
        if (!this.validateAllow()) return false

        if (!this.validateBlock()) {
            logger.warn("Interceptor will be disable to avoid passing wrong traffic through the Proxy.")
            return false
        }
        return true
    }

    private validateAllow(): boolean {
        if (this._allowList === undefined) {
            if (this._managed) return false
            return true
        }

        const valuesToRemove: string[] = []
        for (const hostOrIP of Object.values(this._allowList)) {
            if (!(this.validateHost(hostOrIP) || this.validateIP(hostOrIP))) valuesToRemove.push(hostOrIP)
        }

        logger.warn(`Unsupported value ['${valuesToRemove.toString()}'] will be removed from the allowed list.`)

        this._allowList = this._allowList.filter(item => !valuesToRemove.includes(item))
        return true
    }

    private validateBlock(): boolean {
        if (this._blockList === undefined) return true

        if (this._allowList !== undefined) {
            logger.warn(`TrafficFilter::Found ${ALLOW_LIST} skipping the ${BLOCK_LIST}`)
            this._blockList = []
            return true
        }

        let blockListValidatePass: boolean = true
        for (const hostOrIP of Object.values(this._blockList)) {
            if (!(this.validateHost(hostOrIP) || this.validateIP(hostOrIP))) {
                logger.warn(`Error while parsing '${hostOrIP}' from the block list`)
                blockListValidatePass = false
            }
        }

        return blockListValidatePass
    }

    private validateHost(host: string): boolean {
        if (this.validateIP(host)) return false

        return HOST_PATTERN.test(host)
    }

    private validateIP(ip: string): boolean {
        return IP_PATTERN.test(ip)
    }

    public setManaged(isManaged: boolean): void {
        this._managed = isManaged
        this._stateOk = this.isAccessListValid()
    }

    public isAllowed(hostOrIp: string, headers?: OutgoingHttpHeaders): boolean {
        if (!this._stateOk) return false

        const headerFilter = popHeaderValue(ALLOWED_HEADER_KEY, headers)
        if (headerFilter !== undefined) {
            return headerFilter === ALLOWED_HEADER_VALUE
        }

        return this.checkIfHostOrIPIsAllowed(hostOrIp)
    }

    public isManaged(): boolean {
        return this._managed
    }
}
