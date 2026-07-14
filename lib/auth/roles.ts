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

export function assertRole(
  role: MemberRole,
  predicate: (role: MemberRole) => boolean,
  message = "Sem permissao",
) {
  if (!predicate(role)) throw new Error(message);
}
