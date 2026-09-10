// 放置位置：app/api/tasks/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase: null, me: null };
  const { data: me } = await supabase
    .from("employees")
    .select("id, is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  return { supabase, me };
}

export async function POST(req: Request) {
  const { supabase, me } = await getContext();
  if (!supabase || !me) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  if (action === "assign") {
    const { name, important, urgent } = body;
    const { assignee_id, parent_id } = body;
    if (!name?.trim()) return NextResponse.json({ error: "缺少任务内容" }, { status: 400 });
    // 通过 create_task 函数建任务：可指定负责人(assignee_id)和上级任务(parent_id)；不传负责人则归调用者
    const { error: e } = await (supabase as any).rpc("create_task", {
      p_name: name.trim(),
      p_assignee: assignee_id ?? null,
      p_parent: parent_id ?? null,
      p_important: !!important,
      p_urgent: !!urgent,
    });
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "transfer") {
    if (!me.is_admin) return NextResponse.json({ error: "无权限" }, { status: 403 });
    const { task_id, to_assignee_id } = body;
    const { error: e } = await supabase
      .from("tasks")
      .update({ assignee_id: to_assignee_id })
      .eq("id", task_id);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "setState") {
    const { task_id, state } = body;
    if (!["todo", "doing", "done"].includes(state))
      return NextResponse.json({ error: "状态无效" }, { status: 400 });
    // 标为已完成时记录完成时间；改回其他状态则清空
    const patch: any = { state, done_at: state === "done" ? new Date().toISOString() : null };
    const { error: e } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", task_id);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "setPriority") {
    const { task_id, important, urgent } = body;
    const { error: e } = await supabase
      .from("tasks")
      .update({ important: !!important, urgent: !!urgent })
      .eq("id", task_id);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "setNote") {
    const { task_id, note } = body;
    const clean = (note ?? "").toString().trim();
    const { error: e } = await supabase
      .from("tasks")
      .update({ note: clean.length ? clean : null })
      .eq("id", task_id);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "ack") {
    const { task_id } = body;
    // 员工确认收到自己的任务
    let uq = supabase.from("tasks").update({ acknowledged: true }).eq("id", task_id);
    if (!me.is_admin) uq = uq.eq("assignee_id", me.id);
    const { error: e } = await uq;
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    const { task_id } = body;
    // 管理员可删任意任务；普通员工只能删自己的（删父任务会级联删子任务）
    let dq = supabase.from("tasks").delete().eq("id", task_id);
    if (!me.is_admin) dq = dq.eq("assignee_id", me.id);
    const { error: e } = await dq;
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
