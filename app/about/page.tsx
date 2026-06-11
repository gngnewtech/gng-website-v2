import Link from "next/link";

const values = [
  {
    title: "Client Value Creation",
    desc: "We focus on practical sourcing, competitive pricing, and reliable support that create value for our clients.",
  },
  {
    title: "Trustworthiness & Transparency",
    desc: "We believe honest communication and dependable cooperation are essential to long-term business relationships.",
  },
  {
    title: "Integrity",
    desc: "We work with professionalism, ethical business practice, and respect for rules, standards, and commitments.",
  },
  {
    title: "Innovation",
    desc: "We respond to project needs with practical thinking and flexible supply solutions.",
  },
];

const sectors = [
  "Building Materials",
  "Scaffolding & Formwork Supply",
  "Industrial Products",
  "Electro-Mechanical Equipment",
  "Project Supply Support",
  "General Trading",
];

export default function AboutPage() {
  return (
    <main>
      <section className="section">
        <div className="container">
          <div className="section-heading">
            <div className="badge">ABOUT GNG</div>
            <h1>Practical Supply Support Backed by Experience</h1>
            <p className="section-lead">
              GNG New Tech LLC is a Dubai-based general trading company established
              in 2008, supporting contractors, traders, and project buyers with
              reliable sourcing, practical supply coordination, and responsive
              service.
            </p>
          </div>

          <div className="two-col">
            <div className="info-card">
              <div className="mini-title">COMPANY OVERVIEW</div>
              <h2>Who we are</h2>
              <p>
                Founded in Dubai in 2008, GNG New Tech LLC has developed as a
                practical trading and supply company serving business needs across
                the UAE. We support client requirements with reliable supply
                channels, responsive quotation handling, and a professional
                approach to sourcing and coordination.
              </p>
              <p>
                Our scope includes building materials, industrial products,
                electro-mechanical equipment, and project-related supply support,
                with a strong focus on dependable service and long-term business
                cooperation.
              </p>
            </div>

            <div className="info-card">
              <div className="mini-title">BUSINESS SCOPE</div>
              <h2>What we support</h2>
              <ul className="simple-list">
                {sectors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container">
          <div className="section-heading">
            <div className="mini-title">VISION & VALUES</div>
            <h2>How we work</h2>
          </div>

          <div className="product-grid">
            {values.map((value) => (
              <article key={value.title} className="info-card">
                <h3>{value.title}</h3>
                <p>{value.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container cta-panel">
          <div>
            <div className="mini-title">WORK WITH GNG</div>
            <h2>Need supply support for your project?</h2>
            <p>
              Contact GNG New Tech LLC for quotation requests, sourcing support,
              and project-based supply coordination across the UAE.
            </p>
          </div>

          <div className="cta-actions">
            <Link href="/contact" className="cta">
              Request Quote
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
