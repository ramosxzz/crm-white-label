export type ApiScope =
  | "leads:read"
  | "leads:write"
  | "messages:read"
  | "messages:write"
  | "automations:trigger"
  | "pipelines:read"
  | "webhooks:manage"
  | "agenda:read"
  | "agenda:write"
  | "survey:write";

export const API_SCOPES: ApiScope[] = [
  "leads:read",
  "leads:write",
  "messages:read",
  "messages:write",
  "automations:trigger",
  "pipelines:read",
  "webhooks:manage",
  "agenda:read",
  "agenda:write",
  "survey:write",
];
