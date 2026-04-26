import {
  decryptJson,
  encryptJson,
  decryptInitiation,
  encryptInitiation,
} from "./target-server-crypto.js";

const TEST_KEY = Buffer.alloc(32); // 32 zero-bytes — valid AES-256 key

describe("encryptJson / decryptJson", () => {
  it("round-trips a simple object", () => {
    const data = { type: "stdio", command: "node", args: ["server.js"] };
    const encrypted = encryptJson(data, TEST_KEY);
    expect(decryptJson(encrypted, TEST_KEY)).toEqual(data);
  });

  it("produces a dot-separated string with exactly 3 segments", () => {
    const encrypted = encryptJson({ x: 1 }, TEST_KEY);
    expect(encrypted.split(".")).toHaveLength(3);
  });

  it("produces different ciphertext each call (random IV)", () => {
    const data = { type: "sse", url: "http://localhost:8080" };
    const enc1 = encryptJson(data, TEST_KEY);
    const enc2 = encryptJson(data, TEST_KEY);
    expect(enc1).not.toBe(enc2);
  });

  it("throws on wrong key (auth tag mismatch)", () => {
    const encrypted = encryptJson({ secret: "value" }, TEST_KEY);
    const wrongKey = Buffer.alloc(32, 1); // all 0x01 bytes
    expect(() => decryptJson(encrypted, wrongKey)).toThrow();
  });

  it("throws on truncated ciphertext (only 2 segments)", () => {
    const parts = encryptJson({ x: 1 }, TEST_KEY).split(".");
    expect(() => decryptJson(parts.slice(0, 2).join("."), TEST_KEY)).toThrow(
      "Invalid encrypted format",
    );
  });

  it("throws on extra segment (4 parts)", () => {
    const encrypted = encryptJson({ x: 1 }, TEST_KEY);
    expect(() => decryptJson(encrypted + ".extra", TEST_KEY)).toThrow(
      "Invalid encrypted format",
    );
  });

  it("throws on empty string", () => {
    expect(() => decryptJson("", TEST_KEY)).toThrow("Invalid encrypted format");
  });

  it("round-trips nested objects with special characters", () => {
    const data = { env: { PATH: "/usr/bin", KEY: "value=with=equals" } };
    expect(decryptJson(encryptJson(data, TEST_KEY), TEST_KEY)).toEqual(data);
  });
});

describe("encryptInitiation / decryptInitiation aliases", () => {
  it("are identical to encryptJson / decryptJson", () => {
    expect(encryptInitiation).toBe(encryptJson);
    expect(decryptInitiation).toBe(decryptJson);
  });
});
