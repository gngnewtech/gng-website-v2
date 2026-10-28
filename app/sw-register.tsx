"use client";

import { useEffect } from "react";

// 注册 service worker，让站点满足 PWA「可安装」条件（安卓 Chrome 可独立窗口运行）
export default function SWRegister() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
