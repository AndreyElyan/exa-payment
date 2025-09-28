import {
  defineSignal,
  defineQuery,
  proxyActivities,
  condition,
  sleep,
  setHandler,
  ApplicationFailure,
} from "@temporalio/workflow";
import { PaymentStatus } from "../../../domain/entities/payment.entity";
import type { PaymentActivities } from "./payment.activities.interfaces";

const {
  createPaymentRecord,
  createMercadoPagoPreference,
  updatePaymentStatus,
  publishStatusChangeEvent,
  checkPaymentStatus,
} = proxyActivities<PaymentActivities>({
  startToCloseTimeout: "30s",
  retry: {
    initialInterval: "1s",
    maximumInterval: "10s",
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export interface CreditCardPaymentInput {
  paymentId: string;
  cpf: string;
  description: string;
  amount: number;
  idempotencyKey: string;
}

export interface PaymentStatusSignal {
  status: PaymentStatus.PAID | PaymentStatus.FAIL;
  providerData?: any;
}

export const paymentStatusSignal =
  defineSignal<[PaymentStatusSignal]>("paymentStatus");
export const getPaymentStatusQuery = defineQuery<string>("getPaymentStatus");

export async function creditCardPaymentWorkflow(
  input: CreditCardPaymentInput,
): Promise<{ status: string; initPoint?: string }> {
  let currentStatus = PaymentStatus.PENDING;
  let initPoint: string | undefined;
  let signalReceived = false;

  setHandler(paymentStatusSignal, (signal: PaymentStatusSignal) => {
    currentStatus = signal.status;
    signalReceived = true;
  });

  setHandler(getPaymentStatusQuery, () => currentStatus);

  try {
    await createPaymentRecord({
      paymentId: input.paymentId,
      cpf: input.cpf,
      description: input.description,
      amount: input.amount,
      status: PaymentStatus.PENDING,
    });

    const preferenceResult = await createMercadoPagoPreference({
      cpf: input.cpf,
      description: input.description,
      amount: input.amount,
      idempotencyKey: input.idempotencyKey,
    });

    initPoint = preferenceResult.initPoint;

    await updatePaymentStatus({
      paymentId: input.paymentId,
      status: PaymentStatus.PENDING,
      providerRef: preferenceResult.providerRef,
    });

    const timeoutDuration = "15m";
    const pollingInterval = "30s";
    let attempts = 0;
    const maxAttempts = 30;

    while (!signalReceived && attempts < maxAttempts) {
      const timeoutPromise = sleep(pollingInterval);
      const signalPromise = condition(() => signalReceived);

      await Promise.race([timeoutPromise, signalPromise]);

      if (!signalReceived) {
        try {
          const statusFromProvider = await checkPaymentStatus({
            providerRef: preferenceResult.providerRef,
          });

          if (
            statusFromProvider &&
            statusFromProvider !== PaymentStatus.PENDING
          ) {
            currentStatus = statusFromProvider as PaymentStatus;
            break;
          }
        } catch (error) {
          console.warn(`Error checking payment status: ${error.message}`);
        }

        attempts++;
      }
    }

    if (!signalReceived && attempts >= maxAttempts) {
      currentStatus = PaymentStatus.FAIL;
    }

    await updatePaymentStatus({
      paymentId: input.paymentId,
      status: currentStatus as PaymentStatus,
    });

    await publishStatusChangeEvent({
      paymentId: input.paymentId,
      oldStatus: PaymentStatus.PENDING,
      newStatus: currentStatus as PaymentStatus,
    });

    return {
      status: currentStatus,
      initPoint: initPoint,
    };
  } catch (error) {
    await updatePaymentStatus({
      paymentId: input.paymentId,
      status: PaymentStatus.FAIL,
    });

    await publishStatusChangeEvent({
      paymentId: input.paymentId,
      oldStatus: PaymentStatus.PENDING,
      newStatus: PaymentStatus.FAIL,
    });

    throw ApplicationFailure.create({
      message: `Credit card payment workflow failed: ${error.message}`,
      type: "CreditCardPaymentFailure",
      details: [input.paymentId],
    });
  }
}
