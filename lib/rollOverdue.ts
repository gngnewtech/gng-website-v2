// 过期未完成的任务：日期自动改为今天（迪拜时间，保留原来的钟点）
// 在管理员页 / 员工页加载时调用；用 service_role，所有员工的任务一起处理
// 重复任务：记住原来的基准日（recur_anchor），不打乱每周/每月的规律
import { createAdminClient } from "@/lib/supabase/admin";

const DAY = 86400000;
const DUBAI = 4 * 3600000; // 迪拜 UTC+4，无夏令时
const dayNo = (ms: number) => Math.floor((ms + DUBAI) / DAY);

export async function rollOverdueTasks() {
  try {
    const sb: any = createAdminClient();
    const today = dayNo(Date.now());
    const todayStartIso = new Date(today * DAY - DUBAI).toISOString(); // 迪拜今天 00:00
    const { data: overdue } = await sb
      .from("tasks")
      .select("id, start_at, recur, recur_anchor")
      .neq("state", "done")
      .not("start_at", "is", null)
      .lt("start_at", todayStartIso);
    if (!overdue?.length) return;
    await Promise.all(
      overdue.map((t: any) => {
        const oldMs = new Date(t.start_at).getTime();
        const shift = today - dayNo(oldMs);
        if (shift <= 0) return null;
        const patch: any = { start_at: new Date(oldMs + shift * DAY).toISOString() };
        if (t.recur && !t.recur_anchor) patch.recur_anchor = new Date(oldMs + DUBAI).toISOString().slice(0, 10);
        return sb.from("tasks").update(patch).eq("id", t.id);
      })
    );
  } catch (e) {
    // 出错不影响页面打开
    console.error("rollOverdueTasks", e);
  }
}
