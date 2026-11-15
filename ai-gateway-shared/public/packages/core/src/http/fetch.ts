import { IncomingHttpHeaders, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

// A minimal fetch-shaped seam for HTTP clients: implementations only need to
// produce a status, headers, and a body — enough for JSON request/response
// APIs, and small enough to stub in tests.
export interface ResponseLike {
  status: number;
  headers: Headers;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export interface FetchLike {
  (input: string | URL, init?: RequestInit): Promise<ResponseLike>;
}

/**
 * A FetchLike that sends header names with the exact casing given.
 *
 * WHATWG fetch lowercases every header name (mandated by the Headers spec),
 * which breaks servers that match request headers case-sensitively. Node's
 * http client preserves the given casing on the wire, so this wraps it.
 *
 * Supports what JSON APIs need and nothing more: string bodies, an optional
 * AbortSignal, buffered responses. No redirects, no streaming.
 */
export function caseSensitiveFetch(
  input: string | URL,
  init?: RequestInit,
): Promise<ResponseLike> {
  const { method = "GET", headers, body, signal } = init ?? {};
  if (body !== undefined && body !== null && typeof body !== "string") {
    return Promise.reject(
      new TypeError("caseSensitiveFetch supports only string bodies"),
    );
  }
  const url = new URL(input);
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method,
        headers: toHeaderRecord(headers),
        signal: signal ?? undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("error", reject);
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: res.statusCode ?? 0,
            headers: toWhatwgHeaders(res.headers),
            text: () => Promise.resolve(text),
            json: async () => JSON.parse(text),
          });
        });
      },
    );
    req.on("error", reject);
    req.end(body ?? undefined);
  });
}

// A Headers instance has already lowercased its names — nothing to preserve
// by then. Callers that care about casing must pass a plain record.
function toHeaderRecord(
  headers: RequestInit["headers"],
): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return headers;
}

// Folds node's response headers (a plain record, values string | string[])
// into a WHATWG Headers so callers get case-insensitive lookup and
// multi-value folding. Case preservation only matters on the request side;
// responses are read case-insensitively as usual.
function toWhatwgHeaders(incoming: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  Object.entries(incoming).forEach(([name, value]) => {
    headerValues(value).forEach((item) => headers.append(name, item));
  });
  return headers;
}

function headerValues(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
