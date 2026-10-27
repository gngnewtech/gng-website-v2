// 放置位置：lib/supabase/admin.ts
// 仅服务端使用的 Supabase 管理客户端（service_role 密钥，权限极高，绝不可用于浏览器端）
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("缺少 SUPABASE_SERVICE_ROLE_KEY 环境变量，无法管理员工账号");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
