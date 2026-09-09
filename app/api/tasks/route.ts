// 放置位置：app/api/tasks/route.ts
// 处理任务的分配、转交、改状态、删除。
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

  // 建任务：管理员可给任何人建；员工只能给自己建
  if (action === "assign") {
    let { assignee_id, name } = body;
    if (!name?.trim()) return NextResponse.json({ error: "缺少任务内容" }, { status: 400 });
    if (!me.is_admin) {
      // 员工强制建给自己，忽略传入的 assignee_id
      assignee_id = me.id;
    }
    if (!assignee_id) return NextResponse.json({ error: "缺少员工" }, { status: 400 });
    const { error: e } = await supabase
      .from("tasks")
      .insert({ assignee_id, name: name.trim(), state: "todo" });
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // 转交：仅管理员
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

  // 改状态：管理员改任何；员工改自己的（RLS 兜底）
  if (action === "setState") {
    const { task_id, state } = body;
    if (!["todo", "doing", "done"].includes(state))
      return NextResponse.json({ error: "状态无效" }, { status: 400 });
    const { error: e } = await supabase
      .from("tasks")
      .update({ state })
      .eq("id", task_id);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // 删除：仅管理员
  if (action === "delete") {
    if (!me.is_admin) return NextResponse.json({ error: "无权限" }, { status: 403 });
    const { task_id } = body;
    const { error: e } = await supabase.from("tasks").delete().eq("id", task_id);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
