import { describe, it, expect, beforeEach } from "vitest";
import { IdempotencyService } from "../idempotency.service";

describe("IdempotencyService", () => {
  let service: IdempotencyService;

  beforeEach(() => {
    service = new IdempotencyService();
  });

  describe("generateBodyHash", () => {
    it("should generate consistent hash for same input", () => {
      const body = '{"cpf":"12345678909","amount":100}';
      const hash1 = service.generateBodyHash(body);
      const hash2 = service.generateBodyHash(body);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex length
    });

    it("should generate different hashes for different inputs", () => {
      const body1 = '{"cpf":"12345678909","amount":100}';
      const body2 = '{"cpf":"12345678909","amount":200}';

      const hash1 = service.generateBodyHash(body1);
      const hash2 = service.generateBodyHash(body2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("checkKey", () => {
    it("should return isNew=true for non-existent key", () => {
      const result = service.checkKey("non-existent-key", "some-hash");

      expect(result.isNew).toBe(true);
      expect(result.paymentId).toBeUndefined();
    });

    it("should return isNew=false for existing key with same hash", () => {
      const key = "test-key";
      const bodyHash = "test-hash";
      const paymentId = "payment-123";

      service.storeKey(key, bodyHash, paymentId);
      const result = service.checkKey(key, bodyHash);

      expect(result.isNew).toBe(false);
      expect(result.paymentId).toBe(paymentId);
    });

    it("should throw IDEMPOTENCY_KEY_CONFLICT for same key with different hash", () => {
      const key = "test-key";
      const bodyHash1 = "hash1";
      const bodyHash2 = "hash2";
      const paymentId = "payment-123";

      service.storeKey(key, bodyHash1, paymentId);

      expect(() => service.checkKey(key, bodyHash2)).toThrow(
        "IDEMPOTENCY_KEY_CONFLICT",
      );
    });

    it("should return isNew=true for expired key", () => {
      const key = "test-key";
      const bodyHash = "test-hash";
      const paymentId = "payment-123";

      // Store key with very short TTL
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() - 1); // Expired 1 second ago

      // Manually set expired key
      (service as any).keys.set(key, { bodyHash, paymentId, expiresAt });

      const result = service.checkKey(key, bodyHash);

      expect(result.isNew).toBe(true);
    });
  });

  describe("storeKey", () => {
    it("should store key with default TTL of 24 hours", () => {
      const key = "test-key";
      const bodyHash = "test-hash";
      const paymentId = "payment-123";

      const beforeStore = new Date();
      service.storeKey(key, bodyHash, paymentId);
      const afterStore = new Date();

      const stored = (service as any).keys.get(key);
      expect(stored).toBeDefined();
      expect(stored.bodyHash).toBe(bodyHash);
      expect(stored.paymentId).toBe(paymentId);
      expect(stored.expiresAt.getTime()).toBeGreaterThan(
        beforeStore.getTime() + 23 * 60 * 60 * 1000,
      );
      expect(stored.expiresAt.getTime()).toBeLessThan(
        afterStore.getTime() + 25 * 60 * 60 * 1000,
      );
    });

    it("should store key with custom TTL", () => {
      const key = "test-key";
      const bodyHash = "test-hash";
      const paymentId = "payment-123";
      const ttlHours = 1;

      service.storeKey(key, bodyHash, paymentId, ttlHours);

      const stored = (service as any).keys.get(key);
      expect(stored).toBeDefined();

      const expectedExpiry = new Date();
      expectedExpiry.setHours(expectedExpiry.getHours() + ttlHours);

      expect(stored.expiresAt.getTime()).toBeCloseTo(
        expectedExpiry.getTime(),
        -2,
      );
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete idempotency flow", () => {
      const key = "integration-test-key";
      const bodyHash = "integration-hash";
      const paymentId = "payment-integration-123";

      // First call - should be new
      const firstResult = service.checkKey(key, bodyHash);
      expect(firstResult.isNew).toBe(true);

      // Store the key
      service.storeKey(key, bodyHash, paymentId);

      // Second call with same key and hash - should return existing
      const secondResult = service.checkKey(key, bodyHash);
      expect(secondResult.isNew).toBe(false);
      expect(secondResult.paymentId).toBe(paymentId);

      // Third call with different hash - should throw conflict
      expect(() => service.checkKey(key, "different-hash")).toThrow(
        "IDEMPOTENCY_KEY_CONFLICT",
      );
    });
  });
});
