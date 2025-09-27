import { Worker, NativeConnection } from "@temporalio/worker";
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { PaymentActivitiesImpl } from "./payment/payment.activities";
import * as path from "path";

@Injectable()
export class TemporalWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TemporalWorkerService.name);
  private worker?: Worker;
  private connection?: NativeConnection;

  constructor(private readonly paymentActivities: PaymentActivitiesImpl) {}

  async onModuleInit(): Promise<void> {
    try {
      this.logger.log("Starting Temporal Worker...");

      this.connection = await NativeConnection.connect({
        address: process.env.TEMPORAL_ADDRESS || "localhost:7233",
      });

      this.worker = await Worker.create({
        connection: this.connection,
        namespace: process.env.TEMPORAL_NAMESPACE || "default",
        taskQueue: "payment-workflow",
        workflowsPath: path.join(
          __dirname,
          "payment",
          "credit-card-payment.workflow.js",
        ),
        activities: {
          createPaymentRecord: this.paymentActivities.createPaymentRecord.bind(
            this.paymentActivities,
          ),
          createMercadoPagoPreference:
            this.paymentActivities.createMercadoPagoPreference.bind(
              this.paymentActivities,
            ),
          updatePaymentStatus: this.paymentActivities.updatePaymentStatus.bind(
            this.paymentActivities,
          ),
          checkPaymentStatus: this.paymentActivities.checkPaymentStatus.bind(
            this.paymentActivities,
          ),
          publishStatusChangeEvent:
            this.paymentActivities.publishStatusChangeEvent.bind(
              this.paymentActivities,
            ),
        },
      });

      await this.worker.run();
      this.logger.log("Temporal Worker started successfully");
    } catch (error) {
      this.logger.error("Failed to start Temporal Worker", error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log("Shutting down Temporal Worker...");

    if (this.worker) {
      this.worker.shutdown();
    }

    if (this.connection) {
      await this.connection.close();
    }

    this.logger.log("Temporal Worker shut down successfully");
  }
}
