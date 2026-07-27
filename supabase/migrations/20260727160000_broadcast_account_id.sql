-- Sessao (conta WhatsApp) escolhida pra um disparo, opcional.
alter table public.campaigns add column account_id uuid references public.whatsapp_accounts(id) on delete set null;
