import type { MetadataRoute } from "next";

// PWA 清单：决定装到手机后的名字、图标、启动方式
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GNG 任务系统",
    short_name: "GNG任务",
    description: "GNG New Tech 内部任务管理系统",
    start_url: "/login",
    scope: "/",
    display: "standalone", // 独立窗口打开，无浏览器地址栏，像原生 App
    orientation: "portrait",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    lang: "zh",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
