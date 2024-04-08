import { logger } from './logger'
import { type OutgoingHttpHeaders } from "http"
import { popHeaderValue } from "./helper"

const LIST_DELIMITER = ","
const ALLOW_LIST = "AllowList"
const BLOCK_LIST = "BlockList"
const ALLOWED_HEADER_KEY = "x-lunar-allow"
const IP_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export class TrafficFilter {
    private _managed: boolean = false
    private _stateOk: boolean = false
    private readonly _isExternalIPCache: Map<string, boolean> = new Map<string, boolean>()
    private _allowList: string[] | undefined
    private _blockList: string[] | undefined

    public constructor() {
        this._allowList = this.parseList(process.env["LUNAR_ALLOW_LIST"])
        this._blockList = this.parseList(process.env["LUNAR_BLOCK_LIST"])
    }

    private checkIfHostOrIPIsAllowed(hostOrIp: string): boolean {
        const isAllowed = this.checkAllowed(hostOrIp)

        if (isAllowed !== undefined) return isAllowed

        return this.checkBlocked(hostOrIp) && this.isExternalIP(hostOrIp)
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

    private isExternalIP(ip: string): boolean {
        if (this._isExternalIPCache.has(ip)) return this._isExternalIPCache.get(ip) as boolean
        if (!this.validateIP(ip)) return true // If it's not an IP, we currently assume it's external
        const octets = ip.split('.').map((octet: string) => parseInt(octet));
        let isExternal = false
        if (octets[0] === 10) {
            // 10.x.x.x is a private IP
        } else if (octets[0] === 172 && octets[1] !== undefined && octets[1] >= 16 && octets[1] <= 31) {
            // 172.16.x.x - 172.31.x.x is a private IP
        } else if (octets[0] === 192 && octets[1] === 168) {
            // 192.168.x.x is a private IP
        } else if (octets[0] === 169 && octets[1] === 254) {
            // 169.254.x.x is a private IP
        } else if (octets[0] === 127) {
            // 127.x.x.x is a loopback IP
        } else isExternal = true; // Not an internal IP
        
        this._isExternalIPCache.set(ip, isExternal)
        return isExternal
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
        return true
    }

    private validateIP(ip: string): boolean {
        return IP_PATTERN.test(ip)
    }

    public setManaged(isManaged: boolean): void {
        this._managed = isManaged
        this._stateOk = this.isAccessListValid()
    }

    public isAllowed(hostOrIp: string, headers?: OutgoingHttpHeaders): boolean {
        const hostOrIPWithoutPort = hostOrIp.split(":")[0]
        logger.debug(`TrafficFilter::Checking if called to destination: "${hostOrIPWithoutPort}" is allowed.`)
        if (!this._stateOk) return false
        let isHeaderFilteredAllowed = true

        const isAllowedByHeader = popHeaderValue(ALLOWED_HEADER_KEY, headers);
        if (logger.isDebugEnabled() && isAllowedByHeader !== undefined) {
            logger.debug(`TrafficFilter::Filtering url: "${hostOrIPWithoutPort}" by header ${ALLOWED_HEADER_KEY}=${isAllowedByHeader as string}`);
        }
        
        if (isAllowedByHeader !== undefined) isHeaderFilteredAllowed = isAllowedByHeader === "true";
        
        return isHeaderFilteredAllowed && this.checkIfHostOrIPIsAllowed(hostOrIPWithoutPort ?? '');
    }

    public isManaged(): boolean {
        return this._managed;
    }
}
