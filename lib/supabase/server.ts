// 放置位置：lib/supabase/server.ts
// 服务端用的 Supabase 客户端（在 Server Component / Route Handler 里用）
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 在 Server Component 里调用 setAll 会抛错，可忽略——
            // 会话刷新由 middleware 负责。
          }
        },
      },
    }
  );
}
