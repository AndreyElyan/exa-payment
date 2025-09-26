import { IsEnum, IsNotEmpty } from "class-validator";
import { PaymentStatus } from "../../domain/entities/payment.entity";

export class UpdatePaymentDto {
  @IsNotEmpty({ message: "Status is required" })
  @IsEnum(PaymentStatus, {
    message: "Status must be one of: PENDING, PAID, FAIL",
  })
  status: PaymentStatus;
}
