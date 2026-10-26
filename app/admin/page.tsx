import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminBoard from "./AdminBoard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 确认是管理员或经理
  const { data: me } = await supabase
    .from("employees")
    .select("is_admin, is_manager")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!me?.is_admin && !me?.is_manager) redirect("/employee");

  // 读员工和任务（经理看不到的私密任务由数据库 RLS 自动过滤）
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, role, dept, email, absent")
    .order("created_at", { ascending: true });

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, assignee_id, name, state, important, urgent, note, is_private, start_at, created_at")
    .order("created_at", { ascending: true });

  return (
    <AdminBoard
      employees={employees ?? []}
      tasks={tasks ?? []}
      adminEmail={user.email ?? ""}
      isAdmin={!!me?.is_admin}
    />
  );
}
