import axios from "axios";
import { z } from "zod";

const DEFAULT_ADD_SERVER_ERROR_MESSAGE =
  "Failed to add server. Please try again.";

const apiErrorResponseSchema = z.object({
  msg: z.string().optional(),
  message: z.string().optional(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getResponseData(error: unknown): unknown {
  if (isRecord(error) && "responseData" in error) {
    return error.responseData;
  }

  if (axios.isAxiosError(error)) return error.response?.data;

  return undefined;
}

function getResponseMessage(error: unknown): string | undefined {
  const responseData = getResponseData(error);
  const parsedResponseData = apiErrorResponseSchema.safeParse(responseData);
  if (!parsedResponseData.success) return undefined;

  if (parsedResponseData.data.msg) return parsedResponseData.data.msg;
  if (parsedResponseData.data.message) return parsedResponseData.data.message;

  return undefined;
}

export function getAddServerErrorMessage(
  error: unknown,
  fallback = DEFAULT_ADD_SERVER_ERROR_MESSAGE,
): string {
  return (
    getResponseMessage(error) ||
    (error instanceof Error ? error.message : undefined) ||
    fallback
  );
}
