import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="badge">BUILDING MATERIAL SUPPLIER</div>

            <h1 className="h1">
              Supply You Can Rely On
            </h1>

            <p className="lead">
              Supporting construction and project requirements across the UAE.
            </p>

            <div className="pills">
              <div className="pill">Established in 2008</div>
              <div className="pill">Dubai, United Arab Emirates</div>
              <div className="pill">TRN Verified Business</div>
            </div>

            <div className="hero-actions">
              <Link href="/contact" className="cta">
                Request Quote
              </Link>
              <Link href="/products" className="secondary-btn">
                View Products
              </Link>
            </div>
          </div>

          <div className="hero-card">
            <div className="hero-card-grid">
              <div className="hero-box">
                <div className="mini-title">PRODUCT RANGE</div>
                <strong>Building materials and project supply support</strong>
              </div>

              <div className="hero-box">
                <div className="mini-title">CLIENTS</div>
                <strong>Contractors, traders and project buyers</strong>
              </div>

              <div className="hero-box">
                <div className="mini-title">SUPPLY SUPPORT</div>
                <strong>Reliable sourcing and responsive quotation</strong>
              </div>

              <div className="hero-box">
                <div className="mini-title">SERVICE</div>
                <strong>Practical support for project requirements</strong>
              </div>
            </div>

            <div className="hero-panel">
              <div className="mini-title">COMPANY POSITIONING</div>
              <p>
                GNG New Tech LLC is a Dubai-based supplier serving building
                material demand with a practical and professional approach.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
