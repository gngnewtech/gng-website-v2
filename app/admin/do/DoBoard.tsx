"use client";

// DO 流程：DO → DO BACK → 递交发票 → 收款 → 采购 → 付款 → 完成
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Me = { id: string; name: string; isAdmin: boolean; canManage: boolean };
type Emp = { id: string; name: string; role: string | null };
type Order = { id: string; title: string; do_no: string | null; invoice_no: string | null; assignee_id: string; created_at: string; done_at: string | null };
type DFile = { id: string; order_id: string; path: string; name: string; mime: string | null; size: number | null; uploaded_by: string | null; uploaded_by_name: string | null; created_at: string };
const BUCKET = "do-files";
const MAX_MB = 10;
const isImg = (f: { mime: string | null; name: string }) => (f.mime ?? "").startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(f.name);
type Step = { id: string; order_id: string; step_no: number; name: string; done_at: string | null; done_by_name: string | null };

async function api(body: any) {
  const res = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({} as any));
  return { ok: res.ok, error: data?.error as string | undefined };
}

function fmt(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const CSS = `
.do * { box-sizing: border-box; }
.do-files { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; }
.do-tile { position: relative; width: 76px; height: 76px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; overflow: hidden; cursor: pointer; flex: none; padding: 0; }
.do-tile:hover { border-color: #94a3b8; }
.do-tile .x { position: absolute; top: 3px; right: 3px; width: 20px; height: 20px; border-radius: 999px; border: none; background: rgba(15,23,42,.65); color: #fff; font-size: 12px; line-height: 20px; text-align: center; cursor: pointer; padding: 0; }
.do-steps { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
@media (max-width: 720px) {
  .do-main { padding: 16px !important; }
  .do-steps { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .do-email { display: none; }
}
@media (max-width: 420px) {
  .do-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;

const btnPrimary: React.CSSProperties = { background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 14, fontWeight: 500, cursor: "pointer" };
const btnGhost: React.CSSProperties = { background: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 12px", fontSize: 14, cursor: "pointer" };
const actBtn = (color = "#334155", border = "#cbd5e1"): React.CSSProperties => ({ fontSize: 13, padding: "4px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "#fff", color, cursor: "pointer", whiteSpace: "nowrap", flex: "none" });
const field: React.CSSProperties = { width: "100%", padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none" };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 };
const modal: React.CSSProperties = { width: "100%", maxWidth: 420, background: "#fff", borderRadius: 14, padding: 24 };
const label: React.CSSProperties = { fontSize: 13, color: "#64748b", margin: "14px 0 6px", display: "block" };
const numChip = (has: boolean): React.CSSProperties => ({ fontSize: 12, padding: "2px 9px", borderRadius: 999, whiteSpace: "nowrap", flex: "none", border: `1px solid ${has ? "#bfdbfe" : "#e2e8f0"}`, background: has ? "#eff6ff" : "#fff", color: has ? "#1d4ed8" : "#94a3b8" });

export default function DoBoard({ me, email, employees, orders: ordersProp, steps: stepsProp, files: filesProp = [] }: { me: Me; email: string; employees: Emp[]; orders: Order[]; steps: Step[]; files?: DFile[] }) {
  const router = useRouter();
  const sb = useMemo(() => createClient(), []);
  const [files, setFiles] = useState<DFile[]>(filesProp);
  useEffect(() => { setFiles(filesProp); }, [filesProp]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [confirmFile, setConfirmFile] = useState<DFile | null>(null);
  const [orders, setOrders] = useState<Order[]>(ordersProp);
  const [steps, setSteps] = useState<Step[]>(stepsProp);
  useEffect(() => { setOrders(ordersProp); }, [ordersProp]);
  useEffect(() => { setSteps(stepsProp); }, [stepsProp]);

  const [query, setQuery] = useState("");
  const [doneOpen, setDoneOpen] = useState(false);
  const [form, setForm] = useState<null | { id?: string; title: string; do_no: string; invoice_no: string; assignee_id: string }>(null);
  const [confirmDelete, setConfirmDelete] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 1800); };

  const empName = useMemo(() => { const m: Record<string, string> = {}; employees.forEach((e) => { m[e.id] = e.name; }); return m; }, [employees]);
  const stepsOf = useMemo(() => {
    const m: Record<string, Step[]> = {};
    steps.forEach((s) => { (m[s.order_id] ||= []).push(s); });
    Object.values(m).forEach((l) => l.sort((a, b) => a.step_no - b.step_no));
    return m;
  }, [steps]);

  const filesOf = useMemo(() => {
    const m: Record<string, DFile[]> = {};
    files.forEach((f) => { (m[f.order_id] ||= []).push(f); });
    return m;
  }, [files]);

  // 图片缩略图：私有桶，用 1 小时有效的签名链接
  useEffect(() => {
    const need = files.filter((f) => isImg(f) && !thumbs[f.path]).map((f) => f.path);
    if (!need.length) return;
    let alive = true;
    sb.storage.from(BUCKET).createSignedUrls(need, 3600).then(({ data }: any) => {
      if (!alive || !data) return;
      setThumbs((prev) => { const n = { ...prev }; data.forEach((d: any) => { if (d.signedUrl && d.path) n[d.path] = d.signedUrl; }); return n; });
    });
    return () => { alive = false; };
  }, [files, sb]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (o: Order, list: FileList | null) => {
    if (!list || !list.length) return;
    const picked = Array.from(list);
    const bad = picked.find((f) => !(f.type.startsWith("image/") || f.type === "application/pdf" || /\.(pdf|png|jpe?g|webp|gif|heic|heif)$/i.test(f.name)));
    if (bad) { showToast(`只能上传图片或 PDF：${bad.name}`); return; }
    const big = picked.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (big) { showToast(`文件超过 ${MAX_MB}MB：${big.name}`); return; }
    setUploading(o.id);
    let okCount = 0;
    for (const f of picked) {
      const ext = (f.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? (f.type === "application/pdf" ? "pdf" : "png")).toLowerCase();
      const path = `${o.id}/${crypto.randomUUID()}.${ext}`;
      const mime = f.type || (ext === "pdf" ? "application/pdf" : `image/${ext === "jpg" ? "jpeg" : ext}`);
      const up = await sb.storage.from(BUCKET).upload(path, f, { contentType: mime, upsert: false });
      if (up.error) { showToast(`上传失败：${up.error.message}`); continue; }
      const { data, error } = await sb.from("do_files")
        .insert({ order_id: o.id, path, name: f.name, mime, size: f.size })
        .select("id, order_id, path, name, mime, size, uploaded_by, uploaded_by_name, created_at")
        .single();
      if (error || !data) { await sb.storage.from(BUCKET).remove([path]); showToast(`保存失败：${error?.message ?? ""}`); continue; }
      setFiles((prev) => [...prev, data as DFile]);
      okCount++;
    }
    setUploading(null);
    if (okCount) showToast(`已上传 ${okCount} 个附件`);
  };

  const openFile = async (f: DFile) => {
    const w = window.open("", "_blank"); // 先同步开窗口，避免手机浏览器拦截
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(f.path, 600);
    if (error || !data?.signedUrl) { w?.close(); showToast("打开失败"); return; }
    if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  };

  const removeFile = async (f: DFile) => {
    setConfirmFile(null);
    const { data, error } = await sb.from("do_files").delete().eq("id", f.id).select("id");
    if (error || !data?.length) { showToast(error?.message || "无权限删除"); return; }
    await sb.storage.from(BUCKET).remove([f.path]);
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
    showToast("已删除附件");
  };

  const q = query.trim().toLowerCase();
  const visible = orders.filter((o) => !q || [o.title, o.do_no, o.invoice_no, empName[o.assignee_id]].some((v) => (v ?? "").toLowerCase().includes(q)));
  const isDone = (o: Order) => { const l = stepsOf[o.id] ?? []; return l.length > 0 && l.every((s) => s.done_at); };
  const active = visible.filter((o) => !isDone(o));
  const done = visible.filter(isDone).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));

  const toggle = async (s: Step) => {
    const next = !s.done_at;
    if (!next && !confirm(`取消「${s.name}」这一步？`)) return;
    const backup = steps;
    setSteps((prev) => prev.map((x) => (x.id === s.id ? { ...x, done_at: next ? new Date().toISOString() : null, done_by_name: next ? me.name : null } : x)));
    const r = await api({ action: "toggleStep", step_id: s.id, done: next });
    if (!r.ok) { setSteps(backup); showToast(r.error || "操作失败"); return; }
    router.refresh();
  };

  const openNew = () => setForm({ title: "", do_no: "", invoice_no: "", assignee_id: me.id });
  const openEdit = (o: Order) => setForm({ id: o.id, title: o.title, do_no: o.do_no ?? "", invoice_no: o.invoice_no ?? "", assignee_id: o.assignee_id });
  const saveForm = async () => {
    if (!form || !form.title.trim()) return;
    setBusy(true);
    const r = form.id
      ? await api({ action: "update", order_id: form.id, title: form.title, do_no: form.do_no, invoice_no: form.invoice_no, ...(me.canManage ? { assignee_id: form.assignee_id } : {}) })
      : await api({ action: "create", title: form.title, do_no: form.do_no, invoice_no: form.invoice_no, assignee_id: me.canManage ? form.assignee_id : me.id });
    setBusy(false);
    if (!r.ok) { showToast(r.error || "保存失败"); return; }
    showToast(form.id ? "已保存" : "已新建 DO");
    setForm(null);
    router.refresh();
  };
  const doDelete = async (o: Order) => {
    setConfirmDelete(null);
    const r = await api({ action: "delete", order_id: o.id });
    if (!r.ok) { showToast(r.error || "删除失败"); return; }
    setOrders((prev) => prev.filter((x) => x.id !== o.id));
    showToast("已删除");
    router.refresh();
  };
  const logout = async () => { await fetch("/api/logout", { method: "POST" }); router.push("/login"); router.refresh(); };

  const card = (o: Order) => {
    const l = stepsOf[o.id] ?? [];
    const n = l.filter((s) => s.done_at).length;
    const nextId = l.find((s) => !s.done_at)?.id;
    const finished = l.length > 0 && n === l.length;
    return (
      <div key={o.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: finished ? "#94a3b8" : "#0f172a", textDecoration: finished ? "line-through" : "none", wordBreak: "break-word", minWidth: 0 }}>{o.title}</span>
          <span style={numChip(!!o.do_no)}>DO {o.do_no || "—"}</span>
          <span style={numChip(!!o.invoice_no)}>发票 {o.invoice_no || "—"}</span>
          <span style={{ fontSize: 12, color: "#475569", background: "#f1f5f9", borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap", flex: "none" }}>👤 {empName[o.assignee_id] ?? "?"}</span>
          <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 600, color: finished ? "#047857" : "#475569", flex: "none" }}>{n}/{l.length || 7}</span>
          <button onClick={() => openEdit(o)} style={actBtn()}>编辑</button>
          {me.canManage && <button onClick={() => setConfirmDelete(o)} style={actBtn("#dc2626", "#fecaca")}>删除</button>}
        </div>
        <div className="do-steps">
          {l.map((s) => {
            const on = !!s.done_at;
            const isNext = s.id === nextId;
            return (
              <button key={s.id} onClick={() => toggle(s)} title={on ? `${s.done_by_name ?? ""} ${fmt(s.done_at)}` : "点击标记完成"}
                style={{ textAlign: "left", padding: "8px 8px", borderRadius: 8, cursor: "pointer", minHeight: 58, display: "flex", flexDirection: "column", gap: 3,
                  border: `1px solid ${on ? "#a7f3d0" : isNext ? "#2563eb" : "#e2e8f0"}`, background: on ? "#ecfdf5" : "#fff" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: on ? "#047857" : isNext ? "#1d4ed8" : "#64748b" }}>
                  <span style={{ width: 15, height: 15, borderRadius: 4, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff",
                    background: on ? "#10b981" : "#fff", border: `1.5px solid ${on ? "#10b981" : isNext ? "#2563eb" : "#cbd5e1"}` }}>{on ? "✓" : ""}</span>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                </span>
                {on && <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1.3 }}>{fmt(s.done_at)}</span>}
                {on && s.done_by_name && <span style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.3 }}>{s.done_by_name}</span>}
              </button>
            );
          })}
        </div>
        {(() => {
          const fl = filesOf[o.id] ?? [];
          const busyUp = uploading === o.id;
          return (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: fl.length ? 8 : 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>📎 附件</span>
                {fl.length > 0 && <span style={{ fontSize: 12, color: "#64748b" }}>{fl.length}</span>}
                <label style={{ ...actBtn(), marginLeft: "auto", opacity: busyUp ? 0.5 : 1, cursor: busyUp ? "default" : "pointer" }}>
                  {busyUp ? "上传中…" : "+ 截图 / PDF"}
                  <input type="file" accept="image/*,application/pdf" multiple disabled={busyUp} style={{ display: "none" }}
                    onChange={(e) => { const l = e.target.files; upload(o, l); e.target.value = ""; }} />
                </label>
              </div>
              {fl.length > 0 && (
                <div className="do-files">
                  {fl.map((f) => {
                    const img = isImg(f);
                    const canDel = me.canManage || f.uploaded_by === me.id;
                    return (
                      <div key={f.id} className="do-tile" role="button" onClick={() => openFile(f)}
                        title={`${f.name}\n${f.uploaded_by_name ?? ""} ${fmt(f.created_at)}`}>
                        {img
                          ? (thumbs[f.path]
                              ? <img src={thumbs[f.path]} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                              : <span style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🖼</span>)
                          : (
                            <span style={{ display: "flex", flexDirection: "column", height: "100%", alignItems: "center", justifyContent: "center", gap: 3, padding: "0 6px", background: "#fef2f2" }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", letterSpacing: ".05em" }}>PDF</span>
                              <span style={{ fontSize: 10, color: "#64748b", width: "100%", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
                            </span>
                          )}
                        {canDel && <button className="x" aria-label="删除附件" onClick={(e) => { e.stopPropagation(); setConfirmFile(f); }}>×</button>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div className="do" style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: 'system-ui,-apple-system,"PingFang SC",sans-serif', color: "#1e293b" }}>
      <style>{CSS}</style>
      <header style={{ background: "#0f172a", color: "#f1f5f9", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: "#fbbf24", fontFamily: "ui-monospace,monospace", letterSpacing: ".16em", fontSize: 13, whiteSpace: "nowrap" }}>● DO 流程</span>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 14 }}>
            <a href={me.canManage ? "/admin" : "/employee"} style={{ color: "#cbd5e1", textDecoration: "none", whiteSpace: "nowrap" }}>{me.canManage ? "任务看板" : "我的任务"}</a>
            <span className="do-email" style={{ color: "#cbd5e1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>{email}</span>
            <button onClick={logout} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" }}>退出</button>
          </div>
        </div>
      </header>

      <main className="do-main" style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, flex: 1 }}>DO 流程</h2>
          <button onClick={openNew} style={btnPrimary}>+ 新建 DO</button>
        </div>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 14px" }}>DO → DO BACK → 递交发票 → 收款 → 采购 → 付款 → 完成 · 点格子勾选，自动记录时间 · 蓝框是下一步</p>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索 标题 / DO 号 / 发票号 / 负责人…" style={{ ...field, marginBottom: 16, background: "#fff" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {active.length === 0
            ? <div style={{ textAlign: "center", color: "#94a3b8", padding: 32, background: "#fff", border: "1px dashed #e2e8f0", borderRadius: 12 }}>{q ? "没有找到" : "没有进行中的 DO"}</div>
            : active.map(card)}
        </div>

        {done.length > 0 && (
          <div style={{ marginTop: 20, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
            <button onClick={() => setDoneOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontSize: 12, color: "#64748b", width: 12, display: "inline-block", transform: doneOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#047857" }}>已完成</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#047857", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 999, padding: "1px 8px" }}>{done.length}</span>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>{doneOpen ? "收起" : "展开"}</span>
            </button>
            {doneOpen && <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 12px 12px" }}>{done.map(card)}</div>}
          </div>
        )}
      </main>

      {form && (
        <div style={overlay} onClick={() => setForm(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{form.id ? "编辑 DO" : "新建 DO"}</h3>
            <span style={label}>标题（客户 / 项目）</span>
            <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={field} placeholder="例如：ABC Trading 太阳能板" />
            <span style={label}>DO 号</span>
            <input value={form.do_no} onChange={(e) => setForm({ ...form, do_no: e.target.value })} style={field} placeholder="可选" />
            <span style={label}>发票号</span>
            <input value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} style={field} placeholder="可选，递交发票时再填也行" />
            {me.canManage && (
              <>
                <span style={label}>负责人</span>
                <select value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })} style={field}>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}{e.role ? ` · ${e.role}` : ""}</option>)}
                </select>
              </>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
              <button onClick={() => setForm(null)} style={btnGhost}>取消</button>
              <button disabled={busy || !form.title.trim()} onClick={saveForm} style={{ ...btnPrimary, opacity: busy || !form.title.trim() ? 0.5 : 1 }}>{busy ? "保存中…" : form.id ? "保存" : "新建"}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={overlay} onClick={() => setConfirmDelete(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>确认删除</h3>
            <p style={{ fontSize: 14, color: "#64748b", margin: "10px 0 4px" }}>确定删除这张 DO 单吗？7 个步骤记录和所有附件会一起删除，不可撤销。</p>
            <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 20px", wordBreak: "break-word" }}>{confirmDelete.title}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={btnGhost}>取消</button>
              <button onClick={() => doDelete(confirmDelete)} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>删除</button>
            </div>
          </div>
        </div>
      )}

      {confirmFile && (
        <div style={overlay} onClick={() => setConfirmFile(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>删除附件</h3>
            <p style={{ fontSize: 14, color: "#64748b", margin: "10px 0 4px" }}>确定删除这个附件吗？不可撤销。</p>
            <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 20px", wordBreak: "break-word" }}>{confirmFile.name}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmFile(null)} style={btnGhost}>取消</button>
              <button onClick={() => removeFile(confirmFile)} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>删除</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", left: "50%", top: 72, transform: "translateX(-50%)", background: "#0f172a", color: "#fff", padding: "12px 22px", borderRadius: 999, fontSize: 15, fontWeight: 600, zIndex: 100, boxShadow: "0 10px 30px rgba(15,23,42,.35)" }}>✓ {toast}</div>
      )}
    </div>
  );
}
