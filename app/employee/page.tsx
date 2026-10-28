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
    .select("id, name, role, dept, email, is_admin, is_manager")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!me) redirect("/login");
  if (me.is_admin) redirect("/admin"); // 经理可以进来看自己的任务，不跳走

  // 我的任务 + 其下所有子任务（多层）
  const { data: tasks } = await (supabase as any).rpc("get_my_tasks", { p_uid: me.id });
  // 员工名单（建子任务时选负责人用）
  const { data: staff } = await (supabase as any).rpc("get_staff");
  // 可转交对象（员工 → 经理/管理员；经理 → 全部）
  const { data: transferTargets } = await (supabase as any).rpc("get_transfer_targets");

  // 跟进记录（多条）
  const taskIds = (tasks ?? []).map((x: any) => x.id);
  const { data: notes } = taskIds.length
    ? await (supabase as any)
        .from("task_notes")
        .select("id, task_id, author_id, author_name, body, created_at")
        .in("task_id", taskIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  return <EmployeeBoard me={me} tasks={tasks ?? []} staff={staff ?? []} transferTargets={transferTargets ?? []} notes={notes ?? []} />;
}
