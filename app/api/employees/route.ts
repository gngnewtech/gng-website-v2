// 放置位置：app/api/employees/route.ts
// 员工账号管理：添加 / 删除员工，设置/修改登录邮箱与密码、重设密码。
// 仅管理员可用；可管理普通员工和经理的账号（不能动管理员账号）。
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";

// 用户名：2–32 位，字母 / 数字 / . _ -，统一存小写
const USERNAME_RE = /^[a-z0-9._-]{2,32}$/;
function cleanUsername(v: any) { return (v ?? "").toString().trim().toLowerCase(); }
// 员工不用邮箱登录时，给登录账号生成一个内部邮箱（不会收发邮件）
function internalEmail(username: string) { return `${username}.${randomUUID().slice(0, 8)}@staff.gngnt.com`; }
async function usernameTaken(admin: any, username: string, exceptId?: string) {
  let q = admin.from("employees").select("id").ilike("username", username.replace(/[%_\\]/g, "\\$&"));
  if (exceptId) q = q.neq("id", exceptId);
  const { data } = await q.limit(1);
  return (data ?? []).length > 0;
}

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
  // 只有管理员能管理员工账号
  if (!me.is_admin) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const body = await req.json();
  const { action } = body;

  if (action === "setCredentials") {
    const { employee_id } = body;
    const username = cleanUsername(body.username);
    const password = (body.password ?? "").toString();

    if (!employee_id) return NextResponse.json({ error: "缺少员工" }, { status: 400 });
    if (!USERNAME_RE.test(username))
      return NextResponse.json({ error: "用户名需 2–32 位，只能用字母、数字、. _ -" }, { status: 400 });
    if (password && password.length < 6) return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });

    let admin;
    try { admin = createAdminClient(); }
    catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }

    // 读取目标员工，校验不能动管理员账号
    const { data: target, error: te } = await admin
      .from("employees")
      .select("id, email, user_id, is_admin, is_manager")
      .eq("id", employee_id)
      .maybeSingle();
    if (te) return NextResponse.json({ error: te.message }, { status: 500 });
    if (!target) return NextResponse.json({ error: "员工不存在" }, { status: 404 });
    if (target.is_admin)
      return NextResponse.json({ error: "不能修改管理员的账号" }, { status: 403 });
    if (await usernameTaken(admin, username, employee_id))
      return NextResponse.json({ error: "该用户名已被使用" }, { status: 409 });

    if (target.user_id) {
      // 已有登录账号：（可选）重设密码，更新用户名
      if (password) {
        const { error: ue } = await admin.auth.admin.updateUserById(target.user_id, { password });
        if (ue) return NextResponse.json({ error: ue.message }, { status: 500 });
      }
      const { error: ee } = await admin.from("employees").update({ username }).eq("id", employee_id);
      if (ee) return NextResponse.json({ error: ee.message }, { status: 500 });
      return NextResponse.json({ ok: true, created: false });
    } else {
      // 还没有登录账号：必须给密码，新建并关联
      if (!password) return NextResponse.json({ error: "首次开通需要设置密码" }, { status: 400 });
      const authEmail = target.email || internalEmail(username);
      const { data: created, error: ce } = await admin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true, // 由管理员开通，直接视为已验证，无需确认邮件
      });
      if (ce) return NextResponse.json({ error: ce.message }, { status: 500 });
      const { error: le } = await admin
        .from("employees")
        .update({ user_id: created.user?.id, username })
        .eq("id", employee_id);
      if (le) return NextResponse.json({ error: le.message }, { status: 500 });
      return NextResponse.json({ ok: true, created: true });
    }
  }

  if (action === "addEmployee") {
    const name = (body.name ?? "").toString().trim();
    const username = cleanUsername(body.username);
    const password = (body.password ?? "").toString();
    const role = (body.role ?? "").toString().trim() || null;
    const dept = (body.dept ?? "").toString().trim() || null;

    if (!name) return NextResponse.json({ error: "请填写姓名" }, { status: 400 });
    if (!USERNAME_RE.test(username))
      return NextResponse.json({ error: "用户名需 2–32 位，只能用字母、数字、. _ -" }, { status: 400 });
    if (!password || password.length < 6) return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });

    let admin;
    try { admin = createAdminClient(); }
    catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }

    // 用户名重复直接拦下
    if (await usernameTaken(admin, username))
      return NextResponse.json({ error: "该用户名已被使用" }, { status: 409 });

    // 1) 建登录账号（员工用用户名登录，账号底层用内部邮箱）
    const email = internalEmail(username);
    const { data: created, error: ce } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (ce) return NextResponse.json({ error: ce.message }, { status: 500 });
    const newUserId = created.user?.id;

    // 2) 建员工档案（普通员工），并关联登录账号
    const { error: ie } = await admin.from("employees").insert({
      name, email: null, username, role, dept,
      user_id: newUserId,
      is_admin: false, is_manager: false, absent: false,
    });
    if (ie) {
      // 档案建失败，回滚刚建的登录账号，避免留下孤立账号
      if (newUserId) await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json({ error: ie.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "deleteEmployee") {
    const { employee_id } = body;
    if (!employee_id) return NextResponse.json({ error: "缺少员工" }, { status: 400 });
    if (employee_id === me.id) return NextResponse.json({ error: "不能删除自己" }, { status: 400 });

    let admin;
    try { admin = createAdminClient(); }
    catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }

    const { data: target, error: te } = await admin
      .from("employees")
      .select("id, user_id, is_admin")
      .eq("id", employee_id)
      .maybeSingle();
    if (te) return NextResponse.json({ error: te.message }, { status: 500 });
    if (!target) return NextResponse.json({ error: "员工不存在" }, { status: 404 });
    if (target.is_admin) return NextResponse.json({ error: "不能删除管理员" }, { status: 403 });

    // 名下还有 DO 单时先拦下，避免 DO 记录丢失
    const { count: doCount, error: de } = await admin
      .from("do_orders")
      .select("id", { count: "exact", head: true })
      .eq("assignee_id", employee_id);
    if (de) return NextResponse.json({ error: de.message }, { status: 500 });
    if ((doCount ?? 0) > 0)
      return NextResponse.json({ error: `该员工名下还有 ${doCount} 张 DO 单，请先转交给其他人` }, { status: 409 });

    // 他派给别人的任务保留，只清掉「派任务人」
    const { error: c1 } = await admin.from("tasks").update({ created_by: null }).eq("created_by", employee_id);
    if (c1) return NextResponse.json({ error: c1.message }, { status: 500 });
    const { error: c2 } = await admin.from("tasks").update({ assigned_by: null }).eq("assigned_by", employee_id);
    if (c2) return NextResponse.json({ error: c2.message }, { status: 500 });

    // 删除他名下的任务（其下子任务会随之级联删除）
    const { error: c3 } = await admin.from("tasks").delete().eq("assignee_id", employee_id);
    if (c3) return NextResponse.json({ error: c3.message }, { status: 500 });

    // 删除员工档案
    const { error: c4 } = await admin.from("employees").delete().eq("id", employee_id);
    if (c4) return NextResponse.json({ error: c4.message }, { status: 500 });

    // 删除登录账号
    if (target.user_id) {
      const { error: c5 } = await admin.auth.admin.deleteUser(target.user_id);
      if (c5) return NextResponse.json({ ok: true, warning: "员工已删除，但登录账号删除失败：" + c5.message });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
