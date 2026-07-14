// Tipos minimos do schema. Execute `npm run supabase:types` para gerar tipos completos.
export type MemberRole = "owner" | "admin" | "gerente" | "atendente" | "vendedor";
export type WhatsAppProviderKind = "cloud_api" | "evolution" | "zapi";
export type MessageDirection = "inbound" | "outbound";
export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";
export type StockMovementKind = "in" | "out" | "adjust";
export type TaskStatus = "open" | "done" | "cancelled";
export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
export type StockReservationStatus = "active" | "released" | "consumed";

export type CampaignStatus = "draft" | "scheduled" | "running" | "completed" | "cancelled" | "failed";
export type CampaignMessageMode = "template" | "text";
export type CampaignRecipientStatus = "pending" | "sent" | "failed" | "skipped";

export interface MessageTemplate {
  id: string;
  tenant_id: string;
  name: string;
  channel: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  tenant_id: string;
  name: string;
  status: CampaignStatus;
  message_mode: CampaignMessageMode;
  template_id: string | null;
  body_text: string | null;
  filters: Record<string, unknown>;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  max_per_run: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignRecipient {
  id: string;
  tenant_id: string;
  campaign_id: string;
  lead_id: string;
  phone: string;
  status: CampaignRecipientStatus;
  error: string | null;
  sent_at: string | null;
  external_message_id: string | null;
  created_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string | null;
  tagline: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  stock_enabled: boolean;
  satisfaction_survey_enabled: boolean;
  calls_dashboard_enabled: boolean;
  meta_pixel_id: string | null;
  meta_capi_token: string | null;
  meta_ad_account_id: string | null;
  meta_ads_access_token: string | null;
  created_at: string;
}

export interface QuickMessage {
  id: string;
  tenant_id: string;
  title: string;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  sort_order: number;
  is_preset: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string | null;
  kind: string;
  title: string;
  description: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface SystemUpdate {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
}

export interface LeadIntakeKey {
  id: string;
  tenant_id: string;
  name: string;
  api_key: string;
  source_label: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  default_tenant_id: string | null;
  last_seen_update_at: string;
  created_at: string;
}

export interface TenantMember {
  tenant_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
}

export interface Pipeline {
  id: string;
  tenant_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  tenant_id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color: string | null;
  is_won: boolean;
  is_lost: boolean;
  created_at: string;
}

export interface Lead {
  id: string;
  tenant_id: string;
  pipeline_id: string | null;
  stage_id: string | null;
  assigned_to: string | null;
  name: string;
  phone: string | null;
  whatsapp_lid: string | null;
  email: string | null;
  source: string | null;
  notes: string | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
  position: number;
  value_cents: number | null;
  automations_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: string;
  tenant_id: string;
  lead_id: string;
  user_id: string | null;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface WhatsAppAccount {
  id: string;
  tenant_id: string;
  provider: WhatsAppProviderKind;
  phone_number: string;
  display_name: string | null;
  credentials: Record<string, unknown>;
  webhook_secret: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WhatsAppGroup {
  id: string;
  tenant_id: string;
  whatsapp_account_id: string | null;
  provider_group_id: string;
  subject: string;
  description: string | null;
  owner_jid: string | null;
  participant_count: number | null;
  last_event_type: string | null;
  last_event_at: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppGroupLabel {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface WhatsAppGroupLabelAssignment {
  tenant_id: string;
  group_id: string;
  label_id: string;
  created_at: string;
}

export type ConversationStatus =
  | "nao_iniciada"
  | "aguardando"
  | "em_atendimento"
  | "resolvida";

export interface Conversation {
  id: string;
  tenant_id: string;
  lead_id: string;
  whatsapp_account_id: string | null;
  channel: string;
  last_message_at: string | null;
  unread_count: number;
  status: ConversationStatus;
  created_at: string;
}

export interface Message {
  id: string;
  tenant_id: string;
  conversation_id: string;
  user_id: string | null;
  direction: MessageDirection;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  external_id: string | null;
  reply_to_message_id: string | null;
  reply_to_external_id: string | null;
  reply_to_body: string | null;
  reply_to_sender_name: string | null;
  status: MessageStatus;
  error: string | null;
  created_at: string;
}

export interface FileRow {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  uploaded_by: string | null;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  sku: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  cost_cents: number;
  stock_quantity: number;
  min_stock: number;
  tone: string | null;
  length_cm: number | null;
  texture: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  tenant_id: string;
  product_id: string;
  user_id: string | null;
  lead_id: string | null;
  kind: StockMovementKind;
  quantity: number;
  reason: string | null;
  created_at: string;
}

export interface AttendantStatus {
  tenant_id: string;
  user_id: string;
  is_available: boolean;
  last_assigned_at: string | null;
  updated_at: string;
}

export interface LeadAssignmentHistory {
  id: string;
  tenant_id: string;
  lead_id: string;
  from_user_id: string | null;
  to_user_id: string | null;
  assigned_by: string | null;
  reason: string;
  created_at: string;
}

export interface CustomFieldDefinition {
  id: string;
  tenant_id: string;
  entity_type: "lead";
  key: string;
  label: string;
  field_type: "text" | "number" | "date" | "select" | "boolean" | "file";
  options: unknown[];
  is_required: boolean;
  sort_order: number;
  created_at: string;
}

export interface Task {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  title: string;
  notes: string | null;
  due_at: string | null;
  status: TaskStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Professional {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  tenant_id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  is_active: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  assigned_to: string | null;
  professional_id: string | null;
  service_id: string | null;
  starts_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockReservation {
  id: string;
  tenant_id: string;
  product_id: string;
  lead_id: string | null;
  appointment_id: string | null;
  quantity: number;
  status: StockReservationStatus;
  created_by: string | null;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      tenants: { Row: Tenant; Insert: Partial<Tenant>; Update: Partial<Tenant> };
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      tenant_members: { Row: TenantMember; Insert: Partial<TenantMember>; Update: Partial<TenantMember> };
      pipelines: { Row: Pipeline; Insert: Partial<Pipeline>; Update: Partial<Pipeline> };
      pipeline_stages: { Row: PipelineStage; Insert: Partial<PipelineStage>; Update: Partial<PipelineStage> };
      leads: { Row: Lead; Insert: Partial<Lead>; Update: Partial<Lead> };
      lead_activities: { Row: LeadActivity; Insert: Partial<LeadActivity>; Update: Partial<LeadActivity> };
      whatsapp_accounts: { Row: WhatsAppAccount; Insert: Partial<WhatsAppAccount>; Update: Partial<WhatsAppAccount> };
      whatsapp_groups: { Row: WhatsAppGroup; Insert: Partial<WhatsAppGroup>; Update: Partial<WhatsAppGroup> };
      whatsapp_group_labels: { Row: WhatsAppGroupLabel; Insert: Partial<WhatsAppGroupLabel>; Update: Partial<WhatsAppGroupLabel> };
      whatsapp_group_label_assignments: {
        Row: WhatsAppGroupLabelAssignment;
        Insert: Partial<WhatsAppGroupLabelAssignment>;
        Update: Partial<WhatsAppGroupLabelAssignment>;
      };
      conversations: { Row: Conversation; Insert: Partial<Conversation>; Update: Partial<Conversation> };
      messages: { Row: Message; Insert: Partial<Message>; Update: Partial<Message> };
      files: { Row: FileRow; Insert: Partial<FileRow>; Update: Partial<FileRow> };
      products: { Row: Product; Insert: Partial<Product>; Update: Partial<Product> };
      stock_movements: { Row: StockMovement; Insert: Partial<StockMovement>; Update: Partial<StockMovement> };
      attendant_status: { Row: AttendantStatus; Insert: Partial<AttendantStatus>; Update: Partial<AttendantStatus> };
      lead_assignment_history: {
        Row: LeadAssignmentHistory;
        Insert: Partial<LeadAssignmentHistory>;
        Update: Partial<LeadAssignmentHistory>;
      };
      custom_field_definitions: {
        Row: CustomFieldDefinition;
        Insert: Partial<CustomFieldDefinition>;
        Update: Partial<CustomFieldDefinition>;
      };
      tasks: { Row: Task; Insert: Partial<Task>; Update: Partial<Task> };
      professionals: { Row: Professional; Insert: Partial<Professional>; Update: Partial<Professional> };
      services: { Row: Service; Insert: Partial<Service>; Update: Partial<Service> };
      appointments: { Row: Appointment; Insert: Partial<Appointment>; Update: Partial<Appointment> };
      stock_reservations: { Row: StockReservation; Insert: Partial<StockReservation>; Update: Partial<StockReservation> };
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification> };
      system_updates: { Row: SystemUpdate; Insert: Partial<SystemUpdate>; Update: Partial<SystemUpdate> };
      lead_intake_keys: { Row: LeadIntakeKey; Insert: Partial<LeadIntakeKey>; Update: Partial<LeadIntakeKey> };
      message_templates: { Row: MessageTemplate; Insert: Partial<MessageTemplate>; Update: Partial<MessageTemplate> };
      campaigns: { Row: Campaign; Insert: Partial<Campaign>; Update: Partial<Campaign> };
      campaign_recipients: {
        Row: CampaignRecipient;
        Insert: Partial<CampaignRecipient>;
        Update: Partial<CampaignRecipient>;
      };
    };
  };
};
