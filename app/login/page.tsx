"use client";

// 放置位置：app/login/page.tsx
// 员工和管理员共用。输入邮箱 → 收到登录链接 → 点击后由 /auth/callback 判断身份并跳转。

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  const send = async () => {
    const addr = email.trim();
    if (!addr) return;
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) setError("发送失败，请检查邮箱地址或稍后再试。");
    else setSent(true);
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.tag}><span style={S.dot} />ADMIN.GNGNT.COM</div>

        {sent ? (
          <>
            <h2 style={S.h2}>登录链接已发送</h2>
            <p style={S.sub}>
              我们已把登录链接发到 <b>{email.trim()}</b>。请打开邮箱点击链接完成登录，链接短时间内有效。
            </p>
            <button style={S.ghost} onClick={() => { setSent(false); setEmail(""); }}>
              换个邮箱
            </button>
          </>
        ) : (
          <>
            <h2 style={S.h2}>登录</h2>
            <p style={S.sub}>输入你的工作邮箱，我们会发送一个登录链接，无需密码。</p>

            <label style={S.label}>工作邮箱</label>
            <input
              style={S.input}
              type="email"
              value={email}
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && send()}
              placeholder="you@gngnt.com"
            />

            {error && <div style={S.err}>{error}</div>}

            <button style={{ ...S.btn, opacity: loading || !email.trim() ? 0.6 : 1 }} disabled={loading} onClick={send}>
              {loading ? "发送中…" : "发送登录链接"}
            </button>
            <p style={S.foot}>仅限 GNG New Tech 内部授权员工登录。</p>
          </>
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", padding: 16, fontFamily: 'system-ui,-apple-system,"PingFang SC",sans-serif' },
  card: { width: "100%", maxWidth: 380, background: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 20px 50px rgba(0,0,0,.35)" },
  tag: { display: "inline-flex", alignItems: "center", gap: 8, color: "#d97706", fontFamily: "ui-monospace,monospace", letterSpacing: ".16em", fontSize: 12, marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block" },
  h2: { fontSize: 22, fontWeight: 700, margin: 0, color: "#1e293b" },
  sub: { fontSize: 14, color: "#64748b", margin: "6px 0 22px", lineHeight: 1.6 },
  label: { display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6 },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "11px 12px", fontSize: 15, outline: "none", boxSizing: "border-box" },
  btn: { width: "100%", marginTop: 18, background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, padding: 12, fontSize: 15, fontWeight: 500, cursor: "pointer" },
  ghost: { marginTop: 8, background: "none", border: "none", color: "#2563eb", fontSize: 14, cursor: "pointer", padding: 4 },
  err: { marginTop: 12, fontSize: 14, color: "#e11d48", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 8, padding: "8px 12px" },
  foot: { fontSize: 12, color: "#94a3b8", marginTop: 18, textAlign: "center" },
};
