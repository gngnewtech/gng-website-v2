// 放置位置：app/api/employees/route.ts
// 员工账号管理：设置/修改登录邮箱与密码、重设密码。
// 仅管理员可用；只能管理普通员工（不能动管理员、经理的账号）。
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

    // 读取目标员工，校验只能管普通员工
    const { data: target, error: te } = await supabase
      .from("employees")
      .select("id, email, user_id, is_admin, is_manager")
      .eq("id", employee_id)
      .maybeSingle();
    if (te) return NextResponse.json({ error: te.message }, { status: 500 });
    if (!target) return NextResponse.json({ error: "员工不存在" }, { status: 404 });
    if (target.is_admin || target.is_manager)
      return NextResponse.json({ error: "只能管理普通员工的账号" }, { status: 403 });

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

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
