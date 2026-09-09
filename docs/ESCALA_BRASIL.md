# Plano de escala nacional

Diagnostico atualizado em 9 de setembro de 2026 para a arquitetura atual: Next.js em Docker/Caddy na VPS, Supabase em Sao Paulo, Cloudflare R2 para midias e WhatsApp por Meta Cloud API, Evolution ou Z-API.

## Estado atual

- O produto ja tem isolamento multi-tenant por RLS, deploy automatizado, healthcheck, fila de webhooks, retry/DLQ, Sentry e 199 testes automatizados.
- O banco de producao atual foi recriado ou importado e registra somente as migrations recentes. O repositorio contem o historico completo. Antes de usar `supabase db push`, e obrigatorio reconciliar a baseline para evitar reaplicar schema antigo.
- O Advisor do Supabase aponta 107 chaves estrangeiras sem indice, funcoes `security definer` expostas aos papeis da API e protecao contra senhas vazadas desativada. Os dois pares de indices duplicados encontrados na auditoria ja foram removidos.
- A VPS ainda e um ponto unico de falha para frontend, APIs e webhooks.

## Prioridade 0 - antes de acelerar vendas

1. **Baseline de migrations:** gerar um snapshot declarativo do banco de Sao Paulo, revisar a diferenca com o repositorio e marcar o historico importado sem executar novamente as migrations antigas.
2. **Backups testados:** habilitar PITR conforme o plano do Supabase e fazer um teste documentado de restauracao. Backup sem teste de restore nao e garantia de recuperacao.
3. **Seguranca:** habilitar protecao contra senhas vazadas; revisar uma a uma as funcoes `security definer`; manter tabelas exclusivamente server-side sem policies publicas e documentar essa decisao.
4. **Observabilidade operacional:** alertas para erro de webhook, crescimento da DLQ, latencia p95/p99, taxa de mensagens rejeitadas, uso de CPU/RAM/disco da VPS e falhas de deploy.
5. **Teste de carga:** medir entrada de webhooks, abertura da caixa de conversas e disparos com volumes definidos. A capacidade deve ser decidida por p95/p99, nao por sensacao na interface.

## Prioridade 1 - primeiros clientes em varias regioes

1. Separar o processamento de webhooks e automacoes do processo web em workers independentes. A API deve validar, persistir e responder rapido; trabalho pesado segue pela fila.
2. Adicionar idempotencia por evento do provedor em todos os webhooks e metricas de reprocessamento por tenant.
3. Indexar por evidencia: ativar `pg_stat_statements`, capturar as consultas mais caras e criar primeiro os indices que cobrem os caminhos de chat, leads, campanhas e agenda.
4. Definir limites por tenant: usuarios, armazenamento, importacoes, disparos simultaneos, requisicoes de API e retencao de arquivos.
5. Criar testes E2E dos fluxos de receita: login, criar lead, conversar pela Meta oficial, receber webhook, mover no funil, automacao, OS e pesquisa de satisfacao.
6. Padronizar onboarding da Meta: checklist de WABA, numero, token permanente, webhook, templates, forma de pagamento, qualidade e teste de envio/recebimento.

## Prioridade 2 - operacao nacional

1. Executar ao menos duas replicas stateless da aplicacao atras de um balanceador; workers e crons devem ter eleicao/lock para nao duplicar tarefas.
2. Preparar plano de recuperacao regional: infraestrutura como codigo, imagem versionada, secrets em cofre e procedimento para subir a aplicacao em outra VPS/regiao.
3. Implantar trilha LGPD: base legal e consentimento, politica de retencao, exportacao/exclusao por titular, registro de operadores e resposta a incidentes.
4. Criar painel de SLO por tenant: disponibilidade, atraso de webhook, entrega de mensagem, tempo de primeira resposta e incidentes.
5. So considerar particionamento ou separacao de banco quando metricas mostrarem necessidade. O primeiro ganho normalmente vem de consultas, indices, fila e cache bem definidos.

## Metas tecnicas sugeridas

| Indicador | Meta inicial |
|---|---:|
| Disponibilidade mensal | 99,9% |
| Resposta do webhook p95 | menor que 500 ms |
| Evento persistido para visivel no chat p95 | menor que 2 s |
| Erros 5xx | menor que 0,1% |
| Itens parados na DLQ | 0 sem alerta |
| Restauracao testada | trimestral |
| Deploy com rollback praticado | mensal |

## Regra de evolucao

Cada aumento de capacidade deve partir de uma medicao reproduzivel, ter limite por tenant e incluir rollback. Nao e necessario trocar Supabase ou abandonar a VPS imediatamente; a prioridade e remover pontos unicos de falha, desacoplar trabalho assincrono e provar recuperacao.
