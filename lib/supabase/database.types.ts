// Tipos gerados a partir do schema real do banco (project bwmjtcgfypkqbcthslwr).
// Para atualizar: peca pra regenerar via ferramenta de tipos do Supabase e
// reaplicar os aliases hand-written abaixo do Database (nao editar os dois
// blocos gerados por baixo - eles sao substituidos inteiros na proxima geracao).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ad_creative_signatures: {
        Row: {
          active: boolean
          ad_id: string | null
          created_at: string
          creative_name: string
          emoji: string
          id: string
          match_text: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          ad_id?: string | null
          created_at?: string
          creative_name: string
          emoji: string
          id?: string
          match_text?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          ad_id?: string | null
          created_at?: string
          creative_name?: string
          emoji?: string
          id?: string
          match_text?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_creative_signatures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          model: string | null
          name: string
          system_prompt: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          model?: string | null
          name?: string
          system_prompt?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          model?: string | null
          name?: string
          system_prompt?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scopes: string[]
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          scopes?: string[]
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scopes?: string[]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_webhook_deliveries: {
        Row: {
          created_at: string
          error: string | null
          event: string
          id: string
          response_body: string | null
          status_code: number | null
          tenant_id: string
          webhook_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event: string
          id?: string
          response_body?: string | null
          status_code?: number | null
          tenant_id: string
          webhook_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event?: string
          id?: string
          response_body?: string | null
          status_code?: number | null
          tenant_id?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_webhook_deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "api_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      api_webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          events: string[]
          id: string
          is_active: boolean
          secret: string
          tenant_id: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          id?: string
          is_active?: boolean
          secret: string
          tenant_id: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          id?: string
          is_active?: boolean
          secret?: string
          tenant_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_webhooks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          cost_cents: number
          created_at: string
          created_by: string | null
          deal_value_cents: number
          duration_minutes: number
          id: string
          kind: string
          lead_id: string | null
          notes: string | null
          outcome: string | null
          professional_id: string | null
          reminders_sent: Json
          service_id: string | null
          starts_at: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          cost_cents?: number
          created_at?: string
          created_by?: string | null
          deal_value_cents?: number
          duration_minutes: number
          id?: string
          kind?: string
          lead_id?: string | null
          notes?: string | null
          outcome?: string | null
          professional_id?: string | null
          reminders_sent?: Json
          service_id?: string | null
          starts_at: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          cost_cents?: number
          created_at?: string
          created_by?: string | null
          deal_value_cents?: number
          duration_minutes?: number
          id?: string
          kind?: string
          lead_id?: string | null
          notes?: string | null
          outcome?: string | null
          professional_id?: string | null
          reminders_sent?: Json
          service_id?: string | null
          starts_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attendant_status: {
        Row: {
          is_available: boolean
          last_assigned_at: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          is_available?: boolean
          last_assigned_at?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          is_available?: boolean
          last_assigned_at?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendant_status_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_execution_steps: {
        Row: {
          block_id: string
          block_type: string
          created_at: string
          error: string | null
          execution_id: string
          id: string
          input_payload: Json
          result_payload: Json
          resume_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          block_id: string
          block_type: string
          created_at?: string
          error?: string | null
          execution_id: string
          id?: string
          input_payload?: Json
          result_payload?: Json
          resume_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          block_id?: string
          block_type?: string
          created_at?: string
          error?: string | null
          execution_id?: string
          id?: string
          input_payload?: Json
          result_payload?: Json
          resume_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_execution_steps_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "automation_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_execution_steps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_executions: {
        Row: {
          error_message: string | null
          finished_at: string | null
          flow_id: string
          id: string
          idempotency_key: string
          lead_id: string | null
          started_at: string
          status: string
          tenant_id: string
          trigger_kind: string
          trigger_payload: Json
          version_id: string
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          flow_id: string
          id?: string
          idempotency_key: string
          lead_id?: string | null
          started_at?: string
          status?: string
          tenant_id: string
          trigger_kind: string
          trigger_payload?: Json
          version_id: string
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          flow_id?: string
          id?: string
          idempotency_key?: string
          lead_id?: string | null
          started_at?: string
          status?: string
          tenant_id?: string
          trigger_kind?: string
          trigger_payload?: Json
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "automation_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_flows: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          tenant_id: string
          trigger_kind: string | null
          trigger_kinds: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          tenant_id: string
          trigger_kind?: string | null
          trigger_kinds?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          tenant_id?: string
          trigger_kind?: string | null
          trigger_kinds?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_flows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_versions: {
        Row: {
          config: Json
          created_at: string
          flow_id: string
          id: string
          published_at: string | null
          tenant_id: string
          version_number: number
        }
        Insert: {
          config?: Json
          created_at?: string
          flow_id: string
          id?: string
          published_at?: string | null
          tenant_id: string
          version_number?: number
        }
        Update: {
          config?: Json
          created_at?: string
          flow_id?: string
          id?: string
          published_at?: string | null
          tenant_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_versions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      call_attempts: {
        Row: {
          api4com_call_id: string | null
          created_at: string
          created_by: string | null
          direction: string
          id: string
          lead_id: string | null
          notes: string | null
          outcome: string
          tenant_id: string
        }
        Insert: {
          api4com_call_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          outcome?: string
          tenant_id: string
        }
        Update: {
          api4com_call_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          outcome?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_attempts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_attempts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          error: string | null
          external_message_id: string | null
          id: string
          lead_id: string
          phone: string
          sent_at: string | null
          status: Database["public"]["Enums"]["campaign_recipient_status"]
          tenant_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          error?: string | null
          external_message_id?: string | null
          id?: string
          lead_id: string
          phone: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_recipient_status"]
          tenant_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          error?: string | null
          external_message_id?: string | null
          id?: string
          lead_id?: string
          phone?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_recipient_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          account_id: string | null
          body_text: string | null
          business_hours_only: boolean
          completed_at: string | null
          created_at: string
          created_by: string | null
          daily_cap: number | null
          delay_seconds: number
          filters: Json
          id: string
          max_per_run: number
          message_mode: Database["public"]["Enums"]["campaign_message_mode"]
          name: string
          quick_message_id: string | null
          scheduled_at: string | null
          send_hour_end: number
          send_hour_start: number
          started_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          template_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          body_text?: string | null
          business_hours_only?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          daily_cap?: number | null
          delay_seconds?: number
          filters?: Json
          id?: string
          max_per_run?: number
          message_mode?: Database["public"]["Enums"]["campaign_message_mode"]
          name: string
          quick_message_id?: string | null
          scheduled_at?: string | null
          send_hour_end?: number
          send_hour_start?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          template_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          body_text?: string | null
          business_hours_only?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          daily_cap?: number | null
          delay_seconds?: number
          filters?: Json
          id?: string
          max_per_run?: number
          message_mode?: Database["public"]["Enums"]["campaign_message_mode"]
          name?: string
          quick_message_id?: string | null
          scheduled_at?: string | null
          send_hour_end?: number
          send_hour_start?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          template_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_quick_message_id_fkey"
            columns: ["quick_message_id"]
            isOneToOne: false
            referencedRelation: "quick_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          id: string
          party_kind: string
          percent: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          party_kind: string
          percent?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          party_kind?: string
          percent?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount_cents: number
          base_cents: number
          created_at: string
          id: string
          paid_at: string | null
          partner_id: string | null
          partner_name: string | null
          partner_store: string | null
          party_kind: string
          percent: number
          service_order_id: string
          status: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          amount_cents?: number
          base_cents?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          partner_id?: string | null
          partner_name?: string | null
          partner_store?: string | null
          party_kind: string
          percent?: number
          service_order_id: string
          status?: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          base_cents?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          partner_id?: string | null
          partner_name?: string | null
          partner_store?: string | null
          party_kind?: string
          percent?: number
          service_order_id?: string
          status?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "field_service_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_presence: {
        Row: {
          conversation_id: string
          state: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          conversation_id: string
          state: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          state?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_presence_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_presence_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          channel: string
          created_at: string
          id: string
          last_message_at: string | null
          lead_id: string
          status: Database["public"]["Enums"]["conversation_status"]
          tenant_id: string
          unread_count: number
          whatsapp_account_id: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          lead_id: string
          status?: Database["public"]["Enums"]["conversation_status"]
          tenant_id: string
          unread_count?: number
          whatsapp_account_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          lead_id?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          tenant_id?: string
          unread_count?: number
          whatsapp_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          created_at: string
          entity_type: string
          field_type: string
          id: string
          is_required: boolean
          key: string
          label: string
          options: Json
          sort_order: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          field_type: string
          id?: string
          is_required?: boolean
          key: string
          label: string
          options?: Json
          sort_order?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          field_type?: string
          id?: string
          is_required?: boolean
          key?: string
          label?: string
          options?: Json
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      field_service_partners: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["field_service_partner_kind"]
          name: string
          phone: string | null
          pix_key: string | null
          store_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["field_service_partner_kind"]
          name: string
          phone?: string | null
          pix_key?: string | null
          store_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["field_service_partner_kind"]
          name?: string
          phone?: string | null
          pix_key?: string | null
          store_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_service_partners_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "field_service_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_service_partners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_entries: {
        Row: {
          amount_cents: number
          category: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          installment_count: number
          installment_number: number
          is_recurring: boolean
          kind: string
          paid_at: string | null
          payment_method: string | null
          recurrence_day: number | null
          service_order_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          id?: string
          installment_count?: number
          installment_number?: number
          is_recurring?: boolean
          kind: string
          paid_at?: string | null
          payment_method?: string | null
          recurrence_day?: number | null
          service_order_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          installment_count?: number
          installment_number?: number
          is_recurring?: boolean
          kind?: string
          paid_at?: string | null
          payment_method?: string | null
          recurrence_day?: number | null
          service_order_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_adjustment_requests: {
        Row: {
          adjustment_kind: string
          commission_id: string | null
          created_at: string
          id: string
          payload: Json
          reason: string
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          service_order_id: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          adjustment_kind: string
          commission_id?: string | null
          created_at?: string
          id?: string
          payload: Json
          reason: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_order_id?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          adjustment_kind?: string
          commission_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          reason?: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_order_id?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_adjustment_requests_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_adjustment_requests_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_adjustment_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_accounts: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          instagram_business_account_id: string | null
          is_active: boolean
          page_access_token: string
          page_id: string
          tenant_id: string
          webhook_verify_token: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          instagram_business_account_id?: string | null
          is_active?: boolean
          page_access_token: string
          page_id: string
          tenant_id: string
          webhook_verify_token?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          instagram_business_account_id?: string | null
          is_active?: boolean
          page_access_token?: string
          page_id?: string
          tenant_id?: string
          webhook_verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          created_at: string
          id: string
          kind: string
          lead_id: string
          payload: Json
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          lead_id: string
          payload?: Json
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          lead_id?: string
          payload?: Json
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignment_history: {
        Row: {
          assigned_by: string | null
          created_at: string
          from_user_id: string | null
          id: string
          lead_id: string
          reason: string
          tenant_id: string
          to_user_id: string | null
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          from_user_id?: string | null
          id?: string
          lead_id: string
          reason: string
          tenant_id: string
          to_user_id?: string | null
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          from_user_id?: string | null
          id?: string
          lead_id?: string
          reason?: string
          tenant_id?: string
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignment_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_intake_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          source_label: string | null
          tenant_id: string
        }
        Insert: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          source_label?: string | null
          tenant_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          source_label?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_intake_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tag_catalog: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          normalized_name: string
          tenant_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          normalized_name?: string
          tenant_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          normalized_name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tag_catalog_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_value_items: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          id: string
          label: string
          lead_id: string
          tenant_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          lead_id: string
          tenant_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          lead_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_value_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_value_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          automations_enabled: boolean
          created_at: string
          custom_fields: Json
          email: string | null
          id: string
          instagram_sender_id: string | null
          lost_pain: string | null
          lost_reason: string | null
          name: string
          notes: string | null
          phone: string | null
          pipeline_id: string | null
          position: number
          quality_stars: number
          referred_by_partner_id: string | null
          source: string | null
          stage_id: string | null
          tags: string[]
          tenant_id: string
          updated_at: string
          value_cents: number | null
          whatsapp_lid: string | null
          won_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          automations_enabled?: boolean
          created_at?: string
          custom_fields?: Json
          email?: string | null
          id?: string
          instagram_sender_id?: string | null
          lost_pain?: string | null
          lost_reason?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          pipeline_id?: string | null
          position?: number
          quality_stars?: number
          referred_by_partner_id?: string | null
          source?: string | null
          stage_id?: string | null
          tags?: string[]
          tenant_id: string
          updated_at?: string
          value_cents?: number | null
          whatsapp_lid?: string | null
          won_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          automations_enabled?: boolean
          created_at?: string
          custom_fields?: Json
          email?: string | null
          id?: string
          instagram_sender_id?: string | null
          lost_pain?: string | null
          lost_reason?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          pipeline_id?: string | null
          position?: number
          quality_stars?: number
          referred_by_partner_id?: string | null
          source?: string | null
          stage_id?: string | null
          tags?: string[]
          tenant_id?: string
          updated_at?: string
          value_cents?: number | null
          whatsapp_lid?: string | null
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_referred_by_partner_id_fkey"
            columns: ["referred_by_partner_id"]
            isOneToOne: false
            referencedRelation: "field_service_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          channel: string
          created_at: string
          id: string
          name: string
          payload: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          name: string
          payload?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          name?: string
          payload?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          edited_at: string | null
          error: string | null
          external_id: string | null
          id: string
          is_ai_generated: boolean
          media_type: string | null
          media_url: string | null
          quick_message_id: string | null
          reply_to_body: string | null
          reply_to_external_id: string | null
          reply_to_message_id: string | null
          reply_to_sender_name: string | null
          status: Database["public"]["Enums"]["message_status"]
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          edited_at?: string | null
          error?: string | null
          external_id?: string | null
          id?: string
          is_ai_generated?: boolean
          media_type?: string | null
          media_url?: string | null
          quick_message_id?: string | null
          reply_to_body?: string | null
          reply_to_external_id?: string | null
          reply_to_message_id?: string | null
          reply_to_sender_name?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          edited_at?: string | null
          error?: string | null
          external_id?: string | null
          id?: string
          is_ai_generated?: boolean
          media_type?: string | null
          media_url?: string | null
          quick_message_id?: string | null
          reply_to_body?: string | null
          reply_to_external_id?: string | null
          reply_to_message_id?: string | null
          reply_to_sender_name?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_quick_message_id_fkey"
            columns: ["quick_message_id"]
            isOneToOne: false
            referencedRelation: "quick_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_read: boolean
          kind: string
          link: string | null
          tenant_id: string
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_read?: boolean
          kind: string
          link?: string | null
          tenant_id: string
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_read?: boolean
          kind?: string
          link?: string | null
          tenant_id?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_method_rates: {
        Row: {
          created_at: string
          fee_percent: number
          id: string
          installment_count: number
          is_active: boolean
          minimum_installment_cents: number
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fee_percent?: number
          id?: string
          installment_count?: number
          is_active?: boolean
          minimum_installment_cents?: number
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fee_percent?: number
          id?: string
          installment_count?: number
          is_active?: boolean
          minimum_installment_cents?: number
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_method_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          pipeline_id: string
          position: number
          tenant_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          pipeline_id: string
          position?: number
          tenant_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          pipeline_id?: string
          position?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recipe_items: {
        Row: {
          created_at: string
          id: string
          material_product_id: string
          product_id: string
          quantity: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_product_id: string
          product_id: string
          quantity: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          material_product_id?: string
          product_id?: string
          quantity?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_recipe_items_material_product_id_fkey"
            columns: ["material_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipe_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipe_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock: {
        Row: {
          id: string
          location_id: string
          product_id: string
          quantity: number
          tenant_id: string
        }
        Insert: {
          id?: string
          location_id: string
          product_id: string
          quantity?: number
          tenant_id: string
        }
        Update: {
          id?: string
          location_id?: string
          product_id?: string
          quantity?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          cost_cents: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          length_cm: number | null
          min_stock: number
          name: string
          price_cents: number
          sku: string | null
          stock_quantity: number
          tenant_id: string
          texture: string | null
          tone: string | null
          updated_at: string
        }
        Insert: {
          cost_cents?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          length_cm?: number | null
          min_stock?: number
          name: string
          price_cents?: number
          sku?: string | null
          stock_quantity?: number
          tenant_id: string
          texture?: string | null
          tone?: string | null
          updated_at?: string
        }
        Update: {
          cost_cents?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          length_cm?: number | null
          min_stock?: number
          name?: string
          price_cents?: number
          sku?: string | null
          stock_quantity?: number
          tenant_id?: string
          texture?: string | null
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          tenant_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          tenant_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professionals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          api4com_extension: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          default_tenant_id: string | null
          full_name: string | null
          id: string
          job_title: string | null
          last_seen_update_at: string
        }
        Insert: {
          api4com_extension?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          default_tenant_id?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          last_seen_update_at?: string
        }
        Update: {
          api4com_extension?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          default_tenant_id?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          last_seen_update_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_tenant_id_fkey"
            columns: ["default_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_messages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_preset: boolean
          media_type: string | null
          media_url: string | null
          sort_order: number
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_preset?: boolean
          media_type?: string | null
          media_url?: string | null
          sort_order?: number
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_preset?: boolean
          media_type?: string | null
          media_url?: string | null
          sort_order?: number
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          lead_id: string
          media_type: string | null
          media_url: string | null
          send_at: string
          sent_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          lead_id: string
          media_type?: string | null
          media_url?: string | null
          send_at: string
          sent_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          lead_id?: string
          media_type?: string | null
          media_url?: string | null
          send_at?: string
          sent_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog_items: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          price_cents: number
          tenant_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_cents?: number
          tenant_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          tenant_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_catalog_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_checklists: {
        Row: {
          answers: Json
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          observations: string | null
          service_order_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          observations?: string | null
          service_order_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          observations?: string | null
          service_order_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_checklists_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: true
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_checklists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_damages: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          photo_path: string | null
          service_order_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          photo_path?: string | null
          service_order_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          photo_path?: string | null
          service_order_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_damages_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_damages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_events: {
        Row: {
          created_at: string
          from_status: string | null
          id: string
          reason: string | null
          service_order_id: string
          tenant_id: string
          to_status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          service_order_id: string
          tenant_id: string
          to_status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          service_order_id?: string
          tenant_id?: string
          to_status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_order_events_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_followups: {
        Row: {
          category: string
          contact_date: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          notes: string | null
          responsible_id: string | null
          service_order_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          category: string
          contact_date: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          notes?: string | null
          responsible_id?: string | null
          service_order_id: string
          status?: string
          tenant_id: string
        }
        Update: {
          category?: string
          contact_date?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          notes?: string | null
          responsible_id?: string | null
          service_order_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_followups_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_followups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_items: {
        Row: {
          amount_cents: number
          approved: boolean
          catalog_item_id: string | null
          created_at: string
          created_by: string | null
          description: string
          discount_reason: string | null
          discount_requested_at: string | null
          discount_requested_by: string | null
          discount_reviewed_at: string | null
          discount_reviewed_by: string | null
          discount_status: string
          id: string
          kind: string
          quantity: number
          service_order_id: string
          table_price_cents: number | null
          tenant_id: string
          unit_price_cents: number
        }
        Insert: {
          amount_cents?: number
          approved?: boolean
          catalog_item_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          discount_reason?: string | null
          discount_requested_at?: string | null
          discount_requested_by?: string | null
          discount_reviewed_at?: string | null
          discount_reviewed_by?: string | null
          discount_status?: string
          id?: string
          kind?: string
          quantity?: number
          service_order_id: string
          table_price_cents?: number | null
          tenant_id: string
          unit_price_cents?: number
        }
        Update: {
          amount_cents?: number
          approved?: boolean
          catalog_item_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          discount_reason?: string | null
          discount_requested_at?: string | null
          discount_requested_by?: string | null
          discount_reviewed_at?: string | null
          discount_reviewed_by?: string | null
          discount_status?: string
          id?: string
          kind?: string
          quantity?: number
          service_order_id?: string
          table_price_cents?: number | null
          tenant_id?: string
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_order_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "service_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_items_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_quotes: {
        Row: {
          amount_cents: number | null
          converted_service_order_id: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          service_order_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number | null
          converted_service_order_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          service_order_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number | null
          converted_service_order_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          service_order_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_quotes_converted_service_order_id_fkey"
            columns: ["converted_service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_quotes_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_quotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_schedule_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_date: string | null
          new_shift: string | null
          previous_date: string | null
          previous_shift: string | null
          reason: string
          service_order_id: string
          tenant_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_date?: string | null
          new_shift?: string | null
          previous_date?: string | null
          previous_shift?: string | null
          reason: string
          service_order_id: string
          tenant_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_date?: string | null
          new_shift?: string | null
          previous_date?: string | null
          previous_shift?: string | null
          reason?: string
          service_order_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_schedule_history_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_schedule_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_technicians: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          service_order_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          service_order_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          service_order_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_technicians_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_technicians_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          address_cep: string | null
          address_city: string | null
          address_complement: string | null
          address_district: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          appointment_id: string | null
          closure_notes: string | null
          closure_type: string | null
          code_seq: number
          completed_at: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          confirmed_contact_name: string | null
          consultant_extra_id: string | null
          consultant_id: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          expected_receipt_cents: number | null
          geocoded_at: string | null
          has_pending_issue: boolean
          id: string
          lat: number | null
          lead_id: string
          lng: number | null
          notes: string | null
          observations: string | null
          origin_kind: string | null
          origin_service_order_id: string | null
          partner_commission_percent: number | null
          partner_extra_name: string | null
          partner_extra_percent: number | null
          partner_seller_id: string | null
          partner_seller_name: string | null
          partner_store: string | null
          partner_store_id: string | null
          partner_store_split_percent: number | null
          payment_method: string | null
          pending_issue_note: string | null
          received_cents: number
          reviewed_at: string | null
          reviewed_by: string | null
          route_position: number | null
          sale_channel: string | null
          scheduled_end_at: string | null
          scheduled_start_at: string | null
          service_date: string | null
          service_type: string
          shift: string | null
          signature_path: string | null
          signed_at: string | null
          signer_name: string | null
          status: string
          tenant_id: string
          total_cents: number
          travel_fee_cents: number
          updated_at: string
          voltage: string | null
        }
        Insert: {
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          appointment_id?: string | null
          closure_notes?: string | null
          closure_type?: string | null
          code_seq: number
          completed_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_contact_name?: string | null
          consultant_extra_id?: string | null
          consultant_id?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          expected_receipt_cents?: number | null
          geocoded_at?: string | null
          has_pending_issue?: boolean
          id?: string
          lat?: number | null
          lead_id: string
          lng?: number | null
          notes?: string | null
          observations?: string | null
          origin_kind?: string | null
          origin_service_order_id?: string | null
          partner_commission_percent?: number | null
          partner_extra_name?: string | null
          partner_extra_percent?: number | null
          partner_seller_id?: string | null
          partner_seller_name?: string | null
          partner_store?: string | null
          partner_store_id?: string | null
          partner_store_split_percent?: number | null
          payment_method?: string | null
          pending_issue_note?: string | null
          received_cents?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          route_position?: number | null
          sale_channel?: string | null
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          service_date?: string | null
          service_type?: string
          shift?: string | null
          signature_path?: string | null
          signed_at?: string | null
          signer_name?: string | null
          status?: string
          tenant_id: string
          total_cents?: number
          travel_fee_cents?: number
          updated_at?: string
          voltage?: string | null
        }
        Update: {
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          appointment_id?: string | null
          closure_notes?: string | null
          closure_type?: string | null
          code_seq?: number
          completed_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_contact_name?: string | null
          consultant_extra_id?: string | null
          consultant_id?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          expected_receipt_cents?: number | null
          geocoded_at?: string | null
          has_pending_issue?: boolean
          id?: string
          lat?: number | null
          lead_id?: string
          lng?: number | null
          notes?: string | null
          observations?: string | null
          origin_kind?: string | null
          origin_service_order_id?: string | null
          partner_commission_percent?: number | null
          partner_extra_name?: string | null
          partner_extra_percent?: number | null
          partner_seller_id?: string | null
          partner_seller_name?: string | null
          partner_store?: string | null
          partner_store_id?: string | null
          partner_store_split_percent?: number | null
          payment_method?: string | null
          pending_issue_note?: string | null
          received_cents?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          route_position?: number | null
          sale_channel?: string | null
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          service_date?: string | null
          service_type?: string
          shift?: string | null
          signature_path?: string | null
          signed_at?: string | null
          signer_name?: string | null
          status?: string
          tenant_id?: string
          total_cents?: number
          travel_fee_cents?: number
          updated_at?: string
          voltage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_origin_service_order_id_fkey"
            columns: ["origin_service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_partner_seller_id_fkey"
            columns: ["partner_seller_id"]
            isOneToOne: false
            referencedRelation: "field_service_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_partner_store_id_fkey"
            columns: ["partner_store_id"]
            isOneToOne: false
            referencedRelation: "field_service_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price_cents: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          price_cents?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_locations: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["stock_movement_kind"]
          lead_id: string | null
          location_id: string | null
          product_id: string
          quantity: number
          reason: string | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["stock_movement_kind"]
          lead_id?: string | null
          location_id?: string | null
          product_id: string
          quantity: number
          reason?: string | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["stock_movement_kind"]
          lead_id?: string | null
          location_id?: string | null
          product_id?: string
          quantity?: number
          reason?: string | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          appointment_id: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_id: string | null
          product_id: string
          quantity: number
          status: string
          tenant_id: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          product_id: string
          quantity: number
          status?: string
          tenant_id: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          product_id?: string
          quantity?: number
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_updates: {
        Row: {
          body: string | null
          created_at: string
          id: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          id: string
          kind: string
          lead_id: string | null
          notes: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
          notes?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
          notes?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_locations: {
        Row: {
          accuracy_meters: number | null
          lat: number
          lng: number
          recorded_at: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          lat: number
          lng: number
          recorded_at?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          accuracy_meters?: number | null
          lat?: number
          lng?: number
          recorded_at?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          os_only_access: boolean
          role: Database["public"]["Enums"]["member_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          os_only_access?: boolean
          role?: Database["public"]["Enums"]["member_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          os_only_access?: boolean
          role?: Database["public"]["Enums"]["member_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          brand_color: string | null
          broadcast_enabled: boolean
          calls_dashboard_enabled: boolean
          created_at: string
          email: string | null
          field_service_base_address: string | null
          field_service_base_lat: number | null
          field_service_base_lng: number | null
          field_service_enabled: boolean
          id: string
          lead_assignment_enabled: boolean
          lead_forward_user_id: string | null
          logo_url: string | null
          meta_ad_account_id: string | null
          meta_ads_access_token: string | null
          meta_capi_token: string | null
          meta_pixel_id: string | null
          name: string
          phone: string | null
          quick_messages_seeded_at: string | null
          satisfaction_survey_enabled: boolean
          slug: string
          stock_deduct_on_won: boolean
          stock_enabled: boolean
          tagline: string | null
          website: string | null
        }
        Insert: {
          brand_color?: string | null
          broadcast_enabled?: boolean
          calls_dashboard_enabled?: boolean
          created_at?: string
          email?: string | null
          field_service_base_address?: string | null
          field_service_base_lat?: number | null
          field_service_base_lng?: number | null
          field_service_enabled?: boolean
          id?: string
          lead_assignment_enabled?: boolean
          lead_forward_user_id?: string | null
          logo_url?: string | null
          meta_ad_account_id?: string | null
          meta_ads_access_token?: string | null
          meta_capi_token?: string | null
          meta_pixel_id?: string | null
          name: string
          phone?: string | null
          quick_messages_seeded_at?: string | null
          satisfaction_survey_enabled?: boolean
          slug: string
          stock_deduct_on_won?: boolean
          stock_enabled?: boolean
          tagline?: string | null
          website?: string | null
        }
        Update: {
          brand_color?: string | null
          broadcast_enabled?: boolean
          calls_dashboard_enabled?: boolean
          created_at?: string
          email?: string | null
          field_service_base_address?: string | null
          field_service_base_lat?: number | null
          field_service_base_lng?: number | null
          field_service_enabled?: boolean
          id?: string
          lead_assignment_enabled?: boolean
          lead_forward_user_id?: string | null
          logo_url?: string | null
          meta_ad_account_id?: string | null
          meta_ads_access_token?: string | null
          meta_capi_token?: string | null
          meta_pixel_id?: string | null
          name?: string
          phone?: string | null
          quick_messages_seeded_at?: string | null
          satisfaction_survey_enabled?: boolean
          slug?: string
          stock_deduct_on_won?: boolean
          stock_enabled?: boolean
          tagline?: string | null
          website?: string | null
        }
        Relationships: []
      }
      whatsapp_accounts: {
        Row: {
          assigned_to: string | null
          consecutive_health_failures: number
          created_at: string
          credentials: Json
          display_name: string | null
          health_status: "healthy" | "warning" | "offline"
          id: string
          is_active: boolean
          last_error_message: string | null
          last_health_check_at: string | null
          last_heartbeat_at: string | null
          phone_number: string
          provider: Database["public"]["Enums"]["whatsapp_provider"]
          shared_with_all: boolean
          tenant_id: string
          webhook_secret: string | null
        }
        Insert: {
          assigned_to?: string | null
          consecutive_health_failures?: number
          created_at?: string
          credentials?: Json
          display_name?: string | null
          health_status?: "healthy" | "warning" | "offline"
          id?: string
          is_active?: boolean
          last_error_message?: string | null
          last_health_check_at?: string | null
          last_heartbeat_at?: string | null
          phone_number: string
          provider: Database["public"]["Enums"]["whatsapp_provider"]
          shared_with_all?: boolean
          tenant_id: string
          webhook_secret?: string | null
        }
        Update: {
          assigned_to?: string | null
          consecutive_health_failures?: number
          created_at?: string
          credentials?: Json
          display_name?: string | null
          health_status?: "healthy" | "warning" | "offline"
          id?: string
          is_active?: boolean
          last_error_message?: string | null
          last_health_check_at?: string | null
          last_heartbeat_at?: string | null
          phone_number?: string
          provider?: Database["public"]["Enums"]["whatsapp_provider"]
          shared_with_all?: boolean
          tenant_id?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_group_label_assignments: {
        Row: {
          created_at: string
          group_id: string
          label_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          label_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          label_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_group_label_assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_group_label_assignments_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_group_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_group_label_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_group_labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_group_labels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          last_event_at: string | null
          last_event_type: string | null
          last_message_at: string | null
          last_message_body: string | null
          last_message_direction: string | null
          owner_jid: string | null
          participant_count: number | null
          provider_group_id: string
          raw_payload: Json
          subject: string
          tenant_id: string
          unread_count: number
          updated_at: string
          whatsapp_account_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          last_event_at?: string | null
          last_event_type?: string | null
          last_message_at?: string | null
          last_message_body?: string | null
          last_message_direction?: string | null
          owner_jid?: string | null
          participant_count?: number | null
          provider_group_id: string
          raw_payload?: Json
          subject: string
          tenant_id: string
          unread_count?: number
          updated_at?: string
          whatsapp_account_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          last_event_at?: string | null
          last_event_type?: string | null
          last_message_at?: string | null
          last_message_body?: string | null
          last_message_direction?: string | null
          owner_jid?: string | null
          participant_count?: number | null
          provider_group_id?: string
          raw_payload?: Json
          subject?: string
          tenant_id?: string
          unread_count?: number
          updated_at?: string
          whatsapp_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_groups_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_logs: {
        Row: {
          contact_lid: string | null
          contact_phone: string | null
          created_at: string
          event_type: string | null
          from_me: boolean | null
          id: string
          parsed_count: number
          payload: Json
          tenant_id: string
          whatsapp_account_id: string | null
        }
        Insert: {
          contact_lid?: string | null
          contact_phone?: string | null
          created_at?: string
          event_type?: string | null
          from_me?: boolean | null
          id?: string
          parsed_count?: number
          payload: Json
          tenant_id: string
          whatsapp_account_id?: string | null
        }
        Update: {
          contact_lid?: string | null
          contact_phone?: string | null
          created_at?: string
          event_type?: string | null
          from_me?: boolean | null
          id?: string
          parsed_count?: number
          payload?: Json
          tenant_id?: string
          whatsapp_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_webhook_logs_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_financial_adjustment: {
        Args: { p_request_id: string; p_user_id: string }
        Returns: undefined
      }
      attendant_sla_metrics: {
        Args: { p_from: string; p_tenant_id: string; p_to: string }
        Returns: {
          avg_response_seconds: number
          conversations: number
          median_response_seconds: number
          messages_sent: number
          responses: number
          slowest_response_seconds: number
          user_id: string
        }[]
      }
      bill_service_order: {
        Args: { p_service_order_id: string; p_user_id: string }
        Returns: undefined
      }
      can_view_service_order: { Args: { p_order_id: string }; Returns: boolean }
      cancel_service_order_closure: {
        Args: {
          p_reason: string
          p_service_order_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      close_service_order: {
        Args: {
          p_answers: Json
          p_closure_type: string
          p_observations?: string
          p_quote_description?: string
          p_service_order_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      compute_service_order_commissions: {
        Args: { p_service_order_id: string }
        Returns: {
          out_amount_cents: number
          out_base_cents: number
          out_partner_id: string
          out_partner_name: string
          out_partner_store: string
          out_party_kind: string
          out_percent: number
          out_user_id: string
        }[]
      }
      convert_service_order_quote: {
        Args: { p_quote_id: string; p_user_id: string }
        Returns: string
      }
      dashboard_stage_counts: {
        Args: { p_tenant_id: string }
        Returns: {
          lead_count: number
          stage_id: string
        }[]
      }
      funnel_metrics: {
        Args: {
          p_from?: string
          p_pipeline_id?: string
          p_tenant_id: string
          p_to?: string
        }
        Returns: {
          avg_seconds: number
          is_lost: boolean
          is_won: boolean
          lead_count: number
          stage_color: string
          stage_id: string
          stage_name: string
          stage_position: number
          value_cents: number
        }[]
      }
      has_tenant_role: {
        Args: { roles: Database["public"]["Enums"]["member_role"][]; t: string }
        Returns: boolean
      }
      is_service_order_technician: {
        Args: { p_order_id: string; p_user_id: string }
        Returns: boolean
      }
      is_tenant_member: { Args: { t: string }; Returns: boolean }
      lead_qualification_summary: {
        Args: {
          p_from?: string
          p_stage_ids?: string[]
          p_tenant_id: string
          p_to?: string
        }
        Returns: {
          lead_count: number
          quality_stars: number
          stage_id: string | null
          value_cents_sum: number
        }[]
      }
      list_chat_conversations: {
        Args: {
          p_limit?: number
          p_search?: string
          p_status?: string
          p_tenant_id: string
        }
        Returns: {
          channel: string
          id: string
          last_body: string
          last_direction: string
          last_message_at: string
          lead_custom_fields: Json
          lead_id: string
          lead_name: string
          lead_phone: string
          lead_quality_stars: number
          lead_stage_id: string
          lead_tags: string[]
          lead_whatsapp_lid: string
          status: string
          unread_count: number
          whatsapp_account_id: string
        }[]
      }
      produce_product: {
        Args: {
          p_location_id: string
          p_product_id: string
          p_quantity: number
          p_tenant_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      rebuild_service_order_receivables: {
        Args: { p_service_order_id: string; p_user_id: string }
        Returns: undefined
      }
      seed_megas_perini_defaults: {
        Args: { target_tenant_id: string }
        Returns: undefined
      }
      transfer_stock: {
        Args: {
          p_from_location_id: string
          p_product_id: string
          p_quantity: number
          p_reason?: string
          p_tenant_id: string
          p_to_location_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      user_tenant_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      campaign_message_mode: "template" | "text" | "quick_message"
      campaign_recipient_status: "pending" | "sent" | "failed" | "skipped"
      campaign_status:
        | "draft"
        | "scheduled"
        | "running"
        | "completed"
        | "cancelled"
        | "failed"
      conversation_status:
        | "nao_iniciada"
        | "aguardando"
        | "em_atendimento"
        | "resolvida"
      field_service_partner_kind: "loja" | "vendedor"
      member_role:
        | "owner"
        | "admin"
        | "vendedor"
        | "gerente"
        | "atendente"
        | "tecnico"
      message_direction: "inbound" | "outbound"
      message_status: "pending" | "sent" | "delivered" | "read" | "failed"
      stock_movement_kind: "in" | "out" | "adjust"
      whatsapp_provider: "cloud_api" | "evolution" | "zapi"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      campaign_message_mode: ["template", "text", "quick_message"],
      campaign_recipient_status: ["pending", "sent", "failed", "skipped"],
      campaign_status: [
        "draft",
        "scheduled",
        "running",
        "completed",
        "cancelled",
        "failed",
      ],
      conversation_status: [
        "nao_iniciada",
        "aguardando",
        "em_atendimento",
        "resolvida",
      ],
      field_service_partner_kind: ["loja", "vendedor"],
      member_role: [
        "owner",
        "admin",
        "vendedor",
        "gerente",
        "atendente",
        "tecnico",
      ],
      message_direction: ["inbound", "outbound"],
      message_status: ["pending", "sent", "delivered", "read", "failed"],
      stock_movement_kind: ["in", "out", "adjust"],
      whatsapp_provider: ["cloud_api", "evolution", "zapi"],
    },
  },
} as const

// ---------------------------------------------------------------------------
// Aliases de conveniencia. Nomes e formato identicos ao arquivo anterior, pra
// nenhum import existente quebrar - so a origem do tipo mudou: agora vem do
// schema real (Database) em vez de interface escrita a mao, sujeita a divergir.
// ---------------------------------------------------------------------------

/**
 * Restaura o literal-union num campo que no banco e so `text` com CHECK, nao
 * um enum de verdade - o gerador do Supabase nao consegue ler CHECK e devolve
 * `string`. Os valores aqui sao os mesmos hand-written de sempre, so que agora
 * aplicados sobre a Row real (que ja tem todos os outros campos corretos e
 * completos), em vez de reescrever a interface inteira a mao.
 */
type WithLiteral<Row, Overrides extends Partial<Record<keyof Row, unknown>>> = Omit<Row, keyof Overrides> &
  Overrides;

export type MemberRole = Database["public"]["Enums"]["member_role"];
export type WhatsAppProviderKind = Database["public"]["Enums"]["whatsapp_provider"];
export type MessageDirection = Database["public"]["Enums"]["message_direction"];
export type MessageStatus = Database["public"]["Enums"]["message_status"];
export type StockMovementKind = Database["public"]["Enums"]["stock_movement_kind"];

export type TaskStatus = "open" | "done" | "cancelled";

export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";

export type StockReservationStatus = "active" | "released" | "consumed";
export type CampaignStatus = Database["public"]["Enums"]["campaign_status"];
export type CampaignMessageMode = Database["public"]["Enums"]["campaign_message_mode"];
export type CampaignRecipientStatus = Database["public"]["Enums"]["campaign_recipient_status"];
export type MessageTemplate = Database["public"]["Tables"]["message_templates"]["Row"];
export type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
export type CampaignRecipient = Database["public"]["Tables"]["campaign_recipients"]["Row"];

export type ServiceOrderStatus =
  | "rascunho"
  | "agendada"
  | "em_execucao"
  | "concluida"
  | "conferida"
  | "faturada"
  | "cancelada"
  | "remarcada"
  | "assistencia";

export type ServiceOrderShift = "manha" | "tarde";

export type ServiceOrderItemKind = "original" | "upsell";

export type ServiceOrderType = "normal" | "assistencia";

export type ServiceOrderClosureType = "finalizado" | "finalizado_orcamento" | "assistencia";

/** Ultima posicao conhecida do tecnico. Nao guarda trajeto, so a atual. */
export type TechnicianLocation = Database["public"]["Tables"]["technician_locations"]["Row"];
export type ServiceOrder = WithLiteral<
  Database["public"]["Tables"]["service_orders"]["Row"],
  {
    status: ServiceOrderStatus;
    shift: ServiceOrderShift | null;
    voltage: "110v" | "220v" | null;
    service_type: ServiceOrderType;
    closure_type: ServiceOrderClosureType | null;
  }
>;
export type ServiceOrderItem = WithLiteral<
  Database["public"]["Tables"]["service_order_items"]["Row"],
  { kind: ServiceOrderItemKind }
>;
export type ServiceOrderTechnician = Database["public"]["Tables"]["service_order_technicians"]["Row"];
export type ServiceOrderDamage = Database["public"]["Tables"]["service_order_damages"]["Row"];
export type ServiceOrderEvent = Database["public"]["Tables"]["service_order_events"]["Row"];
export type ServiceOrderChecklist = Database["public"]["Tables"]["service_order_checklists"]["Row"];
export type ServiceOrderQuote = Database["public"]["Tables"]["service_order_quotes"]["Row"];
export type ServiceOrderScheduleHistory = Database["public"]["Tables"]["service_order_schedule_history"]["Row"];
export type PaymentMethodRate = Database["public"]["Tables"]["payment_method_rates"]["Row"];

export type ServiceCatalogCategory =
  | "lavagem"
  | "impermeabilizacao"
  | "couro"
  | "outro";
export type ServiceCatalogItem = WithLiteral<
  Database["public"]["Tables"]["service_catalog_items"]["Row"],
  { category: ServiceCatalogCategory }
>;
export type FinancialAdjustmentRequest = Database["public"]["Tables"]["financial_adjustment_requests"]["Row"];

export type FieldServicePartnerKind = "loja" | "vendedor";
export type FieldServicePartner = Database["public"]["Tables"]["field_service_partners"]["Row"];

export type FinanceEntryKind = "pagar" | "receber";

export type FinanceEntryStatus = "aberta" | "paga" | "cancelada";

export type CommissionStatus = "prevista" | "aprovada" | "paga";

export type CommissionParty = "tecnico" | "vendedora_interna" | "loja_parceira" | "vendedor_externo";
export type FinanceEntry = WithLiteral<
  Database["public"]["Tables"]["finance_entries"]["Row"],
  { kind: FinanceEntryKind; status: FinanceEntryStatus }
>;
export type CommissionRule = Database["public"]["Tables"]["commission_rules"]["Row"];
export type AdCreativeSignature = Database["public"]["Tables"]["ad_creative_signatures"]["Row"];
export type Commission = WithLiteral<
  Database["public"]["Tables"]["commissions"]["Row"],
  { party_kind: CommissionParty; status: CommissionStatus }
>;
export type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
export type QuickMessage = Database["public"]["Tables"]["quick_messages"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type SystemUpdate = Database["public"]["Tables"]["system_updates"]["Row"];
export type LeadIntakeKey = Database["public"]["Tables"]["lead_intake_keys"]["Row"];
export type ApiKey = Database["public"]["Tables"]["api_keys"]["Row"];
export type ApiWebhook = Database["public"]["Tables"]["api_webhooks"]["Row"];
export type ApiWebhookDelivery = Database["public"]["Tables"]["api_webhook_deliveries"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type TenantMember = Database["public"]["Tables"]["tenant_members"]["Row"];
export type Pipeline = Database["public"]["Tables"]["pipelines"]["Row"];
export type PipelineStage = Database["public"]["Tables"]["pipeline_stages"]["Row"];
export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type LeadActivity = Database["public"]["Tables"]["lead_activities"]["Row"];
export type WhatsAppAccount = Database["public"]["Tables"]["whatsapp_accounts"]["Row"];
export type WhatsAppGroup = Database["public"]["Tables"]["whatsapp_groups"]["Row"];
export type WhatsAppGroupLabel = Database["public"]["Tables"]["whatsapp_group_labels"]["Row"];
export type WhatsAppGroupLabelAssignment = Database["public"]["Tables"]["whatsapp_group_label_assignments"]["Row"];
export type ConversationStatus = Database["public"]["Enums"]["conversation_status"];
export type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type FileRow = Database["public"]["Tables"]["files"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type StockMovement = Database["public"]["Tables"]["stock_movements"]["Row"];
export type StockLocation = Database["public"]["Tables"]["stock_locations"]["Row"];
export type ProductStock = Database["public"]["Tables"]["product_stock"]["Row"];
export type ProductRecipeItem = Database["public"]["Tables"]["product_recipe_items"]["Row"];
export type AttendantStatus = Database["public"]["Tables"]["attendant_status"]["Row"];
export type LeadAssignmentHistory = Database["public"]["Tables"]["lead_assignment_history"]["Row"];
export type CustomFieldType = "text" | "number" | "date" | "select" | "boolean" | "file";
export type CustomFieldDefinition = WithLiteral<
  Database["public"]["Tables"]["custom_field_definitions"]["Row"],
  { field_type: CustomFieldType }
>;
export type Task = WithLiteral<Database["public"]["Tables"]["tasks"]["Row"], { status: TaskStatus }>;
export type Professional = Database["public"]["Tables"]["professionals"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type Appointment = WithLiteral<
  Database["public"]["Tables"]["appointments"]["Row"],
  { status: AppointmentStatus }
>;
export type StockReservation = WithLiteral<
  Database["public"]["Tables"]["stock_reservations"]["Row"],
  { status: StockReservationStatus }
>;
