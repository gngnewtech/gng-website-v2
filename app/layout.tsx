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
            
              href="https://wa.me/971586009788"
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
          <Link className="cta" href="/login">
            任务系统 / Task System
          </Link>
          <div style={{ color: "#64748b" }}>
            © 2026 GNG New Tech LLC. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
