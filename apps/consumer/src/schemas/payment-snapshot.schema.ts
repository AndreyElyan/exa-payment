import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type PaymentSnapshotDocument = PaymentSnapshot & Document;

@Schema({ timestamps: true })
export class PaymentSnapshot {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  date: string;

  @Prop()
  status?: string;

  @Prop()
  paymentMethod?: string;

  @Prop()
  customerId?: string;

  @Prop({ default: 0 })
  count: number;

  @Prop({ default: 0 })
  totalAmount: number;

  @Prop({ default: 0 })
  totalPayments: number;

  @Prop({ default: 0 })
  status_pending: number;

  @Prop({ default: 0 })
  status_paid: number;

  @Prop({ default: 0 })
  status_fail: number;

  @Prop({ default: 0 })
  status_cancelled: number;

  @Prop({ default: 0 })
  method_credit_card: number;

  @Prop({ default: 0 })
  method_pix: number;

  @Prop({ default: Date.now })
  lastUpdated: Date;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const PaymentSnapshotSchema =
  SchemaFactory.createForClass(PaymentSnapshot);

PaymentSnapshotSchema.index({ type: 1, date: 1 });
PaymentSnapshotSchema.index({ type: 1, status: 1, date: 1 });
PaymentSnapshotSchema.index({ type: 1, paymentMethod: 1, date: 1 });
PaymentSnapshotSchema.index({ type: 1, customerId: 1, date: 1 });
PaymentSnapshotSchema.index({ date: -1 });
PaymentSnapshotSchema.index({ lastUpdated: -1 });
