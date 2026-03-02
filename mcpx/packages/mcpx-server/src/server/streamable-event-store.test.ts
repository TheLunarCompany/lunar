import { InMemoryEventStore } from "./streamable-event-store.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

const createMessage = (method: string): JSONRPCMessage =>
  ({
    jsonrpc: "2.0",
    method,
  }) as JSONRPCMessage;

describe("InMemoryEventStore replay behavior", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("replays events after the anchor when older events are evicted", async () => {
    const store = new InMemoryEventStore(undefined, { maxEventAgeMs: 1000 });
    const streamId = "stream-1";

    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await store.storeEvent(streamId, createMessage("event-1"));

    jest.setSystemTime(new Date("2026-01-01T00:00:00.400Z"));
    const event2 = await store.storeEvent(streamId, createMessage("event-2"));

    jest.setSystemTime(new Date("2026-01-01T00:00:00.600Z"));
    const event3 = await store.storeEvent(streamId, createMessage("event-3"));

    jest.setSystemTime(new Date("2026-01-01T00:00:01.200Z"));
    const sent: string[] = [];
    await store.replayEventsAfter(event2, {
      send: async (eventId) => {
        sent.push(String(eventId));
      },
    });

    expect(sent).toEqual([String(event3)]);
  });

  it("throws when last event id expires during replay", async () => {
    const store = new InMemoryEventStore(undefined, { maxEventAgeMs: 1000 });
    const streamId = "stream-2";

    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const event1 = await store.storeEvent(streamId, createMessage("event-1"));

    jest.setSystemTime(new Date("2026-01-01T00:00:00.500Z"));
    await store.storeEvent(streamId, createMessage("event-2"));

    jest.setSystemTime(new Date("2026-01-01T00:00:01.600Z"));
    await expect(
      store.replayEventsAfter(event1, {
        send: async () => {},
      }),
    ).rejects.toThrow("Last-Event-ID expired");
  });
});
