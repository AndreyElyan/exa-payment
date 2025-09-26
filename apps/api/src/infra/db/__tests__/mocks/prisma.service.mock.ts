import { PrismaService } from "../../prisma.service";

export class MockPrismaService extends PrismaService {
  private payments: any[] = [];
  private idempotencyKeys: any[] = [];

  async onModuleInit() {
    // Mock initialization - no real connection needed
  }

  get payment() {
    return {
      create: async (data: any) => {
        const payment = {
          id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.payments.push(payment);
        return payment;
      },
      findUnique: async (params: any) => {
        return this.payments.find((p) => p.id === params.where.id) || null;
      },
      update: async (params: any) => {
        const index = this.payments.findIndex((p) => p.id === params.where.id);
        if (index >= 0) {
          this.payments[index] = {
            ...this.payments[index],
            ...params.data,
            updatedAt: new Date(),
          };
          return this.payments[index];
        }
        throw new Error("Payment not found");
      },
      deleteMany: async () => {
        this.payments = [];
        return { count: 0 };
      },
    };
  }

  get idempotencyKey() {
    return {
      create: async (data: any) => {
        const key = {
          id: `mock_key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data.data,
          createdAt: new Date(),
        };
        this.idempotencyKeys.push(key);
        return key;
      },
      findUnique: async (params: any) => {
        return (
          this.idempotencyKeys.find((k) => k.key === params.where.key) || null
        );
      },
      deleteMany: async () => {
        this.idempotencyKeys = [];
        return { count: 0 };
      },
    };
  }

  // Helper methods for testing
  clear() {
    this.payments = [];
    this.idempotencyKeys = [];
  }

  getPayments() {
    return this.payments;
  }
}
