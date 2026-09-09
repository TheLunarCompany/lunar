import { randomUUID } from "crypto";
import type {
  EventId,
  EventStore,
  StreamId,
} from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "winston";

const DEFAULT_MAX_EVENTS_PER_STREAM = 500;
const DEFAULT_MAX_EVENT_AGE_MS = 5 * 60_000;

interface StoredEvent {
  id: EventId;
  message: JSONRPCMessage;
  timestampMs: number;
}

export interface InMemoryEventStoreOptions {
  maxEventsPerStream?: number;
  maxEventAgeMs?: number;
}

export class InMemoryEventStore implements EventStore {
  private eventsByStream = new Map<StreamId, StoredEvent[]>();
  private streamByEventId = new Map<EventId, StreamId>();
  private logger?: Logger;
  private maxEventsPerStream: number;
  private maxEventAgeMs: number;

  constructor(logger?: Logger, options: InMemoryEventStoreOptions = {}) {
    this.logger = logger;
    this.maxEventsPerStream =
      options.maxEventsPerStream ?? DEFAULT_MAX_EVENTS_PER_STREAM;
    this.maxEventAgeMs = options.maxEventAgeMs ?? DEFAULT_MAX_EVENT_AGE_MS;
  }

  async storeEvent(
    streamId: StreamId,
    message: JSONRPCMessage,
  ): Promise<EventId> {
    const now = Date.now();
    this.evictExpired(streamId, now);

    const eventId = randomUUID();
    const events = this.eventsByStream.get(streamId) ?? [];
    events.push({ id: eventId, message, timestampMs: now });
    this.eventsByStream.set(streamId, events);
    this.streamByEventId.set(eventId, streamId);

    this.enforceStreamLimit(streamId, events);
    return eventId;
  }

  async getStreamIdForEventId(eventId: EventId): Promise<StreamId | undefined> {
    return this.streamByEventId.get(eventId);
  }

  async replayEventsAfter(
    lastEventId: EventId,
    {
      send,
    }: { send: (eventId: EventId, message: JSONRPCMessage) => Promise<void> },
  ): Promise<StreamId> {
    const streamId = this.streamByEventId.get(lastEventId);
    if (!streamId) {
      this.logger?.warn("Last-Event-ID not found in event store", {
        lastEventId,
      });
      throw new Error("Invalid Last-Event-ID");
    }

    const events = this.eventsByStream.get(streamId);
    if (!events) {
      this.logger?.warn("Event stream not found for Last-Event-ID", {
        lastEventId,
        streamId,
      });
      throw new Error("Event stream not found");
    }

    // Check presence before eviction so we do not accidentally treat an existing
    // id as missing simply because cleanup happened first.
    const initialIndex = events.findIndex((event) => event.id === lastEventId);
    if (initialIndex === -1) {
      this.logger?.warn("Last-Event-ID not found in stream events", {
        lastEventId,
        streamId,
      });
      throw new Error("Invalid Last-Event-ID");
    }

    const now = Date.now();
    this.evictExpired(streamId, now);

    const activeEvents = this.eventsByStream.get(streamId);
    if (!activeEvents) {
      this.logger?.warn("Last-Event-ID expired from event store", {
        lastEventId,
        streamId,
      });
      throw new Error("Last-Event-ID expired");
    }

    const startIndex = activeEvents.findIndex(
      (event) => event.id === lastEventId,
    );
    if (startIndex === -1) {
      this.logger?.warn("Last-Event-ID expired from event store", {
        lastEventId,
        streamId,
      });
      throw new Error("Last-Event-ID expired");
    }

    for (let i = startIndex + 1; i < activeEvents.length; i += 1) {
      const event = activeEvents[i];
      if (!event) {
        continue;
      }
      await send(event.id, event.message);
    }

    return streamId;
  }

  private enforceStreamLimit(streamId: StreamId, events: StoredEvent[]): void {
    if (this.maxEventsPerStream <= 0) {
      return;
    }
    if (events.length <= this.maxEventsPerStream) {
      return;
    }

    const overflow = events.length - this.maxEventsPerStream;
    const removed = events.splice(0, overflow);
    for (const event of removed) {
      this.streamByEventId.delete(event.id);
    }
    this.eventsByStream.set(streamId, events);
  }

  private evictExpired(streamId: StreamId, now: number): void {
    if (this.maxEventAgeMs <= 0) {
      return;
    }
    const events = this.eventsByStream.get(streamId);
    if (!events || events.length === 0) {
      return;
    }

    const cutoff = now - this.maxEventAgeMs;
    let firstValidIndex = 0;
    while (firstValidIndex < events.length) {
      const event = events[firstValidIndex];
      if (!event) {
        break;
      }
      if (event.timestampMs >= cutoff) {
        break;
      }
      this.streamByEventId.delete(event.id);
      firstValidIndex += 1;
    }

    if (firstValidIndex === 0) {
      return;
    }

    if (firstValidIndex >= events.length) {
      this.eventsByStream.delete(streamId);
      return;
    }

    const remaining = events.slice(firstValidIndex);
    this.eventsByStream.set(streamId, remaining);
  }
}
