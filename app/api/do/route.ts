// 放置位置：app/api/do/route.ts
// DO 流程：新建 / 改单 / 勾选步骤 / 删除（权限由数据库函数和 RLS 校验）
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase: any = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  if (action === "create") {
    const { title, do_no, invoice_no, assignee_id } = body;
    if (!title?.trim()) return NextResponse.json({ error: "缺少标题" }, { status: 400 });
    const { data, error } = await supabase.rpc("create_do_order", {
      p_title: title.trim(),
      p_do_no: do_no ?? null,
      p_invoice_no: invoice_no ?? null,
      p_assignee: assignee_id || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data });
  }

  if (action === "update") {
    // 只允许改这几个字段
    const { order_id } = body;
    if (!order_id) return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    const patch: Record<string, any> = {};
    if (typeof body.title === "string") {
      if (!body.title.trim()) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
      patch.title = body.title.trim();
    }
    if (typeof body.do_no === "string") patch.do_no = body.do_no.trim() || null;
    if (typeof body.invoice_no === "string") patch.invoice_no = body.invoice_no.trim() || null;
    if (typeof body.assignee_id === "string" && body.assignee_id) patch.assignee_id = body.assignee_id;
    if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });
    const { data, error } = await supabase.from("do_orders").update(patch).eq("id", order_id).select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) return NextResponse.json({ error: "无权限" }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  if (action === "toggleStep") {
    const { step_id, done } = body;
    if (!step_id) return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    const { error } = await supabase.rpc("toggle_do_step", { p_step: step_id, p_done: !!done });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    const { order_id } = body;
    // 先删存储里的附件文件（表记录会随 DO 单级联删除）
    const { data: files } = await supabase.from("do_files").select("path").eq("order_id", order_id);
    const paths = (files ?? []).map((f: any) => f.path);
    if (paths.length) await supabase.storage.from("do-files").remove(paths);
    const { data, error } = await supabase.from("do_orders").delete().eq("id", order_id).select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) return NextResponse.json({ error: "无权限删除" }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
