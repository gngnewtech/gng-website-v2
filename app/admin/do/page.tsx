import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DoBoard from "./DoBoard";

export const dynamic = "force-dynamic";

export default async function DoPage() {
  const supabase: any = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("employees")
    .select("*") // 读取自己这一行（含 can_see_all_do；SQL 未运行时该字段为空也不报错）
    .eq("user_id", user.id)
    .maybeSingle();
  if (!me) redirect("/login");

  const canManage = !!(me.is_admin || me.is_manager);

  // 负责人名单（管理员/经理可选全部员工；可查看全部 DO 的员工取全员名单用于显示负责人；普通员工只有自己）
  // （每一步都可以分配给同事，所以普通员工也取全员名单）
  const { data: employees } = canManage
    ? await supabase.from("employees").select("id, name, role").order("created_at", { ascending: true })
    : await supabase.rpc("get_staff");

  // DO 单 + 步骤（普通员工只看到自己负责的；can_see_all_do 的员工看全部；由 RLS 过滤）
  const { data: orders } = await supabase
    .from("do_orders")
    .select("id, title, do_no, invoice_no, assignee_id, created_at, done_at")
    .order("created_at", { ascending: false });

  const ids = (orders ?? []).map((o: any) => o.id);
  const { data: steps } = ids.length
    ? await supabase
        .from("do_steps")
        .select("*") // 含 assignee_id（SQL 未运行时该字段为空也不报错）
        .in("order_id", ids)
        .order("step_no", { ascending: true })
    : { data: [] };

  // 附件（截图 / PDF）
  const { data: files } = ids.length
    ? await supabase
        .from("do_files")
        .select("*") // 含 step_id：合并 PDF 时按步骤挑「签字 DO」「发票」
        .in("order_id", ids)
        .order("created_at", { ascending: true })
    : { data: [] };

  return (
    <DoBoard
      me={{ id: me.id, name: me.name, isAdmin: !!me.is_admin, canManage, canSeeAll: !!me.can_see_all_do }}
      email={user.email ?? ""}
      employees={employees?.length ? employees : [{ id: me.id, name: me.name, role: null }]}
      orders={orders ?? []}
      steps={steps ?? []}
      files={files ?? []}
    />
  );
}
