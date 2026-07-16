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

export function canSeeFullDashboard(role: MemberRole) {
  return role !== "vendedor";
}

export function canManagePipeline(role: MemberRole) {
  return role === "owner" || role === "admin" || role === "gerente" || role === "vendedor";
}

// Estoque, automacoes e configuracoes da empresa: vendedor nao acessa.
export function canAccessStock(role: MemberRole) {
  return role !== "vendedor";
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
