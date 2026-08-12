# Metricas de leads e funil de ligacoes

## Objetivo

Corrigir os indicadores de qualificacao e ligacoes que hoje apresentam valores enganosos ou zerados e ampliar a pagina de Leads com um resumo operacional do periodo filtrado.

## Escopo

### Distribuicao de estrelas no dashboard

- Manter o periodo do cartao baseado na data de entrada do lead.
- Exibir separadamente total de leads, quantidade avaliada e quantidade sem avaliacao.
- Calcular a media somente entre leads com uma a cinco estrelas.
- Categorias com zero leads devem ter barra com largura zero, sem preenchimento visual minimo.

### Funil de ligacoes

O funil deixa de depender de resultados manuais que atualmente nao possuem interface de preenchimento. Os numeros passam a ser derivados de dados observaveis do CRM no periodo selecionado:

- **Ligacoes feitas:** total de chamadas do tenant no periodo.
- **Passou valor:** quantidade de leads distintos presentes nas chamadas do periodo com `value_cents > 0`.
- **Qualificado:** quantidade de leads distintos presentes nas chamadas do periodo com a tag `qualificado`, ignorando caixa e espacos externos.
- **Fechado:** quantidade de leads distintos presentes nas chamadas do periodo cuja etapa atual esteja marcada como ganha (`is_won`).

As porcentagens usam o total de ligacoes como denominador, preservando o rotulo atual do primeiro passo. Um mesmo lead nunca e contado mais de uma vez em cada etapa derivada.

### Resumo operacional na pagina de Leads

O resumo acompanha os filtros de entrada e etapa aplicados na pagina e sempre considera todos os resultados filtrados, nao apenas os 50 registros da pagina atual.

O resumo apresenta:

- numero total de leads do periodo;
- tempo medio da primeira resposta, medido da primeira mensagem recebida ate a primeira mensagem enviada na conversa;
- quantidade e porcentagem dos leads em cada etapa atual;
- distribuicao de qualificacao entre uma e cinco estrelas e sem avaliacao;
- quantidade avaliada e media das estrelas;
- cartao de MQL com estado `Definicao pendente`, sem inventar uma regra ate o processo comercial ser confirmado.

O exemplo de leitura por etapa sera: se 30 leads entraram no periodo, cada etapa mostra quantos desses 30 permanecem nela e qual porcentagem representam.

### Tabela e totais

- Adicionar a coluna **Qualificacao** com a nota de zero a cinco estrelas em modo somente leitura.
- Manter a paginacao atual.
- Adicionar um rodape de totais referente a todos os resultados filtrados com:
  - total de leads;
  - soma de `value_cents`;
  - quantidade de leads avaliados;
  - media das estrelas avaliadas.

## Arquitetura e dados

- Calculos puros e formatacao ficam em um modulo pequeno e testavel em `lib/leads`.
- A pagina de Leads busca agregados separados da consulta paginada para impedir que os totais sejam limitados a 50 registros.
- Consultas devem sempre aplicar `tenant_id`, intervalo de entrada e etapas selecionadas.
- O tempo de resposta sera calculado no banco por uma funcao SQL tenant-scoped para evitar carregar o historico completo de mensagens no servidor Next.js.
- O componente visual de resumo recebe dados prontos e nao refaz regras de negocio no cliente.

## Tratamento de casos extremos

- Periodo sem leads: contagens e valores ficam em zero; percentuais e media nao produzem `NaN`.
- Leads sem etapa aparecem como **Sem etapa**.
- Leads sem estrelas entram apenas em **Sem avaliacao**.
- Conversas sem resposta nao entram na media de tempo de resposta, mas a interface informa quantos leads tiveram resposta medida.
- Chamadas sem `lead_id` entram em **Ligacoes feitas**, mas nao nas etapas derivadas.

## Testes e validacao

- Testes unitarios cobrem distribuicao de estrelas, barras zeradas, deduplicacao do funil, tag com variacao de caixa/espacos, etapa ganha, distribuicao por etapa e totais.
- Teste da funcao SQL documenta o intervalo e o isolamento por tenant por meio da definicao da migration.
- Validacao final obrigatoria: testes completos, TypeScript, lint disponivel e build de producao.

## Fora do escopo

- Definir o criterio de MQL.
- Alterar a estrutura do pipeline do cliente.
- Criar edicao de estrelas diretamente na tabela de Leads.
- Mudar a integracao com a Api4com.
