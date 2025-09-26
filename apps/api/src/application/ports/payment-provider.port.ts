export interface CreateCreditCardChargeInput {
  amount: number;
  description: string;
  idempotencyKey: string;
}

export interface CreateCreditCardChargeOutput {
  providerRef: string;
}

export interface PaymentProvider {
  createCreditCardCharge(input: CreateCreditCardChargeInput): Promise<CreateCreditCardChargeOutput>;
}
