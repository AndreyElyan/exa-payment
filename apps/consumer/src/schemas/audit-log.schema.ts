import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ required: true })
  eventType: string;

  @Prop({ required: true })
  paymentId: string;

  @Prop({ required: true })
  status: string;

  @Prop()
  previousStatus?: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  customerId: string;

  @Prop({ required: true })
  paymentMethod: string;

  @Prop({ required: true })
  timestamp: Date;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ paymentId: 1 });
AuditLogSchema.index({ eventType: 1 });
AuditLogSchema.index({ status: 1 });
AuditLogSchema.index({ customerId: 1 });
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ createdAt: -1 });
