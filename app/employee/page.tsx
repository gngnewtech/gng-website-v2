import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EmployeeBoard from "./EmployeeBoard";

export const dynamic = "force-dynamic";

export default async function EmployeePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("employees")
    .select("id, name, role, dept, email, is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!me) redirect("/login");
  if (me.is_admin) redirect("/admin");

  // 我的任务 + 其下所有子任务（多层）
  const { data: tasks } = await (supabase as any).rpc("get_my_tasks", { p_uid: me.id });

  return <EmployeeBoard me={me} tasks={tasks ?? []} />;
}
