import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";

function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <Link href="/" className="brand">
          <img
            src="/gng-logo-final.png"
            alt="GNG New Tech LLC"
            className="brand-logo"
          />
        </Link>

        <nav className="nav">
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
          <Link href="/products">Products</Link>
          <Link href="/contact">Contact</Link>
        </nav>

        <Link className="cta" href="/contact">
          Request Quote
        </Link>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <div style={{ fontWeight: 700 }}>GNG NEW TECH LLC</div>
          <p>
            International City, Dubai, UAE ·{" "}
            <a href="mailto:sales@gngnt.com">sales@gngnt.com</a> ·{" "}
            <a href="tel:+971586009788">Call</a> ·{" "}
            <a
              href="https://wa.me/971586009788"
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          </p>
        </div>

        <div style={{ color: "#64748b" }}>
          © 2026 GNG New Tech LLC. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
