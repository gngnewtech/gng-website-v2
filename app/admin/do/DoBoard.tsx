"use client";

// DO 流程：DO → DO BACK → 递交发票 → 收款 → 采购 → 入库 → 付款 → 完成
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mergeDoPdf, pickMergeFiles } from "@/lib/mergeDoPdf";
import { photosToPdf } from "@/lib/photoToPdf";

type Me = { id: string; name: string; isAdmin: boolean; canManage: boolean; canSeeAll?: boolean };
type Emp = { id: string; name: string; role: string | null };
type Order = { id: string; title: string; do_no: string | null; invoice_no: string | null; assignee_id: string; created_at: string; done_at: string | null };
type DFile = { id: string; order_id: string; path: string; name: string; mime: string | null; size: number | null; uploaded_by: string | null; uploaded_by_name: string | null; created_at: string; step_id?: string | null };
const BUCKET = "do-files";
const MAX_MB = 10;
const isImg = (f: { mime: string | null; name: string }) => (f.mime ?? "").startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(f.name);
type Step = { id: string; order_id: string; step_no: number; name: string; done_at: string | null; done_by_name: string | null; assignee_id?: string | null };

async function api(body: any) {
  const res = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({} as any));
  return { ok: res.ok, error: data?.error as string | undefined };
}

type Lang = "zh" | "en";

const T = {
  zh: {
    brand: "DO 流程", title: "DO 流程", newDo: "+ 新建 DO", board: "任务看板", myTasks: "我的任务", logout: "退出",
    hint: "DO → DO BACK → 递交发票 → 收款 → 采购 → 入库 → 付款 → 完成 · 点格子勾选，自动记录时间 · 蓝框是下一步 · 格子下方可把这一步分配给同事",
    search: "搜索 标题 / DO 号 / 发票号 / 负责人…", notFound: "没有找到", noActive: "没有进行中的 DO",
    completed: "已完成", collapse: "收起", expand: "展开",
    invoice: "发票", edit: "编辑", delete: "删除", clickToDone: "点击标记完成",
    attachments: "📎 附件", uploading: "上传中…", addFile: "+ 截图 / PDF", mergePdf: "⤓ 合并 PDF", merging: "合并中…", mergeTip: "签字 DO + 发票 合成一个 PDF 下载", mergeFail: "合并失败：", deleteFileAria: "删除附件",
    editDo: "编辑 DO", newDoTitle: "新建 DO", fTitle: "标题（客户 / 项目）", fTitlePh: "例如：ABC Trading 太阳能板",
    fDoNo: "DO 号", optional: "可选", fInvoice: "发票号", fInvoicePh: "可选，递交发票时再填也行", fAssignee: "负责人",
    cancel: "取消", saving: "保存中…", save: "保存", create: "新建",
    confirmDelete: "确认删除", deleteMsg: "确定删除这张 DO 单吗？8 个步骤记录和所有附件会一起删除，不可撤销。",
    deleteFileTitle: "删除附件", deleteFileMsg: "确定删除这个附件吗？不可撤销。",
    onlyImgPdf: "只能上传图片或 PDF：", tooBig: (mb: number) => `文件超过 ${mb}MB：`, uploadFail: "上传失败：", saveFail: "保存失败",
    uploaded: (n: number) => `已上传 ${n} 个附件`, openFail: "打开失败", noPermDelete: "无权限删除", fileDeleted: "已删除附件",
    undoStep: (name: string) => `取消「${name}」这一步？`, opFail: "操作失败", saved: "已保存", created: "已新建 DO",
    deleteFail: "删除失败", deleted: "已删除",
    assign: "+ 分配", unassign: "不分配", assigned: (n: string) => `已分配给 ${n}`, unassigned: "已取消分配", mine: "我",
  },
  en: {
    brand: "DO FLOW", title: "DO Flow", newDo: "+ New DO", board: "Task Board", myTasks: "My Tasks", logout: "Log out",
    hint: "DO → DO BACK → Submit Invoice → Payment Received → Purchase → Stock In → Payment → Done · Tap a box to check it off (time is recorded) · Blue box = next step · Use the bar under each box to assign that step to a colleague",
    search: "Search title / DO no. / invoice no. / assignee…", notFound: "No results", noActive: "No DOs in progress",
    completed: "Completed", collapse: "Hide", expand: "Show",
    invoice: "Invoice", edit: "Edit", delete: "Delete", clickToDone: "Tap to mark done",
    attachments: "📎 Attachments", uploading: "Uploading…", addFile: "+ Photo / PDF", mergePdf: "⤓ Merge PDF", merging: "Merging…", mergeTip: "Signed DO + invoice as one PDF", mergeFail: "Merge failed: ", deleteFileAria: "Delete attachment",
    editDo: "Edit DO", newDoTitle: "New DO", fTitle: "Title (customer / project)", fTitlePh: "e.g. ABC Trading solar panels",
    fDoNo: "DO No.", optional: "Optional", fInvoice: "Invoice No.", fInvoicePh: "Optional — can be filled in when submitting the invoice", fAssignee: "Assignee",
    cancel: "Cancel", saving: "Saving…", save: "Save", create: "Create",
    confirmDelete: "Confirm delete", deleteMsg: "Delete this DO? All 8 step records and attachments will be deleted too. This cannot be undone.",
    deleteFileTitle: "Delete attachment", deleteFileMsg: "Delete this attachment? This cannot be undone.",
    onlyImgPdf: "Only images or PDF allowed: ", tooBig: (mb: number) => `File larger than ${mb}MB: `, uploadFail: "Upload failed: ", saveFail: "Save failed",
    uploaded: (n: number) => `Uploaded ${n} attachment${n > 1 ? "s" : ""}`, openFail: "Could not open file", noPermDelete: "No permission to delete", fileDeleted: "Attachment deleted",
    undoStep: (name: string) => `Uncheck "${name}"?`, opFail: "Action failed", saved: "Saved", created: "DO created",
    deleteFail: "Delete failed", deleted: "Deleted",
    assign: "+ Assign", unassign: "Unassigned", assigned: (n: string) => `Assigned to ${n}`, unassigned: "Unassigned", mine: "Me",
  },
};

// 步骤名存在数据库里是中文，英文界面按名称翻译
const STEP_EN: Record<string, string> = {
  "DO": "DO", "DO BACK": "DO BACK", "递交发票": "Submit Invoice", "收款": "Payment Received",
  "采购": "Purchase", "入库": "Stock In", "付款": "Payment", "完成": "Done",
};
const stepName = (name: string, lang: Lang) => (lang === "en" ? STEP_EN[name] ?? name : name);

// 后端返回的常见中文错误，英文界面下翻译
const ERR_EN: Record<string, string> = {
  "未登录": "Not logged in", "缺少标题": "Title is required", "缺少参数": "Missing parameter",
  "标题不能为空": "Title cannot be empty", "无权限": "No permission", "无权限删除": "No permission to delete", "未知操作": "Unknown action",
};
const errText = (e: string | undefined, lang: Lang) => (e && lang === "en" ? ERR_EN[e] ?? e : e);

function fmt(iso: string | null, lang: Lang = "zh") {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  if (lang === "en") return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
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
// DO 单号里的日期：DO-EL-HAOHU-261125-1 → 261125（2026-11-25），末尾 -1/-2 是当天序号
// 排序键 "261125|0001|创建时间"；单号里没日期就用创建日期
const doSortKey = (o: { title: string; do_no: string | null; created_at: string }) => {
  const src = `${o.do_no ?? ""} ${o.title}`;
  const m = src.match(/(?:^|\D)(\d{2})(\d{2})(\d{2})(?:-(\d+))?(?!\d)/);
  const okDate = m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31;
  const c = new Date(o.created_at);
  const ymd = okDate ? `${m![1]}${m![2]}${m![3]}`
    : `${String(c.getFullYear() % 100).padStart(2, "0")}${String(c.getMonth() + 1).padStart(2, "0")}${String(c.getDate()).padStart(2, "0")}`;
  const seq = okDate && m![4] ? m![4].padStart(4, "0") : "0000";
  return `${ymd}|${seq}|${o.created_at}`;
};
// 新日期在上；同一天序号大的在上
const byDoDate = (a: { title: string; do_no: string | null; created_at: string }, b: { title: string; do_no: string | null; created_at: string }) => doSortKey(b).localeCompare(doSortKey(a));
const actBtn = (color = "#334155", border = "#cbd5e1"): React.CSSProperties => ({ fontSize: 13, padding: "4px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "#fff", color, cursor: "pointer", whiteSpace: "nowrap", flex: "none" });
const field: React.CSSProperties = { width: "100%", padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none" };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 };
const modal: React.CSSProperties = { width: "100%", maxWidth: 420, background: "#fff", borderRadius: 14, padding: 24 };
const label: React.CSSProperties = { fontSize: 13, color: "#64748b", margin: "14px 0 6px", display: "block" };
const numChip = (has: boolean): React.CSSProperties => ({ fontSize: 12, padding: "2px 9px", borderRadius: 999, whiteSpace: "nowrap", flex: "none", border: `1px solid ${has ? "#bfdbfe" : "#e2e8f0"}`, background: has ? "#eff6ff" : "#fff", color: has ? "#1d4ed8" : "#94a3b8" });

export default function DoBoard({ me, email, employees, orders: ordersProp, steps: stepsProp, files: filesProp = [] }: { me: Me; email: string; employees: Emp[]; orders: Order[]; steps: Step[]; files?: DFile[] }) {
  const router = useRouter();
  const sb = useMemo(() => createClient(), []);
  // 语言：跟登录时选的一致（localStorage gng_lang），没选过就跟浏览器语言
  const [lang, setLang] = useState<Lang>("zh");
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("gng_lang"); } catch {}
    if (saved === "zh" || saved === "en") { setLang(saved); return; }
    const l = (navigator.language || "zh").toLowerCase();
    setLang(l.startsWith("zh") ? "zh" : "en");
  }, []);
  const t = T[lang];
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
    const raw = Array.from(list);
    const bad = raw.find((f) => !(f.type.startsWith("image/") || f.type === "application/pdf" || /\.(pdf|png|jpe?g|webp|gif|heic|heif)$/i.test(f.name)));
    if (bad) { showToast(`${t.onlyImgPdf}${bad.name}`); return; }
    setUploading(o.id);
    // 照片自动转成 PDF（一次选的几张合成一个），文件名用 DO 号
    const picked = await photosToPdf(raw, o.do_no || o.title);
    const big = picked.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (big) { setUploading(null); showToast(`${t.tooBig(MAX_MB)}${big.name}`); return; }
    let okCount = 0;
    for (const f of picked) {
      const ext = (f.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? (f.type === "application/pdf" ? "pdf" : "png")).toLowerCase();
      const path = `${o.id}/${crypto.randomUUID()}.${ext}`;
      const mime = f.type || (ext === "pdf" ? "application/pdf" : `image/${ext === "jpg" ? "jpeg" : ext}`);
      const up = await sb.storage.from(BUCKET).upload(path, f, { contentType: mime, upsert: false });
      if (up.error) { showToast(`${t.uploadFail}${up.error.message}`); continue; }
      const { data, error } = await sb.from("do_files")
        .insert({ order_id: o.id, path, name: f.name, mime, size: f.size })
        .select("id, order_id, path, name, mime, size, uploaded_by, uploaded_by_name, created_at")
        .single();
      if (error || !data) { await sb.storage.from(BUCKET).remove([path]); showToast(`${t.saveFail}: ${error?.message ?? ""}`); continue; }
      setFiles((prev) => [...prev, data as DFile]);
      okCount++;
    }
    setUploading(null);
    if (okCount) showToast(t.uploaded(okCount));
  };

  // 签字 DO + 发票 合成一个 PDF
  const [merging, setMerging] = useState<string | null>(null);
  const mergeOrder = async (o: Order) => {
    const list = pickMergeFiles(o.id, files, stepsOf[o.id] ?? []);
    if (!list.length) return;
    setMerging(o.id);
    try { await mergeDoPdf(sb, list, o.do_no || o.title); }
    catch (e: any) { showToast(`${t.mergeFail}${e?.message ?? ""}`); }
    finally { setMerging(null); }
  };

  const openFile = async (f: DFile) => {
    const w = window.open("", "_blank"); // 先同步开窗口，避免手机浏览器拦截
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(f.path, 600);
    if (error || !data?.signedUrl) { w?.close(); showToast(t.openFail); return; }
    if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  };

  const removeFile = async (f: DFile) => {
    setConfirmFile(null);
    const { data, error } = await sb.from("do_files").delete().eq("id", f.id).select("id");
    if (error || !data?.length) { showToast(error?.message || t.noPermDelete); return; }
    await sb.storage.from(BUCKET).remove([f.path]);
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
    showToast(t.fileDeleted);
  };

  const q = query.trim().toLowerCase();
  const visible = orders.filter((o) => !q || [o.title, o.do_no, o.invoice_no, empName[o.assignee_id]].some((v) => (v ?? "").toLowerCase().includes(q)));
  // 已完成：7 步全勾，或最后一步「完成」已勾 → 跟已完成任务一样收到最下面
  const finishStep = (o: Order) => (stepsOf[o.id] ?? []).find((s) => s.name === "完成");
  // 「完成」这一格不再显示：前面 7 步全部完成就算完成（以前手动勾过「完成」的单子也算）
  const isDone = (o: Order) => { const l = (stepsOf[o.id] ?? []).filter((s) => s.name !== "完成"); return l.length > 0 && (l.every((s) => s.done_at) || !!finishStep(o)?.done_at); };
  const active = visible.filter((o) => !isDone(o)).sort(byDoDate);
  const done = visible.filter(isDone).sort(byDoDate);

  const toggle = async (s: Step) => {
    const next = !s.done_at;
    if (!next && !confirm(t.undoStep(stepName(s.name, lang)))) return;
    const backup = steps;
    setSteps((prev) => prev.map((x) => (x.id === s.id ? { ...x, done_at: next ? new Date().toISOString() : null, done_by_name: next ? me.name : null } : x)));
    const r = await api({ action: "toggleStep", step_id: s.id, done: next });
    if (!r.ok) { setSteps(backup); showToast(errText(r.error, lang) || t.opFail); return; }
    router.refresh();
  };

  // 分配某一步的负责人：所有能看到这张 DO 的员工都可以分配
  const assignStep = async (s: Step, toId: string) => {
    const backup = steps;
    setSteps((prev) => prev.map((x) => (x.id === s.id ? { ...x, assignee_id: toId || null } : x)));
    const r = await api({ action: "assignStep", step_id: s.id, to_assignee_id: toId || null });
    if (!r.ok) { setSteps(backup); showToast(errText(r.error, lang) || t.opFail); return; }
    showToast(toId ? t.assigned(empName[toId] ?? "") : t.unassigned);
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
    if (!r.ok) { showToast(errText(r.error, lang) || t.saveFail); return; }
    showToast(form.id ? t.saved : t.created);
    setForm(null);
    router.refresh();
  };
  const doDelete = async (o: Order) => {
    setConfirmDelete(null);
    const r = await api({ action: "delete", order_id: o.id });
    if (!r.ok) { showToast(errText(r.error, lang) || t.deleteFail); return; }
    setOrders((prev) => prev.filter((x) => x.id !== o.id));
    showToast(t.deleted);
    router.refresh();
  };
  const logout = async () => { await fetch("/api/logout", { method: "POST" }); router.push("/login"); router.refresh(); };

  const card = (o: Order) => {
    const l = (stepsOf[o.id] ?? []).filter((s) => s.name !== "完成"); // 不显示「完成」格子
    const n = l.filter((s) => s.done_at).length;
    const nextId = l.find((s) => !s.done_at)?.id;
    const finished = isDone(o);
    const canAssign = true; // 所有员工都能把步骤分配给别人（能看到这张 DO 就能分配）
    return (
      <div key={o.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: finished ? "#94a3b8" : "#0f172a", textDecoration: finished ? "line-through" : "none", wordBreak: "break-word", minWidth: 0 }}>{o.title}</span>
          <span style={numChip(!!o.do_no)}>DO {o.do_no || "—"}</span>
          <span style={numChip(!!o.invoice_no)}>{t.invoice} {o.invoice_no || "—"}</span>
          <span style={{ fontSize: 12, color: "#475569", background: "#f1f5f9", borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap", flex: "none" }}>👤 {empName[o.assignee_id] ?? "?"}</span>
          <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 600, color: finished ? "#047857" : "#475569", flex: "none" }}>{n}/{l.length || 7}</span>
          <button onClick={() => openEdit(o)} style={actBtn()}>{t.edit}</button>
          {me.canManage && <button onClick={() => setConfirmDelete(o)} style={actBtn("#dc2626", "#fecaca")}>{t.delete}</button>}
        </div>
        <div className="do-steps">
          {l.map((s) => {
            const on = !!s.done_at;
            const isNext = s.id === nextId;
            const who = s.assignee_id ?? "";
            const isMe = who === me.id;
            return (
              <div key={s.id} style={{ display: "flex", flexDirection: "column", borderRadius: 8, overflow: "hidden", minWidth: 0,
                border: `1px solid ${on ? "#a7f3d0" : isNext ? "#2563eb" : "#e2e8f0"}`, background: on ? "#ecfdf5" : "#fff" }}>
              <button onClick={() => toggle(s)} title={on ? `${s.done_by_name ?? ""} ${fmt(s.done_at, lang)}` : t.clickToDone}
                style={{ textAlign: "left", padding: "8px 8px", cursor: "pointer", minHeight: 58, display: "flex", flexDirection: "column", gap: 3, flex: 1,
                  border: "none", background: "transparent" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: on ? "#047857" : isNext ? "#1d4ed8" : "#64748b" }}>
                  <span style={{ width: 15, height: 15, borderRadius: 4, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff",
                    background: on ? "#10b981" : "#fff", border: `1.5px solid ${on ? "#10b981" : isNext ? "#2563eb" : "#cbd5e1"}` }}>{on ? "✓" : ""}</span>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stepName(s.name, lang)}</span>
                </span>
                {on && <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1.3 }}>{fmt(s.done_at, lang)}</span>}
                {on && s.done_by_name && <span style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.3 }}>{s.done_by_name}</span>}
              </button>
              {canAssign ? (
                <select value={who} onChange={(e) => assignStep(s, e.target.value)}
                  style={{ width: "100%", fontSize: 11, padding: "4px 4px", border: "none", borderTop: "1px dashed #e2e8f0", fontFamily: "inherit", outline: "none", cursor: "pointer",
                    background: who ? (isMe ? "#fffbeb" : "#eff6ff") : "transparent", color: who ? (isMe ? "#b45309" : "#1d4ed8") : "#94a3b8" }}>
                  <option value="">{who ? t.unassign : t.assign}</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>👤 {e.id === me.id ? t.mine : e.name}</option>)}
                </select>
              ) : who ? (
                <span style={{ fontSize: 11, padding: "4px 6px", borderTop: "1px dashed #e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  background: isMe ? "#fffbeb" : "#eff6ff", color: isMe ? "#b45309" : "#1d4ed8" }}>👤 {isMe ? t.mine : empName[who] ?? "?"}</span>
              ) : null}
              </div>
            );
          })}
        </div>
        {(() => {
          const fl = filesOf[o.id] ?? [];
          const busyUp = uploading === o.id;
          return (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: fl.length ? 8 : 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{t.attachments}</span>
                {fl.length > 0 && <span style={{ fontSize: 12, color: "#64748b" }}>{fl.length}</span>}
                {fl.length > 0 && (
                  <button onClick={() => mergeOrder(o)} disabled={merging === o.id} title={t.mergeTip}
                    style={{ ...actBtn(), marginLeft: "auto", opacity: merging === o.id ? 0.5 : 1, cursor: merging === o.id ? "default" : "pointer" }}>
                    {merging === o.id ? t.merging : t.mergePdf}
                  </button>
                )}
                <label style={{ ...actBtn(), marginLeft: fl.length > 0 ? 0 : "auto", opacity: busyUp ? 0.5 : 1, cursor: busyUp ? "default" : "pointer" }}>
                  {busyUp ? t.uploading : t.addFile}
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
                        title={`${f.name}\n${f.uploaded_by_name ?? ""} ${fmt(f.created_at, lang)}`}>
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
                        {canDel && <button className="x" aria-label={t.deleteFileAria} onClick={(e) => { e.stopPropagation(); setConfirmFile(f); }}>×</button>}
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
          <span style={{ color: "#fbbf24", fontFamily: "ui-monospace,monospace", letterSpacing: ".16em", fontSize: 13, whiteSpace: "nowrap" }}>● {t.brand}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 14 }}>
            <a href={me.canManage ? "/admin" : "/employee"} style={{ color: "#cbd5e1", textDecoration: "none", whiteSpace: "nowrap" }}>{me.canManage ? t.board : t.myTasks}</a>
            <span className="do-email" style={{ color: "#cbd5e1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>{email}</span>
            <button onClick={logout} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" }}>{t.logout}</button>
          </div>
        </div>
      </header>

      <main className="do-main" style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, flex: 1 }}>{t.title}</h2>
          <button onClick={openNew} style={btnPrimary}>{t.newDo}</button>
        </div>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 14px" }}>{t.hint}</p>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} style={{ ...field, marginBottom: 16, background: "#fff" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {active.length === 0
            ? <div style={{ textAlign: "center", color: "#94a3b8", padding: 32, background: "#fff", border: "1px dashed #e2e8f0", borderRadius: 12 }}>{q ? t.notFound : t.noActive}</div>
            : active.map(card)}
        </div>

        {done.length > 0 && (
          <div style={{ marginTop: 20, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
            <button onClick={() => setDoneOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontSize: 12, color: "#64748b", width: 12, display: "inline-block", transform: doneOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#047857" }}>{t.completed}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#047857", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 999, padding: "1px 8px" }}>{done.length}</span>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>{doneOpen ? t.collapse : t.expand}</span>
            </button>
            {doneOpen && <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 12px 12px" }}>{done.map(card)}</div>}
          </div>
        )}
      </main>

      {form && (
        <div style={overlay} onClick={() => setForm(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{form.id ? t.editDo : t.newDoTitle}</h3>
            <span style={label}>{t.fTitle}</span>
            <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={field} placeholder={t.fTitlePh} />
            <span style={label}>{t.fDoNo}</span>
            <input value={form.do_no} onChange={(e) => setForm({ ...form, do_no: e.target.value })} style={field} placeholder={t.optional} />
            <span style={label}>{t.fInvoice}</span>
            <input value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} style={field} placeholder={t.fInvoicePh} />
            {me.canManage && (
              <>
                <span style={label}>{t.fAssignee}</span>
                <select value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })} style={field}>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}{e.role ? ` · ${e.role}` : ""}</option>)}
                </select>
              </>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
              <button onClick={() => setForm(null)} style={btnGhost}>{t.cancel}</button>
              <button disabled={busy || !form.title.trim()} onClick={saveForm} style={{ ...btnPrimary, opacity: busy || !form.title.trim() ? 0.5 : 1 }}>{busy ? t.saving : form.id ? t.save : t.create}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={overlay} onClick={() => setConfirmDelete(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t.confirmDelete}</h3>
            <p style={{ fontSize: 14, color: "#64748b", margin: "10px 0 4px" }}>{t.deleteMsg}</p>
            <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 20px", wordBreak: "break-word" }}>{confirmDelete.title}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={btnGhost}>{t.cancel}</button>
              <button onClick={() => doDelete(confirmDelete)} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>{t.delete}</button>
            </div>
          </div>
        </div>
      )}

      {confirmFile && (
        <div style={overlay} onClick={() => setConfirmFile(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t.deleteFileTitle}</h3>
            <p style={{ fontSize: 14, color: "#64748b", margin: "10px 0 4px" }}>{t.deleteFileMsg}</p>
            <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 20px", wordBreak: "break-word" }}>{confirmFile.name}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmFile(null)} style={btnGhost}>{t.cancel}</button>
              <button onClick={() => removeFile(confirmFile)} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>{t.delete}</button>
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
