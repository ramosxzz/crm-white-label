-- A tela administrativa precisa receber tambem alteracoes feitas nas tabelas
-- filhas pelo app do tecnico, sem depender de F5 ou de uma mudanca de status.
do $block$
declare
  table_name text;
begin
  foreach table_name in array array[
    'service_order_items',
    'service_order_technicians',
    'service_order_checklists',
    'service_order_damages',
    'service_order_followups'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end;
$block$;
