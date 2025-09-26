import { PaymentStatus } from "../entities/payment.entity";

export interface PaymentStatusChangedEventData {
  paymentId: string;
  oldStatus: PaymentStatus;
  newStatus: PaymentStatus;
  changedAt: Date;
}

export class PaymentStatusChangedEvent {
  constructor(
    public readonly data: PaymentStatusChangedEventData,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
