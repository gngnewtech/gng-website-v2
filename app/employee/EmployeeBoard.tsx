"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type TaskState = "todo" | "doing" | "done";
type Task = { id: string; name: string; state: TaskState; done_at: string | null };
type Me = { id: string; name: string; role: string | null; dept: string | null; email: string };

// 中英文对照
const T = {
  zh: {
    brand: "GNG 任务系统", hi: "你好", todayCount: "今日", myTasks: "我的今日任务",
    hint: "点左侧状态按钮更新进度：待开始 → 进行中 → 已完成",
    addPlaceholder: "添加一个新任务…", add: "+ 添加", adding: "添加中…",
    empty: "今天还没有任务，在上面添加一个吧 🎉",
    history: "历史任务", doneAt: "完成", logout: "退出",
    todo: "待开始", doing: "进行中", done: "已完成",
  },
  en: {
    brand: "GNG Task System", hi: "Hi", todayCount: "Today", myTasks: "My Tasks Today",
    hint: "Tap the status button to update: To-do → In progress → Done",
    addPlaceholder: "Add a new task…", add: "+ Add", adding: "Adding…",
    empty: "No tasks today. Add one above 🎉",
    history: "Task History", doneAt: "done", logout: "Log out",
    todo: "To-do", doing: "In progress", done: "Done",
  },
};

const TASK_TONE: Record<TaskState, { color: string; bg: string }> = {
  todo: { color: "#64748b", bg: "#f1f5f9" },
  doing: { color: "#b45309", bg: "#fffbeb" },
  done: { color: "#047857", bg: "#ecfdf5" },
};

function isToday(iso: string | null) {
  if (!iso) return false;
  const d = new Date(iso); const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

async function api(body: any) {
  const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.ok;
}

export default function EmployeeBoard({ me, tasks: initialTasks }: { me: Me; tasks: Task[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [newTask, setNewTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // 语言：默认中文，挂载后按浏览器语言判断
  const [lang, setLang] = useState<"zh" | "en">("zh");
  useEffect(() => {
    const l = (navigator.language || "zh").toLowerCase();
    setLang(l.startsWith("zh") ? "zh" : "en");
  }, []);
  const t = T[lang];

  useEffect(() => { setTasks(initialTasks); }, [initialTasks]);

  // 按语言格式化完成日期
  const fmtDate = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return lang === "zh" ? `${d.getMonth() + 1}月${d.getDate()}日` : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const todayTasks = tasks.filter((x) => x.state !== "done" || isToday(x.done_at));
  const historyTasks = tasks.filter((x) => x.state === "done" && !isToday(x.done_at)).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));

  const total = todayTasks.length;
  const done = todayTasks.filter((x) => x.state === "done").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const cycle = async (task: Task) => {
    const order: TaskState[] = ["todo", "doing", "done"];
    const next = order[(order.indexOf(task.state) + 1) % 3];
    const nowIso = new Date().toISOString();
    setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, state: next, done_at: next === "done" ? nowIso : null } : x)));
    const ok = await api({ action: "setState", task_id: task.id, state: next });
    if (!ok) setTasks((prev) => prev.map((x) => (x.id === task.id ? task : x)));
  };

  const addTask = async () => {
    const name = newTask.trim();
    if (!name) return;
    setBusy(true); setNewTask("");
    const tempId = "temp-" + Date.now();
    setTasks((prev) => [...prev, { id: tempId, name, state: "todo", done_at: null }]);
    const ok = await api({ action: "assign", name });
    setBusy(false);
    if (ok) router.refresh();
    else { setTasks((prev) => prev.filter((x) => x.id !== tempId)); setNewTask(name); }
  };

  const logout = async () => { await fetch("/api/logout", { method: "POST" }); router.push("/login"); router.refresh(); };

  const taskRow = (x: Task, history = false) => (
    <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
      <button onClick={() => cycle(x)} style={{ background: TASK_TONE[x.state].bg, color: TASK_TONE[x.state].color, border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 13, minWidth: 68, fontWeight: 500 }}>{t[x.state]}</button>
      <span style={{ flex: 1, fontSize: 15, textDecoration: x.state === "done" ? "line-through" : "none", color: x.state === "done" ? "#94a3b8" : "#334155" }}>{x.name}</span>
      {history && <span style={{ fontSize: 12, color: "#94a3b8" }}>{fmtDate(x.done_at)} {t.doneAt}</span>}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: 'system-ui,-apple-system,"PingFang SC",sans-serif', color: "#1e293b" }}>
      <header style={{ background: "#0f172a", color: "#f1f5f9", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#fbbf24", fontFamily: "ui-monospace,monospace", letterSpacing: ".12em", fontSize: 13 }}>● {t.brand}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 14 }}>
            <span style={{ color: "#cbd5e1" }}>{me.name}</span>
            <button onClick={logout} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 14 }}>{t.logout}</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 24, marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#1e293b", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 500, fontSize: 18 }}>{me.name.slice(-2)}</div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t.hi}，{me.name}</h2>
            <p style={{ fontSize: 14, color: "#64748b", margin: "4px 0 0" }}>{me.dept} · {me.role}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{pct}%</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{t.todayCount} {done}/{total}</div>
          </div>
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#475569", margin: "0 0 6px" }}>{t.myTasks}</h3>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 14px" }}>{t.hint}</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !busy && addTask()} placeholder={t.addPlaceholder}
            style={{ flex: 1, padding: "11px 12px", border: "1px solid #cbd5e1", borderRadius: 8, outline: "none", fontSize: 15, boxSizing: "border-box" }} />
          <button onClick={addTask} disabled={busy || !newTask.trim()}
            style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, padding: "0 18px", fontSize: 14, fontWeight: 500, cursor: "pointer", opacity: busy || !newTask.trim() ? 0.5 : 1, whiteSpace: "nowrap" }}>
            {busy ? t.adding : t.add}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {todayTasks.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: 48, background: "#fff", border: "1px dashed #e2e8f0", borderRadius: 12 }}>{t.empty}</div>
          ) : (
            todayTasks.map((x) => taskRow(x))
          )}
        </div>

        {historyTasks.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <button onClick={() => setShowHistory((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 600, color: "#475569", padding: 0 }}>
              <span style={{ transform: showHistory ? "rotate(90deg)" : "none", transition: "transform .2s" }}>▶</span>
              {t.history}（{historyTasks.length}）
            </button>
            {showHistory && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {historyTasks.map((x) => taskRow(x, true))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
