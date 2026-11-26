// 把一张 DO 单的「签字 DO」（DO BACK 那一步的附件）和「发票」（递交发票 那一步的附件）合成一个 PDF 并下载。
// 全部在浏览器里做：从私有桶下载文件 → pdf-lib 拼接 → 触发下载。图片每张一页（A4，按比例缩放居中）。

type MFile = { id: string; order_id: string; path: string; name: string; mime: string | null; created_at: string; step_id?: string | null };
type MStep = { id: string; step_no: number; name: string };

const BUCKET = "do-files";
const SIGNED_STEPS = ["DO BACK"]; // 签字 DO
const INVOICE_STEPS = ["递交发票"]; // 发票

const isPdf = (f: MFile) => f.mime === "application/pdf" || /\.pdf$/i.test(f.name);

// 选要合并的文件：先发票（TI），再签字 DO（DO BACK）；这两步都没附件时，退回到这张单的全部附件（按步骤顺序）
export function pickMergeFiles(orderId: string, files: MFile[], steps: MStep[]): MFile[] {
  const mine = files.filter((f) => f.order_id === orderId);
  const byName = (names: string[]) => {
    const ids = new Set(steps.filter((s) => names.includes(s.name)).map((s) => s.id));
    return mine.filter((f) => f.step_id && ids.has(f.step_id)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  };
  const picked = [...byName(INVOICE_STEPS), ...byName(SIGNED_STEPS)];
  if (picked.length) return picked;
  const stepNo: Record<string, number> = Object.fromEntries(steps.map((s) => [s.id, s.step_no]));
  const no = (f: MFile) => (f.step_id && stepNo[f.step_id] != null ? stepNo[f.step_id] : 99);
  return [...mine].sort((a, b) => no(a) - no(b) || a.created_at.localeCompare(b.created_at));
}

// 非 JPG/PNG 的图片（WEBP/GIF/HEIC…）先用浏览器画到 canvas 转成 JPG
async function toJpeg(blob: Blob): Promise<Uint8Array> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error("decode"));
      i.src = url;
    });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    const out = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.92));
    if (!out) throw new Error("encode");
    return new Uint8Array(await out.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

// 返回下载的文件名；有文件处理失败会抛错（错误信息里带文件名）
export async function mergeDoPdf(sb: any, files: MFile[], baseName: string): Promise<string> {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  const A4: [number, number] = [595.28, 841.89];
  const M = 24; // 页边距

  for (const f of files) {
    const { data, error } = await sb.storage.from(BUCKET).download(f.path);
    if (error || !data) throw new Error(`${f.name}: ${error?.message ?? "download failed"}`);
    const blob = data as Blob;
    try {
      if (isPdf(f)) {
        const src = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
        continue;
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const type = (f.mime ?? blob.type ?? "").toLowerCase();
      const isPng = type === "image/png" || /\.png$/i.test(f.name);
      const isJpg = type === "image/jpeg" || /\.jpe?g$/i.test(f.name);
      const img = isPng ? await out.embedPng(bytes)
        : isJpg ? await out.embedJpg(bytes)
        : await out.embedJpg(await toJpeg(blob));
      // 横图用横向 A4
      const land = img.width > img.height;
      const [pw, ph] = land ? [A4[1], A4[0]] : A4;
      const s = Math.min((pw - M * 2) / img.width, (ph - M * 2) / img.height, 1.5);
      const w = img.width * s, h = img.height * s;
      const page = out.addPage([pw, ph]);
      page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    } catch (e: any) {
      throw new Error(`${f.name}: ${e?.message === "decode" ? "无法读取这张图片 / cannot read image" : e?.message ?? "error"}`);
    }
  }

  const pdf = await out.save();
  // 文件名：DO-EL-HAOHU-261125-1 → TI-EL-HAOHU-261125-1 WITH DO.pdf
  const clean = baseName.replace(/[\\/:*?"<>|]+/g, "_").trim() || "DO";
  const name = `${clean.replace(/^DO(?=[-_ ])/i, "TI")} WITH DO.pdf`;
  const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return name;
}
