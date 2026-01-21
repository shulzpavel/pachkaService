import { describe, test, expect } from "@jest/globals";
import { isIPAllowed, verifyApiKey, verifyJiraWebhookSignature } from "../../../shared/security.js";
import crypto from "crypto";

describe("Security Module", () => {
  describe("isIPAllowed", () => {
    test("should allow exact IP match", () => {
      expect(isIPAllowed("192.168.1.1", ["192.168.1.1"])).toBe(true);
    });

    test("should deny non-matching IP", () => {
      expect(isIPAllowed("192.168.1.2", ["192.168.1.1"])).toBe(false);
    });

    test("should allow all when list is empty", () => {
      expect(isIPAllowed("192.168.1.1", [])).toBe(true);
    });

    test("should correctly validate CIDR /24", () => {
      expect(isIPAllowed("192.168.1.100", ["192.168.1.0/24"])).toBe(true);
      expect(isIPAllowed("192.168.1.255", ["192.168.1.0/24"])).toBe(true);
      expect(isIPAllowed("192.168.2.1", ["192.168.1.0/24"])).toBe(false);
    });

    test("should correctly validate CIDR /16", () => {
      expect(isIPAllowed("192.168.100.1", ["192.168.0.0/16"])).toBe(true);
      expect(isIPAllowed("192.169.1.1", ["192.168.0.0/16"])).toBe(false);
    });

    test("should correctly validate CIDR /8", () => {
      expect(isIPAllowed("10.0.0.1", ["10.0.0.0/8"])).toBe(true);
      expect(isIPAllowed("10.255.255.255", ["10.0.0.0/8"])).toBe(true);
      expect(isIPAllowed("11.0.0.1", ["10.0.0.0/8"])).toBe(false);
    });

    test("should handle multiple rules", () => {
      const allowed = ["192.168.1.1", "10.0.0.0/8", "172.16.0.0/12"];
      expect(isIPAllowed("192.168.1.1", allowed)).toBe(true);
      expect(isIPAllowed("10.5.5.5", allowed)).toBe(true);
      expect(isIPAllowed("172.16.1.1", allowed)).toBe(true);
      expect(isIPAllowed("1.1.1.1", allowed)).toBe(false);
    });

    test("should handle hostname matching", () => {
      expect(isIPAllowed("gateway", ["gateway", "127.0.0.1"])).toBe(true);
      expect(isIPAllowed("router", ["gateway", "127.0.0.1"])).toBe(false);
    });

    test("should reject invalid CIDR", () => {
      expect(isIPAllowed("192.168.1.1", ["192.168.1.0/33"])).toBe(false);
      expect(isIPAllowed("192.168.1.1", ["192.168.1.0/-1"])).toBe(false);
    });

    test("should handle edge case: 1.1.1.15 should not match 1.1.1.1/24 incorrectly", () => {
      // Это был баг в старой версии с startsWith
      expect(isIPAllowed("1.1.1.15", ["1.1.1.1/24"])).toBe(true); // Правильно - в той же подсети
      expect(isIPAllowed("1.1.2.1", ["1.1.1.1/24"])).toBe(false); // Правильно - в другой подсети
    });
  });

  describe("verifyApiKey", () => {
    test("should verify correct API key", () => {
      const key = "test-key-123";
      expect(verifyApiKey(key, key)).toBe(true);
    });

    test("should reject incorrect API key", () => {
      expect(verifyApiKey("wrong-key", "correct-key")).toBe(false);
    });

    test("should reject empty keys", () => {
      expect(verifyApiKey("", "key")).toBe(false);
      expect(verifyApiKey("key", "")).toBe(false);
      expect(verifyApiKey("", "")).toBe(false);
    });
  });

  describe("verifyJiraWebhookSignature", () => {
    test("should verify correct HMAC signature", () => {
      const secret = "test-secret";
      const payload = '{"test": "data"}';
      const hmac = crypto.createHmac("sha256", secret);
      hmac.update(payload);
      const signature = hmac.digest("hex");

      expect(verifyJiraWebhookSignature(payload, signature, secret)).toBe(true);
    });

    test("should reject incorrect signature", () => {
      const secret = "test-secret";
      const payload = '{"test": "data"}';
      const wrongSignature = "wrong-signature";

      expect(verifyJiraWebhookSignature(payload, wrongSignature, secret)).toBe(false);
    });

    test("should reject when secret is missing", () => {
      expect(verifyJiraWebhookSignature("payload", "signature", "")).toBe(false);
    });

    test("should handle GitHub-style signature format", () => {
      const secret = "test-secret";
      const payload = '{"test": "data"}';
      const hmac = crypto.createHmac("sha256", secret);
      hmac.update(payload);
      const signature = hmac.digest("hex");

      // С форматом sha256=...
      expect(verifyJiraWebhookSignature(payload, `sha256=${signature}`, secret)).toBe(false); // Нужно убрать префикс перед вызовом
      expect(verifyJiraWebhookSignature(payload, signature, secret)).toBe(true);
    });
  });
});
