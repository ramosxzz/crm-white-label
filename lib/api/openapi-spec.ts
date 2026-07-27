export type ApiDocEndpoint = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  title: string;
  description: string;
  scope: string | null;
  curl: string;
  response: string;
};

export type ApiDocSection = {
  id: string;
  title: string;
  endpoints: ApiDocEndpoint[];
};

const BASE = "https://SEU_DOMINIO/api/v1";

export const API_DOC_SECTIONS: ApiDocSection[] = [
  {
    id: "leads",
    title: "Leads",
    endpoints: [
      {
        method: "GET",
        path: "/leads",
        title: "Listar leads",
        description:
          "Lista leads do seu tenant, paginado (50 por pagina). Filtros opcionais: stage_id, pipeline_id, source, created_after (ISO 8601), page.",
        scope: "leads:read",
        curl: `curl -H "Authorization: Bearer sk_live_..." "${BASE}/leads?stage_id=..."`,
        response: `{
  "data": [
    { "id": "...", "name": "Joao Silva", "phone": "+5511999999999", "stage_id": "...", "value_cents": 12000, "created_at": "..." }
  ],
  "pagination": { "page": 1, "page_size": 50, "total": 132, "total_pages": 3 }
}`,
      },
      {
        method: "POST",
        path: "/leads",
        title: "Criar lead",
        description:
          "Cria um lead. Se stage_id nao for enviado, cai na primeira etapa do funil padrao. Dispara a automacao lead_created e o webhook lead.created.",
        scope: "leads:write",
        curl: `curl -X POST -H "Authorization: Bearer sk_live_..." -H "Content-Type: application/json" \\
  -d '{"name":"Joao Silva","phone":"+5511999999999","source":"site"}' \\
  ${BASE}/leads`,
        response: `{ "data": { "id": "...", "name": "Joao Silva", "stage_id": "...", "created_at": "..." } }`,
      },
      {
        method: "GET",
        path: "/leads/:id",
        title: "Buscar lead",
        description: "Retorna um lead pelo id.",
        scope: "leads:read",
        curl: `curl -H "Authorization: Bearer sk_live_..." ${BASE}/leads/LEAD_ID`,
        response: `{ "data": { "id": "...", "name": "...", "stage_id": "..." } }`,
      },
      {
        method: "PATCH",
        path: "/leads/:id",
        title: "Atualizar lead",
        description:
          "Atualiza campos do lead. Enviar stage_id move o lead de etapa e dispara a automacao stage_changed e o webhook lead.stage_changed.",
        scope: "leads:write",
        curl: `curl -X PATCH -H "Authorization: Bearer sk_live_..." -H "Content-Type: application/json" \\
  -d '{"stage_id":"NOVA_ETAPA_ID"}' \\
  ${BASE}/leads/LEAD_ID`,
        response: `{ "data": { "id": "...", "stage_id": "NOVA_ETAPA_ID" } }`,
      },
      {
        method: "DELETE",
        path: "/leads/:id",
        title: "Remover lead",
        description: "Remove um lead do seu tenant.",
        scope: "leads:write",
        curl: `curl -X DELETE -H "Authorization: Bearer sk_live_..." ${BASE}/leads/LEAD_ID`,
        response: `{ "data": { "id": "...", "deleted": true } }`,
      },
    ],
  },
  {
    id: "pipelines",
    title: "Pipelines e Etapas",
    endpoints: [
      {
        method: "GET",
        path: "/pipelines",
        title: "Listar funis e etapas",
        description: "Retorna os funis do tenant com suas etapas, na ordem correta. Use os ids aqui como stage_id ao criar/mover leads.",
        scope: "pipelines:read",
        curl: `curl -H "Authorization: Bearer sk_live_..." ${BASE}/pipelines`,
        response: `{
  "data": [
    { "id": "...", "name": "SDR - Pre-vendas", "is_default": true, "stages": [
      { "id": "...", "name": "PRIMEIRO CONTATO", "position": 0, "is_won": false, "is_lost": false }
    ] }
  ]
}`,
      },
    ],
  },
  {
    id: "messages",
    title: "Mensagens (WhatsApp)",
    endpoints: [
      {
        method: "GET",
        path: "/messages?leadId=",
        title: "Ler historico de mensagens",
        description: "Retorna as ultimas 150 mensagens da conversa de WhatsApp do lead informado.",
        scope: "messages:read",
        curl: `curl -H "Authorization: Bearer sk_live_..." "${BASE}/messages?leadId=LEAD_ID"`,
        response: `{ "data": [ { "id": "...", "body": "Ola!", "direction": "inbound", "status": "sent", "created_at": "..." } ] }`,
      },
      {
        method: "POST",
        path: "/messages",
        title: "Enviar mensagem",
        description: "Envia uma mensagem de WhatsApp para o lead (precisa de uma conta WhatsApp ativa configurada no tenant).",
        scope: "messages:write",
        curl: `curl -X POST -H "Authorization: Bearer sk_live_..." -H "Content-Type: application/json" \\
  -d '{"leadId":"LEAD_ID","body":"Ola! Como posso ajudar?"}' \\
  ${BASE}/messages`,
        response: `{ "data": { "conversationId": "...", "message": { "id": "...", "status": "sent" } } }`,
      },
    ],
  },
  {
    id: "automations",
    title: "Automacoes",
    endpoints: [
      {
        method: "POST",
        path: "/automations/trigger",
        title: "Disparar automacao",
        description:
          "Dispara manualmente um gatilho de automacao para um lead. kind aceita: lead_created, stage_changed, message_received, message_sent, appointment_created, appointment_near, lead_inactive.",
        scope: "automations:trigger",
        curl: `curl -X POST -H "Authorization: Bearer sk_live_..." -H "Content-Type: application/json" \\
  -d '{"leadId":"LEAD_ID","kind":"lead_created","payload":{}}' \\
  ${BASE}/automations/trigger`,
        response: `{ "data": { "ok": true } }`,
      },
    ],
  },
  {
    id: "webhooks",
    title: "Webhooks de saida",
    endpoints: [
      {
        method: "GET",
        path: "/webhooks",
        title: "Listar webhooks",
        description: "Lista as assinaturas de webhook do tenant.",
        scope: "webhooks:manage",
        curl: `curl -H "Authorization: Bearer sk_live_..." ${BASE}/webhooks`,
        response: `{ "data": [ { "id": "...", "url": "...", "events": ["lead.created"], "is_active": true } ] }`,
      },
      {
        method: "POST",
        path: "/webhooks",
        title: "Criar webhook",
        description:
          "Registra uma URL pra receber eventos. Eventos disponiveis: lead.created, lead.stage_changed, message.received. O segredo (pra validar a assinatura HMAC) so aparece nesta resposta - guarde com cuidado.",
        scope: "webhooks:manage",
        curl: `curl -X POST -H "Authorization: Bearer sk_live_..." -H "Content-Type: application/json" \\
  -d '{"url":"https://seusistema.com/webhook","events":["lead.created","lead.stage_changed"]}' \\
  ${BASE}/webhooks`,
        response: `{ "data": { "id": "...", "url": "...", "events": ["lead.created"], "secret": "..." } }`,
      },
      {
        method: "DELETE",
        path: "/webhooks/:id",
        title: "Remover webhook",
        description: "Remove uma assinatura de webhook.",
        scope: "webhooks:manage",
        curl: `curl -X DELETE -H "Authorization: Bearer sk_live_..." ${BASE}/webhooks/WEBHOOK_ID`,
        response: `{ "data": { "id": "...", "deleted": true } }`,
      },
    ],
  },
];
