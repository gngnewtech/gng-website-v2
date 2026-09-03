// 放置位置：lib/supabase/client.ts
// 浏览器端用的 Supabase 客户端（在 "use client" 组件里用，例如登录页）
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
