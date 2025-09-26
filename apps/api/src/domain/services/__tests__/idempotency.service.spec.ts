import { IdempotencyService } from '../idempotency.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;

  beforeEach(() => {
    service = new IdempotencyService();
  });

  describe('generateBodyHash', () => {
    it('should generate consistent hash for same input', () => {
      const body = '{"cpf":"12345678909","amount":100}';
      const hash1 = service.generateBodyHash(body);
      const hash2 = service.generateBodyHash(body);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const body1 = '{"cpf":"12345678909","amount":100}';
      const body2 = '{"cpf":"12345678909","amount":200}';

      const hash1 = service.generateBodyHash(body1);
      const hash2 = service.generateBodyHash(body2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('checkKey', () => {
    it('should return isNew=true for new key', () => {
      const result = service.checkKey('key1', 'hash1');
      expect(result.isNew).toBe(true);
    });

    it('should return isNew=false for existing key with same hash', () => {
      service.storeKey('key1', 'hash1', 'payment1');

      const result = service.checkKey('key1', 'hash1');
      expect(result.isNew).toBe(false);
      expect(result.paymentId).toBe('payment1');
    });

    it('should throw error for existing key with different hash', () => {
      service.storeKey('key1', 'hash1', 'payment1');

      expect(() => service.checkKey('key1', 'hash2')).toThrow('IDEMPOTENCY_KEY_CONFLICT');
    });
  });

  describe('storeKey', () => {
    it('should store key with expiration', () => {
      service.storeKey('key1', 'hash1', 'payment1');

      const result = service.checkKey('key1', 'hash1');
      expect(result.isNew).toBe(false);
      expect(result.paymentId).toBe('payment1');
    });
  });
});
