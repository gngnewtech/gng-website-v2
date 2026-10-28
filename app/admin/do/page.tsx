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
    .select("id, name, is_admin, is_manager")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!me) redirect("/login");

  const canManage = !!(me.is_admin || me.is_manager);

  // 负责人名单（管理员/经理可选全部员工；普通员工只有自己）
  const { data: employees } = canManage
    ? await supabase.from("employees").select("id, name, role").order("created_at", { ascending: true })
    : { data: [{ id: me.id, name: me.name, role: null }] };

  // DO 单 + 步骤（普通员工只看到自己负责的，由 RLS 过滤）
  const { data: orders } = await supabase
    .from("do_orders")
    .select("id, title, do_no, invoice_no, assignee_id, created_at, done_at")
    .order("created_at", { ascending: false });

  const ids = (orders ?? []).map((o: any) => o.id);
  const { data: steps } = ids.length
    ? await supabase
        .from("do_steps")
        .select("id, order_id, step_no, name, done_at, done_by_name")
        .in("order_id", ids)
        .order("step_no", { ascending: true })
    : { data: [] };

  // 附件（截图 / PDF）
  const { data: files } = ids.length
    ? await supabase
        .from("do_files")
        .select("id, order_id, path, name, mime, size, uploaded_by, uploaded_by_name, created_at")
        .in("order_id", ids)
        .order("created_at", { ascending: true })
    : { data: [] };

  return (
    <DoBoard
      me={{ id: me.id, name: me.name, isAdmin: !!me.is_admin, canManage }}
      email={user.email ?? ""}
      employees={employees ?? []}
      orders={orders ?? []}
      steps={steps ?? []}
      files={files ?? []}
    />
  );
}
