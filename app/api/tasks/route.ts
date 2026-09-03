// 放置位置：app/api/tasks/route.ts
// 处理任务的分配、转交、改状态、删除。只有管理员能调用（RLS 会再兜一层）。
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未登录", supabase: null, isAdmin: false };
  const { data: me } = await supabase
    .from("employees")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  return { error: null, supabase, isAdmin: !!me?.is_admin, user };
}

// 分配 / 转交 / 改状态
export async function POST(req: Request) {
  const { supabase, isAdmin, error } = await requireAdmin();
  if (error || !supabase) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  // 员工改自己任务状态时也允许（RLS 保证只能改自己的），其余动作需管理员
  if (action === "assign") {
    if (!isAdmin) return NextResponse.json({ error: "无权限" }, { status: 403 });
    const { assignee_id, name } = body;
    if (!assignee_id || !name?.trim())
      return NextResponse.json({ error: "缺少员工或任务内容" }, { status: 400 });
    const { error: e } = await supabase
      .from("tasks")
      .insert({ assignee_id, name: name.trim(), state: "todo" });
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "transfer") {
    if (!isAdmin) return NextResponse.json({ error: "无权限" }, { status: 403 });
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
    const { error: e } = await supabase
      .from("tasks")
      .update({ state })
      .eq("id", task_id);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    if (!isAdmin) return NextResponse.json({ error: "无权限" }, { status: 403 });
    const { task_id } = body;
    const { error: e } = await supabase.from("tasks").delete().eq("id", task_id);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
