import { IsEnum, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PaymentStatus } from "../../domain/entities/payment.entity";

export class UpdatePaymentDto {
  @ApiProperty({
    description: "Novo status do pagamento",
    enum: PaymentStatus,
    example: PaymentStatus.PAID,
  })
  @IsNotEmpty({ message: "Status is required" })
  @IsEnum(PaymentStatus, {
    message: "Status must be one of: PENDING, PAID, FAIL",
  })
  status: PaymentStatus;
}
