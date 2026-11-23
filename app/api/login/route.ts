// 放置位置：app/api/login/route.ts
// 用户名 + 密码登录：服务端按用户名找到对应的登录账号，再完成登录（写入登录 Cookie）。
// 也兼容输入邮箱登录。员工的邮箱不会返回给浏览器。
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const login = (body.username ?? "").toString().trim();
  const password = (body.password ?? "").toString();
  if (!login || !password) return NextResponse.json({ error: "creds" }, { status: 400 });

  let admin;
  try { admin = createAdminClient(); }
  catch (err: any) { return NextResponse.json({ error: "server", detail: err.message }, { status: 500 }); }

  // 按用户名（不区分大小写）找员工；输入里带 @ 时按邮箱找
  const col = login.includes("@") ? "email" : "username";
  const { data: emp } = await admin
    .from("employees")
    .select("user_id, is_admin, is_manager")
    .ilike(col, login.replace(/[%_\\]/g, "\\$&"))
    .maybeSingle();
  if (!emp?.user_id) return NextResponse.json({ error: "creds" }, { status: 401 });

  // 取登录账号实际使用的邮箱
  const { data: au } = await admin.auth.admin.getUserById(emp.user_id);
  const authEmail = au?.user?.email;
  if (!authEmail) return NextResponse.json({ error: "creds" }, { status: 401 });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
  if (error) return NextResponse.json({ error: "creds" }, { status: 401 });

  return NextResponse.json({ ok: true, dest: emp.is_admin || emp.is_manager ? "/admin" : "/employee" });
}
