import { type OutgoingHttpHeaders } from 'http';

import { logger } from './logger'
import { HEADER_ERROR_KEY } from './failSafe'
import { LUNAR_HOST_HEADER, LUNAR_INTERCEPTOR_HEADER, LUNAR_RETRY_AFTER_HEADER_KEY,
     LUNAR_SCHEME_HEADER, LUNAR_SEQ_ID_HEADER_KEY, MS_IN_SECOND} from './constants';
import { type EnvironmentInfo } from './environment';


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

    public ManipulateHeadersForFetch(headers: HeadersInit, url: URL, proxyConnInfo: EnvironmentInfo): HeadersInit {
        const headersObj = headers instanceof Headers ? headers : new Headers(headers);
        
        headersObj.set(LUNAR_HOST_HEADER, url.host);
        headersObj.set(LUNAR_INTERCEPTOR_HEADER, proxyConnInfo.interceptorID);
        headersObj.set(LUNAR_SCHEME_HEADER, url.protocol.substring(0, url.protocol.length - 1));        
        
        return headersObj;
    }

    public async PrepareForRetry(headers?: Headers): Promise<string | null> {
        if (headers == null) return null

        let rawRetryAfter = headers.get(LUNAR_RETRY_AFTER_HEADER_KEY);
        if (rawRetryAfter === null) return null
        
        const sequenceID = headers instanceof Headers ? headers.get(LUNAR_SEQ_ID_HEADER_KEY) : headers[LUNAR_SEQ_ID_HEADER_KEY];        
        if (sequenceID === undefined) {
            logger.debug(`Retry required, but ${LUNAR_SEQ_ID_HEADER_KEY} is missing!`)
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
            
            await wait(retryAfter * MS_IN_SECOND);
            
            return String(sequenceID)

        } catch (error) {
            logger.debug(`Retry required, but parsing header ${LUNAR_RETRY_AFTER_HEADER_KEY} as float failed (${rawRetryAfter})`)
        }

        return null
    }

    public ValidateHeaders(headers: Headers | undefined): boolean {
        if (headers === undefined) return true

        return headers.has(HEADER_ERROR_KEY)    
    }
}

