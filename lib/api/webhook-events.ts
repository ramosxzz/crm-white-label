export type WebhookEvent =
  | "lead.created"
  | "lead.stage_changed"
  | "message.received"
  | "appointment.created"
  | "appointment.updated"
  | "appointment.cancelled";

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  "lead.created",
  "lead.stage_changed",
  "message.received",
  "appointment.created",
  "appointment.updated",
  "appointment.cancelled",
];
