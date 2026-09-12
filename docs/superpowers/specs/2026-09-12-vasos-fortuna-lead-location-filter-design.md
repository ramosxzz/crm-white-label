# Filtro de localização dos leads da Vasos Fortuna

## Objetivo

Adicionar à lista de Leads do tenant Vasos Fortuna uma busca por endereço ou cidade, usando o endereço que já é salvo em `custom_fields.address` no perfil do lead.

## Abordagens consideradas

1. **Busca textual única (escolhida):** um campo “Endereço ou cidade” procura o texto informado dentro do endereço completo. Funciona imediatamente com dados como “Campo Bom” e “NH”, sem migração nem interpretação insegura do endereço.
2. **Cidade estruturada em outro campo:** permitiria um seletor com cidades exatas, mas exigiria alterar o cadastro e preencher novamente os leads existentes.
3. **Filtro global para todos os tenants:** reutilizaria a interface, porém exibiria um controle vazio onde o campo de endereço não existe.

## Comportamento

- O controle aparece somente para o tenant de ID `fd0f666f-e303-4694-aa51-1190740c3d12` (Vasos Fortuna).
- O parâmetro de URL é `localizacao`.
- A busca ignora maiúsculas e minúsculas e encontra qualquer trecho do endereço, incluindo rua, bairro, cidade, sigla e CEP.
- O filtro combina com etapa, origem, responsável, tag, período, qualificação, busca geral e ordenação.
- A paginação preserva `localizacao`; limpar filtros também a remove.
- As contagens e o resumo de qualificação usam o mesmo recorte da lista.

## Dados e segurança

Não há migração nem alteração de RLS. A consulta continua limitada por `tenant_id` e pelas políticas existentes; apenas acrescenta `ilike` sobre `custom_fields->>address`.

## Testes

- Cobrir a liberação exclusiva para o tenant Vasos Fortuna.
- Cobrir normalização de espaços, valor vazio e limite de tamanho.
- Verificar a integração do parâmetro na página e no componente por teste de contrato do código-fonte.
- Executar testes completos, TypeScript e build de produção.
