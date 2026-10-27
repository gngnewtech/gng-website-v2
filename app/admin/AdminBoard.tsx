"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type TaskState = "todo" | "doing" | "done";
type Task = { id: string; assignee_id: string; name: string; state: TaskState; important: boolean; urgent: boolean; note: string | null; is_private?: boolean; start_at?: string | null };
type Employee = { id: string; name: string; role: string | null; dept: string | null; email: string; absent: boolean; is_admin?: boolean; is_manager?: boolean; user_id?: string | null };

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
// 开始时间标签（按本地时间显示）
function StartBadge({ t }: { t: Task }) {
  if (!t.start_at) return null;
  const d = new Date(t.start_at);
  const pad = (n: number) => String(n).padStart(2, "0");
  const txt = `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return <span style={{ fontSize: 11, color: "#0369a1", background: "#f0f9ff", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap", flex: "none" }}>🕐 {txt}</span>;
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
async function empApi(body: any): Promise<{ ok: boolean; error?: string; created?: boolean }> {
  const res = await fetch("/api/employees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, error: data?.error, created: data?.created };
}

export default function AdminBoard({ employees, tasks, adminEmail, isAdmin }: { employees: Employee[]; tasks: Task[]; adminEmail: string; isAdmin: boolean }) {
  const router = useRouter();
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

  const tasksOf = (empId: string) => tasks.filter((t) => t.assignee_id === empId);
  const selected = employees.find((e) => e.id === selectedId) ?? null;

  const overview = useMemo(() => {
    const c: Record<Status, number> = { completed: 0, ontrack: 0, behind: 0, absent: 0 };
    employees.forEach((e) => (c[statusOf(e, tasksOf(e.id))] += 1));
    return c;
  }, [employees, tasks]);

  const filtered = employees.filter((e) => e.name.includes(query) || (e.role ?? "").includes(query) || (e.dept ?? "").includes(query));

  const doAssign = async (empId: string, name: string, important: boolean, urgent: boolean, isPrivate: boolean, startAt: string) => {
    setBusy(true);
    await api({ action: "assign", assignee_id: empId, name, important, urgent, is_private: isAdmin && isPrivate, start_at: startAt ? new Date(startAt).toISOString() : null });
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
      await api({ action: "assign", assignee_id: task.assignee_id, name: task.name, important: task.important, urgent: task.urgent, is_private: isAdmin && !!task.is_private });
      showToast("已复制一条新任务到「待开始」");
      router.refresh();
      return;
    }
    const order: TaskState[] = ["todo", "doing", "done"];
    const next = order[(order.indexOf(task.state) + 1) % 3];
    await api({ action: "setState", task_id: task.id, state: next });
    showToast(`已切换为「${TASK_LABEL[next]}」`);
    router.refresh();
  };
  const doSetPriority = async (task: Task, important: boolean, urgent: boolean) => {
    await api({ action: "setPriority", task_id: task.id, important, urgent });
    router.refresh();
  };
  const doSetNote = async (taskId: string, note: string) => {
    await api({ action: "setNote", task_id: taskId, note });
    router.refresh();
  };
  const doSetStart = async (taskId: string, startIso: string | null) => {
    await api({ action: "setStart", task_id: taskId, start_at: startIso });
    router.refresh();
  };
  const doSetCredentials = async (employeeId: string, email: string, password: string) => {
    const r = await empApi({ action: "setCredentials", employee_id: employeeId, email, password });
    if (r.ok) {
      setCredsFor(null);
      showToast(r.created ? "已开通登录账号" : "账号已更新");
      router.refresh();
    } else {
      showToast(r.error || "操作失败");
    }
  };
  const doDelete = async (task: Task) => {
    setConfirmDelete(null);
    await api({ action: "delete", task_id: task.id });
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
      <header style={{ background: "#0f172a", color: "#f1f5f9", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#fbbf24", fontFamily: "ui-monospace,monospace", letterSpacing: ".16em", fontSize: 13 }}>● ADMIN.GNGNT.COM</span>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 14 }}>
            <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, border: "1px solid #334155", color: "#fbbf24" }}>{isAdmin ? "管理员" : "经理"}</span>
            {!isAdmin && <a href="/employee" style={{ color: "#cbd5e1", textDecoration: "none" }}>我的任务</a>}
            <span style={{ color: "#cbd5e1" }}>{adminEmail}</span>
            <button onClick={logout} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 14 }}>退出</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
        {selected ? (
          <Detail emp={selected} tasks={tasksOf(selected.id)} onBack={() => setSelectedId(null)}
            onCycle={doCycle} onSetPriority={doSetPriority} onSetNote={doSetNote} onSetStart={doSetStart} onDelete={(t: Task) => setConfirmDelete(t)} isAdmin={isAdmin} onManageAccount={(e: Employee) => setCredsFor(e)}
            onAssignHere={() => { setAssignFor(selected.id); setAssignOpen(true); }} onTransfer={(t) => setTransfer(t)} bar={bar} />
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>每日工作</h2>
                <p style={{ fontSize: 14, color: "#64748b", marginTop: 2 }}>数据实时来自数据库</p>
              </div>
              <button onClick={() => { setAssignFor(undefined); setAssignOpen(true); }} style={btnPrimary}>+ 分配任务</button>
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
                const pending = t.filter((x) => x.state !== "done").sort(byPriority);
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
                          <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                            <QuadBadge t={x} />
                            <PrivateBadge t={x} />
                            <span style={{ color: "#334155" }}>{x.name}</span>
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
        <div style={{ position: "fixed", left: "50%", bottom: 32, transform: "translateX(-50%)", background: "#0f172a", color: "#fff", padding: "10px 18px", borderRadius: 999, fontSize: 14, zIndex: 100, boxShadow: "0 6px 20px rgba(15,23,42,.25)" }}>{toast}</div>
      )}
      {credsFor && <CredentialsModal emp={credsFor} busy={busy} onClose={() => setCredsFor(null)} onSave={doSetCredentials} />}
    </div>
  );
}

function Detail({ emp, tasks, onBack, onCycle, onSetPriority, onSetNote, onSetStart, onDelete, onAssignHere, onTransfer, bar, isAdmin, onManageAccount }: any) {
  const s = stats(tasks); const m = META[statusOf(emp, tasks)];
  const sorted = [...tasks].sort((a, b) => {
    // 已完成的排到最后，其余按重要紧急排序
    const ad = a.state === "done" ? 1 : 0, bd = b.state === "done" ? 1 : 0;
    return ad !== bd ? ad - bd : byPriority(a, b);
  });
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const openNote = (t: Task) => { setEditingNote(t.id); setNoteDraft(t.note ?? ""); };
  const saveNote = (t: Task) => { setEditingNote(null); onSetNote(t.id, noteDraft.trim()); };
  const [editingStart, setEditingStart] = useState<string | null>(null);
  const [startDraft, setStartDraft] = useState("");
  const toLocalInput = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const openStart = (t: Task) => { setEditingStart(t.id); setStartDraft(toLocalInput(t.start_at)); };
  const saveStart = (t: Task, override?: string | null) => {
    const iso = override !== undefined ? override : (startDraft ? new Date(startDraft).toISOString() : null);
    setEditingStart(null); onSetStart(t.id, iso);
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
            {isAdmin && !emp.is_admin && !emp.is_manager && (
              <button onClick={() => onManageAccount(emp)} style={{ fontSize: 13, padding: "4px 12px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", cursor: "pointer" }}>
                {emp.user_id ? "账号设置" : "开通登录"}
              </button>
            )}
          </div>
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 6 }}>{emp.dept} · {emp.role} · {emp.email}</p>
          <div style={{ marginTop: 16 }}>{bar(s.pct, m.bar)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 30, fontWeight: 700 }}>{s.pct}%</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>完成 {s.done}/{s.total}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 0 12px" }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: 0 }}>任务清单</h4>
        <button onClick={onAssignHere} style={btnPrimary}>+ 给 {emp.name} 派任务</button>
      </div>
      <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 12px" }}>按重要紧急程度排序 · 点状态字切换进度（已完成再点复制新任务）· 点「重要」「紧急」调优先级 · 点「备注」写说明</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.length === 0 ? <div style={{ textAlign: "center", color: "#94a3b8", padding: 32, background: "#fff", border: "1px dashed #e2e8f0", borderRadius: 8 }}>还没有任务</div> :
          sorted.map((t: Task) => {
            const editing = editingNote === t.id;
            return (
              <div key={t.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", flexWrap: "wrap" }}>
                  <StartBadge t={t} />
                  <button onClick={() => (editingStart === t.id ? setEditingStart(null) : openStart(t))} style={{ fontSize: 13, padding: "3px 10px", borderRadius: 6, cursor: "pointer", border: `1px solid ${t.start_at ? "#0369a1" : "#cbd5e1"}`, background: t.start_at ? "#0369a1" : "#fff", color: t.start_at ? "#fff" : "#475569", flex: "none" }}>时间</button>
                  <button onClick={() => onSetPriority(t, !t.important, t.urgent)} style={chipStyle(t.important, "#1d4ed8")}>重要</button>
                  <button onClick={() => onSetPriority(t, t.important, !t.urgent)} style={chipStyle(t.urgent, "#be123c")}>紧急</button>
                  <PrivateBadge t={t} />
                  <span style={{ flex: 1, minWidth: 120, textDecoration: t.state === "done" ? "line-through" : "none", color: t.state === "done" ? "#94a3b8" : "#334155" }}>{t.name}</span>
                  <button onClick={() => (editing ? setEditingNote(null) : openNote(t))} style={noteBtnStyle(!!t.note)}>备注</button>
                  <button onClick={() => onTransfer(t)} style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 13, flex: "none" }}>转交</button>
                  <button onClick={() => onDelete(t)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 13, flex: "none" }}>删除</button>
                  <button onClick={() => onCycle(t)} style={{ background: TASK_TONE[t.state].bg, color: TASK_TONE[t.state].color, border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 12, width: 60, flex: "none" }}>{TASK_LABEL[t.state]}</button>
                </div>
                {t.note && !editing && (
                  <div style={{ padding: "0 16px 12px 88px", fontSize: 13, color: "#64748b", whiteSpace: "pre-wrap" }}>📝 {t.note}</div>
                )}
                {editing && (
                  <div style={{ padding: "0 16px 14px 88px" }}>
                    <textarea value={noteDraft} autoFocus onChange={(e) => setNoteDraft(e.target.value)} rows={2} placeholder="写点备注或需要修改的地方…"
                      style={{ width: "100%", padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button onClick={() => saveNote(t)} style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}>保存</button>
                      <button onClick={() => setEditingNote(null)} style={{ background: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>取消</button>
                    </div>
                  </div>
                )}
                {editingStart === t.id && (
                  <div style={{ padding: "0 16px 14px 88px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#64748b" }}>开始时间</span>
                    <input type="datetime-local" value={startDraft} onChange={(e) => setStartDraft(e.target.value)} style={{ padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, outline: "none" }} />
                    <button onClick={() => saveStart(t)} style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}>保存</button>
                    <button onClick={() => saveStart(t, null)} style={{ background: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>清除</button>
                    <button onClick={() => setEditingStart(null)} style={{ background: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>取消</button>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

function AssignModal({ employees, defaultId, busy, canPrivate, onClose, onAssign }: any) {
  const [empId, setEmpId] = useState(defaultId ?? employees[0]?.id);
  const [name, setName] = useState("");
  const [important, setImportant] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [startAt, setStartAt] = useState("");
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
        <label style={lbl}>开始时间（可留空）</label>
        <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} style={field} />
        {canPrivate && (
          <label style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#475569", cursor: "pointer" }}>
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#7c3aed" }} />
            🔒 私密（经理看不到）
          </label>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnGhost}>取消</button>
          <button disabled={busy || !name.trim()} onClick={() => onAssign(empId, name.trim(), important, urgent, isPrivate, startAt)} style={{ ...btnPrimary, opacity: busy || !name.trim() ? 0.5 : 1 }}>{busy ? "提交中…" : "确认分配"}</button>
        </div>
      </div>
    </div>
  );
}

function CredentialsModal({ emp, busy, onClose, onSave }: any) {
  const hasLogin = !!emp.user_id;
  const [email, setEmail] = useState(emp.email ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const canSave = email.trim() && (hasLogin || password.length >= 6) && (!password || password.length >= 6);
  const submit = async () => { setSaving(true); await onSave(emp.id, email.trim(), password); setSaving(false); };
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{hasLogin ? "账号设置" : "开通登录"}</h3>
        <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 20px" }}>
          {emp.name} · {hasLogin ? "可修改登录邮箱或重设密码" : "为该员工开通登录账号"}
        </p>
        <label style={lbl}>登录邮箱</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" style={field} />
        <div style={{ height: 16 }} />
        <label style={lbl}>{hasLogin ? "新密码（留空=不修改）" : "初始密码（至少 6 位）"}</label>
        <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={hasLogin ? "留空则只改邮箱" : "至少 6 位"} style={field} />
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "8px 0 0" }}>
          {hasLogin ? "填写新密码即为该员工重设密码；修改后请把新密码/邮箱告知本人。" : "开通后请把邮箱和初始密码告知该员工，首次登录后可自行使用。"}
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
