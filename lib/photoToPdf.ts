// 拍照 / 选图片上传前，在浏览器里自动转成 PDF。
// 一次选的所有图片合成一个 PDF（每张一页 A4，横图横向）；PDF 文件原样保留。
// 照片先缩到最长边 2000px、JPG 质量 0.85，文件小、上传快；浏览器会按 EXIF 自动摆正方向。
// 某张图片浏览器读不了（比如 Chrome 里的 HEIC）→ 这批图片不转，原样上传。

const MAX_SIDE = 2000;

const isPdfFile = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

async function photoToJpeg(file: File): Promise<{ bytes: Uint8Array; w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error("decode"));
      i.src = url;
    });
    const s = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.85));
    if (!blob) throw new Error("encode");
    return { bytes: new Uint8Array(await blob.arrayBuffer()), w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function photosToPdf(files: File[], baseName: string): Promise<File[]> {
  const imgs = files.filter((f) => !isPdfFile(f));
  if (!imgs.length) return files;
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const A4: [number, number] = [595.28, 841.89];
    const M = 24;
    for (const f of imgs) {
      const j = await photoToJpeg(f);
      const img = await doc.embedJpg(j.bytes);
      const land = j.w > j.h;
      const [pw, ph] = land ? [A4[1], A4[0]] : A4;
      const s = Math.min((pw - M * 2) / j.w, (ph - M * 2) / j.h);
      const w = j.w * s, h = j.h * s;
      doc.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    }
    const bytes = await doc.save();
    const name = `${baseName.replace(/[\\/:*?"<>|]+/g, "_").trim() || "photo"}.pdf`;
    const pdf = new File([bytes as BlobPart], name, { type: "application/pdf" });
    // 合成的 PDF 放在第一张图片原来的位置
    const first = files.indexOf(imgs[0]);
    const rest = files.filter((f) => isPdfFile(f));
    const out = [...rest];
    out.splice(files.slice(0, first).filter(isPdfFile).length, 0, pdf);
    return out;
  } catch {
    return files; // 转不了就原样上传
  }
}
