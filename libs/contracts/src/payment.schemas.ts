import { z } from 'zod';

export const CreatePaymentSchema = z.object({
  cpf: z.string().regex(/^\d{11}$/, 'CPF must be 11 digits'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().max(255, 'Description must be at most 255 characters'),
  paymentMethod: z.enum(['PIX', 'CREDIT_CARD'], {
    errorMap: () => ({ message: 'Payment method must be PIX or CREDIT_CARD' }),
  }),
});

export const UpdatePaymentSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'FAIL'], {
    errorMap: () => ({ message: 'Status must be PENDING, PAID or FAIL' }),
  }),
});

export const PaymentQuerySchema = z.object({
  cpf: z.string().optional(),
  paymentMethod: z.enum(['PIX', 'CREDIT_CARD']).optional(),
  status: z.enum(['PENDING', 'PAID', 'FAIL']).optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
});

export const ExportQuerySchema = z.object({
  from: z.string().datetime('From must be a valid ISO datetime'),
  to: z.string().datetime('To must be a valid ISO datetime'),
  format: z.enum(['ndjson', 'parquet']).default('ndjson'),
});

export type CreatePaymentDto = z.infer<typeof CreatePaymentSchema>;
export type UpdatePaymentDto = z.infer<typeof UpdatePaymentSchema>;
export type PaymentQueryDto = z.infer<typeof PaymentQuerySchema>;
export type ExportQueryDto = z.infer<typeof ExportQuerySchema>;
