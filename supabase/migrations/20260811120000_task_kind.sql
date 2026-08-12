-- Tarefa pode ser um "a fazer" comum ou marcar uma reuniao interna/
-- alinhamento (mesmo termo ja usado em Agenda) - fica na propria lista de
-- Tarefas, sem duplicar/sincronizar com a tabela de appointments.
alter table public.tasks
  add column kind text not null default 'task' check (kind in ('task', 'meeting'));
