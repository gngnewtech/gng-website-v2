import "./globals.css";
import type { ReactNode } from "react";
import SiteChrome from "./SiteChrome";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
