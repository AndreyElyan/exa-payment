import { Payment } from "../../domain/entities/payment.entity";

export interface FindManyFilters {
  cpf?: string;
  paymentMethod?: string;
  status?: string;
}

export interface FindManyResult {
  items: Payment[];
  total: number;
}

export interface PaymentRepository {
  save(payment: Payment): Promise<Payment>;
  findById(id: string): Promise<Payment | null>;
  update(payment: Payment): Promise<Payment>;
  findMany(
    filters: FindManyFilters,
    page: number,
    limit: number,
  ): Promise<FindManyResult>;
}
