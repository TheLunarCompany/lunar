import { z } from "zod/v4";

/**
 * Base error class for LLM-related errors.
 */
export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}

/**
 * Thrown when the LLM response cannot be parsed according to the expected schema.
 * Includes the Zod error for detailed inspection at call sites.
 *
 * @example
 * ```typescript
 * catch (e) {
 *   if (e instanceof LlmParseError) {
 *     logger.error("Parse failed", { details: z.treeifyError(e.zodError) });
 *   }
 * }
 * ```
 */
export class LlmParseError extends LlmError {
  constructor(
    message: string,
    public readonly zodError: z.ZodError,
  ) {
    super(message);
    this.name = "LlmParseError";
  }
}

/**
 * Thrown when the LLM returns an empty or null response.
 */
export class LlmEmptyResponseError extends LlmError {
  constructor(provider: string) {
    super(`${provider} returned empty response`);
    this.name = "LlmEmptyResponseError";
  }
}

/**
 * Thrown when the LLM API call fails.
 */
export class LlmApiError extends LlmError {
  constructor(
    provider: string,
    public readonly cause: unknown,
  ) {
    super(`${provider} API call failed`);
    this.name = "LlmApiError";
  }
}
