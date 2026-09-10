"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type TaskState = "todo" | "doing" | "done";
type Task = { id: string; name: string; state: TaskState; done_at: string | null; important: boolean; urgent: boolean; note: string | null };
type Me = { id: string; name: string; role: string | null; dept: string | null; email: string };

const T = {
  zh: {
    brand: "GNG 任务系统", hi: "你好", todayCount: "今日", myTasks: "我的今日任务",
    hint: "点状态按钮更新进度（已完成再点会复制一条新任务）· 点「重要」「紧急」调优先级 · 点「备注」写说明",
    addPlaceholder: "添加任务，可一次输入多个（换行或用 1. 2. 3. 编号）…",
    add: "+ 添加", adding: "添加中…",
    empty: "今天还没有任务，在上面添加一个吧 🎉",
    history: "历史任务", doneAt: "完成", logout: "退出",
    todo: "待开始", doing: "进行中", done: "已完成",
    priority: "优先级", important: "重要", urgent: "紧急",
    q1: "重要紧急", q2: "重要不急", q3: "紧急不重要", q4: "一般",
    note: "备注", notePlaceholder: "写点备注或需要修改的地方…", save: "保存", cancel: "取消",
    delete: "删除", deleteTitle: "确认删除", deleteMsg: "确定删除这条任务吗？此操作不可撤销。",
  },
  en: {
    brand: "GNG Task System", hi: "Hi", todayCount: "Today", myTasks: "My Tasks Today",
    hint: "Tap status to update (tapping a done task copies a fresh one) · tap Important/Urgent to set priority · tap Note to add details",
    addPlaceholder: "Add tasks — enter several at once (new lines or 1. 2. 3.)…",
    add: "+ Add", adding: "Adding…",
    empty: "No tasks today. Add one above 🎉",
    history: "Task History", doneAt: "done", logout: "Log out",
    todo: "To-do", doing: "In progress", done: "Done",
    priority: "Priority", important: "Important", urgent: "Urgent",
    q1: "Important & Urgent", q2: "Important", q3: "Urgent", q4: "Normal",
    note: "Note", notePlaceholder: "Add a note or what needs changing…", save: "Save", cancel: "Cancel",
    delete: "Delete", deleteTitle: "Delete task", deleteMsg: "Delete this task? This can't be undone.",
  },
};

const TASK_TONE: Record<TaskState, { color: string; bg: string }> = {
  todo: { color: "#64748b", bg: "#f1f5f9" },
  doing: { color: "#b45309", bg: "#fffbeb" },
  done: { color: "#047857", bg: "#ecfdf5" },
};

// —— 四象限（重要 × 紧急）——
type Quadrant = 1 | 2 | 3 | 4;
function quadrantOf(x: Task): Quadrant {
  if (x.important && x.urgent) return 1;
  if (x.important) return 2;
  if (x.urgent) return 3;
  return 4;
}
const QUAD_META: Record<Quadrant, { color: string; bg: string; rank: number; key: "q1" | "q2" | "q3" | "q4" }> = {
  1: { color: "#be123c", bg: "#fff1f2", rank: 0, key: "q1" },
  2: { color: "#1d4ed8", bg: "#eff6ff", rank: 1, key: "q2" },
  3: { color: "#c2410c", bg: "#fff7ed", rank: 2, key: "q3" },
  4: { color: "#64748b", bg: "#f1f5f9", rank: 3, key: "q4" },
};
// 排序：先按重要，后按紧急（象限一 → 二 → 三 → 四）
function byPriority(a: Task, b: Task) {
  return QUAD_META[quadrantOf(a)].rank - QUAD_META[quadrantOf(b)].rank;
}

function isToday(iso: string | null) {
  if (!iso) return false;
  const d = new Date(iso); const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

// 把一段输入拆成多个任务名：先按换行分，再按 1. 2. 3. / 1、/ 1) 等编号分；去掉开头编号
function splitTasks(input: string): string[] {
  let parts = input.split(/\r?\n/);
  // 对每一行，再尝试按行内编号切分（如 "1.a 2.b 3.c" 写在一行）
  const out: string[] = [];
  for (const line of parts) {
    // 在 "数字 + . 、) 」" 这种编号前断开
    const segs = line.split(/(?=(?:^|\s)\d+\s*[.、)]\s*)/g);
    for (const seg of segs) out.push(seg);
  }
  return out
    .map((s) => s.replace(/^\s*\d+\s*[.、)]\s*/, "").trim()) // 去掉开头编号
    .filter((s) => s.length > 0);
}

async function api(body: any) {
  const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.ok;
}

const CSS = `
.emp * { box-sizing: border-box; }
.emp-wrap { max-width: 720px; margin: 0 auto; padding: 24px; }
.emp-head-in { max-width: 720px; margin: 0 auto; padding: 0 16px; height: 56px; display: flex; align-items: center; justify-content: space-between; }
.emp-profile { display: flex; align-items: center; gap: 16px; }
.emp-add { display: flex; gap: 8px; margin-bottom: 12px; align-items: flex-start; }
.emp-add textarea { flex: 1; }
.emp-prio { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.emp-task { display: flex; align-items: center; gap: 10px; padding: 14px 16px; flex-wrap: wrap; }
.emp-task-name { flex: 1; min-width: 120px; font-size: 15px; word-break: break-word; }
.emp-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.emp-note { padding: 0 16px 12px 92px; }
@media (max-width: 560px) {
  .emp-wrap { padding: 16px; }
  .emp-profile { padding: 14px !important; margin-bottom: 14px !important; gap: 12px; }
  .emp-avatar { width: 40px !important; height: 40px !important; font-size: 15px !important; }
  .emp-hi { font-size: 16px !important; }
  .emp-pct div:first-child { font-size: 22px !important; }
  .emp-add { flex-direction: column; align-items: stretch; }
  .emp-add textarea { width: 100%; }
  .emp-add button { width: 100%; padding: 12px !important; height: auto !important; }
  .emp-note { padding-left: 16px; }
}
`;

const toggleStyle = (on: boolean, c: string): React.CSSProperties => ({ padding: "7px 14px", borderRadius: 8, fontSize: 14, cursor: "pointer", border: `1px solid ${on ? c : "#cbd5e1"}`, background: on ? c : "#fff", color: on ? "#fff" : "#475569", fontWeight: on ? 600 : 400 });
const chipStyle = (on: boolean, c: string): React.CSSProperties => ({ fontSize: 12, padding: "3px 10px", borderRadius: 999, cursor: "pointer", border: `1px solid ${on ? c : "#e2e8f0"}`, background: on ? c : "#fff", color: on ? "#fff" : "#94a3b8", fontWeight: on ? 600 : 400, whiteSpace: "nowrap", flex: "none" });
const noteBtnStyle = (has: boolean): React.CSSProperties => ({ fontSize: 12, padding: "3px 10px", borderRadius: 999, cursor: "pointer", border: `1px solid ${has ? "#0f172a" : "#e2e8f0"}`, background: has ? "#0f172a" : "#fff", color: has ? "#fff" : "#94a3b8", whiteSpace: "nowrap", flex: "none" });
const delBtnStyle: React.CSSProperties = { background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 13, flex: "none" };
const empOverlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 };
const empModal: React.CSSProperties = { width: "100%", maxWidth: 380, background: "#fff", borderRadius: 14, padding: 24 };
const empGhostBtn: React.CSSProperties = { background: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 14px", fontSize: 14, cursor: "pointer" };
const empDangerBtn: React.CSSProperties = { background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer" };

export default function EmployeeBoard({ me, tasks: initialTasks }: { me: Me; tasks: Task[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [newTask, setNewTask] = useState("");
  const [important, setImportant] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null);
  const [lang, setLang] = useState<"zh" | "en">("zh");
  useEffect(() => {
    const l = (navigator.language || "zh").toLowerCase();
    setLang(l.startsWith("zh") ? "zh" : "en");
  }, []);
  const t = T[lang];

  useEffect(() => { setTasks(initialTasks); }, [initialTasks]);

  const fmtDate = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return lang === "zh" ? `${d.getMonth() + 1}月${d.getDate()}日` : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const todayTasks = tasks.filter((x) => x.state !== "done" || isToday(x.done_at)).sort(byPriority);
  const historyTasks = tasks.filter((x) => x.state === "done" && !isToday(x.done_at)).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));

  const total = todayTasks.length;
  const done = todayTasks.filter((x) => x.state === "done").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const q: Quadrant = important && urgent ? 1 : important ? 2 : urgent ? 3 : 4;

  const cycle = async (task: Task) => {
    // 已完成再点 → 复制一条新的「待开始」任务，原任务保持已完成
    if (task.state === "done") {
      const temp: Task = { id: "temp-" + Date.now(), name: task.name, state: "todo", done_at: null, important: task.important, urgent: task.urgent, note: null };
      setTasks((prev) => [...prev, temp]);
      const ok = await api({ action: "assign", name: task.name, important: task.important, urgent: task.urgent });
      if (ok) router.refresh();
      else setTasks((prev) => prev.filter((x) => x.id !== temp.id));
      return;
    }
    const order: TaskState[] = ["todo", "doing", "done"];
    const next = order[(order.indexOf(task.state) + 1) % 3];
    const nowIso = new Date().toISOString();
    setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, state: next, done_at: next === "done" ? nowIso : null } : x)));
    const ok = await api({ action: "setState", task_id: task.id, state: next });
    if (!ok) setTasks((prev) => prev.map((x) => (x.id === task.id ? task : x)));
  };

  const setPriority = async (task: Task, imp: boolean, urg: boolean) => {
    setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, important: imp, urgent: urg } : x)));
    const ok = await api({ action: "setPriority", task_id: task.id, important: imp, urgent: urg });
    if (!ok) setTasks((prev) => prev.map((x) => (x.id === task.id ? task : x)));
  };

  const openNote = (task: Task) => { setEditingNote(task.id); setNoteDraft(task.note ?? ""); };
  const saveNote = async (task: Task) => {
    const note = noteDraft.trim();
    setEditingNote(null);
    setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, note: note || null } : x)));
    const ok = await api({ action: "setNote", task_id: task.id, note });
    if (!ok) setTasks((prev) => prev.map((x) => (x.id === task.id ? task : x)));
  };

  const removeTask = async (task: Task) => {
    setConfirmDelete(null);
    setTasks((prev) => prev.filter((x) => x.id !== task.id));
    const ok = await api({ action: "delete", task_id: task.id });
    if (!ok) router.refresh();
  };

  const addTask = async () => {
    const names = splitTasks(newTask);
    if (names.length === 0) return;
    setBusy(true);
    setNewTask("");
    // 立即显示（乐观更新）
    const temps = names.map((name, i) => ({ id: "temp-" + Date.now() + "-" + i, name, state: "todo" as TaskState, done_at: null, important, urgent, note: null }));
    setTasks((prev) => [...prev, ...temps]);
    // 逐个提交
    let allOk = true;
    for (const name of names) {
      const ok = await api({ action: "assign", name, important, urgent });
      if (!ok) allOk = false;
    }
    setBusy(false);
    if (allOk) router.refresh();
    else { setNewTask(names.join("\n")); router.refresh(); }
  };

  const logout = async () => { await fetch("/api/logout", { method: "POST" }); router.push("/login"); router.refresh(); };

  const taskRow = (x: Task, history = false) => {
    const editing = editingNote === x.id;
    return (
      <div key={x.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
        <div className="emp-task">
          <button onClick={() => cycle(x)} style={{ background: TASK_TONE[x.state].bg, color: TASK_TONE[x.state].color, border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 13, minWidth: 68, fontWeight: 500, flex: "none" }}>{t[x.state]}</button>
          <span className="emp-task-name" style={{ textDecoration: x.state === "done" ? "line-through" : "none", color: x.state === "done" ? "#94a3b8" : "#334155" }}>{x.name}</span>
          <div className="emp-actions">
            {!history && (
              <>
                <button onClick={() => setPriority(x, !x.important, x.urgent)} style={chipStyle(x.important, "#1d4ed8")}>{t.important}</button>
                <button onClick={() => setPriority(x, x.important, !x.urgent)} style={chipStyle(x.urgent, "#be123c")}>{t.urgent}</button>
                <button onClick={() => (editing ? setEditingNote(null) : openNote(x))} style={noteBtnStyle(!!x.note)}>{t.note}</button>
              </>
            )}
            {history && <span className="emp-hist-date" style={{ fontSize: 12, color: "#94a3b8", flex: "none" }}>{fmtDate(x.done_at)} {t.doneAt}</span>}
            <button onClick={() => setConfirmDelete(x)} style={delBtnStyle}>{t.delete}</button>
          </div>
        </div>
        {x.note && !editing && (
          <div className="emp-note" style={{ fontSize: 13, color: "#64748b", whiteSpace: "pre-wrap" }}>📝 {x.note}</div>
        )}
        {editing && (
          <div className="emp-note">
            <textarea value={noteDraft} autoFocus onChange={(e) => setNoteDraft(e.target.value)} rows={2} placeholder={t.notePlaceholder}
              style={{ width: "100%", padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={() => saveNote(x)} style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}>{t.save}</button>
              <button onClick={() => setEditingNote(null)} style={{ background: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>{t.cancel}</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="emp" style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: 'system-ui,-apple-system,"PingFang SC",sans-serif', color: "#1e293b" }}>
      <style>{CSS}</style>
      <header style={{ background: "#0f172a", color: "#f1f5f9", position: "sticky", top: 0, zIndex: 10 }}>
        <div className="emp-head-in">
          <span style={{ color: "#fbbf24", fontFamily: "ui-monospace,monospace", letterSpacing: ".08em", fontSize: 13 }}>● {t.brand}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14 }}>
            <span style={{ color: "#cbd5e1" }}>{me.name}</span>
            <button onClick={logout} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 14 }}>{t.logout}</button>
          </div>
        </div>
      </header>

      <main className="emp-wrap">
        <div className="emp-profile" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div className="emp-avatar" style={{ width: 48, height: 48, flex: "none", borderRadius: "50%", background: "#1e293b", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 500, fontSize: 17 }}>{me.name.slice(-2)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="emp-hi" style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>{t.hi}，{me.name}</h2>
            <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>{me.dept} · {me.role}</p>
          </div>
          <div className="emp-pct" style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{pct}%</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{t.todayCount} {done}/{total}</div>
          </div>
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#475569", margin: "0 0 6px" }}>{t.myTasks}</h3>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 14px" }}>{t.hint}</p>

        <div className="emp-add">
          <textarea value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder={t.addPlaceholder} rows={3}
            style={{ padding: "12px", border: "1px solid #cbd5e1", borderRadius: 8, outline: "none", fontSize: 16, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
          <button onClick={addTask} disabled={busy || !newTask.trim()}
            style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, padding: "0 18px", height: 46, fontSize: 15, fontWeight: 500, cursor: "pointer", opacity: busy || !newTask.trim() ? 0.5 : 1, whiteSpace: "nowrap" }}>
            {busy ? t.adding : t.add}
          </button>
        </div>

        <div className="emp-prio">
          <span style={{ fontSize: 13, color: "#64748b" }}>{t.priority}：</span>
          <button type="button" onClick={() => setImportant((v) => !v)} style={toggleStyle(important, "#1d4ed8")}>{important ? "✓ " : ""}{t.important}</button>
          <button type="button" onClick={() => setUrgent((v) => !v)} style={toggleStyle(urgent, "#be123c")}>{urgent ? "✓ " : ""}{t.urgent}</button>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>→</span>
          <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 999, color: QUAD_META[q].color, background: QUAD_META[q].bg }}>{t[QUAD_META[q].key]}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {todayTasks.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: 40, background: "#fff", border: "1px dashed #e2e8f0", borderRadius: 12 }}>{t.empty}</div>
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

      {confirmDelete && (
        <div style={empOverlay} onClick={() => setConfirmDelete(null)}>
          <div style={empModal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t.deleteTitle}</h3>
            <p style={{ fontSize: 14, color: "#64748b", margin: "10px 0 4px" }}>{t.deleteMsg}</p>
            <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 20px", wordBreak: "break-word" }}>{confirmDelete.name}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={empGhostBtn}>{t.cancel}</button>
              <button onClick={() => removeTask(confirmDelete)} style={empDangerBtn}>{t.delete}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
