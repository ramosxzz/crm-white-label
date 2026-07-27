export type WebhookEvent = "lead.created" | "lead.stage_changed" | "message.received";

export const WEBHOOK_EVENTS: WebhookEvent[] = ["lead.created", "lead.stage_changed", "message.received"];
