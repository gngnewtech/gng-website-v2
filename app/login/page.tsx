"use client";

// 放置位置：app/login/page.tsx
// 邮箱 + 密码登录。登录成功后按身份跳转（管理员→/admin，员工→/employee）。

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();
  const router = useRouter();

  const signIn = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setLoading(false);
      setError("邮箱或密码不正确，请重试。");
      return;
    }

    // 登录成功，查身份决定跳哪
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: emp } = await supabase
      .from("employees")
      .select("is_admin")
      .eq("user_id", user?.id)
      .maybeSingle();

    if (!emp) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("此账号不在员工名单中，请联系管理员。");
      return;
    }

    router.push(emp.is_admin ? "/admin" : "/employee");
    router.refresh();
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.tag}><span style={S.dot} />ADMIN.GNGNT.COM</div>
        <h2 style={S.h2}>登录</h2>
        <p style={S.sub}>请输入你的账号邮箱和密码。</p>

        <label style={S.label}>邮箱</label>
        <input
          style={S.input}
          type="email"
          value={email}
          autoFocus
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@gngnt.com"
        />

        <label style={{ ...S.label, marginTop: 14 }}>密码</label>
        <input
          style={S.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && signIn()}
          placeholder="••••••••"
        />

        {error && <div style={S.err}>{error}</div>}

        <button
          style={{ ...S.btn, opacity: loading || !email.trim() || !password ? 0.6 : 1 }}
          disabled={loading}
          onClick={signIn}
        >
          {loading ? "登录中…" : "登录"}
        </button>
        <p style={S.foot}>仅限 GNG New Tech 内部授权员工登录。</p>
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
  err: { marginTop: 12, fontSize: 14, color: "#e11d48", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 8, padding: "8px 12px" },
  foot: { fontSize: 12, color: "#94a3b8", marginTop: 18, textAlign: "center" },
};
