# Meta App Review - roteiro operacional

Este roteiro deve ser executado com dados de teste e com uma conta WhatsApp Business controlada
pela equipe. Nao inclua tokens, segredos do app, senhas ou dados reais de clientes nas gravacoes.

## Pre-requisitos

- A verificacao de Provedor de Tecnologia deve estar aprovada ou em condicao aceita pela Meta.
- O usuario que grava precisa administrar o portfolio empresarial, a WABA e o numero de teste.
- O dominio `crm.solairew.com.br` deve estar autorizado no app da Meta.
- O Cadastro Incorporado precisa estar configurado com o Configuration ID de producao.
- A conta de demonstracao do CRM precisa estar isolada e conter somente dados ficticios.

## Chamadas obrigatorias da API

Use um token temporario gerado para o app `Solaire W+ CRM`, com as permissoes solicitadas.

1. `whatsapp_business_management`
   - Consultar a WABA ou o numero conectado e exibir nome, telefone e identificador.
2. `whatsapp_business_messaging`
   - Enviar o modelo `hello_world` do numero de teste para um telefone autorizado.
3. `business_management`
   - Consultar o portfolio empresarial ou listar a WABA atribuida ao usuario de teste.

Depois de respostas bem-sucedidas, aguarde ate 24 horas para a Meta atualizar o contador do teste.

## Video 1 - whatsapp_business_management

Duracao recomendada: 60 a 90 segundos.

1. Mostrar a URL `crm.solairew.com.br` e entrar na conta de demonstracao.
2. Abrir **Integracoes > WhatsApp**.
3. Mostrar que ainda nao existe conexao configurada.
4. Clicar em **Conectar WhatsApp com Facebook**.
5. No Cadastro Incorporado, selecionar o portfolio empresarial, a WABA e o numero de teste.
6. Autorizar apenas os ativos controlados pela equipe.
7. Voltar automaticamente ao CRM.
8. Mostrar a conexao criada com o nome e o telefone da conta.
9. Explicar na narracao que o CRM usa a permissao para identificar a WABA, registrar o numero,
   assinar webhooks e consultar modelos aprovados.

## Video 2 - whatsapp_business_messaging

Duracao recomendada: 60 a 90 segundos.

1. Com a conexao oficial ativa, abrir **Conversas**.
2. Enviar do telefone autorizado uma mensagem para o numero de teste da Meta.
3. Mostrar a conversa chegando ao CRM e vinculada ao tenant correto.
4. Responder pelo CRM.
5. Mostrar a resposta recebida no telefone.
6. Voltar ao CRM e mostrar os estados de envio, entrega e leitura.
7. Se a janela de 24 horas estiver fechada, demonstrar o envio com um modelo aprovado.

## Qualidade das gravacoes

- Resolucao minima de 1280x720; preferir 1920x1080.
- Zoom do navegador em 100% e texto legivel.
- Sem cortes no fluxo de autorizacao ou na volta ao CRM.
- Sem outras abas, notificacoes, dados pessoais ou credenciais visiveis.
- Cursor visivel e ritmo lento o suficiente para o avaliador acompanhar.
- Arquivo MP4 com H.264 e sem musica de fundo.

## Tratamento de dados

Antes de confirmar o questionario, validar com o responsavel juridico:

- a pessoa juridica controladora dos Dados da Plataforma;
- o CNPJ que deve coincidir com a entidade verificada no portfolio da Meta;
- todos os operadores com acesso aos dados, incluindo banco, armazenamento, CDN e hospedagem;
- as respostas sobre solicitacoes de autoridades publicas e os processos internos aplicaveis.

## Conferencia final

- As descricoes das permissoes correspondem exatamente ao que aparece nos videos.
- Cada permissao possui uma gravacao anexada.
- Os contadores das chamadas obrigatorias estao completos.
- As URLs de privacidade, termos e exclusao de dados estao publicas.
- As credenciais do avaliador funcionam e nao exigem autenticacao em dois fatores.
- O questionario de tratamento de dados foi revisado pelo responsavel.
- O envio final so deve ser confirmado depois desta conferencia.
