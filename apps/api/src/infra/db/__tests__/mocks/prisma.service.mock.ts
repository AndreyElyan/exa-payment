import { PrismaService } from "../../prisma.service";

export class MockPrismaService {
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
      findUniqueOrThrow: async (params: any) => {
        const payment = this.payments.find((p) => p.id === params.where.id);
        if (!payment) throw new Error("Payment not found");
        return payment;
      },
      findFirst: async (params: any) => {
        return (
          this.payments.find((p) => {
            if (params.where.cpf) return p.cpf === params.where.cpf;
            if (params.where.status) return p.status === params.where.status;
            return true;
          }) || null
        );
      },
      findFirstOrThrow: async (params: any) => {
        const payment = this.payments.find((p) => {
          if (params.where.cpf) return p.cpf === params.where.cpf;
          if (params.where.status) return p.status === params.where.status;
          return true;
        });
        if (!payment) throw new Error("Payment not found");
        return payment;
      },
      findMany: async (params: any) => {
        return this.payments.filter((p) => {
          if (params.where?.cpf) return p.cpf === params.where.cpf;
          if (params.where?.status) return p.status === params.where.status;
          if (params.where?.paymentMethod)
            return p.paymentMethod === params.where.paymentMethod;
          return true;
        });
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
      updateMany: async (params: any) => {
        const count = this.payments.filter((p) => {
          if (params.where?.cpf) return p.cpf === params.where.cpf;
          if (params.where?.status) return p.status === params.where.status;
          return true;
        }).length;
        return { count };
      },
      delete: async (params: any) => {
        const index = this.payments.findIndex((p) => p.id === params.where.id);
        if (index >= 0) {
          const payment = this.payments[index];
          this.payments.splice(index, 1);
          return payment;
        }
        throw new Error("Payment not found");
      },
      deleteMany: async () => {
        this.payments = [];
        return { count: 0 };
      },
      count: async (params: any) => {
        return this.payments.filter((p) => {
          if (params.where?.cpf) return p.cpf === params.where.cpf;
          if (params.where?.status) return p.status === params.where.status;
          if (params.where?.paymentMethod)
            return p.paymentMethod === params.where.paymentMethod;
          return true;
        }).length;
      },
      aggregate: async (params: any) => {
        return { _count: { id: this.payments.length } };
      },
      groupBy: async (params: any) => {
        return [];
      },
      createMany: async (data: any) => {
        const items = data.data.map((item: any) => ({
          id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...item,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
        this.payments.push(...items);
        return { count: items.length };
      },
      createManyAndReturn: async (data: any) => {
        const items = data.data.map((item: any) => ({
          id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...item,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
        this.payments.push(...items);
        return items;
      },
      upsert: async (params: any) => {
        const existing = this.payments.find((p) => p.id === params.where.id);
        if (existing) {
          const index = this.payments.findIndex(
            (p) => p.id === params.where.id,
          );
          this.payments[index] = {
            ...this.payments[index],
            ...params.update,
            updatedAt: new Date(),
          };
          return this.payments[index];
        } else {
          const payment = {
            id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...params.create,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          this.payments.push(payment);
          return payment;
        }
      },
      fields: {},
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
      findUniqueOrThrow: async (params: any) => {
        const key = this.idempotencyKeys.find(
          (k) => k.key === params.where.key,
        );
        if (!key) throw new Error("Idempotency key not found");
        return key;
      },
      findFirst: async (params: any) => {
        return (
          this.idempotencyKeys.find((k) => {
            if (params.where.key) return k.key === params.where.key;
            return true;
          }) || null
        );
      },
      findFirstOrThrow: async (params: any) => {
        const key = this.idempotencyKeys.find((k) => {
          if (params.where.key) return k.key === params.where.key;
          return true;
        });
        if (!key) throw new Error("Idempotency key not found");
        return key;
      },
      findMany: async (params: any) => {
        return this.idempotencyKeys.filter((k) => {
          if (params.where?.key) return k.key === params.where.key;
          return true;
        });
      },
      update: async (params: any) => {
        const index = this.idempotencyKeys.findIndex(
          (k) => k.key === params.where.key,
        );
        if (index >= 0) {
          this.idempotencyKeys[index] = {
            ...this.idempotencyKeys[index],
            ...params.data,
          };
          return this.idempotencyKeys[index];
        }
        throw new Error("Idempotency key not found");
      },
      updateMany: async (params: any) => {
        const count = this.idempotencyKeys.filter((k) => {
          if (params.where?.key) return k.key === params.where.key;
          return true;
        }).length;
        return { count };
      },
      delete: async (params: any) => {
        const index = this.idempotencyKeys.findIndex(
          (k) => k.key === params.where.key,
        );
        if (index >= 0) {
          const key = this.idempotencyKeys[index];
          this.idempotencyKeys.splice(index, 1);
          return key;
        }
        throw new Error("Idempotency key not found");
      },
      deleteMany: async () => {
        this.idempotencyKeys = [];
        return { count: 0 };
      },
      count: async (params: any) => {
        return this.idempotencyKeys.filter((k) => {
          if (params.where?.key) return k.key === params.where.key;
          return true;
        }).length;
      },
      aggregate: async (params: any) => {
        return { _count: { id: this.idempotencyKeys.length } };
      },
      groupBy: async (params: any) => {
        return [];
      },
      createMany: async (data: any) => {
        const items = data.data.map((item: any) => ({
          id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...item,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
        this.payments.push(...items);
        return { count: items.length };
      },
      createManyAndReturn: async (data: any) => {
        const items = data.data.map((item: any) => ({
          id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...item,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
        this.payments.push(...items);
        return items;
      },
      upsert: async (params: any) => {
        const existing = this.payments.find((p) => p.id === params.where.id);
        if (existing) {
          const index = this.payments.findIndex(
            (p) => p.id === params.where.id,
          );
          this.payments[index] = {
            ...this.payments[index],
            ...params.update,
            updatedAt: new Date(),
          };
          return this.payments[index];
        } else {
          const payment = {
            id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...params.create,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          this.payments.push(payment);
          return payment;
        }
      },
      fields: {},
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
