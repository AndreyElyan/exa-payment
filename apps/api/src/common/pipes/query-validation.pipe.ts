import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";
import { validate } from "class-validator";
import { plainToClass } from "class-transformer";
import { ListPaymentsQueryDto } from "../../interfaces/dto/list-payments-query.dto";

@Injectable()
export class QueryValidationPipe implements PipeTransform {
  async transform(value: any): Promise<ListPaymentsQueryDto> {
    const dto = plainToClass(ListPaymentsQueryDto, value);
    const errors = await validate(dto);

    if (errors.length > 0) {
      const errorMessages = errors.map((error) => {
        const constraints = Object.values(error.constraints || {});
        return constraints.join(", ");
      });
      throw new BadRequestException(errorMessages.join("; "));
    }

    return dto;
  }
}
