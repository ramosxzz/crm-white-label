alter table public.tenants
  add column payment_overdue boolean not null default false,
  add column payment_due_at date;
