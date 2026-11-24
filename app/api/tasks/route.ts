// 放置位置：app/api/tasks/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 重复规则：每天 / 每周 / 每月；其他值视为不重复
const RECURS = ["daily", "weekly", "monthly"];
const cleanRecur = (v: any) => (RECURS.includes(v) ? v : null);

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase: null, me: null };
  const { data: me } = await supabase
    .from("employees")
    .select("id, is_admin, is_manager")
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
    const { assignee_id, parent_id, start_at, is_private } = body;
    if (!name?.trim()) return NextResponse.json({ error: "缺少任务内容" }, { status: 400 });
    // 通过 create_task 函数建任务：可指定负责人(assignee_id)、上级任务(parent_id)、开始时间(start_at)
    const { error: e } = await (supabase as any).rpc("create_task", {
      p_name: name.trim(),
      p_assignee: assignee_id ?? null,
      p_parent: parent_id ?? null,
      p_important: !!important,
      p_urgent: !!urgent,
      p_start_at: start_at || null,
      p_private: !!is_private, // 只有管理员能建私密任务（数据库会校验）
      p_recur: cleanRecur(body.recur), // 重复：每天/每周/每月（没填日期则从今天开始）
    });
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "transfer") {
    // 权限由数据库 transfer_task 校验：
    // 管理员不限；经理可转看得到的任务；普通员工只能把自己的任务转给经理/管理员
    const { task_id, to_assignee_id } = body;
    if (!task_id || !to_assignee_id) return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    const { error: e } = await (supabase as any).rpc("transfer_task", {
      p_task: task_id,
      p_to: to_assignee_id,
    });
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
    // 重复任务完成后自动生成下一次（不是重复任务时数据库直接返回 null）
    if (state === "done") {
      const { data: spawned, error: se } = await (supabase as any).rpc("spawn_recur_task", { p_task: task_id });
      // 状态已经改成功了；生成下一次失败不影响本次完成
      if (se) return NextResponse.json({ ok: true, spawned: null, spawnError: se.message });
      return NextResponse.json({ ok: true, spawned: spawned ?? null });
    }
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

  if (action === "addNote") {
    // 新增一条跟进（作者、时间由数据库自动填；能看到任务的人才能写，由 RLS 校验）
    const { task_id, body: text } = body;
    const clean = (text ?? "").toString().trim();
    if (!task_id || !clean) return NextResponse.json({ error: "缺少内容" }, { status: 400 });
    const { data, error: e } = await (supabase as any)
      .from("task_notes")
      .insert({ task_id, body: clean })
      .select("id, task_id, author_id, author_name, body, created_at")
      .single();
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    // 有了跟进：任务日期自动顺延到明天（迪拜时间），保留原来的钟点
    // 只处理有日期、未完成、日期是今天或已过期的任务；以后日期的不动
    let start_at: string | null = null;
    const { data: t } = await (supabase as any)
      .from("tasks")
      .select("start_at, state, recur, recur_anchor")
      .eq("id", task_id)
      .maybeSingle();
    if (t?.start_at && t.state !== "done") {
      const DAY = 86400000, DUBAI = 4 * 3600000; // 迪拜 UTC+4，无夏令时
      const dayNo = (ms: number) => Math.floor((ms + DUBAI) / DAY);
      const oldMs = new Date(t.start_at).getTime();
      const shift = dayNo(Date.now()) + 1 - dayNo(oldMs);
      if (shift > 0) {
        const patch: any = { start_at: new Date(oldMs + shift * DAY).toISOString() };
        // 重复任务：记住原来的基准日，顺延不打乱每周/每月的规律
        if (t.recur && !t.recur_anchor) patch.recur_anchor = new Date(oldMs + DUBAI).toISOString().slice(0, 10);
        const { data: up } = await (supabase as any).from("tasks").update(patch).eq("id", task_id).select("start_at");
        if (up && up.length) start_at = up[0].start_at;
      }
    }
    return NextResponse.json({ ok: true, note: data, start_at });
  }

  if (action === "deleteNote") {
    // 删除一条跟进：本人或管理员（RLS 校验）
    const { note_id } = body;
    if (!note_id) return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    const { data, error: e } = await (supabase as any).from("task_notes").delete().eq("id", note_id).select("id");
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    if (!data || data.length === 0) return NextResponse.json({ error: "无权限删除" }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  if (action === "setName") {
    const { task_id, name } = body;
    const clean = (name ?? "").toString().trim();
    if (!clean) return NextResponse.json({ error: "缺少任务内容" }, { status: 400 });
    // 修改任务内容；普通员工只能改自己的任务
    let uq = supabase.from("tasks").update({ name: clean }).eq("id", task_id);
    if (!me.is_admin && !me.is_manager) uq = uq.eq("assignee_id", me.id);
    const { error: e } = await uq;
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "setStart") {
    const { task_id, start_at } = body;
    // 修改任务开始时间（清空传 null）；管理员/经理可改看得到的任务，普通员工只能改自己的
    // 带 recur 字段时一并修改重复规则；清空日期 = 取消重复
    const patch: any = { start_at: start_at || null };
    if ("recur" in body) patch.recur = start_at ? cleanRecur(body.recur) : null;
    if (!start_at) patch.recur = null;
    patch.recur_anchor = null; // 日期改了，重复基准跟着新日期走
    let uq = (supabase as any).from("tasks").update(patch).eq("id", task_id);
    if (!me.is_admin && !me.is_manager) uq = uq.eq("assignee_id", me.id);
    const { error: e } = await uq;
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "ack") {
    const { task_id } = body;
    // 员工确认收到自己的任务
    let uq = supabase.from("tasks").update({ acknowledged: true }).eq("id", task_id);
    if (!me.is_admin && !me.is_manager) uq = uq.eq("assignee_id", me.id);
    const { error: e } = await uq;
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    const { task_id } = body;
    // 管理员、经理可删看得到的任务；普通员工只能删自己的（删父任务会级联删子任务）
    let dq = supabase.from("tasks").delete().eq("id", task_id);
    if (!me.is_admin && !me.is_manager) dq = dq.eq("assignee_id", me.id);
    const { error: e } = await dq;
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
