// 放置位置：app/auth/callback/route.ts
// 员工点邮件里的登录链接后会回到这里。完成登录、判断身份，跳到对应页面。
// 同时兼容两种邮件模板（code 流程 / token_hash 流程），无需你改 Supabase 邮件模板。
import { NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  // 兼容两种登录链接格式
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(`${origin}/login?error=auth`);
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (error) return NextResponse.redirect(`${origin}/login?error=auth`);
  } else {
    return NextResponse.redirect(`${origin}/login?error=missing_params`);
  }

  // 取当前用户
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?error=auth`);

  // 查这个人在员工表里的身份
  const { data: emp } = await supabase
    .from("employees")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  // 不在员工名单里 —— 拒绝进入（可去 Supabase 手动加进 employees 表）
  if (!emp) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_registered`);
  }

  // 管理员进后台，普通员工进个人任务页
  return NextResponse.redirect(`${origin}/${emp.is_admin ? "admin" : "employee"}`);
}
