import { z } from 'zod';

export const CreatePaymentSchema = z.object({
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter exatamente 11 dígitos'),
  amount: z.number().positive('Valor deve ser positivo').multipleOf(0.01, 'Valor deve ter no máximo 2 casas decimais'),
  description: z.string().min(1, 'Descrição é obrigatória').max(255, 'Descrição deve ter no máximo 255 caracteres'),
  paymentMethod: z.enum(['PIX', 'CREDIT_CARD'], {
    errorMap: () => ({ message: 'Método de pagamento deve ser PIX ou CREDIT_CARD' })
  }),
});

export const UpdatePaymentSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'FAIL'], {
    errorMap: () => ({ message: 'Status deve ser PENDING, PAID ou FAIL' })
  }).optional(),
});

export const PaymentResponseSchema = z.object({
  id: z.string(),
  cpf: z.string(),
  amount: z.number(),
  description: z.string(),
  paymentMethod: z.enum(['PIX', 'CREDIT_CARD']),
  status: z.enum(['PENDING', 'PAID', 'FAIL']),
  providerRef: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const PaymentListQuerySchema = z.object({
  cpf: z.string().optional(),
  paymentMethod: z.enum(['PIX', 'CREDIT_CARD']).optional(),
  status: z.enum(['PENDING', 'PAID', 'FAIL']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const PaymentExportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  format: z.enum(['ndjson', 'parquet']).default('ndjson'),
});

export type CreatePaymentDto = z.infer<typeof CreatePaymentSchema>;
export type UpdatePaymentDto = z.infer<typeof UpdatePaymentSchema>;
export type PaymentResponse = z.infer<typeof PaymentResponseSchema>;
export type PaymentListQuery = z.infer<typeof PaymentListQuerySchema>;
export type PaymentExportQuery = z.infer<typeof PaymentExportQuerySchema>;
