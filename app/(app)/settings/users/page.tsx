import { redirect } from "next/navigation";
import { UsersManager } from "./users-manager";
import { listTeamUsers } from "./actions";
import { requireContext } from "@/lib/tenant";
import { canManageUsers } from "@/lib/auth/roles";

export default async function UsersSettingsPage() {
  const ctx = await requireContext();
  if (!canManageUsers(ctx.role)) redirect("/settings");
  const users = await listTeamUsers();

  return (
    <div className="space-y-6 p-6">
      <UsersManager users={users} canManage={canManageUsers(ctx.role)} />
    </div>
  );
}
