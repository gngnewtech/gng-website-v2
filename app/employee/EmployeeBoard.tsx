"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

type TaskState = "todo" | "doing" | "done";
type Task = { id: string; name: string; state: TaskState };
type Me = { id: string; name: string; role: string | null; dept: string | null; email: string };

const TASK_LABEL: Record<TaskState, string> = { todo: "待开始", doing: "进行中", done: "已完成" };
const TASK_TONE: Record<TaskState, { color: string; bg: string }> = {
  todo: { color: "#64748b", bg: "#f1f5f9" },
  doing: { color: "#b45309", bg: "#fffbeb" },
  done: { color: "#047857", bg: "#ecfdf5" },
};

async function api(body: any) {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export default function EmployeeBoard({ me, tasks }: { me: Me; tasks: Task[] }) {
  const router = useRouter();
  const [newTask, setNewTask] = useState("");
  const [busy, setBusy] = useState(false);

  const total = tasks.length;
  const done = tasks.filter((t) => t.state === "done").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const cycle = async (task: Task) => {
    const order: TaskState[] = ["todo", "doing", "done"];
    const next = order[(order.indexOf(task.state) + 1) % 3];
    await api({ action: "setState", task_id: task.id, state: next });
    router.refresh();
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    setBusy(true);
    // 员工建任务：后端会强制建给自己，assignee_id 不用传
    await api({ action: "assign", name: newTask.trim() });
    setBusy(false);
    setNewTask("");
    router.refresh();
  };

  const logout = async () => { await fetch("/api/logout", { method: "POST" }); router.push("/login"); router.refresh(); };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: 'system-ui,-apple-system,"PingFang SC",sans-serif', color: "#1e293b" }}>
      <header style={{ background: "#0f172a", color: "#f1f5f9", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#fbbf24", fontFamily: "ui-monospace,monospace", letterSpacing: ".16em", fontSize: 13 }}>● GNG 任务系统</span>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 14 }}>
            <span style={{ color: "#cbd5e1" }}>{me.name}</span>
            <button onClick={logout} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 14 }}>退出</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 24, marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#1e293b", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 500, fontSize: 18 }}>{me.name.slice(-2)}</div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>你好，{me.name}</h2>
            <p style={{ fontSize: 14, color: "#64748b", margin: "4px 0 0" }}>{me.dept} · {me.role}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{pct}%</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>完成 {done}/{total}</div>
          </div>
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#475569", margin: "0 0 6px" }}>我的今日任务</h3>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 14px" }}>点左侧状态按钮更新进度：待开始 → 进行中 → 已完成</p>

        {/* 自己添加任务 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !busy && addTask()}
            placeholder="添加一个新任务…"
            style={{ flex: 1, padding: "11px 12px", border: "1px solid #cbd5e1", borderRadius: 8, outline: "none", fontSize: 15, boxSizing: "border-box" }}
          />
          <button
            onClick={addTask}
            disabled={busy || !newTask.trim()}
            style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, padding: "0 18px", fontSize: 14, fontWeight: 500, cursor: "pointer", opacity: busy || !newTask.trim() ? 0.5 : 1, whiteSpace: "nowrap" }}
          >
            {busy ? "添加中…" : "+ 添加"}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: 48, background: "#fff", border: "1px dashed #e2e8f0", borderRadius: 12 }}>
              还没有任务，在上面添加一个吧 🎉
            </div>
          ) : (
            tasks.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
                <button onClick={() => cycle(t)} style={{ background: TASK_TONE[t.state].bg, color: TASK_TONE[t.state].color, border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 13, width: 68, fontWeight: 500 }}>{TASK_LABEL[t.state]}</button>
                <span style={{ flex: 1, fontSize: 15, textDecoration: t.state === "done" ? "line-through" : "none", color: t.state === "done" ? "#94a3b8" : "#334155" }}>{t.name}</span>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
