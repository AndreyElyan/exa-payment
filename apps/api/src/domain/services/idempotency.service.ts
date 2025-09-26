import { createHash } from 'crypto';

export interface IdempotencyResult {
  isNew: boolean;
  paymentId?: string;
}

export class IdempotencyService {
  private readonly keys = new Map<
    string,
    { bodyHash: string; paymentId: string; expiresAt: Date }
  >();

  generateBodyHash(body: string): string {
    return createHash('sha256').update(body).digest('hex');
  }

  checkKey(key: string, bodyHash: string): IdempotencyResult {
    const existing = this.keys.get(key);

    if (!existing) {
      return { isNew: true };
    }

    if (existing.expiresAt < new Date()) {
      this.keys.delete(key);
      return { isNew: true };
    }

    if (existing.bodyHash !== bodyHash) {
      throw new Error('IDEMPOTENCY_KEY_CONFLICT');
    }

    return { isNew: false, paymentId: existing.paymentId };
  }

  storeKey(key: string, bodyHash: string, paymentId: string, ttlHours = 24): void {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    this.keys.set(key, { bodyHash, paymentId, expiresAt });
  }
}
