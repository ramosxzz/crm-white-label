-- Atribuicao de anuncio por assinatura na primeira mensagem.
--
-- Contexto: quem usa Evolution API (WhatsApp nao-oficial) nao recebe o
-- referral do Click-to-WhatsApp, entao `custom_fields.meta_ad_id` fica vazio e
-- o painel de vendas por criativo nao enche. A saida usada na pratica e por um
-- emoji distinto no texto de abertura de cada criativo; esta tabela guarda o
-- de/para desse emoji para o criativo.
--
-- `match_text` existe porque emoji sozinho nao basta: ja houve caso do mesmo
-- emoji em dois criativos (uma cidade em cada). Quando preenchido, o texto
-- tambem precisa bater, e a regra com texto ganha da regra so de emoji.

create table public.ad_creative_signatures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  emoji text not null,
  match_text text,
  creative_name text not null,
  ad_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_creative_signatures_emoji_not_blank check (btrim(emoji) <> ''),
  constraint ad_creative_signatures_name_not_blank check (btrim(creative_name) <> '')
);

-- Duas regras iguais de emoji + texto se anulariam: qual delas venceria seria
-- indeterminado, e a atribuicao ficaria instavel entre uma mensagem e outra.
create unique index ad_creative_signatures_unique
  on public.ad_creative_signatures (tenant_id, emoji, coalesce(btrim(lower(match_text)), ''));

create index ad_creative_signatures_tenant_active
  on public.ad_creative_signatures (tenant_id) where active;

alter table public.ad_creative_signatures enable row level security;

-- Mesma regra de canManageCompanySettings na aplicacao. Se divergir, o banco
-- deixa passar o que a tela recusa - ou o contrario, e a tela quebra sem
-- explicacao.
create policy "ad_creative_signatures_manage" on public.ad_creative_signatures
  for all using (
    public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[])
  )
  with check (
    public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[])
  );
