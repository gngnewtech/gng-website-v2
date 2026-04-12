import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="badge">DUBAI-BASED BUILDING MATERIAL SUPPLIER</div>

            <h1 className="h1">
              Reliable Building Material Supply for Project Requirements
            </h1>

            <p className="lead">
              GNG New Tech LLC supports contractors, traders, and project buyers
              across the UAE with practical supply solutions for scaffolding,
              formwork, timber beam, plywood, accessories, and related building
              material requirements.
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
                <strong>
                  Scaffolding, formwork, timber beam, plywood, accessories and
                  related building materials
                </strong>
              </div>

              <div className="hero-box">
                <div className="mini-title">CLIENTS</div>
                <strong>Contractors, traders and project buyers</strong>
              </div>

              <div className="hero-box">
                <div className="mini-title">SUPPLY SUPPORT</div>
                <strong>
                  Practical supply support for construction and project requirements
                </strong>
              </div>

              <div className="hero-box">
                <div className="mini-title">SERVICE</div>
                <strong>Responsive quotation, sourcing support and customer service</strong>
              </div>
            </div>

            <div className="hero-panel">
              <div className="mini-title">COMPANY POSITIONING</div>
              <p>
                GNG New Tech LLC is a Dubai-based building material supplier
                serving site demand, trading supply, and project-based purchasing
                requirements with a practical and professional approach.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
