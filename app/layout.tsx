import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";

export const metadata: Metadata = {
  title: "GNG New Tech LLC",
  description: "Dubai-based supplier of scaffolding systems, formwork materials, timber beams, plywood, accessories, and project supply solutions.",
};

function Header() {
  return (
    <header className="site-header">
      <div className="container header-row">
        <Link href="/" className="brand" aria-label="GNG New Tech LLC home">
          <div className="brand-mark">
            <Image src="/gng-logo.jpg" alt="GNG logo" width={1600} height={255} />
          </div>
          <div>
            <div className="brand-title"><span>GNG</span> <span className="blue">NEW TECH LLC</span></div>
            <div className="brand-subtitle">Dubai, UAE</div>
          </div>
        </Link>

        <nav className="nav">
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
          <Link href="/products">Products</Link>
          <Link href="/contact">Contact</Link>
        </nav>

        <Link href="/contact" className="btn btn-primary">Request Quote</Link>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-row">
        <div>
          <div style={{ fontWeight: 800, letterSpacing: '-0.02em' }}>GNG NEW TECH LLC</div>
          <small>International City, Dubai, UAE · sales@gngnt.com · 056 4480 245</small>
        </div>
        <small>© 2026 GNG New Tech LLC. All rights reserved.</small>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
