import { isAuthenticationError } from "./oauth-connection-handler.js";

describe("OAuthConnectionHandler", () => {
  describe(".isAuthenticationError", () => {
    it("should return true for 401 status in response", () => {
      const error = { response: { status: 401 } };
      expect(isAuthenticationError(error)).toBe(true);
    });

    it("should return true for direct 401 status", () => {
      const error = { status: 401 };
      expect(isAuthenticationError(error)).toBe(true);
    });

    it("should return true for 401 code", () => {
      const error = { code: 401 };
      expect(isAuthenticationError(error)).toBe(true);
    });

    it("should return true for message containing '401'", () => {
      const error = { message: "HTTP 401 Unauthorized" };
      expect(isAuthenticationError(error)).toBe(true);
    });

    it("should return true for message containing 'Unauthorized'", () => {
      const error = { message: "Unauthorized access" };
      expect(isAuthenticationError(error)).toBe(true);
    });

    it("should return false for non-401 errors", () => {
      const error = { status: 500 };
      expect(isAuthenticationError(error)).toBe(false);
    });

    it("should return false for non-object errors", () => {
      expect(isAuthenticationError("string error")).toBe(false);
      expect(isAuthenticationError(null)).toBe(false);
      expect(isAuthenticationError(undefined)).toBe(false);
    });

    it("should return false for objects without auth-related properties", () => {
      const error = { message: "Some other error", code: 500 };
      expect(isAuthenticationError(error)).toBe(false);
    });
  });

  // TODO: add tests for retryWithOAuth method
});
