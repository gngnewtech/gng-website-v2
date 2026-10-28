// 放置位置：app/api/employees/route.ts
// 员工账号管理：设置/修改登录邮箱与密码、重设密码。
// 仅管理员可用；可管理普通员工和经理的账号（不能动管理员账号）。
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
    const email = (body.email ?? "").toString().trim();
    const password = (body.password ?? "").toString();

    if (!employee_id) return NextResponse.json({ error: "缺少员工" }, { status: 400 });
    if (!email) return NextResponse.json({ error: "请填写登录邮箱" }, { status: 400 });
    if (password && password.length < 6) return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });

    // 读取目标员工，校验不能动管理员账号
    const { data: target, error: te } = await supabase
      .from("employees")
      .select("id, email, user_id, is_admin, is_manager")
      .eq("id", employee_id)
      .maybeSingle();
    if (te) return NextResponse.json({ error: te.message }, { status: 500 });
    if (!target) return NextResponse.json({ error: "员工不存在" }, { status: 404 });
    if (target.is_admin)
      return NextResponse.json({ error: "不能修改管理员的账号" }, { status: 403 });

    let admin;
    try { admin = createAdminClient(); }
    catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }

    if (target.user_id) {
      // 已有登录账号：更新邮箱 /（可选）密码
      const patch: any = { email };
      if (password) patch.password = password;
      const { error: ue } = await admin.auth.admin.updateUserById(target.user_id, patch);
      if (ue) return NextResponse.json({ error: ue.message }, { status: 500 });
      if (email !== target.email) {
        const { error: ee } = await admin.from("employees").update({ email }).eq("id", employee_id);
        if (ee) return NextResponse.json({ error: ee.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, created: false });
    } else {
      // 还没有登录账号：必须给密码，新建并关联
      if (!password) return NextResponse.json({ error: "首次开通需要设置密码" }, { status: 400 });
      const { data: created, error: ce } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // 由管理员开通，直接视为已验证，无需确认邮件
      });
      if (ce) return NextResponse.json({ error: ce.message }, { status: 500 });
      const newId = created.user?.id;
      const { error: le } = await admin
        .from("employees")
        .update({ user_id: newId, email })
        .eq("id", employee_id);
      if (le) return NextResponse.json({ error: le.message }, { status: 500 });
      return NextResponse.json({ ok: true, created: true });
    }
  }

  if (action === "addEmployee") {
    const name = (body.name ?? "").toString().trim();
    const email = (body.email ?? "").toString().trim();
    const password = (body.password ?? "").toString();
    const role = (body.role ?? "").toString().trim() || null;
    const dept = (body.dept ?? "").toString().trim() || null;

    if (!name) return NextResponse.json({ error: "请填写姓名" }, { status: 400 });
    if (!email) return NextResponse.json({ error: "请填写登录邮箱" }, { status: 400 });
    if (!password || password.length < 6) return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });

    let admin;
    try { admin = createAdminClient(); }
    catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }

    // 邮箱若已是员工，直接拦下
    const { data: dup } = await admin.from("employees").select("id").eq("email", email).maybeSingle();
    if (dup) return NextResponse.json({ error: "该邮箱已是员工" }, { status: 409 });

    // 1) 建登录账号
    const { data: created, error: ce } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (ce) return NextResponse.json({ error: ce.message }, { status: 500 });
    const newUserId = created.user?.id;

    // 2) 建员工档案（普通员工），并关联登录账号
    const { error: ie } = await admin.from("employees").insert({
      name, email, role, dept,
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

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
