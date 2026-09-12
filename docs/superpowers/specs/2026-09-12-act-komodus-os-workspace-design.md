# ACT — Redesenho do módulo de Ordens de Serviço

**Data:** 2026-09-12  
**Status:** aprovado para planejamento  
**Escopo:** todo o módulo de OS, disponível exclusivamente para o tenant ACT

## Objetivo

Substituir a experiência administrativa atual de Ordens de Serviço por um fluxo operacional próximo ao Komodus, sistema já conhecido pela administradora da ACT. A interface deve preservar a identidade visual do CRM W+, mas adotar a densidade, a organização e a velocidade de consulta do sistema de referência.

O resultado deve permitir que a administradora trabalhe sem alternar entre várias telas para consultar agenda, cliente, atendimento, peças, valores, comissões, confirmação e histórico.

## Princípios

- O módulo de OS pertence somente ao tenant ACT; não será criada uma variação paralela para outros tenants.
- A familiaridade operacional tem prioridade sobre uma reformulação estética ampla.
- A tela principal de uma OS deve ser compacta e mostrar todas as informações importantes de uma vez.
- A agenda completa continua sendo uma tela separada, otimizada para distribuir serviços entre técnicos.
- A identidade CRM W+ permanece em tipografia, componentes, estados, navegação e acabamento.
- Dados já existentes e regras atuais serão reaproveitados; não haverá duplicação desnecessária do domínio de OS.

## Arquitetura de navegação

O módulo terá quatro superfícies principais:

1. **Lista operacional de OS** — busca, filtros, status e ações rápidas.
2. **Agenda completa** — grade diária por técnico e horário.
3. **Workspace compacto da OS** — operação administrativa completa em uma tela.
4. **Impressão operacional** — ficha condensada para execução em campo e conferência.

Ao abrir uma OS pela lista ou pela agenda, o usuário entra no workspace compacto. A agenda completa permanece acessível por uma ação fixa no cabeçalho.

## Agenda completa

### Estrutura

- Data selecionada no cabeçalho, com navegação para dia anterior, hoje e próximo dia.
- Horários na vertical, cobrindo o expediente configurado.
- Uma coluna por técnico.
- Cabeçalhos e eixo de horários fixos durante a rolagem.
- Blocos posicionados de acordo com início, fim e técnico responsável.
- Tratamento visual de sobreposição quando um técnico possui mais de um compromisso no mesmo intervalo.

### Cores

- Verde: OS agendada e em situação operacional normal.
- Laranja: remarcada ou aguardando ajuste de agenda.
- Vermelho: pendência crítica ou impedimento.
- Cinza: cancelada.
- Roxo: serviço em execução.

As cores devem funcionar como leitura rápida, sem depender somente delas: cada bloco também exibe texto ou ícone de estado.

### Conteúdo do bloco

O bloco mostra, conforme o espaço disponível:

- horário;
- cidade/bairro;
- cliente;
- serviço resumido;
- situação de confirmação.

Ao passar o cursor ou selecionar o bloco, uma ficha rápida mostra:

- serviço e peças;
- cliente, telefone e endereço;
- loja/parceiro;
- vendedor/consultor;
- pagamento e valor;
- contato e data da confirmação;
- criador, última edição e respectivos horários;
- observações;
- início e fim.

O clique principal abre o workspace compacto da OS.

## Workspace compacto da OS

### Layout

Em desktop, a tela usa três regiões:

- **Coluna esquerda:** miniagenda do dia, agrupada ou filtrada por técnico, permitindo alternar rapidamente entre OS.
- **Centro:** dados do cliente, agendamento/próximo contato, serviço, peças, negociação, observações e registros.
- **Coluna direita:** situação, confirmação, parceiro, responsáveis, pagamento, valores, recebimento e comissões.

O cabeçalho exibe número da OS, status, cliente, técnico, data/horário e ações principais. As ações de gravar, imprimir, remarcar, finalizar, reabrir e cancelar ficam sempre acessíveis.

Em telas menores, as três regiões passam para uma sequência vertical sem esconder informações nem depender de abas profundas.

### Seções centrais

1. **Cliente** — nome, documento quando existente, telefones, endereço, cidade e origem.
2. **Agendamento** — categoria, responsável, início, fim, confirmação e descrição.
3. **Serviços e peças** — código, descrição, quantidade, valor unitário, desconto e total.
4. **Negociação** — observações comerciais e itens adicionais.
5. **Execução** — laudo, ocorrências, checklist e registros operacionais.
6. **Auditoria** — criação, alterações e responsáveis.

### Painel financeiro

- loja/parceiro e parceiro extra;
- consultor e consultor extra;
- técnico e técnico extra;
- forma de pagamento;
- base de serviço e deslocamento;
- subtotais por categoria de serviço;
- desconto, valor previsto, recebido e saldo;
- percentuais e valores de comissão;
- ajuste de comissão com registro de auditoria.

Os cálculos continuam vindo das regras do sistema. A interface não introduzirá valores estimados ou inventados.

### Ações administrativas

- confirmar atendimento;
- remarcar;
- iniciar e finalizar;
- reabrir uma OS finalizada;
- cancelar uma OS;
- ajustar comissão;
- imprimir ficha;
- exportar dados disponíveis em formato útil;
- editar campos permitidos sem sair do workspace.

Ações irreversíveis ou sensíveis exigem confirmação clara e mantêm registro de autoria e horário.

## Lista operacional

A lista continuará oferecendo busca e filtros, mas terá densidade semelhante à referência. Deve exibir os campos essenciais para decisão rápida: horário, cliente, técnico, cidade, serviço, confirmação, status e valor.

O menu contextual reúne ações compatíveis com o estado da OS, incluindo abrir, imprimir, remarcar, finalizar, reabrir, cancelar e ajustar comissão. Exportações serão oferecidas somente nos formatos realmente mantidos pelo CRM.

## Impressão

A ficha impressa será condensada e preparada para papel, com:

- identificação da ACT;
- parceiro, técnico e consultor;
- cliente, telefone e endereço;
- peças e serviços;
- preços por categoria;
- valor inicial, desconto e valor final;
- pagamento;
- observações e conferência;
- data e horário de início/fim;
- confirmação e auditoria essenciais.

O formato deve favorecer a impressão de múltiplas OS por página quando o conteúdo permitir, sem cortar textos críticos.

## Dados e integração

A implementação reaproveitará as tabelas, consultas e componentes existentes para ordens, agenda, itens, responsáveis, parceiros, pagamentos, comissões, registros e acompanhamentos. Mudanças de banco serão limitadas a lacunas comprovadas durante a implementação e entregues por migração versionada.

O acesso permanece protegido pelas regras de tenant e permissões existentes. Como o módulo é exclusivo da ACT, sua navegação e suas rotas não devem aparecer para outros tenants.

## Desempenho

- Alternar datas ou técnicos não deve deslocar a estrutura principal da página.
- A agenda deve evitar recarregamentos completos desnecessários.
- Fichas rápidas não devem disparar uma consulta nova a cada movimento do cursor.
- Alterações devem atualizar somente as áreas afetadas sempre que possível.
- Estados de carregamento preservam a geometria da tela para impedir saltos visuais.

## Acessibilidade e segurança operacional

- Estados possuem rótulo textual além da cor.
- Controles podem ser usados por teclado.
- Foco e confirmação são visíveis em ações críticas.
- Valores monetários e datas seguem o padrão brasileiro.
- Operações administrativas são registradas com usuário e horário.

## Critérios de aceite

1. A administradora da ACT consegue visualizar a agenda diária completa por técnico e horário.
2. Uma OS normal aparece em verde; remarcadas, críticas, canceladas e em execução são distinguíveis.
3. A ficha rápida da agenda contém os dados operacionais presentes na referência, quando cadastrados.
4. A abertura de uma OS apresenta agenda, cliente, serviço, peças, observações, valores, pagamento e comissões em uma única tela desktop.
5. É possível navegar entre OS do mesmo dia sem retornar à lista.
6. As ações administrativas respeitam status, confirmação e auditoria.
7. A impressão gera uma ficha compacta e legível.
8. O módulo mantém o acabamento e os componentes visuais do CRM W+.
9. O módulo e sua navegação não ficam disponíveis para tenants diferentes da ACT.
10. Testes automatizados, verificação de tipos, build e validação visual em navegador são concluídos antes do deploy.

## Fora do escopo

- Copiar marca, código ou elementos proprietários do Komodus.
- Alterar o módulo comercial que já atende ao tenant.
- Disponibilizar o módulo de OS para outros tenants.
- Criar dados operacionais ausentes apenas para preencher a interface.
