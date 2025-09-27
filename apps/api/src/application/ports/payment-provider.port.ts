export interface CreateCreditCardChargeInput {
  amount: number;
  description: string;
  idempotencyKey: string;
  cpf?: string;
}

export interface CreateCreditCardChargeOutput {
  providerRef: string;
  initPoint?: string;
}

export interface PaymentProvider {
  createCreditCardCharge(
    input: CreateCreditCardChargeInput,
  ): Promise<CreateCreditCardChargeOutput>;
}
