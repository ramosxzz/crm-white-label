// Tipos minimos do schema. Execute `npm run supabase:types` para gerar tipos completos.
export type MemberRole = "owner" | "admin" | "gerente" | "atendente" | "vendedor" | "tecnico";
export type WhatsAppProviderKind = "cloud_api" | "evolution" | "zapi";
export type MessageDirection = "inbound" | "outbound";
export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";
export type StockMovementKind = "in" | "out" | "adjust";
export type TaskStatus = "open" | "done" | "cancelled";
export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
export type StockReservationStatus = "active" | "released" | "consumed";

export type CampaignStatus = "draft" | "scheduled" | "running" | "completed" | "cancelled" | "failed";
export type CampaignMessageMode = "template" | "text" | "quick_message";
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
  quick_message_id: string | null;
  account_id: string | null;
  body_text: string | null;
  filters: Record<string, unknown>;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  max_per_run: number;
  delay_seconds: number;
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

// --- Servico em campo (ERP de OS) ---

export type ServiceOrderStatus =
  | "rascunho"
  | "agendada"
  | "em_execucao"
  | "concluida"
  | "conferida"
  | "faturada"
  | "cancelada"
  | "remarcada";

export type ServiceOrderShift = "manha" | "tarde";
export type ServiceOrderItemKind = "original" | "upsell";

/** Ultima posicao conhecida do tecnico. Nao guarda trajeto, so a atual. */
export interface TechnicianLocation {
  tenant_id: string;
  user_id: string;
  lat: number;
  lng: number;
  accuracy_meters: number | null;
  recorded_at: string;
}

export interface ServiceOrder {
  id: string;
  tenant_id: string;
  lead_id: string;
  appointment_id: string | null;
  code_seq: number;
  status: ServiceOrderStatus;
  consultant_id: string | null;
  created_by: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  address_cep: string | null;
  lat: number | null;
  lng: number | null;
  geocoded_at: string | null;
  voltage: "110v" | "220v" | null;
  service_date: string | null;
  shift: ServiceOrderShift | null;
  route_position: number | null;
  deadline: string | null;
  notes: string | null;
  observations: string | null;
  total_cents: number;
  partner_store: string | null;
  partner_seller_name: string | null;
  /** Percentual negociado nesta indicacao. Nulo = regra global do tenant. */
  partner_commission_percent: number | null;
  /** Loja/vendedor cadastrados. Preferidos sobre partner_store/partner_seller_name quando presentes. */
  partner_store_id: string | null;
  partner_seller_id: string | null;
  /** Fatia da comissao de indicacao que fica com a loja. Nulo com os dois = 50/50. */
  partner_store_split_percent: number | null;
  signature_path: string | null;
  signed_at: string | null;
  signer_name: string | null;
  completed_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceOrderItem {
  id: string;
  tenant_id: string;
  service_order_id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  amount_cents: number;
  kind: ServiceOrderItemKind;
  approved: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ServiceOrderTechnician {
  id: string;
  tenant_id: string;
  service_order_id: string;
  user_id: string;
  is_primary: boolean;
  created_at: string;
}

export interface ServiceOrderDamage {
  id: string;
  tenant_id: string;
  service_order_id: string;
  description: string;
  photo_path: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ServiceOrderEvent {
  id: string;
  tenant_id: string;
  service_order_id: string;
  from_status: ServiceOrderStatus | null;
  to_status: ServiceOrderStatus;
  user_id: string | null;
  reason: string | null;
  created_at: string;
}

export type FieldServicePartnerKind = "loja" | "vendedor";

export interface FieldServicePartner {
  id: string;
  tenant_id: string;
  kind: FieldServicePartnerKind;
  name: string;
  /** So preenchido em vendedor: a loja a qual ele pertence (opcional). */
  store_id: string | null;
  phone: string | null;
  pix_key: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Financeiro do servico em campo ---

export type FinanceEntryKind = "pagar" | "receber";
export type FinanceEntryStatus = "aberta" | "paga" | "cancelada";
export type CommissionStatus = "prevista" | "aprovada" | "paga";
export type CommissionParty = "tecnico" | "vendedora_interna" | "loja_parceira" | "vendedor_externo";

export interface FinanceEntry {
  id: string;
  tenant_id: string;
  kind: FinanceEntryKind;
  description: string;
  amount_cents: number;
  due_date: string | null;
  paid_at: string | null;
  status: FinanceEntryStatus;
  category: string | null;
  service_order_id: string | null;
  is_recurring: boolean;
  recurrence_day: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommissionRule {
  id: string;
  tenant_id: string;
  party_kind: CommissionParty;
  percent: number;
  updated_at: string;
}

/**
 * De/para do emoji da mensagem de abertura para o criativo de origem, usado
 * quando o referral do Click-to-WhatsApp nao chega (caso da Evolution API).
 * `match_text` so e preenchido quando dois criativos dividem o mesmo emoji.
 */
export interface AdCreativeSignature {
  id: string;
  tenant_id: string;
  emoji: string;
  match_text: string | null;
  creative_name: string;
  ad_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Commission {
  id: string;
  tenant_id: string;
  service_order_id: string;
  party_kind: CommissionParty;
  user_id: string | null;
  partner_id: string | null;
  partner_name: string | null;
  partner_store: string | null;
  base_cents: number;
  percent: number;
  amount_cents: number;
  status: CommissionStatus;
  paid_at: string | null;
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
  broadcast_enabled: boolean;
  lead_assignment_enabled: boolean;
  field_service_enabled: boolean;
  field_service_base_address: string | null;
  field_service_base_lat: number | null;
  field_service_base_lng: number | null;
  meta_pixel_id: string | null;
  meta_capi_token: string | null;
  meta_ad_account_id: string | null;
  meta_ads_access_token: string | null;
  lead_forward_user_id: string | null;
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

export interface ApiKey {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ApiWebhook {
  id: string;
  tenant_id: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ApiWebhookDelivery {
  id: string;
  webhook_id: string;
  tenant_id: string;
  event: string;
  status_code: number | null;
  response_body: string | null;
  error: string | null;
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
  referred_by_partner_id: string | null;
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
  assigned_to: string | null;
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
  location_id: string | null;
  created_at: string;
}

export interface StockLocation {
  id: string;
  tenant_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface ProductStock {
  id: string;
  tenant_id: string;
  product_id: string;
  location_id: string;
  quantity: number;
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
      stock_locations: { Row: StockLocation; Insert: Partial<StockLocation>; Update: Partial<StockLocation> };
      product_stock: { Row: ProductStock; Insert: Partial<ProductStock>; Update: Partial<ProductStock> };
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
      api_keys: { Row: ApiKey; Insert: Partial<ApiKey>; Update: Partial<ApiKey> };
      api_webhooks: { Row: ApiWebhook; Insert: Partial<ApiWebhook>; Update: Partial<ApiWebhook> };
      api_webhook_deliveries: {
        Row: ApiWebhookDelivery;
        Insert: Partial<ApiWebhookDelivery>;
        Update: Partial<ApiWebhookDelivery>;
      };
      message_templates: { Row: MessageTemplate; Insert: Partial<MessageTemplate>; Update: Partial<MessageTemplate> };
      campaigns: { Row: Campaign; Insert: Partial<Campaign>; Update: Partial<Campaign> };
      campaign_recipients: {
        Row: CampaignRecipient;
        Insert: Partial<CampaignRecipient>;
        Update: Partial<CampaignRecipient>;
      };
      service_orders: { Row: ServiceOrder; Insert: Partial<ServiceOrder>; Update: Partial<ServiceOrder> };
      service_order_items: {
        Row: ServiceOrderItem;
        Insert: Partial<ServiceOrderItem>;
        Update: Partial<ServiceOrderItem>;
      };
      service_order_technicians: {
        Row: ServiceOrderTechnician;
        Insert: Partial<ServiceOrderTechnician>;
        Update: Partial<ServiceOrderTechnician>;
      };
      service_order_damages: {
        Row: ServiceOrderDamage;
        Insert: Partial<ServiceOrderDamage>;
        Update: Partial<ServiceOrderDamage>;
      };
      service_order_events: {
        Row: ServiceOrderEvent;
        Insert: Partial<ServiceOrderEvent>;
        Update: Partial<ServiceOrderEvent>;
      };
      finance_entries: { Row: FinanceEntry; Insert: Partial<FinanceEntry>; Update: Partial<FinanceEntry> };
      commission_rules: { Row: CommissionRule; Insert: Partial<CommissionRule>; Update: Partial<CommissionRule> };
      commissions: { Row: Commission; Insert: Partial<Commission>; Update: Partial<Commission> };
      ad_creative_signatures: {
        Row: AdCreativeSignature;
        Insert: Partial<AdCreativeSignature>;
        Update: Partial<AdCreativeSignature>;
      };
    };
  };
};
