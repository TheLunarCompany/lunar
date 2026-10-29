import { decryptJson, encryptJson } from "@aigw/core/data";
import { decryptInitiation, encryptInitiation } from "./initiation-crypto.js";

describe("encryptInitiation / decryptInitiation aliases", () => {
  it("are identical to encryptJson / decryptJson", () => {
    expect(encryptInitiation).toBe(encryptJson);
    expect(decryptInitiation).toBe(decryptJson);
  });
});
