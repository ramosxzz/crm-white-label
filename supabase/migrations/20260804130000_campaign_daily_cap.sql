-- Cap diario e janela de horario comercial para disparos em massa (cobranca
-- recorrente com 50-60 msgs/dia sem levar o numero a banimento).

alter table public.campaigns add column daily_cap int;
alter table public.campaigns add column business_hours_only boolean not null default true;
alter table public.campaigns add column send_hour_start int not null default 8;
alter table public.campaigns add column send_hour_end int not null default 21;
