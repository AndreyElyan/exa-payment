import { Injectable } from "@nestjs/common";

export interface DomainEvent {
  occurredAt: Date;
}

@Injectable()
export class DomainEventService {
  private events: DomainEvent[] = [];

  addEvent(event: DomainEvent): void {
    this.events.push(event);
  }

  getEvents(): DomainEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
  }

  hasEvents(): boolean {
    return this.events.length > 0;
  }

  async publishPaymentStatusChanged(event: any): Promise<void> {
    // Implementation for publishing payment status changed events
    console.log("Publishing payment status changed event:", event);
  }
}
