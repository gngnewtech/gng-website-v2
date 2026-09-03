// 放置位置：app/employee/page.tsx
// 临时占位页 —— 验证"普通员工能登录并被识别"。下一步替换成员工的任务清单页。
import { createClient } from "@/lib/supabase/server";

export default async function EmployeePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={tag}><span style={dot} />GNG 任务系统</div>
        <div style={{ fontSize: 40, marginBottom: 8 }}>👋</div>
        <h1 style={h1}>登录成功</h1>
        <p style={p}>
          你好，<b>{user?.email ?? "同事"}</b>。这里以后会显示分配给你的任务，你可以在这里查看和更新进度。
        </p>
        <p style={{ ...p, color: "#94a3b8", fontSize: 14 }}>个人任务清单页面正在搭建中。</p>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: 16, fontFamily: 'system-ui,-apple-system,"PingFang SC",sans-serif' };
const card: React.CSSProperties = { maxWidth: 460, textAlign: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 40 };
const tag: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, color: "#d97706", fontFamily: "ui-monospace,monospace", letterSpacing: ".16em", fontSize: 12, marginBottom: 20 };
const dot: React.CSSProperties = { width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block" };
const h1: React.CSSProperties = { fontSize: 24, fontWeight: 700, margin: "0 0 12px", color: "#1e293b" };
const p: React.CSSProperties = { fontSize: 15, color: "#475569", lineHeight: 1.7, margin: "0 0 10px" };
