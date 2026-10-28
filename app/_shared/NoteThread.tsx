"use client";

// 任务「跟进」多条记录：列表 + 新增 + 删除（后台和员工页共用）
import React, { useState } from "react";

export type TaskNote = {
  id: string;
  task_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
};

export type NoteLabels = {
  placeholder: string;
  add: string;
  adding: string;
  cancel: string;
  delete: string;
  confirmDelete: string;
  unknownAuthor: string;
};

function fmtTime(iso: string, lang: "zh" | "en") {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return lang === "zh"
    ? `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`
    : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function NoteThread({
  notes, editing, onCloseEditor, onAdd, onDelete, canDelete, labels, lang = "zh", padLeft = 88, className,
}: {
  notes: TaskNote[];
  editing: boolean;
  onCloseEditor: () => void;
  onAdd: (body: string) => Promise<boolean>;
  onDelete: (note: TaskNote) => void;
  canDelete: (note: TaskNote) => boolean;
  labels: NoteLabels;
  lang?: "zh" | "en";
  padLeft?: number | string;
  className?: string; // 传了就用该 class 控制内边距（员工页 .emp-note 自带手机适配）
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  if (notes.length === 0 && !editing) return null;

  const submit = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    const ok = await onAdd(body);
    setBusy(false);
    if (ok) setDraft("");
  };

  return (
    <div className={className} style={{ ...(className ? {} : { padding: `0 16px 12px ${typeof padLeft === "number" ? padLeft + "px" : padLeft}` }), display: "flex", flexDirection: "column", gap: 6 }}>
      {notes.map((n) => (
        <div key={n.id} style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#475569" }}>📝 {n.body}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#94a3b8", marginTop: 2, paddingLeft: 20 }}>
            <span>{n.author_name || labels.unknownAuthor} · {fmtTime(n.created_at, lang)}</span>
            {canDelete(n) && (
              <button
                onClick={() => { if (confirm(labels.confirmDelete)) onDelete(n); }}
                style={{ background: "none", border: "none", padding: 0, color: "#dc2626", fontSize: 11, cursor: "pointer" }}
              >{labels.delete}</button>
            )}
          </div>
        </div>
      ))}

      {editing && (
        <div style={{ marginTop: notes.length ? 6 : 0 }}>
          <textarea
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
            rows={2}
            placeholder={labels.placeholder}
            style={{ width: "100%", padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={submit} disabled={!draft.trim() || busy}
              style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer", opacity: !draft.trim() || busy ? 0.5 : 1 }}>
              {busy ? labels.adding : labels.add}
            </button>
            <button onClick={() => { setDraft(""); onCloseEditor(); }}
              style={{ background: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>
              {labels.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
