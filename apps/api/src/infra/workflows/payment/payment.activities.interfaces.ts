export interface CreatePaymentRecordInput {
  paymentId: string;
  cpf: string;
  description: string;
  amount: number;
  status: string;
}

export interface CreateMercadoPagoPreferenceInput {
  cpf: string;
  description: string;
  amount: number;
  idempotencyKey: string;
}

export interface CreateMercadoPagoPreferenceOutput {
  providerRef: string;
  initPoint: string;
}

export interface UpdatePaymentStatusInput {
  paymentId: string;
  status: string;
  providerRef?: string;
}

export interface CheckPaymentStatusInput {
  providerRef: string;
}

export interface PublishStatusChangeEventInput {
  paymentId: string;
  oldStatus: "PENDING" | "PAID" | "FAIL";
  newStatus: "PENDING" | "PAID" | "FAIL";
}

export interface PaymentActivities {
  createPaymentRecord(input: CreatePaymentRecordInput): Promise<void>;
  createMercadoPagoPreference(
    input: CreateMercadoPagoPreferenceInput,
  ): Promise<CreateMercadoPagoPreferenceOutput>;
  updatePaymentStatus(input: UpdatePaymentStatusInput): Promise<void>;
  checkPaymentStatus(input: CheckPaymentStatusInput): Promise<string | null>;
  publishStatusChangeEvent(input: PublishStatusChangeEventInput): Promise<void>;
}
