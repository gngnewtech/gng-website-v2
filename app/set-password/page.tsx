"use client";

// 临时页面：给已存在的账号设置/重设密码。用完请删除此文件。
// 放置位置：app/set-password/page.tsx  →  访问 /set-password

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const run = async () => {
    setLoading(true);
    setMsg("");
    // 用注册接口写入：账号已存在且已确认时，Supabase 会更新其密码
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      setMsg("出错：" + error.message);
    } else {
      setMsg("已提交。现在去 /login 用这个邮箱和密码登录试试。");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", fontFamily: "system-ui,sans-serif", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 16, padding: 32 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>设置密码（临时工具）</h2>
        <p style={{ fontSize: 13, color: "#64748b" }}>输入账号邮箱和你想要的新密码。</p>
        <input
          style={{ width: "100%", padding: 11, marginTop: 12, border: "1px solid #cbd5e1", borderRadius: 8, boxSizing: "border-box" }}
          placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)}
        />
        <input
          style={{ width: "100%", padding: 11, marginTop: 10, border: "1px solid #cbd5e1", borderRadius: 8, boxSizing: "border-box" }}
          placeholder="新密码（至少6位）" type="text" value={password} onChange={(e) => setPassword(e.target.value)}
        />
        <button
          style={{ width: "100%", marginTop: 14, padding: 12, background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
          disabled={loading} onClick={run}
        >
          {loading ? "处理中…" : "设置密码"}
        </button>
        {msg && <p style={{ marginTop: 14, fontSize: 14, color: msg.startsWith("出错") ? "#e11d48" : "#059669" }}>{msg}</p>}
      </div>
    </div>
  );
}
