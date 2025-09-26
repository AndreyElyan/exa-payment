import { Injectable } from "@nestjs/common";
import {
  PaymentProvider,
  CreateCreditCardChargeInput,
  CreateCreditCardChargeOutput,
} from "../../application/ports/payment-provider.port";

@Injectable()
export class StubPaymentProvider implements PaymentProvider {
  async createCreditCardCharge(
    input: CreateCreditCardChargeInput,
  ): Promise<CreateCreditCardChargeOutput> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const providerRef = `mp_${Date.now().toString(36).substr(-8)}`;

    return { providerRef };
  }
}
