import { createClient } from "@supabase/supabase-js";

const email = process.env.DEMO_ACCOUNT_EMAIL ?? "demo@solairew.com";
const password = process.env.DEMO_ACCOUNT_PASSWORD ?? "12345678";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de criar a demonstração.");
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw new Error(listError.message);

let user = listed.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Visitante da demonstração", company_name: "Solaire W+ Demonstração" },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Não foi possível criar o usuário de demonstração.");
  user = data.user;
} else {
  const { error } = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) throw new Error(error.message);
}

// O gatilho de signup cria o tenant e o funil inicial. Este trecho também
// recupera contas criadas antes de o script existir.
let { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("default_tenant_id")
  .eq("id", user.id)
  .maybeSingle();
if (profileError) throw new Error(profileError.message);

if (!profile?.default_tenant_id) {
  const { data: tenant, error } = await supabase
    .from("tenants")
    .insert({ name: "Solaire W+ Demonstração", slug: "solaire-w-demo", brand_color: "#2563EB" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { error: memberError } = await supabase.from("tenant_members").upsert({ tenant_id: tenant.id, user_id: user.id, role: "owner" });
  if (memberError) throw new Error(memberError.message);
  const { error: updateProfileError } = await supabase.from("profiles").upsert({ id: user.id, full_name: "Visitante da demonstração", default_tenant_id: tenant.id });
  if (updateProfileError) throw new Error(updateProfileError.message);
  profile = { default_tenant_id: tenant.id };
}

const tenantId = profile.default_tenant_id;
const { error: tenantError } = await supabase
  .from("tenants")
  .update({
    name: "Solaire W+ Demonstração",
    brand_color: "#2563EB",
    tagline: "Ambiente seguro com dados fictícios",
    stock_enabled: true,
    broadcast_enabled: false,
    field_service_enabled: true,
  })
  .eq("id", tenantId);
if (tenantError) throw new Error(tenantError.message);

const { data: stages, error: stagesError } = await supabase
  .from("pipeline_stages")
  .select("id, pipeline_id, position")
  .eq("tenant_id", tenantId)
  .order("position");
if (stagesError) throw new Error(stagesError.message);

if (stages.length > 0) {
  const { count, error: countError } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  if (countError) throw new Error(countError.message);
  if (count === 0) {
    const samples = [
      ["Ana Martins", "Novo Lead", 0, 185000],
      ["Bruno Costa", "Instagram", 1, 320000],
      ["Carla Souza", "Indicação", 2, 470000],
      ["Diego Almeida", "Google", 3, 610000],
      ["Empresa Horizonte", "Site", 4, 890000],
    ];
    const rows = samples.map(([name, source, stageIndex, value], index) => {
      const stage = stages[Math.min(Number(stageIndex), stages.length - 1)];
      return {
        tenant_id: tenantId,
        name,
        source,
        phone: `+551199999${String(1000 + index).slice(-4)}`,
        notes: "Contato fictício do ambiente de demonstração.",
        pipeline_id: stage.pipeline_id,
        stage_id: stage.id,
        position: index,
        value_cents: value,
        assigned_to: user.id,
      };
    });
    const { error } = await supabase.from("leads").insert(rows);
    if (error) throw new Error(error.message);
  }
}

const { data: demoLeads, error: demoLeadsError } = await supabase
  .from("leads")
  .select("id, name")
  .eq("tenant_id", tenantId)
  .order("created_at");
if (demoLeadsError) throw new Error(demoLeadsError.message);

const leadByName = new Map((demoLeads ?? []).map((lead) => [lead.name, lead]));
const ana = leadByName.get("Ana Martins") ?? demoLeads?.[0];
const bruno = leadByName.get("Bruno Costa") ?? demoLeads?.[1] ?? ana;
const carla = leadByName.get("Carla Souza") ?? demoLeads?.[2] ?? ana;

// Conversas e mensagens deixam o chat visualmente completo, mas nao ha conta
// WhatsApp configurada: nenhuma mensagem deste tenant pode sair para fora.
if (ana && bruno && carla) {
  const { count, error } = await supabase.from("conversations").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  if (count === 0) {
    const now = Date.now();
    const conversations = [
      { tenant_id: tenantId, lead_id: ana.id, channel: "whatsapp", status: "em_atendimento", unread_count: 1, last_message_at: new Date(now - 8 * 60_000).toISOString() },
      { tenant_id: tenantId, lead_id: bruno.id, channel: "whatsapp", status: "aguardando", unread_count: 0, last_message_at: new Date(now - 32 * 60_000).toISOString() },
      { tenant_id: tenantId, lead_id: carla.id, channel: "whatsapp", status: "resolvida", unread_count: 0, last_message_at: new Date(now - 3 * 60 * 60_000).toISOString() },
    ];
    const { data: created, error: conversationError } = await supabase.from("conversations").insert(conversations).select("id, lead_id");
    if (conversationError) throw new Error(conversationError.message);
    const conversationByLead = new Map(created.map((conversation) => [conversation.lead_id, conversation.id]));
    const messages = [
      [ana.id, "inbound", "Olá! Vi a proposta e gostaria de entender as opções.", now - 24 * 60_000],
      [ana.id, "outbound", "Oi, Ana! Claro. Posso te mostrar as opções e agendar uma conversa rápida.", now - 18 * 60_000],
      [ana.id, "inbound", "Perfeito, pode ser amanhã às 10h?", now - 8 * 60_000],
      [bruno.id, "inbound", "Olá, quero saber mais sobre os planos para minha equipe.", now - 44 * 60_000],
      [bruno.id, "outbound", "Olá, Bruno! Separei uma demonstração personalizada para você.", now - 32 * 60_000],
      [carla.id, "inbound", "Obrigada pelo atendimento!", now - 4 * 60 * 60_000],
      [carla.id, "outbound", "Nós que agradecemos. Qualquer dúvida, estou à disposição.", now - 3 * 60 * 60_000],
    ].map(([leadId, direction, body, createdAt]) => ({
      tenant_id: tenantId,
      conversation_id: conversationByLead.get(leadId),
      user_id: direction === "outbound" ? user.id : null,
      direction,
      body,
      status: "read",
      created_at: new Date(createdAt).toISOString(),
    }));
    const { error: messagesError } = await supabase.from("messages").insert(messages);
    if (messagesError) throw new Error(messagesError.message);
  }
}

if (ana && bruno) {
  const { count, error } = await supabase.from("appointments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  if (count === 0) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    const { error: appointmentsError } = await supabase.from("appointments").insert([
      { tenant_id: tenantId, lead_id: ana.id, assigned_to: user.id, starts_at: tomorrow.toISOString(), duration_minutes: 45, status: "confirmed", notes: "Demonstração do CRM para a equipe comercial.", created_by: user.id },
      { tenant_id: tenantId, lead_id: bruno.id, assigned_to: user.id, starts_at: dayAfter.toISOString(), duration_minutes: 30, status: "scheduled", notes: "Apresentar funil, WhatsApp e automações.", created_by: user.id },
    ]);
    if (appointmentsError) throw new Error(appointmentsError.message);
  }

  const { count: taskCount, error: taskError } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  if (taskError) throw new Error(taskError.message);
  if (taskCount === 0) {
    const { error: tasksError } = await supabase.from("tasks").insert([
      { tenant_id: tenantId, lead_id: ana.id, assigned_to: user.id, created_by: user.id, title: "Enviar proposta comercial", notes: "Usar o modelo de proposta para plano anual.", due_at: new Date(Date.now() + 86_400_000).toISOString(), status: "open" },
      { tenant_id: tenantId, lead_id: bruno.id, assigned_to: user.id, created_by: user.id, title: "Confirmar participantes da reunião", due_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), status: "open" },
      { tenant_id: tenantId, lead_id: carla?.id ?? null, assigned_to: user.id, created_by: user.id, title: "Registrar feedback do atendimento", status: "done", completed_at: new Date().toISOString() },
    ]);
    if (tasksError) throw new Error(tasksError.message);
  }
}

const { count: productCount, error: productCountError } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
if (productCountError) throw new Error(productCountError.message);
if (productCount === 0) {
  const { error } = await supabase.from("products").insert([
    { tenant_id: tenantId, sku: "CRM-START", name: "Plano Start", description: "Até 3 usuários e funil comercial.", price_cents: 9900, cost_cents: 2500, stock_quantity: 18, min_stock: 5 },
    { tenant_id: tenantId, sku: "CRM-PRO", name: "Plano Pro", description: "Equipe completa com automações e relatórios.", price_cents: 24900, cost_cents: 7000, stock_quantity: 7, min_stock: 8 },
    { tenant_id: tenantId, sku: "ONBOARDING", name: "Onboarding personalizado", description: "Implantação e treinamento da equipe.", price_cents: 150000, cost_cents: 45000, stock_quantity: 12, min_stock: 3 },
  ]);
  if (error) throw new Error(error.message);
}

const { count: flowCount, error: flowCountError } = await supabase.from("automation_flows").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
if (flowCountError) throw new Error(flowCountError.message);
if (flowCount === 0) {
  const { error } = await supabase.from("automation_flows").insert({
    tenant_id: tenantId,
    name: "Boas-vindas para novos leads",
    description: "Exemplo de automação para responder assim que um lead entra no funil.",
    trigger_kind: "lead_created",
    status: "active",
  });
  if (error) throw new Error(error.message);
}

const { count: quickMessageCount, error: quickMessageCountError } = await supabase
  .from("quick_messages")
  .select("id", { count: "exact", head: true })
  .eq("tenant_id", tenantId);
if (quickMessageCountError) throw new Error(quickMessageCountError.message);
if (quickMessageCount === 0) {
  const { error } = await supabase.from("quick_messages").insert([
    { tenant_id: tenantId, title: "Boas-vindas", body: "Olá, {{nome}}! Que bom falar com você. Como podemos ajudar?", sort_order: 0, is_preset: true },
    { tenant_id: tenantId, title: "Agendar demonstração", body: "Posso te apresentar a plataforma em uma demonstração rápida. Qual horário funciona melhor?", sort_order: 1, is_preset: true },
    { tenant_id: tenantId, title: "Enviar proposta", body: "Preparei uma proposta alinhada ao que conversamos. Posso te enviar por aqui?", sort_order: 2, is_preset: true },
  ]);
  if (error) throw new Error(error.message);
}

console.log(`Conta de demonstração pronta: ${email}`);
