import { Payment } from '../../domain/entities/payment.entity';

export interface PaymentRepository {
  save(payment: Payment): Promise<Payment>;
  findById(id: string): Promise<Payment | null>;
  update(payment: Payment): Promise<Payment>;
}
