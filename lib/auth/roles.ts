import type { MemberRole } from "../supabase/database.types";

export function canManageUsers(role: MemberRole) {
  return role === "owner" || role === "admin";
}

export function canManageIntegrations(role: MemberRole) {
  return role === "owner" || role === "admin";
}

export function canManageOperationalSetup(role: MemberRole) {
  return role === "owner" || role === "admin" || role === "gerente";
}

export function canOperateLead(role: MemberRole) {
  return ["owner", "admin", "gerente", "atendente", "vendedor"].includes(role);
}

export function canSeeAllLeads(role: MemberRole) {
  return role === "owner" || role === "admin" || role === "gerente";
}

// Allowlist explicita de proposito: papel novo (ex: tecnico) nao deve ganhar
// acesso por acidente so por nao ser "vendedor".
export function canSeeFullDashboard(role: MemberRole) {
  return ["owner", "admin", "gerente", "atendente"].includes(role);
}

// Exclusao de lead e gestao das contas de WhatsApp: todo mundo do escritorio,
// menos vendedor e tecnico. Allowlist em vez de "!== vendedor" pelo mesmo
// motivo do canSeeFullDashboard.
export function canDeleteLead(role: MemberRole) {
  return ["owner", "admin", "gerente", "atendente"].includes(role);
}

export function canManageWhatsAppAccounts(role: MemberRole) {
  return ["owner", "admin", "gerente", "atendente"].includes(role);
}

export function canManagePipeline(role: MemberRole) {
  return role === "owner" || role === "admin" || role === "gerente" || role === "vendedor";
}

// Estoque, automacoes e configuracoes da empresa: vendedor e tecnico nao acessam.
export function canAccessStock(role: MemberRole) {
  return ["owner", "admin", "gerente", "atendente"].includes(role);
}

// --- Servico em campo (OS) ---

// Quem cria, agenda e roteiriza ordem de servico.
export function canManageServiceOrders(role: MemberRole) {
  return ["owner", "admin", "gerente", "atendente"].includes(role);
}

// Vendedor entra na OS so pra acompanhar o que ele mesmo vendeu.
export function canAccessServiceOrders(role: MemberRole) {
  return ["owner", "admin", "gerente", "atendente", "vendedor"].includes(role);
}

// Quem abre o roteiro e o mapa do dia. Vendedor entra pra ver o trajeto, mas
// so leitura: otimizar rota, alocar tecnico e reagendar seguem em
// canManageServiceOrders.
export function canViewServiceRoutes(role: MemberRole) {
  return ["owner", "admin", "gerente", "atendente", "vendedor"].includes(role);
}

// Conferencia / pre-fechamento e aprovacao de upsell: so a gestao.
export function canReviewServiceOrder(role: MemberRole) {
  return role === "owner" || role === "admin";
}

// Reabrir/cancelar uma conclusao muda o que o tecnico ja assinou em campo.
// Owner, admin e o coordenador de vendas (gerente) podem fazer isso; atendente
// segue cuidando da agenda, mas nao do fechamento.
export function canReopenServiceOrder(role: MemberRole) {
  return role === "owner" || role === "admin" || role === "gerente";
}

// Desconto e uma decisao comercial: gerente pode autorizar, mas atendente
// nao. Faturamento continua reservado ao owner/admin.
export function canApproveServiceOrderDiscount(role: MemberRole) {
  return role === "owner" || role === "admin" || role === "gerente";
}

export function isTechnician(role: MemberRole) {
  return role === "tecnico";
}

export function isProspeccao(role: MemberRole) {
  return role === "prospeccao";
}

// Alinhado com a RLS de automation_flows (apenas owner/admin escrevem).
export function canManageAutomations(role: MemberRole) {
  return role === "owner" || role === "admin";
}

export function canManageCompanySettings(role: MemberRole) {
  return role === "owner" || role === "admin";
}

export function assertRole(
  role: MemberRole,
  predicate: (role: MemberRole) => boolean,
  message = "Sem permissao",
) {
  if (!predicate(role)) throw new Error(message);
}
