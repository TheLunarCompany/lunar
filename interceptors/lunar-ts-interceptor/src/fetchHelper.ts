import { type OutgoingHttpHeaders } from 'http';
import { type ConnectionInformation } from './helper';
import { logger } from './logger'
import { HEADER_ERROR_KEY } from './failSafe'


// Helper method to convert HeadersInit to OutgoingHttpHeaders
export class FetchHelper {
   public ConvertHeadersToOutgoingHttpHeaders(requestHeaders: Headers, headersInit?: HeadersInit): OutgoingHttpHeaders {
        let headers: OutgoingHttpHeaders = {};
        requestHeaders.forEach((value, key) => {
            headers[key] = value;
        });
        if (headersInit === null || headersInit === undefined) { return headers } 
        
        if (headersInit instanceof Headers) {
            // Headers object (from Fetch API)
            headersInit.forEach((value, key) => {
                headers[key] = value;
            });
        } else if (Array.isArray(headersInit)) {
            // Array of key-value pairs
            headersInit.forEach(([key, value]) => {
                headers[key] = value;
            });
        } else {
            // Object of key-value pairs
            headers = { ...headersInit };
        }  
        return headers;
    }

    public ManipulateHeadersForFetch(headers: HeadersInit, url: URL, proxyConnInfo: ConnectionInformation): HeadersInit {
        const headersObj = headers instanceof Headers ? headers : new Headers(headers);
        
        headersObj.set('x-lunar-host', url.host);
        headersObj.set('x-lunar-interceptor', proxyConnInfo.interceptorID);
        headersObj.set('x-lunar-scheme', url.protocol.substring(0, url.protocol.length - 1));        
        
        return headersObj;
    }

    public async PrepareForRetry(retryAfterHeaderKey: string, sequenceIdHeaderKey: string, headers?: Headers): Promise<string | null> {
        if (headers == null) return null

        let rawRetryAfter = headers.get(retryAfterHeaderKey);
        if (rawRetryAfter === null) return null
        
        const sequenceID = headers instanceof Headers ? headers.get(sequenceIdHeaderKey) : headers[sequenceIdHeaderKey];        
        if (sequenceID === undefined) {
            logger.debug(`Retry required, but ${sequenceIdHeaderKey} is missing!`)
            return null
        }

        // eslint-disable-next-line @typescript-eslint/promise-function-async
        function wait(ms: number): Promise<void> {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        
        if (Array.isArray(rawRetryAfter)) rawRetryAfter = rawRetryAfter[0]
        try {
            const retryAfter = parseFloat(String(rawRetryAfter))
            logger.debug(`Retry required, will retry in ${retryAfter} seconds...`)
            
            await wait(retryAfter * 1000);
            
            return String(sequenceID)

        } catch (error) {
            logger.debug(`Retry required, but parsing header ${retryAfterHeaderKey} as float failed (${rawRetryAfter})`)
        }

        return null
    }

    public ValidateHeaders(headers: Headers | undefined): boolean {
        if (headers === undefined) return true

        return headers.has(HEADER_ERROR_KEY)    
    }
}

