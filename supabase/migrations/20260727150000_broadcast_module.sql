-- Modulo de disparo em massa (broadcast), ativavel por tenant.

alter table public.tenants add column broadcast_enabled boolean not null default false;

alter type public.campaign_message_mode add value if not exists 'quick_message';

alter table public.campaigns add column delay_seconds int not null default 10;
alter table public.campaigns add column quick_message_id uuid references public.quick_messages(id) on delete set null;
