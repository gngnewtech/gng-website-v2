"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import NoteThread, { type TaskNote } from "../_shared/NoteThread";
import { createClient } from "@/lib/supabase/client";

const NOTE_LABELS = { placeholder: "写进一步的进展或消息…", add: "添加跟进", adding: "保存中…", cancel: "取消", delete: "删除", confirmDelete: "删除这条跟进？", unknownAuthor: "（原备注）" };

type TaskState = "todo" | "doing" | "done";
type Task = { id: string; assignee_id: string; name: string; state: TaskState; important: boolean; urgent: boolean; note: string | null; is_private?: boolean; start_at?: string | null; recur?: Recur | null };
type DoOrder = { id: string; title: string; do_no: string | null; invoice_no: string | null; assignee_id: string; created_at: string; done_at: string | null };
type DoFile = { id: string; order_id: string; path: string; name: string; mime: string | null; uploaded_by_name: string | null; created_at: string };
const DO_BUCKET = "do-files";
const isImgFile = (f: { mime: string | null; name: string }) => (f.mime ?? "").startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(f.name);
type DoStep = { id: string; order_id: string; step_no: number; name: string; done_at: string | null; done_by_name: string | null };
type Employee = { id: string; name: string; role: string | null; dept: string | null; email: string; absent: boolean; is_admin?: boolean; is_manager?: boolean; user_id?: string | null; username?: string | null };

function stats(tasks: Task[]) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.state === "done").length;
  const doing = tasks.filter((t) => t.state === "doing").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, doing, pct };
}
type Status = "completed" | "ontrack" | "behind" | "absent";
function statusOf(emp: Employee, tasks: Task[]): Status {
  if (emp.absent) return "absent";
  const { pct, doing } = stats(tasks);
  if (pct === 100 && tasks.length > 0) return "completed";
  if (pct < 40 && doing === 0) return "behind";
  return "ontrack";
}
const META: Record<Status, { label: string; color: string; bg: string; bar: string }> = {
  completed: { label: "已完成", color: "#047857", bg: "#ecfdf5", bar: "#10b981" },
  ontrack: { label: "进行中", color: "#b45309", bg: "#fffbeb", bar: "#f59e0b" },
  behind: { label: "进度落后", color: "#be123c", bg: "#fff1f2", bar: "#f43f5e" },
  absent: { label: "未打卡", color: "#64748b", bg: "#f1f5f9", bar: "#cbd5e1" },
};
const TASK_LABEL: Record<TaskState, string> = { todo: "待开始", doing: "进行中", done: "已完成" };
// —— 重复规则 ——
type Recur = "daily" | "weekly" | "monthly";
const RECUR_LABEL: Record<Recur, string> = { daily: "每天", weekly: "每周", monthly: "每月" };
const RECUR_OPTIONS: { v: Recur | ""; label: string }[] = [
  { v: "", label: "不重复" }, { v: "daily", label: "每天" }, { v: "weekly", label: "每周" }, { v: "monthly", label: "每月" },
];
const pad2 = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
// 是否是「今天」的未完成任务（按本地日期）
function isToday(t: Task) {
  return !!t.start_at && t.state !== "done" && dayKey(new Date(t.start_at)) === dayKey(new Date());
}
// 开始日期标签（按本地日期显示）；今天的任务用醒目的橙色「今天」
function StartBadge({ t }: { t: Task }) {
  if (!t.start_at) return null;
  const d = new Date(t.start_at);
  const txt = `${d.getMonth() + 1}月${d.getDate()}日`;
  const recur = t.recur ? ` · 🔁${RECUR_LABEL[t.recur]}` : "";
  if (isToday(t)) {
    return <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "#f59e0b", borderRadius: 999, padding: "2px 10px", whiteSpace: "nowrap", flex: "none" }}>📅 今天 {txt}{recur}</span>;
  }
  return <span style={{ fontSize: 11, color: "#0369a1", background: "#f0f9ff", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap", flex: "none" }}>📅 {txt}{recur}</span>;
}
const TASK_TONE: Record<TaskState, { color: string; bg: string }> = {
  todo: { color: "#64748b", bg: "#f1f5f9" },
  doing: { color: "#b45309", bg: "#fffbeb" },
  done: { color: "#047857", bg: "#ecfdf5" },
};

// —— 四象限（重要 × 紧急）——
type Quadrant = 1 | 2 | 3 | 4;
function quadrantOf(t: Task): Quadrant {
  if (t.important && t.urgent) return 1;
  if (t.important) return 2;
  if (t.urgent) return 3;
  return 4;
}
const QUAD_META: Record<Quadrant, { label: string; color: string; bg: string; rank: number }> = {
  1: { label: "重要紧急", color: "#be123c", bg: "#fff1f2", rank: 0 },
  2: { label: "重要不急", color: "#1d4ed8", bg: "#eff6ff", rank: 1 },
  3: { label: "紧急不重要", color: "#c2410c", bg: "#fff7ed", rank: 2 },
  4: { label: "一般", color: "#64748b", bg: "#f1f5f9", rank: 3 },
};
// 排序：先按重要，后按紧急（象限一 → 二 → 三 → 四）
function byPriority(a: Task, b: Task) {
  return QUAD_META[quadrantOf(a)].rank - QUAD_META[quadrantOf(b)].rank;
}
// 排序：有时间的按时间从早到晚在前 → 没时间的在后 → 同一时间/都没时间时紧急优先，再按重要紧急
function byTimeUrgent(a: Task, b: Task) {
  const at = a.start_at ? 0 : 1, bt = b.start_at ? 0 : 1;
  if (at !== bt) return at - bt;                                   // 没时间的沉到后面
  if (a.start_at && b.start_at && a.start_at !== b.start_at)        // 有时间的按时间从早到晚
    return a.start_at < b.start_at ? -1 : 1;
  const au = a.urgent ? 0 : 1, bu = b.urgent ? 0 : 1;              // 同一时间/都没时间：紧急优先
  if (au !== bu) return au - bu;
  return byPriority(a, b);
}
// 今天的任务排最前，其余按原规则
function byTodayFirst(a: Task, b: Task) {
  const at = isToday(a) ? 0 : 1, bt = isToday(b) ? 0 : 1;
  return at !== bt ? at - bt : byTimeUrgent(a, b);
}
// 私密任务标记（只有管理员会拿到私密任务，经理那边数据库已过滤）
function PrivateBadge({ t }: { t: Task }) {
  if (!t.is_private) return null;
  return <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 999, color: "#7c3aed", background: "#f5f3ff", whiteSpace: "nowrap", flex: "none" }}>🔒 私密</span>;
}
function QuadBadge({ t }: { t: Task }) {
  const q = QUAD_META[quadrantOf(t)];
  return <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 999, color: q.color, background: q.bg, whiteSpace: "nowrap" }}>{q.label}</span>;
}
const chipStyle = (on: boolean, c: string): React.CSSProperties => ({ fontSize: 12, padding: "3px 10px", borderRadius: 999, cursor: "pointer", border: `1px solid ${on ? c : "#e2e8f0"}`, background: on ? c : "#fff", color: on ? "#fff" : "#94a3b8", fontWeight: on ? 600 : 400, whiteSpace: "nowrap", flex: "none" });
const actBtn = (color: string = "#475569", border: string = "#cbd5e1"): React.CSSProperties => ({ fontSize: 13, padding: "3px 12px", borderRadius: 6, cursor: "pointer", border: `1px solid ${border}`, background: "#fff", color, whiteSpace: "nowrap", flex: "none" });
const noteBtnStyle = (has: boolean): React.CSSProperties => ({ fontSize: 12, padding: "3px 10px", borderRadius: 999, cursor: "pointer", border: `1px solid ${has ? "#0f172a" : "#e2e8f0"}`, background: has ? "#0f172a" : "#fff", color: has ? "#fff" : "#94a3b8", whiteSpace: "nowrap", flex: "none" });

async function api(body: any) {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}
// 员工账号管理接口，返回 {ok, error?, created?}
async function empApi(body: any): Promise<{ ok: boolean; error?: string; created?: boolean; warning?: string }> {
  const res = await fetch("/api/employees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, error: data?.error, created: data?.created, warning: data?.warning };
}

export default function AdminBoard({ employees, tasks: tasksProp, notes: notesProp = [], doOrders = [], doSteps: doStepsProp = [], doFiles = [], meId = null, adminEmail, isAdmin }: { employees: Employee[]; tasks: Task[]; notes?: TaskNote[]; doOrders?: DoOrder[]; doSteps?: DoStep[]; doFiles?: DoFile[]; meId?: string | null; adminEmail: string; isAdmin: boolean }) {
  const router = useRouter();
  const [doSteps, setDoSteps] = useState<DoStep[]>(doStepsProp);
  useEffect(() => { setDoSteps(doStepsProp); }, [doStepsProp]);
  const stepsByOrder = useMemo(() => {
    const m: Record<string, DoStep[]> = {};
    doSteps.forEach((s) => { (m[s.order_id] ||= []).push(s); });
    Object.values(m).forEach((l) => l.sort((a, b) => a.step_no - b.step_no));
    return m;
  }, [doSteps]);
  const myName = employees.find((e) => e.id === meId)?.name ?? null;
  const doToggleStep = async (st: DoStep) => {
    const next = !st.done_at;
    if (!next && !confirm(`取消「${st.name}」这一步？`)) return;
    const backup = doSteps;
    setDoSteps((prev) => prev.map((x) => (x.id === st.id ? { ...x, done_at: next ? new Date().toISOString() : null, done_by_name: next ? myName : null } : x)));
    const res = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggleStep", step_id: st.id, done: next }) });
    if (!res.ok) { setDoSteps(backup); const d = await res.json().catch(() => ({} as any)); showToast(d?.error || "操作失败"); return; }
    router.refresh();
  };
  const [tasks, setTasks] = useState<Task[]>(tasksProp);
  useEffect(() => { setTasks(tasksProp); }, [tasksProp]);
  const [notes, setNotes] = useState<TaskNote[]>(notesProp);
  useEffect(() => { setNotes(notesProp); }, [notesProp]);
  const notesByTask = useMemo(() => {
    const m: Record<string, TaskNote[]> = {};
    notes.forEach((n) => { (m[n.task_id] ||= []).push(n); });
    return m;
  }, [notes]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<string | undefined>(undefined);
  const [transfer, setTransfer] = useState<Task | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 1800); };
  const [credsFor, setCredsFor] = useState<Employee | null>(null);
  const [removeEmp, setRemoveEmp] = useState<Employee | null>(null);
  const [staffOpen, setStaffOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const tasksOf = (empId: string) => tasks.filter((t) => t.assignee_id === empId);
  const selected = employees.find((e) => e.id === selectedId) ?? null;

  const overview = useMemo(() => {
    const c: Record<Status, number> = { completed: 0, ontrack: 0, behind: 0, absent: 0 };
    employees.forEach((e) => (c[statusOf(e, tasksOf(e.id))] += 1));
    return c;
  }, [employees, tasks]);

  const filtered = employees.filter((e) => e.name.includes(query) || (e.role ?? "").includes(query) || (e.dept ?? "").includes(query));

  const doAssign = async (empId: string, name: string, important: boolean, urgent: boolean, isPrivate: boolean, startAt: string, recur: Recur | "") => {
    setBusy(true);
    // 设了重复但没选日期 → 从今天开始
    const day = startAt || (recur ? dayKey(new Date()) : "");
    await api({ action: "assign", assignee_id: empId, name, important, urgent, is_private: isAdmin && isPrivate, start_at: day ? new Date(`${day}T00:00`).toISOString() : null, recur: recur || null });
    setBusy(false); setAssignOpen(false); router.refresh();
  };
  const doTransfer = async (taskId: string, toId: string) => {
    setBusy(true);
    await api({ action: "transfer", task_id: taskId, to_assignee_id: toId });
    setBusy(false); setTransfer(null); router.refresh();
  };
  const doCycle = async (task: Task) => {
    // 已完成再点 → 复制一条新的「待开始」任务给同一员工，原任务保持已完成
    if (task.state === "done") {
      if (task.recur) { showToast("重复任务已自动生成下一次"); return; }
      await api({ action: "assign", assignee_id: task.assignee_id, name: task.name, important: task.important, urgent: task.urgent, is_private: isAdmin && !!task.is_private });
      router.refresh();
      return;
    }
    const order: TaskState[] = ["todo", "doing", "done"];
    const next = order[(order.indexOf(task.state) + 1) % 3];
    // 先本地立即切换，点一下马上变；再同步后端
    setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, state: next, done_at: next === "done" ? new Date().toISOString() : null } : x)));
    const ok = await api({ action: "setState", task_id: task.id, state: next });
    if (!ok) setTasks((prev) => prev.map((x) => (x.id === task.id ? task : x)));
    else if (next === "done" && task.recur) showToast(`已生成下一次（${RECUR_LABEL[task.recur]}）`);
    router.refresh();
  };
  const doSetPriority = async (task: Task, important: boolean, urgent: boolean) => {
    await api({ action: "setPriority", task_id: task.id, important, urgent });
    router.refresh();
  };
  const doAddNote = async (taskId: string, body: string): Promise<boolean> => {
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "addNote", task_id: taskId, body }) });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok || !data?.note) { showToast(data?.error || "保存失败"); return false; }
    setNotes((prev) => [...prev, data.note]);
    return true;
  };
  const doDeleteNote = async (note: TaskNote) => {
    const backup = notes;
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deleteNote", note_id: note.id }) });
    if (!res.ok) { setNotes(backup); const d = await res.json().catch(() => ({} as any)); showToast(d?.error || "删除失败"); }
  };
  const doSetStart = async (taskId: string, startIso: string | null, recur: Recur | null) => {
    setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, start_at: startIso, recur: startIso ? recur : null } : x)));
    await api({ action: "setStart", task_id: taskId, start_at: startIso, recur });
    router.refresh();
  };
  const doSetCredentials = async (employeeId: string, username: string, password: string) => {
    const r = await empApi({ action: "setCredentials", employee_id: employeeId, username, password });
    if (r.ok) {
      setCredsFor(null);
      showToast(r.created ? "已开通登录账号" : "账号已更新");
      router.refresh();
    } else {
      showToast(r.error || "操作失败");
    }
  };
  const doAddEmployee = async (name: string, username: string, password: string, role: string, dept: string) => {
    const r = await empApi({ action: "addEmployee", name, username, password, role, dept });
    if (r.ok) { setAddOpen(false); showToast("已添加员工"); router.refresh(); }
    else { showToast(r.error || "添加失败"); }
  };
  const doDeleteEmployee = async (emp: Employee) => {
    setBusy(true);
    const r = await empApi({ action: "deleteEmployee", employee_id: emp.id });
    setBusy(false);
    if (r.ok) {
      setRemoveEmp(null); setSelectedId(null);
      showToast(r.warning || `已删除员工 ${emp.name}`);
      router.refresh();
    } else {
      showToast(r.error || "删除失败");
    }
  };
  const doDelete = async (task: Task) => {
    setConfirmDelete(null);
    await api({ action: "delete", task_id: task.id });
    router.refresh();
  };
  const doEditTask = async (original: Task, name: string, assigneeId: string, important: boolean, urgent: boolean) => {
    setEditTask(null);
    const nm = name.trim();
    setTasks((prev) => prev.map((x) => (x.id === original.id ? { ...x, name: nm || x.name, assignee_id: assigneeId, important, urgent } : x)));
    const calls: Promise<boolean>[] = [];
    if (nm && nm !== original.name) calls.push(api({ action: "setName", task_id: original.id, name: nm }));
    if (assigneeId && assigneeId !== original.assignee_id) calls.push(api({ action: "transfer", task_id: original.id, to_assignee_id: assigneeId }));
    if (important !== original.important || urgent !== original.urgent) calls.push(api({ action: "setPriority", task_id: original.id, important, urgent }));
    await Promise.all(calls);
    router.refresh();
  };
  const logout = async () => { await fetch("/api/logout", { method: "POST" }); router.push("/login"); router.refresh(); };

  const bar = (pct: number, color: string) => (
    <div style={{ width: "100%", height: 8, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999, transition: "width .5s" }} />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: 'system-ui,-apple-system,"PingFang SC",sans-serif', color: "#1e293b" }}>
      <style>{`
        .ab-cols { display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 24px; align-items: start; }
        @media (max-width: 1100px) { .ab-cols { grid-template-columns: minmax(0, 1fr); } }
        @media (max-width: 600px) {
          .ab-head { padding: 0 12px !important; }
          .ab-brand { font-size: 11px !important; letter-spacing: .06em !important; }
          .ab-head-right { gap: 10px !important; font-size: 13px !important; }
          .ab-email { display: none !important; }
          .ab-main { padding: 16px 12px !important; }
          .ab-tname { min-width: 100% !important; flex-basis: 100% !important; }
        }
      `}</style>
      <header style={{ background: "#0f172a", color: "#f1f5f9", position: "sticky", top: 0, zIndex: 10 }}>
        <div className="ab-head" style={{ maxWidth: selected ? 1360 : 960, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="ab-brand" style={{ color: "#fbbf24", fontFamily: "ui-monospace,monospace", letterSpacing: ".16em", fontSize: 13, whiteSpace: "nowrap" }}>● ADMIN.GNGNT.COM</span>
          <div className="ab-head-right" style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 14 }}>
            <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, border: "1px solid #334155", color: "#fbbf24", whiteSpace: "nowrap", flex: "none" }}>{isAdmin ? "管理员" : "经理"}</span>
            {!isAdmin && <a href="/employee" style={{ color: "#cbd5e1", textDecoration: "none", whiteSpace: "nowrap", flex: "none" }}>我的任务</a>}
            <span className="ab-email" style={{ color: "#cbd5e1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>{adminEmail}</span>
            <button onClick={logout} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 14, whiteSpace: "nowrap", flex: "none" }}>退出</button>
          </div>
        </div>
      </header>

      <main className="ab-main" style={{ maxWidth: selected ? 1360 : 960, margin: "0 auto", padding: 24 }}>
        {selected ? (
          <Detail emp={selected} tasks={tasksOf(selected.id)} onBack={() => setSelectedId(null)}
            onCycle={doCycle} onSetPriority={doSetPriority} notesByTask={notesByTask} onAddNote={doAddNote} onDeleteNote={doDeleteNote} meId={meId} onSetStart={doSetStart} onDelete={(t: Task) => setConfirmDelete(t)} onEdit={(t: Task) => setEditTask(t)} isAdmin={isAdmin} onManageAccount={(e: Employee) => setCredsFor(e)} canRemove={isAdmin && !selected.is_admin && selected.id !== meId} onRemove={() => setRemoveEmp(selected)}
            onAssignHere={() => { setAssignFor(selected.id); setAssignOpen(true); }} onTransfer={(t) => setTransfer(t)} bar={bar}
            doOrders={doOrders} doFiles={doFiles} employees={employees} stepsByOrder={stepsByOrder} onToggleStep={doToggleStep} />
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>每日工作</h2>
                <p style={{ fontSize: 14, color: "#64748b", marginTop: 2 }}>数据实时来自数据库</p>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {isAdmin && <button onClick={() => setStaffOpen(true)} style={btnGhost}>设置员工</button>}
                {isAdmin && <button onClick={() => setAddOpen(true)} style={btnGhost}>+ 添加员工</button>}
                <a href="/admin/do" style={{ ...btnGhost, textDecoration: "none", display: "inline-block" }}>DO 流程</a>
                <button onClick={() => { setAssignFor(undefined); setAssignOpen(true); }} style={btnPrimary}>+ 分配任务</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
              {[["员工总数", employees.length, "#475569", "#f1f5f9"], ["已完成", overview.completed, "#059669", "#ecfdf5"], ["进行中", overview.ontrack, "#d97706", "#fffbeb"], ["落后/未打卡", overview.behind + overview.absent, "#e11d48", "#fff1f2"]].map(([l, v, c, b], i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: c as string }}>{v as number}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{l as string}</div>
                </div>
              ))}
            </div>

            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索姓名、岗位或部门…"
              style={{ width: "100%", padding: "11px 12px", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 16, boxSizing: "border-box", outline: "none" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((emp) => {
                const t = tasksOf(emp.id); const s = stats(t); const m = META[statusOf(emp, t)];
                const pending = t.filter((x) => x.state !== "done").sort(byTodayFirst);
                return (
                  <button key={emp.id} onClick={() => setSelectedId(emp.id)} style={{ ...rowStyle, alignItems: "stretch", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, width: "100%" }}>
                      <div style={avatar}>{emp.name.slice(-2)}</div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 600 }}>{emp.name}</span>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>{emp.role}</span>
                        </div>
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ flex: 1 }}>{bar(s.pct, m.bar)}</div>
                          <span style={{ fontSize: 13, color: "#64748b", width: 56, textAlign: "right" }}>{s.done}/{s.total} 项</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 18, fontWeight: 700, width: 48, textAlign: "right" }}>{s.pct}%</span>
                        <span style={{ ...pill, color: m.color, background: m.bg, borderColor: m.bg }}>{m.label}</span>
                      </div>
                    </div>
                    {pending.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 60 }}>
                        {pending.map((x) => (
                          <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, ...(isToday(x) ? { background: "#fffbeb", borderLeft: "3px solid #f59e0b", borderRadius: 4, padding: "3px 8px", marginLeft: -11 } : {}) }}>
                            <QuadBadge t={x} />
                            <PrivateBadge t={x} />
                            <span style={{ color: isToday(x) ? "#0f172a" : "#334155", fontWeight: isToday(x) ? 700 : 400 }}>{x.name}</span>
                            <StartBadge t={x} />
                            <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 999, color: TASK_TONE[x.state].color, background: TASK_TONE[x.state].bg }}>{TASK_LABEL[x.state]}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {t.length > 0 && pending.length === 0 && (
                      <div style={{ fontSize: 12, color: "#059669", paddingLeft: 60 }}>✓ 今日任务已全部完成</div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>

      {assignOpen && <AssignModal employees={employees} defaultId={assignFor} busy={busy} canPrivate={isAdmin} onClose={() => setAssignOpen(false)} onAssign={doAssign} />}
      {transfer && <TransferModal task={transfer} employees={employees} busy={busy} onClose={() => setTransfer(null)} onConfirm={doTransfer} />}
      {confirmDelete && (
        <div style={overlay} onClick={() => setConfirmDelete(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>确认删除</h3>
            <p style={{ fontSize: 14, color: "#64748b", margin: "10px 0 4px" }}>确定删除这条任务吗？此操作不可撤销。</p>
            <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 20px" }}>{confirmDelete.name}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={btnGhost}>取消</button>
              <button onClick={() => doDelete(confirmDelete)} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>删除</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div style={{ position: "fixed", left: "50%", top: 72, transform: "translateX(-50%)", background: "#0f172a", color: "#fff", padding: "12px 22px", borderRadius: 999, fontSize: 15, fontWeight: 600, zIndex: 100, boxShadow: "0 10px 30px rgba(15,23,42,.35)", display: "flex", alignItems: "center", gap: 8 }}>✓ {toast}</div>
      )}
      {staffOpen && (
        <StaffModal employees={employees} meId={meId} countOf={(id: string) => tasksOf(id).length}
          onClose={() => setStaffOpen(false)} onAdd={() => setAddOpen(true)}
          onAccount={(e: Employee) => setCredsFor(e)} onRemove={(e: Employee) => setRemoveEmp(e)} />
      )}
      {credsFor && <CredentialsModal emp={credsFor} busy={busy} onClose={() => setCredsFor(null)} onSave={doSetCredentials} />}
      {addOpen && <AddEmployeeModal onClose={() => setAddOpen(false)} onSave={doAddEmployee} />}
      {removeEmp && (
        <div style={overlay} onClick={() => !busy && setRemoveEmp(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>删除员工</h3>
            <p style={{ fontSize: 15, fontWeight: 600, margin: "12px 0 8px" }}>{removeEmp.name}{removeEmp.email ? ` · ${removeEmp.email}` : ""}</p>
            <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 20px", lineHeight: 1.6 }}>
              将同时删除 TA 名下的 <b style={{ color: "#dc2626" }}>{tasksOf(removeEmp.id).length}</b> 条任务和登录账号，TA 将无法再登录。此操作不可撤销。
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button disabled={busy} onClick={() => setRemoveEmp(null)} style={btnGhost}>取消</button>
              <button disabled={busy} onClick={() => doDeleteEmployee(removeEmp)} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer", opacity: busy ? 0.5 : 1 }}>{busy ? "删除中…" : "确认删除"}</button>
            </div>
          </div>
        </div>
      )}
      {editTask && <EditTaskModal task={editTask} employees={employees} onClose={() => setEditTask(null)} onSave={doEditTask} />}
    </div>
  );
}

function Detail({ emp, tasks, doOrders = [], doFiles = [], employees = [], stepsByOrder = {}, onToggleStep, onBack, onCycle, onSetPriority, notesByTask, onAddNote, onDeleteNote, meId, onSetStart, onDelete, onEdit, onAssignHere, onTransfer, bar, isAdmin, onManageAccount, canRemove, onRemove }: any) {
  const s = stats(tasks); const m = META[statusOf(emp, tasks)];
  const sorted = [...tasks].sort((a, b) => {
    // 已完成的排到最后；其余：紧急优先 → 有时间的按时间 → 无时间的在后
    const ad = a.state === "done" ? 1 : 0, bd = b.state === "done" ? 1 : 0;
    return ad !== bd ? ad - bd : byTodayFirst(a, b);
  });
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ id: string; msg: string } | null>(null);
  const cycleOrder: TaskState[] = ["todo", "doing", "done"];
  const [confirmDone, setConfirmDone] = useState<Task | null>(null);
  const runCycle = (t: Task) => {
    const msg = t.state === "done" ? "已复制" : "→ " + TASK_LABEL[cycleOrder[(cycleOrder.indexOf(t.state) + 1) % 3]];
    setFlash({ id: t.id, msg });
    setTimeout(() => setFlash((f) => (f && f.id === t.id ? null : f)), 1500);
    onCycle(t);
  };
  const clickStatus = (t: Task) => {
    // 进行中 → 已完成 需二次确认，防误点
    if (t.state === "doing") { setConfirmDone(t); return; }
    runCycle(t);
  };
  const [editingStart, setEditingStart] = useState<string | null>(null);
  const [startDraft, setStartDraft] = useState("");
  const [recurDraft, setRecurDraft] = useState<Recur | "">("");
  const toLocalInput = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const openStart = (t: Task) => { setEditingStart(t.id); setStartDraft(toLocalInput(t.start_at)); setRecurDraft(t.recur ?? ""); };
  const saveStart = (t: Task, override?: string | null) => {
    // 选了重复但没选日期 → 从今天开始
    const day = startDraft || (recurDraft ? dayKey(new Date()) : "");
    const iso = override !== undefined ? override : (day ? new Date(`${day}T00:00`).toISOString() : null);
    setEditingStart(null); onSetStart(t.id, iso, iso ? (recurDraft || null) : null);
  };
  const activeTasks = sorted.filter((t: Task) => t.state !== "done");
  const doneTasks = sorted.filter((t: Task) => t.state === "done");
  const [doneOpen, setDoneOpen] = useState(false);
  const renderRow = (t: Task) => {
    const editing = editingNote === t.id;
    const tNotes: TaskNote[] = notesByTask[t.id] ?? [];
    const today = isToday(t);
    return (
      <div key={t.id} style={today
        ? { background: "#fffbeb", border: "2px solid #f59e0b", borderLeft: "6px solid #f59e0b", borderRadius: 8, overflow: "hidden", boxShadow: "0 4px 14px rgba(245,158,11,.25)" }
        : { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
        <div className="ab-trow" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", flexWrap: "wrap" }}>
          <StartBadge t={t} />
          <button onClick={() => (editingStart === t.id ? setEditingStart(null) : openStart(t))} style={{ fontSize: 13, padding: "3px 10px", borderRadius: 6, cursor: "pointer", border: `1px solid ${t.start_at ? "#0369a1" : "#cbd5e1"}`, background: t.start_at ? "#0369a1" : "#fff", color: t.start_at ? "#fff" : "#475569", flex: "none" }}>日期</button>
          <button onClick={() => onSetPriority(t, !t.important, t.urgent)} style={chipStyle(t.important, "#1d4ed8")}>重要</button>
          <button onClick={() => onSetPriority(t, t.important, !t.urgent)} style={chipStyle(t.urgent, "#be123c")}>紧急</button>
          <PrivateBadge t={t} />
          <span className="ab-tname" style={{ flex: 1, minWidth: 120, textDecoration: t.state === "done" ? "line-through" : "none", color: t.state === "done" ? "#94a3b8" : today ? "#0f172a" : "#334155", fontWeight: today ? 700 : 400 }}>{t.name}</span>
          <button onClick={() => setEditingNote(editing ? null : t.id)} style={tNotes.length ? { ...actBtn("#fff", "#0f172a"), background: "#0f172a" } : actBtn()}>{tNotes.length ? "跟进 ●" : "跟进"}</button>
          <button onClick={() => onEdit(t)} style={actBtn()}>编辑</button>
          <button onClick={() => onTransfer(t)} style={actBtn("#2563eb", "#bfdbfe")}>转交</button>
          <button onClick={() => onDelete(t)} style={actBtn("#dc2626", "#fecaca")}>删除</button>
          <button onClick={() => clickStatus(t)} style={{ background: TASK_TONE[t.state].bg, color: TASK_TONE[t.state].color, border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 12, width: 60, flex: "none" }}>{TASK_LABEL[t.state]}</button>
          {flash && flash.id === t.id && <span style={{ fontSize: 12, fontWeight: 600, color: "#047857", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 999, padding: "2px 10px", whiteSpace: "nowrap", flex: "none" }}>✓ {flash.msg}</span>}
        </div>
        <NoteThread
          notes={tNotes}
          editing={editing}
          onCloseEditor={() => setEditingNote(null)}
          onAdd={(body) => onAddNote(t.id, body)}
          onDelete={onDeleteNote}
          canDelete={(n) => isAdmin || (!!meId && n.author_id === meId)}
          labels={NOTE_LABELS}
        />
        {editingStart === t.id && (
          <div style={{ padding: "0 16px 14px 88px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>开始日期</span>
            <input type="date" value={startDraft} onChange={(e) => setStartDraft(e.target.value)} style={{ padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, outline: "none" }} />
            <span style={{ fontSize: 12, color: "#64748b" }}>重复</span>
            <select value={recurDraft} onChange={(e) => setRecurDraft(e.target.value as Recur | "")} style={{ padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, outline: "none", background: "#fff" }}>
              {RECUR_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
            <button onClick={() => saveStart(t)} style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}>保存</button>
            <button onClick={() => saveStart(t, null)} style={{ background: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>清除</button>
            <button onClick={() => setEditingStart(null)} style={{ background: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>取消</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", marginBottom: 16 }}>← 返回列表</button>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 24, display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ ...avatar, width: 56, height: 56, fontSize: 18 }}>{emp.name.slice(-2)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{emp.name}</h3>
            <span style={{ ...pill, color: m.color, background: m.bg, borderColor: m.bg }}>{m.label}</span>
            {isAdmin && !emp.is_admin && (
              <button onClick={() => onManageAccount(emp)} style={{ fontSize: 13, padding: "4px 12px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", cursor: "pointer" }}>
                {emp.user_id ? "账号设置" : "开通登录"}
              </button>
            )}
            {canRemove && (
              <button onClick={onRemove} style={{ fontSize: 13, padding: "4px 12px", borderRadius: 999, border: "1px solid #fecaca", background: "#fff", color: "#dc2626", cursor: "pointer" }}>
                删除员工
              </button>
            )}
          </div>
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 6 }}>{[emp.dept, emp.role, emp.username ? `@${emp.username}` : emp.email].filter(Boolean).join(" · ")}</p>
          <div style={{ marginTop: 16 }}>{bar(s.pct, m.bar)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 30, fontWeight: 700 }}>{s.pct}%</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>完成 {s.done}/{s.total}</div>
        </div>
      </div>
      <div className="ab-cols" style={{ marginTop: 24 }}>
      <section style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 12px" }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: 0 }}>每日任务</h4>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={onAssignHere} style={btnPrimary}>+ 给 {emp.name} 派任务</button>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 12px" }}>今天的任务置顶并以橙色突出 · 点状态字切换进度（已完成再点复制新任务）· 点「日期」可设每天/每周/每月重复，完成后自动生成下一次 · 点「重要」「紧急」调优先级</p>
      {sorted.length === 0 ? <div style={{ textAlign: "center", color: "#94a3b8", padding: 32, background: "#fff", border: "1px dashed #e2e8f0", borderRadius: 8 }}>还没有任务</div> : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activeTasks.length === 0
              ? <div style={{ textAlign: "center", color: "#94a3b8", padding: 24, background: "#fff", border: "1px dashed #e2e8f0", borderRadius: 8 }}>没有未完成的任务</div>
              : activeTasks.map(renderRow)}
          </div>
          {doneTasks.length > 0 && (
            <div style={{ marginTop: 20, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
              <button onClick={() => setDoneOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: 12, color: "#64748b", width: 12, display: "inline-block", transform: doneOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#047857" }}>已完成</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#047857", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 999, padding: "1px 8px" }}>{doneTasks.length}</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>{doneOpen ? "收起" : "展开"}</span>
              </button>
              {doneOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 12px 12px" }}>
                  {doneTasks.map(renderRow)}
                </div>
              )}
            </div>
          )}
        </>
      )}
      </section>
      <DoColumn emp={emp} orders={doOrders} files={doFiles} employees={employees} stepsByOrder={stepsByOrder} onToggle={onToggleStep} />
      </div>

      {confirmDone && (
        <div style={overlay} onClick={() => setConfirmDone(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>确认完成</h3>
            <p style={{ fontSize: 14, color: "#64748b", margin: "10px 0 4px" }}>确定把这条任务标记为「已完成」吗？</p>
            <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 20px", wordBreak: "break-word" }}>{confirmDone.name}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDone(null)} style={btnGhost}>取消</button>
              <button onClick={() => { const t = confirmDone; setConfirmDone(null); runCycle(t); }} style={btnPrimary}>确认完成</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DoColumn({ emp, orders: allOrders, files = [], employees, stepsByOrder, onToggle }: { emp: Employee; orders: DoOrder[]; files?: DoFile[]; employees: Employee[]; stepsByOrder: Record<string, DoStep[]>; onToggle: (s: DoStep) => void }) {
  const [doneOpen, setDoneOpen] = useState(false);
  // 管理员 / 经理默认看全部 DO，可切换只看当前员工的
  const [onlyEmp, setOnlyEmp] = useState(false);
  const empName: Record<string, string> = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e.name])), [employees]);
  const empCount = allOrders.filter((o) => o.assignee_id === emp.id).length;
  const orders = onlyEmp ? allOrders.filter((o) => o.assignee_id === emp.id) : allOrders;
  // 附件：私有桶，图片用 1 小时签名链接做缩略图；点击用 10 分钟签名链接打开
  const sb = useMemo(() => createClient(), []);
  const filesOf = useMemo(() => {
    const m: Record<string, DoFile[]> = {};
    files.forEach((f) => { (m[f.order_id] ||= []).push(f); });
    return m;
  }, [files]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    const need = files.filter((f) => isImgFile(f) && !thumbs[f.path]).map((f) => f.path);
    if (!need.length) return;
    let alive = true;
    sb.storage.from(DO_BUCKET).createSignedUrls(need, 3600).then(({ data }: any) => {
      if (!alive || !data) return;
      setThumbs((prev) => { const n = { ...prev }; data.forEach((d: any) => { if (d.signedUrl && d.path) n[d.path] = d.signedUrl; }); return n; });
    });
    return () => { alive = false; };
  }, [files, sb]); // eslint-disable-line react-hooks/exhaustive-deps
  const openFile = async (f: DoFile) => {
    const w = window.open("", "_blank"); // 先同步开窗口，避免手机浏览器拦截
    const { data, error } = await sb.storage.from(DO_BUCKET).createSignedUrl(f.path, 600);
    if (error || !data?.signedUrl) { w?.close(); alert("打开失败"); return; }
    if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  };
  // 已完成：7 步全勾，或最后一步「完成」已勾 → 跟已完成任务一样收到最下面
  const finishStep = (o: DoOrder) => (stepsByOrder[o.id] ?? []).find((s) => s.step_no === 7 || s.name === "完成");
  const isDone = (o: DoOrder) => { const l = stepsByOrder[o.id] ?? []; return l.length > 0 && (l.every((s) => s.done_at) || !!finishStep(o)?.done_at); };
  const doneTime = (o: DoOrder) => o.done_at ?? finishStep(o)?.done_at ?? "";
  const active = orders.filter((o) => !isDone(o));
  const done = orders.filter(isDone).sort((a, b) => doneTime(b).localeCompare(doneTime(a)));
  const fmtT = (iso: string) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  const card = (o: DoOrder) => {
    const steps = stepsByOrder[o.id] ?? [];
    const nextIdx = steps.findIndex((s) => !s.done_at);
    const doneCount = steps.filter((s) => s.done_at).length;
    return (
      <div key={o.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 120, fontWeight: 600, color: "#0f172a", wordBreak: "break-word" }}>{o.title}</span>
          <span style={{ fontSize: 12, padding: "1px 8px", borderRadius: 999, flex: "none", border: `1px solid ${o.assignee_id === emp.id ? "#f59e0b" : "#e2e8f0"}`, background: o.assignee_id === emp.id ? "#fffbeb" : "#f8fafc", color: o.assignee_id === emp.id ? "#b45309" : "#64748b" }}>{empName[o.assignee_id] ?? "—"}</span>
          <span style={{ fontSize: 12, color: "#64748b", flex: "none" }}>{doneCount}/{steps.length}</span>
        </div>
        {(o.do_no || o.invoice_no) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {o.do_no && <span style={doChip}>DO {o.do_no}</span>}
            {o.invoice_no && <span style={doChip}>发票 {o.invoice_no}</span>}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6, marginTop: 10 }}>
          {steps.map((s, i) => {
            const on = !!s.done_at; const isNext = i === nextIdx;
            return (
              <button key={s.id} onClick={() => onToggle(s)} title={on ? `${s.done_by_name ?? ""} ${fmtT(s.done_at!)}` : "点击标记完成"}
                style={{ padding: "6px 4px", borderRadius: 6, cursor: "pointer", fontSize: 12, lineHeight: 1.3, textAlign: "center", minWidth: 0,
                  border: `${isNext ? 2 : 1}px solid ${on ? "#10b981" : isNext ? "#2563eb" : "#e2e8f0"}`,
                  background: on ? "#ecfdf5" : "#fff", color: on ? "#047857" : isNext ? "#1d4ed8" : "#94a3b8", fontWeight: on || isNext ? 600 : 400 }}>
                <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{on ? "✓ " : ""}{s.name}</div>
                {on && <div style={{ fontSize: 10, fontWeight: 400, color: "#64748b", marginTop: 2, whiteSpace: "nowrap" }}>{fmtT(s.done_at!)}</div>}
              </button>
            );
          })}
        </div>
        {(filesOf[o.id] ?? []).length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #e2e8f0" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>📎 附件 {(filesOf[o.id] ?? []).length}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(filesOf[o.id] ?? []).map((f) => (
                <button key={f.id} onClick={() => openFile(f)} title={`${f.name}\n${f.uploaded_by_name ?? ""} ${fmtT(f.created_at)}`}
                  style={{ width: 60, height: 60, padding: 0, borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", overflow: "hidden", cursor: "pointer", flex: "none" }}>
                  {isImgFile(f)
                    ? (thumbs[f.path]
                        ? <img src={thumbs[f.path]} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        : <span style={{ fontSize: 20 }}>🖼</span>)
                    : (
                      <span style={{ display: "flex", flexDirection: "column", height: "100%", alignItems: "center", justifyContent: "center", gap: 2, padding: "0 4px", background: "#fef2f2" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626" }}>PDF</span>
                        <span style={{ fontSize: 9, color: "#64748b", width: "100%", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
                      </span>
                    )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  return (
    <section style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 12px", minHeight: 38 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: 0 }}>DO 单</h4>
        <a href="/admin/do" style={{ ...btnGhost, textDecoration: "none", display: "inline-block" }}>DO 流程 →</a>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button onClick={() => setOnlyEmp(false)} style={chipStyle(!onlyEmp, "#0f172a")}>全部 {allOrders.length}</button>
        <button onClick={() => setOnlyEmp(true)} style={chipStyle(onlyEmp, "#0f172a")}>只看 {emp.name} {empCount}</button>
      </div>
      <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 12px" }}>点格子勾选步骤 · 蓝框是下一步 · 橙色名字是当前员工负责的</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {active.length === 0
          ? <div style={{ textAlign: "center", color: "#94a3b8", padding: 24, background: "#fff", border: "1px dashed #e2e8f0", borderRadius: 8 }}>没有进行中的 DO</div>
          : active.map(card)}
      </div>
      {done.length > 0 && (
        <div style={{ marginTop: 16, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <button onClick={() => setDoneOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
            <span style={{ fontSize: 12, color: "#64748b", width: 12, display: "inline-block", transform: doneOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#047857" }}>已完成</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#047857", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 999, padding: "1px 8px" }}>{done.length}</span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>{doneOpen ? "收起" : "展开"}</span>
          </button>
          {doneOpen && <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 12px 12px" }}>{done.map(card)}</div>}
        </div>
      )}
    </section>
  );
}
const doChip: React.CSSProperties = { fontSize: 12, padding: "2px 9px", borderRadius: 999, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", whiteSpace: "nowrap" };

function AssignModal({ employees, defaultId, busy, canPrivate, onClose, onAssign }: any) {
  const [empId, setEmpId] = useState(defaultId ?? employees[0]?.id);
  const [name, setName] = useState("");
  const [important, setImportant] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [startAt, setStartAt] = useState("");
  const [recur, setRecur] = useState<Recur | "">("");
  const q: Quadrant = important && urgent ? 1 : important ? 2 : urgent ? 3 : 4;
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>分配任务</h3>
        <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 20px" }}>选择员工并填写任务内容。</p>
        <label style={lbl}>分配给</label>
        <select value={empId} onChange={(e) => setEmpId(e.target.value)} style={field}>
          {employees.map((e: Employee) => <option key={e.id} value={e.id}>{e.name} · {e.role}</option>)}
        </select>
        <div style={{ height: 16 }} />
        <label style={lbl}>任务内容</label>
        <input value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="例如：整理销售数据" style={field} />
        <div style={{ height: 16 }} />
        <label style={lbl}>优先级（四象限）</label>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => setImportant((v) => !v)} style={toggleStyle(important, "#1d4ed8")}>{important ? "✓ " : ""}重要</button>
          <button type="button" onClick={() => setUrgent((v) => !v)} style={toggleStyle(urgent, "#be123c")}>{urgent ? "✓ " : ""}紧急</button>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
          归入象限：<span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 999, color: QUAD_META[q].color, background: QUAD_META[q].bg }}>{QUAD_META[q].label}</span>
        </div>
        <div style={{ height: 16 }} />
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>开始日期（可留空）</label>
            <input type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} style={field} />
          </div>
          <div style={{ width: 120, flex: "none" }}>
            <label style={lbl}>重复</label>
            <select value={recur} onChange={(e) => setRecur(e.target.value as Recur | "")} style={field}>
              {RECUR_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </div>
        </div>
        {recur && !startAt && <p style={{ fontSize: 12, color: "#94a3b8", margin: "6px 0 0" }}>未选日期时从今天开始</p>}
        {canPrivate && (
          <label style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#475569", cursor: "pointer" }}>
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#7c3aed" }} />
            🔒 私密（经理看不到）
          </label>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnGhost}>取消</button>
          <button disabled={busy || !name.trim()} onClick={() => onAssign(empId, name.trim(), important, urgent, isPrivate, startAt, recur)} style={{ ...btnPrimary, opacity: busy || !name.trim() ? 0.5 : 1 }}>{busy ? "提交中…" : "确认分配"}</button>
        </div>
      </div>
    </div>
  );
}

function EditTaskModal({ task, employees, onClose, onSave }: any) {
  const [name, setName] = useState(task.name ?? "");
  const [assigneeId, setAssigneeId] = useState(task.assignee_id);
  const [important, setImportant] = useState(!!task.important);
  const [urgent, setUrgent] = useState(!!task.urgent);
  const [saving, setSaving] = useState(false);
  const submit = async () => { setSaving(true); await onSave(task, name, assigneeId, important, urgent); setSaving(false); };
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>编辑任务</h3>
        <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 20px" }}>可修改任务内容、负责人和优先级。</p>
        <label style={lbl}>任务内容</label>
        <textarea value={name} autoFocus onChange={(e) => setName(e.target.value)} rows={2} style={{ ...field, fontFamily: "inherit", resize: "vertical" }} />
        <div style={{ height: 16 }} />
        <label style={lbl}>负责人</label>
        <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={field}>
          {employees.map((e: Employee) => <option key={e.id} value={e.id}>{e.name}{e.role ? " · " + e.role : ""}</option>)}
        </select>
        <div style={{ height: 16 }} />
        <label style={lbl}>优先级（四象限）</label>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => setImportant((v) => !v)} style={toggleStyle(important, "#1d4ed8")}>{important ? "✓ " : ""}重要</button>
          <button type="button" onClick={() => setUrgent((v) => !v)} style={toggleStyle(urgent, "#be123c")}>{urgent ? "✓ " : ""}紧急</button>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnGhost}>取消</button>
          <button disabled={saving || !name.trim()} onClick={submit} style={{ ...btnPrimary, opacity: saving || !name.trim() ? 0.5 : 1 }}>{saving ? "保存中…" : "保存"}</button>
        </div>
      </div>
    </div>
  );
}

// 员工管理列表：所有员工一览，可添加、改账号/密码、删除（仅管理员可见）
function StaffModal({ employees, meId, countOf, onClose, onAdd, onAccount, onRemove }: any) {
  const [q, setQ] = useState("");
  const rank = (e: Employee) => (e.is_admin ? 0 : e.is_manager ? 1 : 2);
  const list = [...employees]
    .filter((e: Employee) => !q || e.name.includes(q) || (e.username ?? "").includes(q.toLowerCase()) || (e.email ?? "").toLowerCase().includes(q.toLowerCase()) || (e.role ?? "").includes(q) || (e.dept ?? "").includes(q))
    .sort((a: Employee, b: Employee) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const tag = (text: string, color: string, bg: string) => (
    <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 999, color, background: bg, whiteSpace: "nowrap", flex: "none" }}>{text}</span>
  );
  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...modal, maxWidth: 640, maxHeight: "86vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>设置员工</h3>
            <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>共 {employees.length} 人 · 可添加员工、修改用户名和密码、删除员工</p>
          </div>
          <button onClick={onAdd} style={{ ...btnPrimary, flex: "none" }}>+ 添加员工</button>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索姓名、用户名、岗位或部门…"
          style={{ ...field, margin: "16px 0 12px", fontSize: 14 }} />
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, margin: "0 -4px", padding: "0 4px" }}>
          {list.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: 24 }}>没有匹配的员工</div>}
          {list.map((e: Employee) => {
            const isMe = e.id === meId;
            return (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, flexWrap: "wrap" }}>
                <div style={{ ...avatar, width: 36, height: 36, fontSize: 13 }}>{e.name.slice(-2)}</div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600 }}>{e.name}</span>
                    {e.is_admin && tag("管理员", "#b45309", "#fffbeb")}
                    {!e.is_admin && e.is_manager && tag("经理", "#1d4ed8", "#eff6ff")}
                    {isMe && tag("我", "#475569", "#f1f5f9")}
                    {!e.user_id && tag("未开通登录", "#be123c", "#fff1f2")}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, wordBreak: "break-all" }}>
                    <span style={{ color: "#0f172a", fontFamily: "ui-monospace,monospace" }}>{e.username ? `@${e.username}` : "未设用户名"}</span>
                    {[e.role, e.dept].filter(Boolean).length > 0 && ` · ${[e.role, e.dept].filter(Boolean).join(" · ")}`} · {countOf(e.id)} 条任务
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flex: "none" }}>
                  {!e.is_admin && (
                    <button onClick={() => onAccount(e)} style={actBtn()}>{e.user_id ? "账号设置" : "开通登录"}</button>
                  )}
                  {!e.is_admin && !isMe && (
                    <button onClick={() => onRemove(e)} style={actBtn("#dc2626", "#fecaca")}>删除</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose} style={btnGhost}>关闭</button>
        </div>
      </div>
    </div>
  );
}

function AddEmployeeModal({ onClose, onSave }: any) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [dept, setDept] = useState("");
  const [saving, setSaving] = useState(false);
  const uOk = /^[a-z0-9._-]{2,32}$/.test(username.trim());
  const canSave = name.trim() && uOk && password.length >= 6;
  const submit = async () => { setSaving(true); await onSave(name.trim(), username.trim(), password, role.trim(), dept.trim()); setSaving(false); };
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>添加员工</h3>
        <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 20px" }}>新建普通员工，并同时开通登录账号。</p>
        <label style={lbl}>姓名</label>
        <input value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="例如：张伟" style={field} />
        <div style={{ height: 14 }} />
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}><label style={lbl}>岗位（可留空）</label><input value={role} onChange={(e) => setRole(e.target.value)} placeholder="例如：销售" style={field} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>部门（可留空）</label><input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="例如：业务部" style={field} /></div>
        </div>
        <div style={{ height: 14 }} />
        <label style={lbl}>登录用户名</label>
        <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} placeholder="例如：vineetha" autoCapitalize="none" autoCorrect="off" style={field} />
        <p style={{ fontSize: 12, color: username && !uOk ? "#dc2626" : "#94a3b8", margin: "6px 0 0" }}>2–32 位，只能用英文字母、数字、. _ -</p>
        <div style={{ height: 14 }} />
        <label style={lbl}>初始密码（至少 6 位）</label>
        <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 位" style={field} />
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "8px 0 0" }}>创建后请把用户名和初始密码告知该员工。</p>
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnGhost}>取消</button>
          <button disabled={saving || !canSave} onClick={submit} style={{ ...btnPrimary, opacity: saving || !canSave ? 0.5 : 1 }}>{saving ? "提交中…" : "创建"}</button>
        </div>
      </div>
    </div>
  );
}

function CredentialsModal({ emp, busy, onClose, onSave }: any) {
  const hasLogin = !!emp.user_id;
  const [username, setUsername] = useState(emp.username ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const uOk = /^[a-z0-9._-]{2,32}$/.test(username.trim());
  const canSave = uOk && (hasLogin || password.length >= 6) && (!password || password.length >= 6);
  const submit = async () => { setSaving(true); await onSave(emp.id, username.trim(), password); setSaving(false); };
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{hasLogin ? "账号设置" : "开通登录"}</h3>
        <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 20px" }}>
          {emp.name} · {hasLogin ? "可修改用户名或重设密码" : "为该员工开通登录账号"}
        </p>
        <label style={lbl}>登录用户名</label>
        <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} placeholder="例如：vineetha" autoCapitalize="none" autoCorrect="off" style={field} />
        <p style={{ fontSize: 12, color: username && !uOk ? "#dc2626" : "#94a3b8", margin: "6px 0 0" }}>2–32 位，只能用英文字母、数字、. _ -</p>
        <div style={{ height: 16 }} />
        <label style={lbl}>{hasLogin ? "新密码（留空=不修改）" : "初始密码（至少 6 位）"}</label>
        <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={hasLogin ? "留空则不改密码" : "至少 6 位"} style={field} />
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "8px 0 0" }}>
          {hasLogin ? "填写新密码即为该员工重设密码；修改后请把用户名和新密码告知本人。" : "开通后请把用户名和初始密码告知该员工。"}
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnGhost}>取消</button>
          <button disabled={busy || saving || !canSave} onClick={submit} style={{ ...btnPrimary, opacity: busy || saving || !canSave ? 0.5 : 1 }}>{saving ? "提交中…" : "保存"}</button>
        </div>
      </div>
    </div>
  );
}

function TransferModal({ task, employees, busy, onClose, onConfirm }: any) {
  const others = employees.filter((e: Employee) => e.id !== task.assignee_id);
  const [toId, setToId] = useState(others[0]?.id);
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>转交任务</h3>
        <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 16px" }}>「{task.name}」转交给：</p>
        <select value={toId} onChange={(e) => setToId(e.target.value)} style={field}>
          {others.map((e: Employee) => <option key={e.id} value={e.id}>{e.name} · {e.role}</option>)}
        </select>
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnGhost}>取消</button>
          <button disabled={busy} onClick={() => onConfirm(task.id, toId)} style={btnPrimary}>{busy ? "提交中…" : "确认转交"}</button>
        </div>
      </div>
    </div>
  );
}

const avatar: React.CSSProperties = { width: 44, height: 44, flex: "none", borderRadius: "50%", background: "#1e293b", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 500 };
const rowStyle: React.CSSProperties = { width: "100%", textAlign: "left", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, display: "flex", alignItems: "center", gap: 16, cursor: "pointer" };
const pill: React.CSSProperties = { fontSize: 12, padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap", border: "1px solid" };
const btnPrimary: React.CSSProperties = { background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 14, fontWeight: 500, cursor: "pointer" };
const btnGhost: React.CSSProperties = { background: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 12px", fontSize: 14, cursor: "pointer" };
const toggleStyle = (on: boolean, c: string): React.CSSProperties => ({ flex: 1, padding: "9px 12px", borderRadius: 8, fontSize: 14, cursor: "pointer", border: `1px solid ${on ? c : "#cbd5e1"}`, background: on ? c : "#fff", color: on ? "#fff" : "#475569", fontWeight: on ? 600 : 400 });
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 };
const modal: React.CSSProperties = { width: "100%", maxWidth: 420, background: "#fff", borderRadius: 14, padding: 24 };
const field: React.CSSProperties = { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", fontSize: 15, outline: "none", boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6, display: "block" };
