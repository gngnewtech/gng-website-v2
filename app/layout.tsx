import './globals.css';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'GNG New Tech LLC',
  description: 'Dubai-based supplier of scaffolding systems, formwork materials, timber beams, plywood, accessories, and construction support solutions.'
};

function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="GNG New Tech LLC">
          <Image src="/gng-logo-final.png" alt="GNG New Tech LLC logo" width={420} height={120} className="brand-logo" priority />
        </Link>
        <nav className="nav">
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
          <Link href="/products">Products</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <Link className="cta" href="/contact">Request Quote</Link>
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
          <div style={{ color: '#64748b', marginTop: 6 }}>International City, Dubai, UAE · sales@gngnt.com · 056 4480 245</div>
        </div>
        <div style={{ color: '#64748b' }}>© 2026 GNG New Tech LLC. All rights reserved.</div>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
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
