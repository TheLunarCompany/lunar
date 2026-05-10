import { Logger } from "winston";
import { BatchBuffer } from "@mcpx/toolkit-core/data";
import {
  WebappBoundPayloadOf,
  wrapInEnvelope,
  EnvelopedMessage,
  ToolCallEventInput,
} from "@mcpx/webapp-protocol/messages";

const MAX_BUFFER_SIZE = 100;

export interface ToolCallBatchSocket {
  emit(
    event: "tool-call-batch",
    data: EnvelopedMessage<WebappBoundPayloadOf<"tool-call-batch">>,
  ): void;
}

export type ToolCallBatcher = BatchBuffer<ToolCallEventInput>;

export function createToolCallBatcher(params: {
  logger: Logger;
  intervalMs: number;
  getSocket: () => ToolCallBatchSocket | null;
}): ToolCallBatcher {
  const { logger, intervalMs, getSocket } = params;
  return new BatchBuffer<ToolCallEventInput>({
    name: "tool-call-batch",
    flushIntervalMs: intervalMs,
    maxBufferSize: MAX_BUFFER_SIZE,
    logger,
    onFlush: (events): void => {
      const socket = getSocket();
      if (!socket) return;
      const payload: WebappBoundPayloadOf<"tool-call-batch"> = { events };
      socket.emit("tool-call-batch", wrapInEnvelope({ payload }));
    },
  });
}
