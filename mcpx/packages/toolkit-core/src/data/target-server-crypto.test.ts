import {
  encryptInitiation,
  decryptInitiation,
} from "./target-server-crypto.js";

const TEST_KEY = Buffer.alloc(32); // 32 zero-bytes — valid AES-256 key

describe("encryptInitiation / decryptInitiation", () => {
  it("round-trips a simple object", () => {
    const data = { type: "stdio", command: "node", args: ["server.js"] };
    const encrypted = encryptInitiation(data, TEST_KEY);
    expect(decryptInitiation(encrypted, TEST_KEY)).toEqual(data);
  });

  it("produces a dot-separated string with exactly 3 segments", () => {
    const encrypted = encryptInitiation({ x: 1 }, TEST_KEY);
    expect(encrypted.split(".")).toHaveLength(3);
  });

  it("produces different ciphertext each call (random IV)", () => {
    const data = { type: "sse", url: "http://localhost:8080" };
    const enc1 = encryptInitiation(data, TEST_KEY);
    const enc2 = encryptInitiation(data, TEST_KEY);
    expect(enc1).not.toBe(enc2);
  });

  it("throws on wrong key (auth tag mismatch)", () => {
    const encrypted = encryptInitiation({ secret: "value" }, TEST_KEY);
    const wrongKey = Buffer.alloc(32, 1); // all 0x01 bytes
    expect(() => decryptInitiation(encrypted, wrongKey)).toThrow();
  });

  it("throws on truncated ciphertext (only 2 segments)", () => {
    const parts = encryptInitiation({ x: 1 }, TEST_KEY).split(".");
    expect(() =>
      decryptInitiation(parts.slice(0, 2).join("."), TEST_KEY),
    ).toThrow("Invalid initiation_enc format");
  });

  it("throws on extra segment (4 parts)", () => {
    const encrypted = encryptInitiation({ x: 1 }, TEST_KEY);
    expect(() => decryptInitiation(encrypted + ".extra", TEST_KEY)).toThrow(
      "Invalid initiation_enc format",
    );
  });

  it("throws on empty string", () => {
    expect(() => decryptInitiation("", TEST_KEY)).toThrow(
      "Invalid initiation_enc format",
    );
  });

  it("round-trips nested objects with special characters", () => {
    const data = { env: { PATH: "/usr/bin", KEY: "value=with=equals" } };
    expect(
      decryptInitiation(encryptInitiation(data, TEST_KEY), TEST_KEY),
    ).toEqual(data);
  });
});
