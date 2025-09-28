import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { PaymentEventConsumer } from "./consumers/payment-event.consumer";
import { AuditService } from "./services/audit.service";
import { NotificationService } from "./services/notification.service";
import { AnalyticsService } from "./services/analytics.service";
import { AuditLog, AuditLogSchema } from "./schemas/audit-log.schema";
import {
  PaymentSnapshot,
  PaymentSnapshotSchema,
} from "./schemas/payment-snapshot.schema";
import { RabbitMQSetupService } from "./infra/messaging/rabbitmq-setup.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: "../../.env",
    }),
    MongooseModule.forRoot(
      process.env.MONGODB_URL ||
        "mongodb://app:app@localhost:27017/payments_audit?authSource=admin",
    ),
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: PaymentSnapshot.name, schema: PaymentSnapshotSchema },
    ]),
  ],
  providers: [
    RabbitMQSetupService,
    PaymentEventConsumer,
    AuditService,
    NotificationService,
    AnalyticsService,
  ],
})
export class AppModule {}
