"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type TaskState = "todo" | "doing" | "done";
type Task = { id: string; assignee_id: string; name: string; state: TaskState };
type Employee = { id: string; name: string; role: string | null; dept: string | null; email: string; absent: boolean };

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

export default function AdminBoard({ employees, tasks, adminEmail }: { employees: Employee[]; tasks: Task[]; adminEmail: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<string | undefined>(undefined);
  const [transfer, setTransfer] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);

  const tasksOf = (empId: string) => tasks.filter((t) => t.assignee_id === empId);
  const selected = employees.find((e) => e.id === selectedId) ?? null;

  const overview = useMemo(() => {
    const c: Record<Status, number> = { completed: 0, ontrack: 0, behind: 0, absent: 0 };
    employees.forEach((e) => (c[statusOf(e, tasksOf(e.id))] += 1));
    return c;
  }, [employees, tasks]);

  const filtered = employees.filter((e) => e.name.includes(query) || (e.role ?? "").includes(query) || (e.dept ?? "").includes(query));

  const doAssign = async (empId: string, name: string) => {
    setBusy(true);
    await api({ action: "assign", assignee_id: empId, name });
    setBusy(false); setAssignOpen(false); router.refresh();
  };
  const doTransfer = async (taskId: string, toId: string) => {
    setBusy(true);
    await api({ action: "transfer", task_id: taskId, to_assignee_id: toId });
    setBusy(false); setTransfer(null); router.refresh();
  };
  const doCycle = async (task: Task) => {
    const order: TaskState[] = ["todo", "doing", "done"];
    const next = order[(order.indexOf(task.state) + 1) % 3];
    await api({ action: "setState", task_id: task.id, state: next });
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
            <span style={{ color: "#cbd5e1" }}>{adminEmail}</span>
            <button onClick={logout} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 14 }}>退出</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
        {selected ? (
          <Detail emp={selected} tasks={tasksOf(selected.id)} onBack={() => setSelectedId(null)}
            onCycle={doCycle} onAssignHere={() => { setAssignFor(selected.id); setAssignOpen(true); }} onTransfer={(t) => setTransfer(t)} bar={bar} />
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>员工每日工作进度</h2>
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
                const pending = t.filter((x) => x.state !== "done");
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
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 60 }}>
                        {pending.map((x) => (
                          <span key={x.id} style={{ fontSize: 12, color: "#475569", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 999, color: TASK_TONE[x.state].color, background: TASK_TONE[x.state].bg }}>{TASK_LABEL[x.state]}</span>
                            {x.name}
                          </span>
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

      {assignOpen && <AssignModal employees={employees} defaultId={assignFor} busy={busy} onClose={() => setAssignOpen(false)} onAssign={doAssign} />}
      {transfer && <TransferModal task={transfer} employees={employees} busy={busy} onClose={() => setTransfer(null)} onConfirm={doTransfer} />}
    </div>
  );
}

function Detail({ emp, tasks, onBack, onCycle, onAssignHere, onTransfer, bar }: any) {
  const s = stats(tasks); const m = META[statusOf(emp, tasks)];
  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", marginBottom: 16 }}>← 返回列表</button>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 24, display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ ...avatar, width: 56, height: 56, fontSize: 18 }}>{emp.name.slice(-2)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{emp.name}</h3>
            <span style={{ ...pill, color: m.color, background: m.bg, borderColor: m.bg }}>{m.label}</span>
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
      <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 12px" }}>点左侧状态字切换：待开始 → 进行中 → 已完成</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tasks.length === 0 ? <div style={{ textAlign: "center", color: "#94a3b8", padding: 32, background: "#fff", border: "1px dashed #e2e8f0", borderRadius: 8 }}>还没有任务</div> :
          tasks.map((t: Task) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px" }}>
              <button onClick={() => onCycle(t)} style={{ background: TASK_TONE[t.state].bg, color: TASK_TONE[t.state].color, border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 12, width: 60 }}>{TASK_LABEL[t.state]}</button>
              <span style={{ flex: 1, textDecoration: t.state === "done" ? "line-through" : "none", color: t.state === "done" ? "#94a3b8" : "#334155" }}>{t.name}</span>
              <button onClick={() => onTransfer(t)} style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 13 }}>转交</button>
            </div>
          ))}
      </div>
    </div>
  );
}

function AssignModal({ employees, defaultId, busy, onClose, onAssign }: any) {
  const [empId, setEmpId] = useState(defaultId ?? employees[0]?.id);
  const [name, setName] = useState("");
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
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnGhost}>取消</button>
          <button disabled={busy || !name.trim()} onClick={() => onAssign(empId, name.trim())} style={{ ...btnPrimary, opacity: busy || !name.trim() ? 0.5 : 1 }}>{busy ? "提交中…" : "确认分配"}</button>
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
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 };
const modal: React.CSSProperties = { width: "100%", maxWidth: 420, background: "#fff", borderRadius: 14, padding: 24 };
const field: React.CSSProperties = { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", fontSize: 15, outline: "none", boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6, display: "block" };
