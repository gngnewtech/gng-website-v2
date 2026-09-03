import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminBoard from "./AdminBoard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 确认是管理员
  const { data: me } = await supabase
    .from("employees")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!me?.is_admin) redirect("/employee");

  // 读所有员工和任务
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, role, dept, email, absent")
    .order("created_at", { ascending: true });

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, assignee_id, name, state, created_at")
    .order("created_at", { ascending: true });

  return (
    <AdminBoard
      employees={employees ?? []}
      tasks={tasks ?? []}
      adminEmail={user.email ?? ""}
    />
  );
}
