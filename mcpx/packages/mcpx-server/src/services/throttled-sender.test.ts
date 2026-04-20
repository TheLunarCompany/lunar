import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ThrottledSender } from "./throttled-sender.js";

describe("ThrottledSender", () => {
  let throttledSender: ThrottledSender;
  let sentMessages: Array<{
    key: string;
    payload: unknown;
    timestamp: number;
  }> = [];

  const mockSender = (key: string, payload: unknown) => {
    sentMessages.push({ key, payload, timestamp: Date.now() });
  };

  const waitFor = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  beforeEach(() => {
    sentMessages = [];
    throttledSender = new ThrottledSender(mockSender, {
      debounceMs: 100,
      maxWaitMs: 200,
    });
  });

  afterEach(() => {
    throttledSender.shutdown();
  });

  it("should send a single message after debounce delay", async () => {
    throttledSender.send("test", { value: 1 });

    expect(sentMessages).toHaveLength(0);
    await waitFor(150);

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toMatchObject({
      key: "test",
      payload: { value: 1 },
    });
  });

  it("should send only the latest message when multiple arrive within debounce window", async () => {
    throttledSender.send("test", { value: 1 });
    await waitFor(50);
    throttledSender.send("test", { value: 2 });
    await waitFor(50);
    throttledSender.send("test", { value: 3 });

    await waitFor(150);

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toMatchObject({
      key: "test",
      payload: { value: 3 },
    });
  });

  it("should prevent starvation with max wait", async () => {
    // Send messages every 50ms, faster than debounce
    for (let i = 1; i <= 6; i++) {
      throttledSender.send("test", { value: i });
      await waitFor(50);
    }

    // After 300ms total, should have sent at least one message due to maxWait
    expect(sentMessages.length).toBeGreaterThanOrEqual(1);
    expect(sentMessages[0]?.payload).toMatchObject({ value: 4 }); // Sent at ~200ms

    await waitFor(150);

    // Should have sent the final message
    expect(sentMessages).toHaveLength(2);
    expect(sentMessages[1]?.payload).toMatchObject({ value: 6 });
  });

  it("should handle multiple keys independently", async () => {
    throttledSender.send("key1", { value: "a" });
    throttledSender.send("key2", { value: "b" });
    await waitFor(50);
    throttledSender.send("key1", { value: "a2" });

    await waitFor(100);

    expect(sentMessages).toHaveLength(2);
    const key1Message = sentMessages.find((m) => m.key === "key1");
    const key2Message = sentMessages.find((m) => m.key === "key2");

    expect(key1Message?.payload).toEqual({ value: "a2" });
    expect(key2Message?.payload).toEqual({ value: "b" });
  });

  it("should flush all pending messages on shutdown", async () => {
    throttledSender.send("key1", { value: 1 });
    throttledSender.send("key2", { value: 2 });
    throttledSender.send("key3", { value: 3 });

    expect(sentMessages).toHaveLength(0);

    throttledSender.shutdown();

    expect(sentMessages).toHaveLength(3);
    expect(sentMessages.map((m) => m.key).sort()).toEqual([
      "key1",
      "key2",
      "key3",
    ]);
  });
});
