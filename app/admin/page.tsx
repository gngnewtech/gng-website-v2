import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { rollOverdueTasks } from "@/lib/rollOverdue";
import AdminBoard from "./AdminBoard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 确认是管理员或经理
  const { data: me } = await supabase
    .from("employees")
    .select("id, is_admin, is_manager")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!me?.is_admin && !me?.is_manager) redirect("/employee");

  // 过期未完成的任务，日期自动改为今天
  await rollOverdueTasks();

  // 读员工和任务（经理看不到的私密任务由数据库 RLS 自动过滤）
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, role, dept, email, username, absent, is_admin, is_manager, user_id")
    .order("created_at", { ascending: true });

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, assignee_id, parent_id, name, state, important, urgent, note, is_private, start_at, recur, created_at")
    .order("created_at", { ascending: true });

  // 跟进记录（多条；经理看不到的任务的跟进由 RLS 过滤）
  const { data: notes } = await (supabase as any)
    .from("task_notes")
    .select("id, task_id, author_id, author_name, body, created_at")
    .order("created_at", { ascending: true });

  // DO 单 + 步骤（详情页右栏显示该员工负责的 DO）
  const { data: doOrders } = await (supabase as any)
    .from("do_orders")
    .select("id, title, do_no, invoice_no, assignee_id, created_at, done_at")
    .order("created_at", { ascending: false });
  const doIds = (doOrders ?? []).map((o: any) => o.id);
  const { data: doSteps } = doIds.length
    ? await (supabase as any)
        .from("do_steps")
        .select("*") // 含 assignee_id（SQL 未运行时该字段为空也不报错）
        .in("order_id", doIds)
        .order("step_no", { ascending: true })
    : { data: [] };
  const { data: doFiles } = doIds.length
    ? await (supabase as any)
        .from("do_files")
        .select("*") // 含 step_id（附件挂在哪一步）
        .in("order_id", doIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  return (
    <AdminBoard
      employees={employees ?? []}
      tasks={tasks ?? []}
      notes={notes ?? []}
      doOrders={doOrders ?? []}
      doSteps={doSteps ?? []}
      doFiles={doFiles ?? []}
      meId={me?.id ?? null}
      adminEmail={user.email ?? ""}
      isAdmin={!!me?.is_admin}
    />
  );
}
